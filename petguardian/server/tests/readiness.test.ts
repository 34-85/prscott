import { describe, expect, it } from 'vitest';
import { computeReadiness, type FullPlan } from '../src/services/readiness.js';

function base(): FullPlan {
  return {
    plan: {
      id: 'p1', name: 'x', state: 'GA',
      settlor_full_name: null, settlor_address: null, funding_target: null, funding_notes: null,
      remainder_beneficiary: null, disposition_instructions: null, incapacity_instructions: null,
    },
    pets: [],
    caregivers: [],
    trustees: [],
    fundingSources: [],
  };
}

describe('computeReadiness', () => {
  it('is zero for an empty plan', () => {
    const r = computeReadiness(base());
    expect(r.score).toBe(0);
    expect(r.level).toBe('Not started');
    expect(r.gaps.length).toBeGreaterThan(0);
  });

  it('reaches 100 when every requirement is met with separate roles', () => {
    const data = base();
    data.plan.settlor_full_name = 'Jane Doe';
    data.plan.remainder_beneficiary = 'Charity';
    data.plan.disposition_instructions = 'Rehome first.';
    data.plan.incapacity_instructions = 'POA agent acts.';
    data.pets = [{ name: 'Rex' }];
    data.caregivers = [
      { role: 'PRIMARY', confirmed: true, full_name: 'Amy' },
      { role: 'ALTERNATE', confirmed: false, full_name: 'Ben' },
    ];
    data.trustees = [{ role: 'TRUSTEE', confirmed: false, full_name: 'Tom' }];
    data.fundingSources = [{ amount: '25000' }];

    const r = computeReadiness(data);
    expect(r.score).toBe(100);
    expect(r.level).toBe('Complete');
    expect(r.gaps).toHaveLength(0);
  });

  it('flags missing oversight separation when caregiver and trustee are the same person', () => {
    const data = base();
    data.caregivers = [{ role: 'PRIMARY', confirmed: true, full_name: 'Same Name' }];
    data.trustees = [{ role: 'TRUSTEE', confirmed: false, full_name: 'same name' }];
    const r = computeReadiness(data);
    const sep = r.items.find((i) => i.key === 'separation');
    expect(sep?.done).toBe(false);
  });

  it('counts funding only when an amount is present', () => {
    const data = base();
    data.fundingSources = [{ amount: null }];
    const funding = computeReadiness(data).items.find((i) => i.key === 'funding');
    expect(funding?.done).toBe(false);
  });
});
