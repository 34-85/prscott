import type { StateLaw } from '../data/states.js';

export interface FullPlan {
  plan: {
    id: string;
    name: string;
    state: string;
    settlor_full_name: string | null;
    settlor_address: string | null;
    funding_target: string | null;
    funding_notes: string | null;
    remainder_beneficiary: string | null;
    disposition_instructions: string | null;
    incapacity_instructions: string | null;
  };
  pets: Array<Record<string, unknown>>;
  caregivers: Array<{ role: string; confirmed: boolean } & Record<string, unknown>>;
  trustees: Array<{ role: string; confirmed: boolean } & Record<string, unknown>>;
  fundingSources: Array<{ amount: string | null } & Record<string, unknown>>;
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  weight: number;
  detail: string;
}

export interface ReadinessResult {
  score: number; // 0-100
  level: 'Not started' | 'Getting there' | 'Solid' | 'Complete';
  items: ChecklistItem[];
  gaps: string[];
}

/**
 * A durable pet-care plan needs, at minimum:
 *  - at least one pet described
 *  - a settlor identified
 *  - a primary caregiver AND an alternate, each confirmed willing
 *  - a trustee/enforcer separate from the caregiver (oversight)
 *  - a funded source of money earmarked for care
 *  - a remainder beneficiary for unused funds
 *  - disposition + incapacity instructions and a care memorandum
 */
export function computeReadiness(data: FullPlan, _law?: StateLaw): ReadinessResult {
  const { plan, pets, caregivers, trustees, fundingSources } = data;

  const primary = caregivers.filter((c) => c.role === 'PRIMARY');
  const alternates = caregivers.filter((c) => c.role === 'ALTERNATE');
  const enforcers = trustees.filter(
    (t) => t.role === 'TRUSTEE' || t.role === 'ENFORCER' || t.role === 'SUCCESSOR_TRUSTEE',
  );
  const fundedTotal = fundingSources.reduce((sum, f) => sum + Number(f.amount ?? 0), 0);

  // Caregiver and trustee should not be the same single person controlling both.
  const caregiverNames = new Set(
    caregivers.map((c) => String((c as { full_name?: string }).full_name ?? '').trim().toLowerCase()).filter(Boolean),
  );
  const trusteeNames = trustees.map((t) =>
    String((t as { full_name?: string }).full_name ?? '').trim().toLowerCase(),
  );
  const separateOversight =
    enforcers.length > 0 && trusteeNames.some((n) => n && !caregiverNames.has(n));

  const items: ChecklistItem[] = [
    {
      key: 'pet',
      label: 'At least one animal described',
      done: pets.length > 0,
      weight: 10,
      detail: 'The trust must cover a specific animal alive during your lifetime.',
    },
    {
      key: 'settlor',
      label: 'You (the settlor) are identified with a legal name',
      done: Boolean(plan.settlor_full_name && plan.settlor_full_name.trim()),
      weight: 5,
      detail: 'Your full legal name and address anchor the trust instrument.',
    },
    {
      key: 'primary_caregiver',
      label: 'A primary caregiver is named',
      done: primary.length > 0,
      weight: 15,
      detail: 'Someone must have clear authority and duty to take possession of the animal.',
    },
    {
      key: 'primary_confirmed',
      label: 'Primary caregiver has confirmed willingness',
      done: primary.some((c) => c.confirmed),
      weight: 8,
      detail: 'A willing, confirmed caregiver prevents a custody gap at death.',
    },
    {
      key: 'alternate_caregiver',
      label: 'At least one alternate caregiver is named',
      done: alternates.length > 0,
      weight: 10,
      detail: 'A backup avoids the animal defaulting to the estate administrator.',
    },
    {
      key: 'trustee',
      label: 'A trustee or enforcer provides oversight',
      done: enforcers.length > 0,
      weight: 12,
      detail: 'A trustee holds and controls the funds and can enforce the care terms.',
    },
    {
      key: 'separation',
      label: 'Trustee/enforcer is separate from the caregiver',
      done: separateOversight,
      weight: 8,
      detail: 'Separating money-control from animal-custody adds real accountability.',
    },
    {
      key: 'funding',
      label: 'The plan is funded with earmarked money',
      done: fundedTotal > 0,
      weight: 15,
      detail: 'A dedicated pool (life insurance, account, or bequest) pays for care immediately.',
    },
    {
      key: 'remainder',
      label: 'A remainder beneficiary is named for unused funds',
      done: Boolean(plan.remainder_beneficiary && plan.remainder_beneficiary.trim()),
      weight: 5,
      detail: 'Naming who receives leftover funds avoids ambiguity even where defaults exist.',
    },
    {
      key: 'disposition',
      label: 'Disposition & medical/end-of-life instructions provided',
      done: Boolean(plan.disposition_instructions && plan.disposition_instructions.trim()),
      weight: 6,
      detail: 'Documents your preferences for rehoming, treatment, and end-of-life care.',
    },
    {
      key: 'incapacity',
      label: 'Incapacity instructions provided',
      done: Boolean(plan.incapacity_instructions && plan.incapacity_instructions.trim()),
      weight: 6,
      detail: 'Care may be needed long before an estate is administered.',
    },
  ];

  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const earned = items.filter((i) => i.done).reduce((s, i) => s + i.weight, 0);
  const score = Math.round((earned / totalWeight) * 100);

  let level: ReadinessResult['level'] = 'Not started';
  if (score >= 100) level = 'Complete';
  else if (score >= 75) level = 'Solid';
  else if (score >= 35) level = 'Getting there';

  const gaps = items.filter((i) => !i.done).map((i) => i.label);

  return { score, level, items, gaps };
}
