import { useState } from 'react';
import { api } from '../../api/client';
import type { Caregiver, Trustee } from '../../lib/types';
import { Banner, Field, SelectField } from '../ui';

export function PeopleTab({
  planId,
  caregivers,
  trustees,
  onChange,
}: {
  planId: string;
  caregivers: Caregiver[];
  trustees: Trustee[];
  onChange: () => void;
}) {
  return (
    <div className="space-y-6">
      <Banner>
        Name a <strong>primary caregiver</strong> and at least one <strong>alternate</strong>, plus a
        <strong> trustee/enforcer</strong> who is a different person — so control of the money is separated
        from custody of the animal.
      </Banner>

      <PersonSection
        title="Caregivers"
        subtitle="Who takes physical custody of the animal."
        planId={planId}
        resource="caregivers"
        people={caregivers}
        roles={[
          { value: 'PRIMARY', label: 'Primary' },
          { value: 'ALTERNATE', label: 'Alternate' },
        ]}
        onChange={onChange}
      />

      <PersonSection
        title="Trustees & enforcers"
        subtitle="Who holds the funds and can enforce the care terms."
        planId={planId}
        resource="trustees"
        people={trustees}
        roles={[
          { value: 'TRUSTEE', label: 'Trustee' },
          { value: 'SUCCESSOR_TRUSTEE', label: 'Successor trustee' },
          { value: 'ENFORCER', label: 'Enforcer' },
        ]}
        onChange={onChange}
      />
    </div>
  );
}

interface PersonLike {
  id: string;
  role: string;
  full_name: string;
  relationship?: string;
  phone?: string;
  email?: string;
  address?: string;
  confirmed: boolean;
}

function PersonSection({
  title,
  subtitle,
  planId,
  resource,
  people,
  roles,
  onChange,
}: {
  title: string;
  subtitle: string;
  planId: string;
  resource: 'caregivers' | 'trustees';
  people: PersonLike[];
  roles: Array<{ value: string; label: string }>;
  onChange: () => void;
}) {
  const [form, setForm] = useState({
    role: roles[0].value,
    fullName: '',
    relationship: '',
    phone: '',
    email: '',
    address: '',
  });
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await api.post(`/plans/${planId}/${resource}/`, payload);
      setForm({ ...form, fullName: '', relationship: '', phone: '', email: '', address: '' });
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await api.del(`/plans/${planId}/${resource}/${id}`);
    onChange();
  }

  async function toggleConfirmed(person: PersonLike) {
    await api.put(`/plans/${planId}/${resource}/${person.id}`, { confirmed: !person.confirmed });
    onChange();
  }

  return (
    <section className="card space-y-4">
      <div>
        <h2 className="font-bold text-brand-900">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>

      {people.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {people.map((p) => (
            <li key={p.id} className="py-3 flex items-center justify-between gap-3">
              <div>
                <div className="font-medium text-slate-900">
                  {p.full_name}{' '}
                  <span className="text-xs font-semibold text-brand-600">{p.role.replace('_', ' ')}</span>
                </div>
                <div className="text-xs text-slate-500">
                  {[p.relationship, p.phone, p.email].filter(Boolean).join(' · ') || 'No contact details'}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={p.confirmed} onChange={() => toggleConfirmed(p)} />
                  Confirmed willing
                </label>
                <button className="text-red-600 text-sm" onClick={() => remove(p.id)}>
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={add} className="grid gap-3 sm:grid-cols-2 border-t border-slate-100 pt-4">
        <SelectField label="Role" value={form.role} onChange={(v) => set('role', v)} options={roles} />
        <Field label="Full name" value={form.fullName} onChange={(v) => set('fullName', v)} required />
        <Field label="Relationship" value={form.relationship} onChange={(v) => set('relationship', v)} />
        <Field label="Phone" value={form.phone} onChange={(v) => set('phone', v)} />
        <Field label="Email" value={form.email} onChange={(v) => set('email', v)} />
        <Field label="Address" value={form.address} onChange={(v) => set('address', v)} />
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={busy || !form.fullName}>
            {busy ? 'Adding…' : `Add ${title.toLowerCase().replace(/s$/, '')}`}
          </button>
        </div>
      </form>
    </section>
  );
}
