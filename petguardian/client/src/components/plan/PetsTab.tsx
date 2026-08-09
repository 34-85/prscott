import { useState } from 'react';
import { api } from '../../api/client';
import type { Pet } from '../../lib/types';
import { Field, SelectField } from '../ui';

const EMPTY = {
  name: '', species: 'Dog', breed: '', color: '', sex: '', birthdate: '', microchip: '',
  vetName: '', vetPhone: '', insurance: '', medications: '', diet: '', routine: '',
  behavior: '', placementPreference: '', medicalDirectives: '',
};

export function PetsTab({ planId, pets, onChange }: { planId: string; pets: Pet[]; onChange: () => void }) {
  const [form, setForm] = useState(EMPTY);
  const [open, setOpen] = useState(pets.length === 0);
  const [busy, setBusy] = useState(false);

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).filter(([, v]) => v !== ''));
      await api.post(`/plans/${planId}/pets`, payload);
      setForm(EMPTY);
      setOpen(false);
      onChange();
    } finally {
      setBusy(false);
    }
  }

  async function remove(petId: string) {
    if (!confirm('Remove this animal?')) return;
    await api.del(`/plans/${planId}/pets/${petId}`);
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {pets.map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <p className="text-xs text-slate-500">
                  {[p.species, p.breed, p.color, p.sex].filter(Boolean).join(' · ') || 'No details'}
                </p>
              </div>
              <button className="text-red-600 text-sm" onClick={() => remove(p.id)}>
                Remove
              </button>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {p.microchip && <Row k="Microchip" v={p.microchip} />}
              {p.vet_name && <Row k="Vet" v={`${p.vet_name} ${p.vet_phone ?? ''}`} />}
              {p.medications && <Row k="Meds" v={p.medications} />}
              {p.diet && <Row k="Diet" v={p.diet} />}
              {p.placement_preference && <Row k="Placement" v={p.placement_preference} />}
            </dl>
          </div>
        ))}
      </div>

      {open ? (
        <form onSubmit={add} className="card space-y-4">
          <h3 className="font-bold text-brand-900">Add an animal</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Name" value={form.name} onChange={(v) => set('name', v)} required />
            <SelectField
              label="Species"
              value={form.species}
              onChange={(v) => set('species', v)}
              options={['Dog', 'Cat', 'Bird', 'Horse', 'Reptile', 'Small mammal', 'Fish', 'Other'].map((s) => ({ value: s, label: s }))}
            />
            <Field label="Breed" value={form.breed} onChange={(v) => set('breed', v)} />
            <Field label="Color / markings" value={form.color} onChange={(v) => set('color', v)} />
            <Field label="Sex" value={form.sex} onChange={(v) => set('sex', v)} />
            <Field label="Birthdate" type="date" value={form.birthdate} onChange={(v) => set('birthdate', v)} />
            <Field label="Microchip #" value={form.microchip} onChange={(v) => set('microchip', v)} />
            <Field label="Insurance" value={form.insurance} onChange={(v) => set('insurance', v)} />
            <Field label="Veterinarian" value={form.vetName} onChange={(v) => set('vetName', v)} />
            <Field label="Vet phone" value={form.vetPhone} onChange={(v) => set('vetPhone', v)} />
          </div>
          <Field label="Medications & dosing" value={form.medications} onChange={(v) => set('medications', v)} textarea />
          <Field label="Diet" value={form.diet} onChange={(v) => set('diet', v)} textarea />
          <Field label="Daily routine" value={form.routine} onChange={(v) => set('routine', v)} textarea />
          <Field label="Behavior & temperament" value={form.behavior} onChange={(v) => set('behavior', v)} textarea />
          <Field label="Placement preference" value={form.placementPreference} onChange={(v) => set('placementPreference', v)} textarea />
          <Field label="Medical & end-of-life directives" value={form.medicalDirectives} onChange={(v) => set('medicalDirectives', v)} textarea />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add animal'}</button>
            {pets.length > 0 && (
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
            )}
          </div>
        </form>
      ) : (
        <button className="btn-ghost" onClick={() => setOpen(true)}>
          + Add another animal
        </button>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="col-span-2">
      <span className="font-semibold text-slate-500">{k}: </span>
      <span className="text-slate-700">{v}</span>
    </div>
  );
}
