export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'OWNER' | 'ATTORNEY';
  state: string | null;
}

export interface StateLawSummary {
  code: string;
  name: string;
  statuteCitation: string;
}

export interface StateLaw extends StateLawSummary {
  model: string;
  durationRule: string;
  remainderDefault: string;
  courtMayReduceExcessFunds: boolean;
  enforcement: string;
  notes: string;
}

export interface PlanSummary {
  id: string;
  name: string;
  state: string;
  settlor_full_name: string | null;
  funding_target: string | null;
  petCount: number;
  readinessScore: number;
  readinessLevel: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  name: string;
  state: string;
  settlor_full_name: string | null;
  settlor_address: string | null;
  settlor_phone: string | null;
  settlor_email: string | null;
  funding_target: string | null;
  funding_notes: string | null;
  remainder_beneficiary: string | null;
  disposition_instructions: string | null;
  incapacity_instructions: string | null;
}

export interface Pet {
  id: string;
  name: string;
  species?: string; breed?: string; color?: string; sex?: string;
  birthdate?: string; microchip?: string; vet_name?: string; vet_phone?: string;
  insurance?: string; medications?: string; diet?: string; routine?: string;
  behavior?: string; placement_preference?: string; medical_directives?: string;
  allergies?: string; emergency_vet_name?: string; emergency_vet_phone?: string;
  grooming_exercise?: string;
}

export interface Caregiver {
  id: string;
  role: 'PRIMARY' | 'ALTERNATE';
  full_name: string;
  relationship?: string; phone?: string; email?: string; address?: string;
  confirmed: boolean;
}

export interface Trustee {
  id: string;
  role: 'TRUSTEE' | 'SUCCESSOR_TRUSTEE' | 'ENFORCER';
  full_name: string;
  relationship?: string; phone?: string; email?: string; address?: string;
  confirmed: boolean;
}

export interface FundingSource {
  id: string;
  type: string;
  description?: string;
  amount?: string;
  beneficiary_designation?: string;
}

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  weight: number;
  detail: string;
}

export interface Readiness {
  score: number;
  level: string;
  items: ChecklistItem[];
  gaps: string[];
}

export interface FullPlanResponse {
  plan: Plan;
  pets: Pet[];
  caregivers: Caregiver[];
  trustees: Trustee[];
  fundingSources: FundingSource[];
  stateLaw: StateLaw | null;
  readiness: Readiness;
}
