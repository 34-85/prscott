import PDFDocument from 'pdfkit';
import type { StateLaw } from '../data/states.js';
import { LEGAL_DISCLAIMER, LEGAL_DISCLAIMER_SHORT } from '../data/states.js';
import type { FullPlan } from './readiness.js';

export type DocumentType = 'trust-directive' | 'care-memorandum' | 'emergency-card';

const NAVY = '#1e2a44';
const BRAND = '#2f49b8';
const SLATE = '#475467';
const MUTED = '#98a2b3';
const INK = '#101828';
const RULE = '#c9d2e3';

/** Render a pdfkit document into a single Buffer, stamping page-number footers. */
export function renderToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: 64, bufferPages: true });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      build(doc);
      addFooters(doc);
    } catch (err) {
      reject(err);
      return;
    }
    doc.end();
  });
}

function today(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function addFooters(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const y = doc.page.height - 48;
    // The footer sits inside the bottom margin. pdfkit treats text past the
    // bottom margin as overflow and appends a blank continuation page, so
    // neutralize the bottom margin while stamping, then restore it.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.save();
    doc.moveTo(left, y).lineTo(right, y).strokeColor(RULE).lineWidth(0.5).stroke();
    doc.font('Helvetica').fontSize(7).fillColor(MUTED);
    doc.text('PetGuardian — not legal advice; a guide for your attorney to draft official documents.', left, y + 5, {
      width: right - left - 80,
      lineBreak: false,
      ellipsis: true,
    });
    doc.text(`Page ${i + 1} of ${range.count}`, right - 80, y + 5, { width: 80, align: 'right', lineBreak: false });
    doc.restore();
    doc.page.margins.bottom = savedBottom;
  }
}

/* --------------------------- primitives ------------------------------- */

function heading(doc: PDFKit.PDFDocument, text: string) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.moveDown(0.6);
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12.5).text(text.toUpperCase());
  const y = doc.y + 2;
  doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y)
    .strokeColor(RULE).lineWidth(1).stroke();
  doc.moveDown(0.5);
  doc.fillColor(INK).font('Helvetica').fontSize(10.5);
}

function field(doc: PDFKit.PDFDocument, label: string, value?: string | null, blankLen = 46) {
  doc.font('Helvetica-Bold').fillColor(SLATE).fontSize(9).text(label.toUpperCase());
  const v = value !== undefined && value !== null && String(value).trim();
  if (v) {
    doc.font('Helvetica').fillColor(INK).fontSize(11).text(String(value).trim());
  } else {
    doc.font('Helvetica').fillColor(MUTED).fontSize(11).text('_'.repeat(blankLen));
  }
  doc.moveDown(0.3);
}

function paragraph(doc: PDFKit.PDFDocument, text: string, opts: { size?: number; color?: string } = {}) {
  doc.font('Helvetica').fillColor(opts.color ?? INK).fontSize(opts.size ?? 10.5).text(text, { align: 'left', lineGap: 2 });
  doc.moveDown(0.4);
}

function clause(doc: PDFKit.PDFDocument, title: string, body: string) {
  doc.font('Helvetica-Bold').fillColor(NAVY).fontSize(10.5).text(title);
  doc.font('Helvetica').fillColor(INK).fontSize(10.5).text(body, { align: 'left', lineGap: 2 });
  doc.moveDown(0.5);
}

function docHeader(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(20).text('PetGuardian');
  doc.fillColor(SLATE).font('Helvetica').fontSize(9).text('Nationwide pet estate-planning workbook');
  doc.moveDown(0.8);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text(title);
  doc.fillColor(SLATE).font('Helvetica').fontSize(10).text(subtitle);
  doc.moveDown(0.3);
}

