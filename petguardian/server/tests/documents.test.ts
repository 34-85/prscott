import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import request from 'supertest';
import { app, auth, registerUser, resetDb } from './helpers.js';
import { closePool } from '../src/db/pool.js';

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await closePool();
});

/** Decode visible text from a pdfkit PDF (hex strings in TJ arrays + literals). */
function pdfText(buf: Buffer): string {
  let out = '';
  let i = 0;
  const sTok = Buffer.from('stream');
  const eTok = Buffer.from('endstream');
  while (true) {
    const s = buf.indexOf(sTok, i);
    if (s < 0) break;
    let p = s + sTok.length;
    if (buf[p] === 0x0d) p++;
    if (buf[p] === 0x0a) p++;
    const e = buf.indexOf(eTok, p);
    if (e < 0) break;
    let end = e;
    if (buf[end - 1] === 0x0a) end--;
    if (buf[end - 1] === 0x0d) end--;
    try {
      const inflated = zlib.inflateSync(buf.subarray(p, end)).toString('latin1');
      inflated.replace(/<([0-9A-Fa-f\s]+)>/g, (_m, h: string) => {
        const hex = h.replace(/\s/g, '');
        for (let j = 0; j + 1 < hex.length; j += 2) {
          const c = parseInt(hex.substr(j, 2), 16);
          if (c >= 32 && c < 127) out += String.fromCharCode(c);
        }
        return _m;
      });
    } catch {
      /* not a text stream */
    }
    i = e + eTok.length;
  }
  return out;
}

function fetchPdf(planId: string, type: string, token: string) {
  return request(app)
    .get(`/api/plans/${planId}/documents/${type}`)
    .set(auth(token))
    .buffer(true)
    .parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
}

async function seededPlan(token: string) {
  const plan = (await request(app).post('/api/plans').set(auth(token)).send({ name: 'P', state: 'GA' })).body.plan;
  await request(app).put(`/api/plans/${plan.id}`).set(auth(token)).send({
    settlorFullName: 'Jane Doe',
    settlorPhone: '555-0100',
    settlorEmail: 'jane@example.com',
    remainderBeneficiary: 'ASPCA',
  });
  await request(app).post(`/api/plans/${plan.id}/pets`).set(auth(token)).send({
    name: 'Rex', species: 'Dog', microchip: '985112', medications: 'Insulin 2u BID',
    allergies: 'Chicken', emergencyVetName: 'MedVet', emergencyVetPhone: '555-0199',
  });
  await request(app).post(`/api/plans/${plan.id}/caregivers`).set(auth(token)).send({ role: 'PRIMARY', fullName: 'Amy', phone: '555-1000' });
  await request(app).post(`/api/plans/${plan.id}/caregivers`).set(auth(token)).send({ role: 'ALTERNATE', fullName: 'Ben', phone: '555-2000' });
  await request(app).post(`/api/plans/${plan.id}/trustees`).set(auth(token)).send({ role: 'TRUSTEE', fullName: 'Tom' });
  await request(app).post(`/api/plans/${plan.id}/funding`).set(auth(token)).send({ type: 'LIFE_INSURANCE', amount: 20000 });
  return plan;
}

