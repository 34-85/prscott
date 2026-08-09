import PDFDocument from 'pdfkit';
import type { StateLaw } from '../data/states.js';
import { LEGAL_DISCLAIMER } from '../data/states.js';
import type { FullPlan } from './readiness.js';

export type DocumentType = 'trust-directive' | 'care-memorandum' | 'emergency-card';

/** Render a pdfkit document into a single Buffer. */
export function renderToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 64 });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      build(doc);
    } catch (err) {
      reject(err);
      return;
    }
    doc.end();
  });
}

const NAVY = '#1e2a44';
const SLATE = '#475467';
const RULE = '#c9d2e3';

function heading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.6);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(13).text(text.toUpperCase());
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(RULE).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fillColor('#101828').font('Helvetica').fontSize(10.5);
}

function field(doc: PDFKit.PDFDocument, label: string, value?: string | null) {
  const v = value && String(value).trim() ? String(value).trim() : '—';
  doc.font('Helvetica-Bold').fillColor(SLATE).fontSize(9.5).text(label.toUpperCase(), { continued: false });
  doc.font('Helvetica').fillColor('#101828').fontSize(11).text(v);
  doc.moveDown(0.35);
}

function paragraph(doc: PDFKit.PDFDocument, text: string) {
  doc.font('Helvetica').fillColor('#101828').fontSize(10.5).text(text, { align: 'left', lineGap: 2 });
  doc.moveDown(0.4);
}

function docHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20).text('PetGuardian', { continued: false });
  doc.fillColor(SLATE).font('Helvetica').fontSize(9).text('Nationwide pet estate-planning workbook');
  doc.moveDown(0.8);
  doc.fillColor('#101828').font('Helvetica-Bold').fontSize(16).text(title);
  doc.fillColor(SLATE).font('Helvetica').fontSize(10).text(subtitle);
  doc.moveDown(0.3);
}

function disclaimerFooter(doc: PDFKit.PDFDocument) {
  doc.moveDown(1);
  const y = doc.y;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(RULE).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.font('Helvetica-Oblique').fillColor(SLATE).fontSize(8).text(LEGAL_DISCLAIMER, { lineGap: 1 });
}