function disclaimerBox(doc: PDFKit.PDFDocument) {
  doc.moveDown(0.6);
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const top = doc.y;
  const padding = 10;
  doc.font('Helvetica-Bold').fillColor(NAVY).fontSize(9);
  const titleH = doc.heightOfString('IMPORTANT — NOT LEGAL ADVICE', { width: width - padding * 2 });
  doc.font('Helvetica-Oblique').fillColor(SLATE).fontSize(8.5);
  const bodyH = doc.heightOfString(LEGAL_DISCLAIMER, { width: width - padding * 2, lineGap: 1 });
  const boxH = titleH + bodyH + padding * 2 + 4;
  doc.save();
  doc.roundedRect(left, top, width, boxH, 6).fill('#f2f5fc');
  doc.restore();
  doc.font('Helvetica-Bold').fillColor(NAVY).fontSize(9).text('IMPORTANT — NOT LEGAL ADVICE', left + padding, top + padding, { width: width - padding * 2 });
  doc.font('Helvetica-Oblique').fillColor(SLATE).fontSize(8.5).text(LEGAL_DISCLAIMER, left + padding, top + padding + titleH + 4, { width: width - padding * 2, lineGap: 1 });
  doc.y = top + boxH;
  doc.moveDown(0.5);
}

function money(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === '') return '—';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function str(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim();
}

function personLine(p: Record<string, unknown>): string {
  const name = str(p.full_name) || '____________________';
  const rel = str(p.relationship);
  const contact = [str(p.phone), str(p.email)].filter(Boolean).join(' · ');
  let line = name + (rel ? ` (${rel})` : '');
  if (contact) line += ` — ${contact}`;
  if (str(p.address)) line += `\n   ${str(p.address)}`;
  return line;
}

/** List the sections a user still needs to complete for a strong document. */
function computeMissing(data: FullPlan): string[] {
  const { plan, pets, caregivers, trustees, fundingSources } = data;
  const missing: string[] = [];
  if (pets.length === 0) missing.push('Add at least one animal (Pets tab)');
  if (!str(plan.settlor_full_name)) missing.push('Add your full legal name (Overview tab)');
  if (!str(plan.settlor_phone)) missing.push('Add your phone number (Overview tab)');
  if (!caregivers.some((c) => c.role === 'PRIMARY')) missing.push('Name a primary caregiver (People tab)');
  if (!caregivers.some((c) => c.role === 'ALTERNATE')) missing.push('Name an alternate caregiver (People tab)');
  if (trustees.length === 0) missing.push('Name a trustee/enforcer (People tab)');
  if (fundingSources.reduce((s, f) => s + Number(f.amount ?? 0), 0) <= 0) missing.push('Add a funding source with an amount (Funding tab)');
  if (!str(plan.remainder_beneficiary)) missing.push('Name a remainder beneficiary (Overview tab)');
  return missing;
}

function missingChecklist(doc: PDFKit.PDFDocument, data: FullPlan) {
  const missing = computeMissing(data);
  if (missing.length === 0) return;
  heading(doc, 'To finish this document');
  paragraph(
    doc,
    'This draft is usable now — items below are shown as blanks you can complete by hand. ' +
      'To auto-fill them, add the following in the PetGuardian app, then regenerate:',
    { color: SLATE, size: 9.5 },
  );
  missing.forEach((m) => doc.font('Helvetica').fillColor(INK).fontSize(10).text(`•  ${m}`));
  doc.moveDown(0.3);
}

/* ----------------------- Trust directive ------------------------------ */