describe('documents', () => {
  it('lists the available documents', async () => {
    const { token } = await registerUser();
    const plan = await seededPlan(token);
    const res = await request(app).get(`/api/plans/${plan.id}/documents`).set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.documents.map((d: { type: string }) => d.type)).toEqual([
      'trust-directive',
      'care-memorandum',
      'emergency-card',
    ]);
  });

  it.each(['trust-directive', 'care-memorandum', 'emergency-card'])(
    'generates a valid PDF for %s',
    async (type) => {
      const { token } = await registerUser();
      const plan = await seededPlan(token);
      const res = await fetchPdf(plan.id, type, token);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('application/pdf');
      const body = res.body as Buffer;
      expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
      expect(body.length).toBeGreaterThan(500);
    },
  );

  // Section headings are rendered uppercase in the PDF, so match case-insensitively.
  const has = (text: string, needle: string) => text.toLowerCase().includes(needle.toLowerCase());

  it('trust directive contains the legal scaffold and state statute', async () => {
    const { token } = await registerUser();
    const plan = await seededPlan(token);
    const text = pdfText((await fetchPdf(plan.id, 'trust-directive', token)).body as Buffer);
    expect(has(text, 'Animal Care Trust Directive')).toBe(true);
    expect(has(text, 'Jane Doe')).toBe(true);
    expect(has(text, '53-12-28')).toBe(true); // Georgia statute
    expect(has(text, 'Schedule A')).toBe(true); // covered animals schedule
    expect(has(text, 'notary')).toBe(true); // execution block
    expect(has(text, 'not legal advice')).toBe(true);
  });

  it('care memorandum includes the First 72 hours guidance and pet detail', async () => {
    const { token } = await registerUser();
    const plan = await seededPlan(token);
    const text = pdfText((await fetchPdf(plan.id, 'care-memorandum', token)).body as Buffer);
    expect(has(text, 'First 72 hours')).toBe(true);
    expect(has(text, 'Rex')).toBe(true);
    expect(has(text, 'Insulin')).toBe(true); // medication
    expect(has(text, '555-0100')).toBe(true); // owner phone
  });

  it('emergency card is populated with owner + caregiver data', async () => {
    const { token } = await registerUser();
    const plan = await seededPlan(token);
    const text = pdfText((await fetchPdf(plan.id, 'emergency-card', token)).body as Buffer);
    expect(has(text, 'IN CASE OF EMERGENCY')).toBe(true);
    expect(has(text, 'Jane Doe')).toBe(true);
    expect(has(text, '555-1000')).toBe(true); // caregiver phone
    expect(has(text, '985112')).toBe(true); // microchip
    expect(has(text, 'first responders')).toBe(true);
  });

  it('emergency card is never blank — renders fillable blanks and a checklist for an empty plan', async () => {
    const { token } = await registerUser();
    const empty = (await request(app).post('/api/plans').set(auth(token)).send({ name: 'Empty', state: 'GA' })).body.plan;
    const res = await fetchPdf(empty.id, 'emergency-card', token);
    expect(res.status).toBe(200);
    const buf = res.body as Buffer;
    expect(buf.length).toBeGreaterThan(800);
    const text = pdfText(buf);
    expect(has(text, 'IN CASE OF EMERGENCY')).toBe(true);
    expect(text).toContain('____'); // fillable blank lines present
    expect(has(text, 'To finish this document')).toBe(true); // completion checklist
  });

  /** Decode each page's own content-stream text by mapping Page objects to their /Contents. */
  function pageTextLengths(buf: Buffer): number[] {
    const s = buf.toString('latin1');
    const objText: Record<string, string> = {};
    const objRe = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g;
    let m: RegExpExecArray | null;
    while ((m = objRe.exec(s))) {
      const body = m[2];
      const sm = body.indexOf('stream');
      if (sm < 0) continue;
      let p = sm + 6;
      if (body[p] === '\r') p++;
      if (body[p] === '\n') p++;
      const e = body.indexOf('endstream', p);
      try {
        const inf = zlib.inflateSync(Buffer.from(body.slice(p, e), 'latin1')).toString('latin1');
        let txt = '';
        inf.replace(/<([0-9A-Fa-f\s]+)>/g, (_mm, h: string) => {
          const hex = h.replace(/\s/g, '');
          for (let j = 0; j + 1 < hex.length; j += 2) {
            const c = parseInt(hex.substr(j, 2), 16);
            if (c >= 32 && c < 127) txt += String.fromCharCode(c);
          }
          return _mm;
        });
        objText[m[1]] = txt;
      } catch {
        /* binary stream (font) */
      }
    }
    const lengths: number[] = [];
    const pageRe = /\/Type\s*\/Page(?![s])([\s\S]*?)>>/g;
    let pm: RegExpExecArray | null;
    while ((pm = pageRe.exec(s))) {
      const cm = pm[1].match(/\/Contents\s+(\d+)\s+0\s+R/);
      lengths.push(cm ? (objText[cm[1]] ?? '').length : 0);
    }
    return lengths;
  }

  it.each(['trust-directive', 'care-memorandum', 'emergency-card'])(
    'has no blank pages for %s (every page carries real content)',
    async (type) => {
      const { token } = await registerUser();
      const plan = await seededPlan(token);
      const buf = (await fetchPdf(plan.id, type, token)).body as Buffer;
      const lengths = pageTextLengths(buf);
      expect(lengths.length).toBeGreaterThan(0);
      // A blank page would be near-empty (bug produced ~0-char pages); a real
      // page has hundreds of characters, well above any footer-only content.
      for (const len of lengths) {
        expect(len).toBeGreaterThan(150);
      }
    },
  );

  it('rejects an unknown document type', async () => {
    const { token } = await registerUser();
    const plan = await seededPlan(token);
    const res = await request(app).get(`/api/plans/${plan.id}/documents/bogus`).set(auth(token));
    expect(res.status).toBe(404);
  });

  it('does not let another user download the document', async () => {
    const owner = await registerUser();
    const plan = await seededPlan(owner.token);
    const intruder = await registerUser();
    const res = await request(app)
      .get(`/api/plans/${plan.id}/documents/trust-directive`)
      .set(auth(intruder.token));
    expect(res.status).toBe(403);
  });
});
