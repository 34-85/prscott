import { useState } from 'react';
import { api } from '../../api/client';
import type { FundingSource } from '../../lib/types';
import { Banner, Field, SelectField } from '../ui';

const TYPES = [
  { value: 'LIFE_INSURANCE', label: 'Life insurance' },
  { value: 'BANK', label: 'Bank account' },
  { value: 'BROKERAGE', label: 'Brokerage account' },
  { value: 'RETIREMENT', label: 'Retirement account' },
  { value: 'TRUST', label: 'Revocable/living trust' },
  { value: 'WILL_BEQUEST', label: 'Will bequest' },
  { value: 'CASH', label: 'Cash / other liquid' },
  { value: 'OTHER', label: 'Other' },
];

export function FundingTab({
  planId,
  sources,
  onChange,
}: {
  planId: string;
  sources: FundingSource[];
  onChange: () => void;
}) {
  const [form, setForm] = useState({ type: 'LIFE_INSURANCE', description: '', amount: '', beneficiaryDesignation: '' });
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const total = sources.reduce((s, f) => s + Number(f.amount ?? 0), 0);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/plans/${planId}/funding/`, {
        type: form.type,
        description: form.description || undefined,
        amount: form.amount ? Number(form.amount) : undefined,
        beneficiaryDesignation: form.beneficiaryDesignation || undefined,
      });
      setForm({ type: form.type, description: '', amount: '', beneficiaryDesignation: '' });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/plans/${planId}/funding/${id}`);
    onChange();
  }

  return (
    <div className="space-y-4">
      <Banner>
        The funding problem is separate from naming a caregiver. Earmark a real, timely pool of money — often
        life-insurance proceeds or a beneficiary-designated account — so care is paid for immediately, not after
        probate.
      </Banner>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-brand-900">Funding sources</h2>
          <div className="text-right">
            <div className="text-xs text-slate-500 uppercase">Total earmarked</div>
            <div className="text-xl font-bold text-brand-900">
              {total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
            </div>
          </div>
        </div>

        {sources.length > 0 && (
          <ul className="divide-y divide-slate-100 mt-3">
            {sources.map((f) => (
              <li key={f.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900">
                    {TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                    {f.description ? ` — ${f.description}` : ''}
                  </div>
                  {f.beneficiary_designation && (
                    <div className="text-xs text-slate-500">Beneficiary: {f.beneficiary_designation}</div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold text-slate-900">
                    {Number(f.amount ?? 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </span>
                  <button className="text-red-600 text-sm" onClick={() => remove(f.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-4 mt-3">
          <SelectField label="Type" value={form.type} onChange={(v) => set('type', v)} options={TYPES} />
          <Field label="Amount ($)" type="number" value={form.amount} onChange={(v) => set('amount', v)} />
          <Field label="Description" value={form.description} onChange={(v) => set('description', v)} />
          <Field label="Beneficiary designation" value={form.beneficiaryDesignation} onChange={(v) => set('beneficiaryDesignation', v)} placeholder="e.g. payable to the pet trust" />
          <div className="sm:col-span-2">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add funding source'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