export function buildTrustDirective(doc: PDFKit.PDFDocument, data: FullPlan, law?: StateLaw) {
  const { plan, pets, caregivers, trustees, fundingSources } = data;
  const stateName = law?.name ?? plan.state;
  const settlor = str(plan.settlor_full_name) || '[your full legal name]';

  // ---- Cover page ----
  doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(26).text('PetGuardian', { align: 'center' });
  doc.fillColor(SLATE).font('Helvetica').fontSize(10).text('Nationwide pet estate-planning workbook', { align: 'center' });
  doc.moveDown(3);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(24).text('Pet Trust Planning Guide', { align: 'center' });
  doc.moveDown(0.5);
  doc.fillColor(SLATE).font('Helvetica').fontSize(12).text(`Prepared for ${settlor}`, { align: 'center' });
  doc.fillColor(SLATE).font('Helvetica').fontSize(12).text(`Governing state: ${stateName}`, { align: 'center' });
  doc.moveDown(0.3);
  doc.fillColor(SLATE).font('Helvetica').fontSize(10).text(`Generated ${today()}`, { align: 'center' });
  doc.moveDown(3);
  doc.font('Helvetica-Bold').fillColor(BRAND).fontSize(12)
    .text('A guide to take to your attorney.', { align: 'center' });
  doc.font('Helvetica').fillColor(SLATE).fontSize(10.5)
    .text('This is not a legal document and not legal advice. It organizes your wishes so a licensed attorney can draft your pet trust.', { align: 'center' });
  disclaimerBox(doc);

  // ---- Body ----
  doc.addPage();
  docHeader(doc, 'Pet Trust Planning Guide', `A plan to review with a licensed attorney in ${stateName}`);

  paragraph(
    doc,
    'How to use this guide: it records what you want for your animals so a licensed attorney can draft a valid pet trust under ' +
      `${stateName} law quickly and accurately. Bring it to your attorney. You record your wishes here; your attorney prepares ` +
      'the legal instrument and handles the signing, witnessing, and notarization your state requires. Do not treat this guide ' +
      'as something to sign. It has no legal effect by itself.',
    { color: SLATE, size: 10 },
  );

  heading(doc, 'About you (the person planning)');
  field(doc, 'Full legal name', plan.settlor_full_name);
  field(doc, 'Address', plan.settlor_address);
  field(doc, 'Phone', plan.settlor_phone, 24);
  field(doc, 'Email', plan.settlor_email, 30);
  paragraph(
    doc,
    'What to tell your attorney: you want a trust for the animals listed under "Your animals" that are alive during your ' +
      `lifetime, enforceable under ${stateName} law, continuing until the last covered animal dies, with any remaining funds ` +
      'going to the remainder beneficiary you name below.',
    { color: SLATE, size: 9.5 },
  );

  heading(doc, `Your state pet-trust law (${stateName})`);
  paragraph(doc, 'Reference for your attorney:', { color: SLATE, size: 9.5 });
  if (law) {
    field(doc, 'Statute', law.statuteCitation);
    field(doc, 'Duration', law.durationRule);
    field(doc, 'Enforcement', law.enforcement);
    field(doc, 'Remainder default (if none named)', law.remainderDefault);
    if (law.courtMayReduceExcessFunds) {
      paragraph(doc, 'Note: in this state a court may reduce funds it finds substantially in excess of what the animal needs. Discuss a realistic amount with your attorney.', { color: SLATE, size: 9.5 });
    }
    if (law.notes) paragraph(doc, `Note: ${law.notes}`, { color: SLATE, size: 9.5 });
  } else {
    paragraph(doc, 'Confirm the governing animal-trust statute with counsel in your state.');
  }

  heading(doc, 'Your animals (draft Schedule A)');
  paragraph(doc, 'Your attorney attaches the final animal list as Schedule A of the trust.', { color: SLATE, size: 9.5 });
  if (pets.length === 0) {
    field(doc, 'Animal 1', null);
    field(doc, 'Animal 2', null);
  } else {
    pets.forEach((p, i) => {
      const desc = [str(p.species), str(p.breed), str(p.color), str(p.sex), str(p.microchip) ? `microchip ${str(p.microchip)}` : '']
        .filter(Boolean).join(', ');
      field(doc, `Animal ${i + 1}`, `${str(p.name)}${desc ? ` (${desc})` : ''}`);
    });
  }

  heading(doc, 'Who will care for your animals');
  paragraph(doc, 'Your intent: the animals go to your primary caregiver; if that person cannot serve, to the alternates in the order listed. Point for your attorney: this becomes the caregiver succession clause.', { color: SLATE, size: 9.5 });
  const primary = caregivers.filter((c) => c.role === 'PRIMARY');
  const alternate = caregivers.filter((c) => c.role === 'ALTERNATE');
  doc.font('Helvetica-Bold').fillColor(SLATE).fontSize(9).text('PRIMARY CAREGIVER');
  primary.length ? primary.forEach((c) => paragraph(doc, `- ${personLine(c)}`)) : field(doc, '', null);
  doc.font('Helvetica-Bold').fillColor(SLATE).fontSize(9).text('ALTERNATE CAREGIVER(S), IN ORDER');
  alternate.length ? alternate.forEach((c) => paragraph(doc, `- ${personLine(c)}`)) : field(doc, '', null);

  heading(doc, 'Who controls the money (trustee / enforcer)');
  paragraph(doc, 'Your intent: the person who controls the money (the trustee) should be different from the person who keeps the animal (the caregiver), so oversight of the funds is separate from custody of the animal. Point for your attorney: name the trustee, a successor trustee, and the person who may enforce the trust.', { color: SLATE, size: 9.5 });
  trustees.length
    ? trustees.forEach((t) => paragraph(doc, `- ${String(t.role).replace('_', ' ')}: ${personLine(t)}`))
    : field(doc, 'Trustee / enforcer', null);

  heading(doc, 'The standard of care you want');
  paragraph(doc, 'You want the trust to keep each animal in at least the standard of living it has now: food, housing, routine and emergency veterinary care, medication, boarding, transport, grooming, insurance, and humane end-of-life care. Point for your attorney: this is the standard-of-care and distribution clause.');

  heading(doc, 'Funding you plan to set aside (draft Schedule B)');
  paragraph(doc, 'PetGuardian never holds, transfers, or manages any money. You and your attorney, with your financial institutions, decide how the trust is funded and set it up. The figures below are your planning estimate for your attorney.', { color: SLATE, size: 9.5 });
  const total = fundingSources.reduce((s, f) => s + Number(f.amount ?? 0), 0);
  field(doc, 'Target funding amount', plan.funding_target ? money(plan.funding_target) : null, 20);
  field(doc, 'Total identified funding', total > 0 ? money(total) : null, 20);
  if (str(plan.funding_notes)) paragraph(doc, `Notes: ${str(plan.funding_notes)}`);
  if (fundingSources.length === 0) {
    field(doc, 'Source 1 (type, description, beneficiary, amount)', null);
  } else {
    fundingSources.forEach((f) => {
      const desc = [str(f.type), str(f.description), str(f.beneficiary_designation)].filter(Boolean).join(' / ');
      paragraph(doc, `- ${desc || 'Funding source'}: ${money(f.amount as string)}`);
    });
  }

  heading(doc, 'What happens to unused funds');
  paragraph(doc, 'When the last covered animal dies, the trust ends and any remaining funds go to the remainder beneficiary you name here. Point for your attorney: this is the remainder and termination clause.', { color: SLATE, size: 9.5 });
  field(doc, 'Remainder beneficiary for unused funds', plan.remainder_beneficiary);

  heading(doc, 'End-of-life and disposition wishes');
  plan.disposition_instructions ? paragraph(doc, str(plan.disposition_instructions)) : field(doc, 'Your wishes', null, 60);

  heading(doc, 'If you become unable to care for your animals');
  paragraph(doc, 'These are your wishes if you are alive but cannot care for an animal, for example during illness or incapacity, before any estate is administered. Point for your attorney: coordinate this with your financial power of attorney.', { color: SLATE, size: 9.5 });
  plan.incapacity_instructions ? paragraph(doc, str(plan.incapacity_instructions)) : field(doc, 'Your wishes', null, 60);

  heading(doc, 'Points for your attorney to address');
  [
    'Trustee compensation and reimbursement of administrative costs.',
    'Whether to waive bond for the trustee.',
    'Naming a successor trustee if the first cannot serve.',
    'Spendthrift protection for the trust funds, to the extent your state allows.',
    'Who may request an accounting and enforce the trust, and how often.',
    `Execution for ${stateName}: the signing, witnessing, and notarization, which your attorney will handle.`,
  ].forEach((s) => doc.font('Helvetica').fillColor(INK).fontSize(10).text(`-  ${s}`, { lineGap: 1 }));
  doc.moveDown(0.4);

  heading(doc, 'Next steps: taking this to your attorney');
  paragraph(doc, 'Bring this guide to a licensed estate-planning attorney in your state. Your attorney turns it into a valid pet trust, advises you on funding, and handles the signing, witnessing, and notarization your state requires.');
  paragraph(doc, 'Do not sign this guide. It is preparatory only and has no legal effect by itself. The care memorandum and emergency card from PetGuardian are practical documents you can use right away; this plan becomes legally effective only once your attorney drafts the trust and you properly execute it.', { color: SLATE, size: 9.5 });

  missingChecklist(doc, data);
}

