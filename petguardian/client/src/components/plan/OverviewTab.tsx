import { useState } from 'react';
import { api } from '../../api/client';
import type { FullPlanResponse } from '../../lib/types';
import { Field } from '../ui';

export function OverviewTab({ data, onChange }: { data: FullPlanResponse; onChange: () => void }) {
  const p = data.plan;
  const [form, setForm] = useState({
    settlorFullName: p.settlor_full_name ?? '',
    settlorAddress: p.settlor_address ?? '',
    settlorPhone: p.settlor_phone ?? '',
    settlorEmail: p.settlor_email ?? '',
    fundingTarget: p.funding_target ?? '',
    remainderBeneficiary: p.remainder_beneficiary ?? '',
    dispositionInstructions: p.disposition_instructions ?? '',
    incapacityInstructions: p.incapacity_instructions ?? '',
    fundingNotes: p.funding_notes ?? '',
  });
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    try {
      await api.put(`/plans/${p.id}`, {
        settlorFullName: form.settlorFullName,
        settlorAddress: form.settlorAddress,
        settlorPhone: form.settlorPhone,
        settlorEmail: form.settlorEmail,
        fundingTarget: form.fundingTarget ? Number(form.fundingTarget) : undefined,
        remainderBeneficiary: form.remainderBeneficiary,
        dispositionInstructions: form.dispositionInstructions,
        incapacityInstructions: form.incapacityInstructions,
        fundingNotes: form.fundingNotes,
      });
      setSaved(true);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr,340px]">
      <div className="space-y-6">
        <section className="card space-y-4">
          <h2 className="font-bold text-brand-900">You (the settlor)</h2>
          <Field label="Full legal name" value={form.settlorFullName} onChange={(v) => set('settlorFullName', v)} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Phone (used on the emergency card)" value={form.settlorPhone} onChange={(v) => set('settlorPhone', v)} />
            <Field label="Email" type="email" value={form.settlorEmail} onChange={(v) => set('settlorEmail', v)} />
          </div>
          <Field label="Address" value={form.settlorAddress} onChange={(v) => set('settlorAddress', v)} textarea />
        </section>

        <section className="card space-y-4">
          <h2 className="font-bold text-brand-900">Funding & remainder</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Target funding amount ($)" type="number" value={String(form.fundingTarget)} onChange={(v) => set('fundingTarget', v)} placeholder="e.g. 25000" />
            <Field label="Remainder beneficiary (unused funds)" value={form.remainderBeneficiary} onChange={(v) => set('remainderBeneficiary', v)} placeholder="e.g. Local Humane Society" />
          </div>
          <Field label="Funding notes" value={form.fundingNotes} onChange={(v) => set('fundingNotes', v)} textarea />
        </section>

        <section className="card space-y-4">
          <h2 className="font-bold text-brand-900">Instructions</h2>
          <Field
            label="Disposition, medical & end-of-life standard"
            value={form.dispositionInstructions}
            onChange={(v) => set('dispositionInstructions', v)}
            textarea
            placeholder="Your preferences for rehoming, medical treatment limits, and end-of-life care."
          />
          <Field
            label="If you are incapacitated (not deceased)"
            value={form.incapacityInstructions}
            onChange={(v) => set('incapacityInstructions', v)}
            textarea
            placeholder="Who acts, and how care is paid for, before an estate is administered."
          />
        </section>

        <div className="flex items-center gap-3">
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-green-700">Saved ✓</span>}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card">
          <h3 className="font-bold text-brand-900 mb-3">Readiness checklist</h3>
          <ul className="space-y-2">
            {data.readiness.items.map((item) => (
              <li key={item.key} className="flex gap-2 text-sm">
                <span className={item.done ? 'text-green-600' : 'text-slate-300'}>{item.done ? '✓' : '○'}</span>
                <span>
                  <span className={item.done ? 'text-slate-700' : 'text-slate-900 font-medium'}>{item.label}</span>
                  {!item.done && <span className="block text-xs text-slate-500">{item.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        </div>
        {data.stateLaw && (
          <div className="card text-sm">
            <h3 className="font-bold text-brand-900 mb-2">{data.stateLaw.name} law</h3>
            <p className="text-slate-600">{data.stateLaw.statuteCitation}</p>
            <p className="text-slate-600 mt-2">{data.stateLaw.durationRule}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