function money(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function person(p: Record<string, unknown>): string {
  const parts = [p.full_name as string];
  if (p.relationship) parts.push(`(${p.relationship})`);
  const contact = [p.phone, p.email].filter(Boolean).join(' · ');
  let line = parts.filter(Boolean).join(' ');
  if (contact) line += ` — ${contact}`;
  if (p.address) line += `\n${p.address}`;
  return line;
}

/* ----------------------- Trust directive ------------------------------ */

export function buildTrustDirective(doc: PDFKit.PDFDocument, data: FullPlan, law?: StateLaw) {
  const { plan, pets, caregivers, trustees, fundingSources } = data;
  const stateName = law?.name ?? plan.state;
  docHeader(
    doc,
    'Animal Care Trust Directive',
    `A ${stateName} pet trust directive prepared for review with an attorney`,
  );

  heading(doc, 'Settlor');
  field(doc, 'Full legal name', plan.settlor_full_name);
  field(doc, 'Address', plan.settlor_address);
  field(doc, 'Governing state', stateName);

  heading(doc, 'Statement of intent');
  paragraph(
    doc,
    `I, ${plan.settlor_full_name || '[settlor]'}, establish this trust for the care of the ` +
      `animal(s) identified below that are alive during my lifetime. It is my intent that this ` +
      `trust be recognized and enforced under the law of ${stateName}. The trust shall continue ` +
      `until the death of the last surviving animal covered by it, at which point any remaining ` +
      `property shall be distributed as directed under "Remainder" below.`,
  );

  heading(doc, `Governing law — ${stateName}`);
  if (law) {
    field(doc, 'Statute', law.statuteCitation);
    field(doc, 'Duration', law.durationRule);
    field(doc, 'Enforcement', law.enforcement);
    field(doc, 'Remainder default (if none named)', law.remainderDefault);
    if (law.notes) paragraph(doc, `Note: ${law.notes}`);
  } else {
    paragraph(doc, 'State statute reference unavailable; confirm the governing provision with counsel.');
  }

  heading(doc, 'Covered animals');
  if (pets.length === 0) paragraph(doc, 'No animals recorded.');
  pets.forEach((p, idx) => {
    const desc = [
      p.species, p.breed, p.color, p.sex,
      p.microchip ? `microchip ${p.microchip}` : null,
    ].filter(Boolean).join(', ');
    field(doc, `Animal ${idx + 1}`, `${p.name}${desc ? ` — ${desc}` : ''}`);
  });

  heading(doc, 'Caregivers');
  const primary = caregivers.filter((c) => c.role === 'PRIMARY');
  const alternate = caregivers.filter((c) => c.role === 'ALTERNATE');
  paragraph(doc, 'Primary caregiver(s):');
  primary.length ? primary.forEach((c) => paragraph(doc, `• ${person(c)}`)) : paragraph(doc, '• [none named]');
  paragraph(doc, 'Alternate caregiver(s), in order:');
  alternate.length ? alternate.forEach((c) => paragraph(doc, `• ${person(c)}`)) : paragraph(doc, '• [none named]');

  heading(doc, 'Trustee & enforcement');
  paragraph(
    doc,
    'The trustee holds and administers trust property and may pay for ordinary care, veterinary ' +
      'treatment, emergency care, boarding, transport, insurance, and reasonable administrative costs. ' +
      'The trustee is intentionally a different party from the caregiver so that control of funds and ' +
      'custody of the animal are separated.',
  );
  trustees.length
    ? trustees.forEach((t) => paragraph(doc, `• ${t.role.replace('_', ' ')}: ${person(t)}`))
    : paragraph(doc, '• [no trustee/enforcer named]');

  heading(doc, 'Funding');
  const total = fundingSources.reduce((s, f) => s + Number(f.amount ?? 0), 0);
  if (plan.funding_target) field(doc, 'Target funding amount', money(plan.funding_target));
  field(doc, 'Total identified funding', money(total));
  fundingSources.forEach((f) => {
    const desc = [f.type, f.description, f.beneficiary_designation].filter(Boolean).join(' — ');
    paragraph(doc, `• ${desc || 'Funding source'}: ${money(f.amount as string)}`);
  });
  if (plan.funding_notes) paragraph(doc, `Notes: ${plan.funding_notes}`);

  heading(doc, 'Remainder');
  field(doc, 'Remainder beneficiary for unused funds', plan.remainder_beneficiary);

  heading(doc, 'Disposition, medical & end-of-life standard');
  paragraph(doc, plan.disposition_instructions || 'No disposition standard recorded.');

  heading(doc, 'Incapacity');
  paragraph(doc, plan.incapacity_instructions || 'No incapacity instructions recorded.');

  heading(doc, 'Signatures');
  doc.moveDown(1.5);
  doc.font('Helvetica').fontSize(10).fillColor('#101828');
  doc.text('_______________________________________     Date: ____________________');
  doc.moveDown(0.3);
  doc.text(`${plan.settlor_full_name || 'Settlor'}, Settlor`);
  doc.moveDown(1.2);
  doc.text('_______________________________________     Date: ____________________');
  doc.moveDown(0.3);
  doc.text('Trustee');
  doc.moveDown(1.2);
  doc.text('Witnessed / notarized as required by your state:');
  doc.moveDown(1);
  doc.text('_______________________________________     _______________________________________');

  disclaimerFooter(doc);
}

/* ----------------------- Care memorandum ------------------------------ */

export function buildCareMemorandum(doc: PDFKit.PDFDocument, data: FullPlan, law?: StateLaw) {
  const { plan, pets, caregivers, trustees } = data;
  docHeader(
    doc,
    'Pet Care Memorandum',
    'Detailed care instructions to travel with the animal and guide any caregiver',
  );

  heading(doc, 'Household & authority');
  field(doc, 'Owner (settlor)', plan.settlor_full_name);
  field(doc, 'Governing state', law?.name ?? plan.state);
  const primary = caregivers.find((c) => c.role === 'PRIMARY');
  field(doc, 'Primary caregiver', primary ? person(primary) : undefined);
  const trustee = trustees[0];
  field(doc, 'Trustee / person controlling funds', trustee ? person(trustee) : undefined);

  pets.forEach((p, idx) => {
    heading(doc, `Animal ${idx + 1}: ${p.name}`);
    field(doc, 'Species / breed', [p.species, p.breed].filter(Boolean).join(' / '));
    field(doc, 'Color / sex', [p.color, p.sex].filter(Boolean).join(' / '));
    field(doc, 'Birthdate', p.birthdate ? String(p.birthdate).slice(0, 10) : undefined);
    field(doc, 'Microchip #', p.microchip as string);
    field(doc, 'Veterinarian', [p.vet_name, p.vet_phone].filter(Boolean).join(' · '));
    field(doc, 'Insurance', p.insurance as string);
    field(doc, 'Medications', p.medications as string);
    field(doc, 'Diet', p.diet as string);
    field(doc, 'Daily routine', p.routine as string);
    field(doc, 'Behavior & temperament', p.behavior as string);
    field(doc, 'Placement preference', p.placement_preference as string);
    field(doc, 'Medical & end-of-life directives', p.medical_directives as string);
  });

  if (pets.length === 0) paragraph(doc, 'No animals recorded yet.');

  heading(doc, 'General disposition standard');
  paragraph(doc, plan.disposition_instructions || 'Not specified.');

  heading(doc, 'If the owner is incapacitated (not yet deceased)');
  paragraph(doc, plan.incapacity_instructions || 'Not specified.');

  disclaimerFooter(doc);
}

/* ----------------------- Emergency card ------------------------------- */

export function buildEmergencyCard(doc: PDFKit.PDFDocument, data: FullPlan) {
  const { plan, pets, caregivers, trustees } = data;
  docHeader(doc, 'Emergency Pet Alert & Wallet Card', 'Cut out and carry; post a copy at home');

  const primary = caregivers.find((c) => c.role === 'PRIMARY');
  const alternate = caregivers.find((c) => c.role === 'ALTERNATE');
  const trustee = trustees[0];

  // Draw a bordered "card"
  const drawCard = (title: string) => {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const top = doc.y;
    doc.roundedRect(left, top, width, 150, 8).strokeColor(NAVY).lineWidth(1.2).stroke();
    doc.save();
    doc.rect(left, top, width, 150).clip();
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(title, left + 12, top + 10);
    doc.font('Helvetica').fillColor('#101828').fontSize(9.5);
    let y = top + 30;
    const line = (label: string, value: string) => {
      doc.font('Helvetica-Bold').fillColor(SLATE).text(label, left + 12, y, { continued: true });
      doc.font('Helvetica').fillColor('#101828').text(`  ${value}`);
      y = doc.y + 2;
    };
    line('ALERT:', `In an emergency, I have ${pets.length || 'a'} pet(s) at home who need care.`);
    line('Pets:', pets.map((p) => p.name).join(', ') || '—');
    line('Primary caregiver:', primary ? `${primary.full_name} ${primary.phone ?? ''}` : '—');
    line('Alternate:', alternate ? `${alternate.full_name} ${alternate.phone ?? ''}` : '—');
    line('Trustee (funds):', trustee ? `${trustee.full_name} ${trustee.phone ?? ''}` : '—');
    line('Owner:', plan.settlor_full_name || '—');
    doc.restore();
    doc.y = top + 160;
  };

  doc.moveDown(0.5);
  drawCard('IN CASE OF EMERGENCY — PET CARE');
  drawCard('IN CASE OF EMERGENCY — PET CARE (copy)');

  heading(doc, 'Full contact list');
  caregivers.forEach((c) => paragraph(doc, `• ${c.role}: ${person(c)}`));
  trustees.forEach((t) => paragraph(doc, `• ${t.role.replace('_', ' ')}: ${person(t)}`));

  disclaimerFooter(doc);
}

export function documentBuilder(type: DocumentType) {
  switch (type) {
    case 'trust-directive':
      return buildTrustDirective;
    case 'care-memorandum':
      return buildCareMemorandum;
    case 'emergency-card':
      return buildEmergencyCard;
  }
}