/* ----------------------- Care memorandum ------------------------------ */

export function buildCareMemorandum(doc: PDFKit.PDFDocument, data: FullPlan, law?: StateLaw) {
  const { plan, pets, caregivers, trustees } = data;
  docHeader(doc, 'Pet Care Memorandum', 'Detailed care instructions to travel with the animal and guide any caregiver');
  doc.fillColor(SLATE).font('Helvetica').fontSize(9).text(`Generated ${today()}`);
  doc.moveDown(0.2);

  heading(doc, 'Household & authority');
  field(doc, 'Owner (settlor)', plan.settlor_full_name);
  field(doc, 'Owner phone', plan.settlor_phone, 24);
  field(doc, 'Owner email', plan.settlor_email, 30);
  field(doc, 'Governing state', law?.name ?? plan.state);
  const primary = caregivers.find((c) => c.role === 'PRIMARY');
  const alternate = caregivers.find((c) => c.role === 'ALTERNATE');
  field(doc, 'Primary caregiver', primary ? personLine(primary) : null);
  field(doc, 'Alternate caregiver', alternate ? personLine(alternate) : null);
  field(doc, 'Trustee / person controlling funds', trustees[0] ? personLine(trustees[0]) : null);

  heading(doc, 'First 72 hours — what a caregiver should do now');
  [
    'Take physical custody of the animal(s) and keep them together if they are bonded.',
    'Call the veterinarian and the emergency vet listed below; confirm current medications.',
    'Continue the normal feeding schedule and medication doses without interruption.',
    'Notify the Trustee so funds can be released for immediate expenses.',
    'Keep this memorandum, ID/microchip records, and insurance details with the animal.',
  ].forEach((s, i) => doc.font('Helvetica').fillColor(INK).fontSize(10.5).text(`${i + 1}.  ${s}`, { lineGap: 1 }));
  doc.moveDown(0.4);

  if (pets.length === 0) {
    heading(doc, 'Animal 1');
    ['Name', 'Species / breed', 'Microchip #', 'Veterinarian', 'Emergency vet', 'Medications & schedule', 'Allergies', 'Diet & feeding schedule', 'Daily routine']
      .forEach((l) => field(doc, l, null));
  }

  pets.forEach((p, idx) => {
    heading(doc, `Animal ${idx + 1}: ${str(p.name) || '____________'}`);
    field(doc, 'Species / breed', [str(p.species), str(p.breed)].filter(Boolean).join(' / '));
    field(doc, 'Color / sex', [str(p.color), str(p.sex)].filter(Boolean).join(' / '));
    field(doc, 'Birthdate', str(p.birthdate) ? String(p.birthdate).slice(0, 10) : null, 20);
    field(doc, 'Microchip #', p.microchip as string, 24);
    field(doc, 'Veterinarian', [str(p.vet_name), str(p.vet_phone)].filter(Boolean).join(' · '));
    field(doc, 'Emergency vet', [str(p.emergency_vet_name), str(p.emergency_vet_phone)].filter(Boolean).join(' · '));
    field(doc, 'Insurance', p.insurance as string);
    field(doc, 'Allergies', p.allergies as string);
    field(doc, 'Medications & schedule', p.medications as string);
    field(doc, 'Diet & feeding schedule', p.diet as string);
    field(doc, 'Daily routine', p.routine as string);
    field(doc, 'Grooming & exercise', p.grooming_exercise as string);
    field(doc, 'Behavior & temperament', p.behavior as string);
    field(doc, 'Placement preference', p.placement_preference as string);
    field(doc, 'Medical & end-of-life directives', p.medical_directives as string);
  });

  heading(doc, 'General disposition standard');
  plan.disposition_instructions ? paragraph(doc, str(plan.disposition_instructions)) : field(doc, 'Standard', null, 60);

  heading(doc, 'If the owner is incapacitated (not yet deceased)');
  plan.incapacity_instructions ? paragraph(doc, str(plan.incapacity_instructions)) : field(doc, 'Instructions', null, 60);

  missingChecklist(doc, data);
}

/* ----------------------- Emergency card ------------------------------- */

export function buildEmergencyCard(doc: PDFKit.PDFDocument, data: FullPlan) {
  const { plan, pets, caregivers, trustees } = data;
  docHeader(doc, 'Emergency Pet Alert & Wallet Card', 'Cut out and carry; post a copy at home. Blank lines can be filled in by hand.');

  const primary = caregivers.find((c) => c.role === 'PRIMARY');
  const alternate = caregivers.find((c) => c.role === 'ALTERNATE');
  const trustee = trustees[0];
  const petCount = pets.length;
  const petNames = pets.map((p) => str(p.name)).filter(Boolean).join(', ');
  const nameAndPhone = (p?: Record<string, unknown>) =>
    p ? [str(p.full_name), str(p.phone)].filter(Boolean).join('  ') || '________________________' : '________________________';

  const drawCard = (title: string) => {
    if (doc.y > doc.page.height - 220) doc.addPage();
    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const top = doc.y;
    const H = 172;
    doc.roundedRect(left, top, width, H, 8).strokeColor(NAVY).lineWidth(1.2).stroke();
    doc.save();
    doc.roundedRect(left, top, width, H, 8).clip();
    doc.fillColor(NAVY).font('Helvetica-Bold').fontSize(12).text(title, left + 12, top + 10);
    let y = top + 30;
    const line = (label: string, value: string) => {
      doc.font('Helvetica-Bold').fillColor(SLATE).fontSize(9.5).text(label, left + 12, y, { continued: true, lineBreak: false });
      doc.font('Helvetica').fillColor(INK).text(`  ${value}`, { lineBreak: false });
      y += 18;
    };
    line('ALERT:', `I have ${petCount || '____'} pet(s) at home who need immediate care.`);
    line('Pets:', petNames || '________________________');
    line('Primary caregiver:', nameAndPhone(primary));
    line('Alternate:', nameAndPhone(alternate));
    line('Trustee (funds):', nameAndPhone(trustee));
    line('Owner:', [str(plan.settlor_full_name), str(plan.settlor_phone)].filter(Boolean).join('  ') || '________________________');
    doc.restore();
    doc.y = top + H + 12;
  };

  doc.moveDown(0.3);
  drawCard('IN CASE OF EMERGENCY — PET CARE');
  drawCard('IN CASE OF EMERGENCY — PET CARE (home copy)');

  heading(doc, 'For first responders');
  paragraph(
    doc,
    `There ${petCount === 1 ? 'is 1 pet' : `are ${petCount || 'one or more'} pet(s)`} at this residence who depend on ` +
      'daily care. If the owner is hospitalized or deceased, please contact the caregivers below so the animals are not left alone.',
    { size: 10 },
  );

  heading(doc, 'Owner');
  field(doc, 'Name', plan.settlor_full_name);
  field(doc, 'Phone', plan.settlor_phone, 24);
  field(doc, 'Email', plan.settlor_email, 30);
  field(doc, 'Home address', plan.settlor_address);

  heading(doc, 'Animals & critical care');
  if (pets.length === 0) {
    field(doc, 'Pet name', null);
    field(doc, 'Microchip #', null, 24);
    field(doc, 'Critical medications', null);
    field(doc, 'Vet / emergency vet phone', null);
  }
  pets.forEach((p, i) => {
    doc.font('Helvetica-Bold').fillColor(NAVY).fontSize(10.5).text(`${i + 1}. ${str(p.name) || '____________'}  ${[str(p.species), str(p.breed)].filter(Boolean).join(' / ')}`);
    field(doc, 'Microchip #', p.microchip as string, 24);
    field(doc, 'Critical medications', p.medications as string);
    field(doc, 'Allergies', p.allergies as string);
    field(doc, 'Vet phone', p.vet_phone as string, 24);
    field(doc, 'Emergency vet phone', p.emergency_vet_phone as string, 24);
  });

  heading(doc, 'Full contact list');
  const contacts = [...caregivers, ...trustees];
  if (contacts.length === 0) {
    field(doc, 'Caregiver / trustee', null);
    field(doc, 'Caregiver / trustee', null);
  } else {
    caregivers.forEach((c) => paragraph(doc, `• ${String(c.role)}: ${personLine(c)}`));
    trustees.forEach((t) => paragraph(doc, `• ${String(t.role).replace('_', ' ')}: ${personLine(t)}`));
  }

  missingChecklist(doc, data);
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
