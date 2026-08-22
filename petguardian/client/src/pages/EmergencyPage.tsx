import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { loadAllSnapshots, removeSnapshot, type EmergencySnapshot } from '../lib/offline';
import { isNative, shareText } from '../lib/native';

export default function EmergencyPage() {
  const [snaps, setSnaps] = useState<EmergencySnapshot[]>(
    () => Object.values(loadAllSnapshots()).sort((a, b) => b.savedAt.localeCompare(a.savedAt)),
  );

  function drop(planId: string) {
    removeSnapshot(planId);
    setSnaps((prev) => prev.filter((s) => s.planId !== planId));
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">Emergency cards</h1>
          <p className="text-sm text-slate-500">Saved on this device. Works with no internet and no sign-in.</p>
        </div>
        {snaps.length > 0 && (
          <button className="btn-ghost print:hidden" onClick={() => window.print()}>
            Print
          </button>
        )}
      </div>

      {snaps.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-slate-600">No emergency card saved yet.</p>
          <p className="text-sm text-slate-500 mt-1">
            Open a plan while online and it’s saved here automatically for offline access.
          </p>
          <Link to="/dashboard" className="btn-primary mt-4 inline-block">
            Go to my plans
          </Link>
        </div>
      ) : (
        snaps.map((snap) => <Card key={snap.planId} snap={snap} onDrop={() => drop(snap.planId)} />)
      )}
    </div>
  );
}

function Card({ snap, onDrop }: { snap: EmergencySnapshot; onDrop: () => void }) {
  const text = useMemo(() => toShareText(snap), [snap]);

  return (
    <div className="card space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-bold text-brand-900">{snap.planName || 'Pet care plan'}</h2>
          <p className="text-xs text-slate-400">Saved {new Date(snap.savedAt).toLocaleDateString()}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          {isNative() && (
            <button className="text-brand-600 text-sm" onClick={() => shareText('Emergency pet card', text)}>
              Share
            </button>
          )}
          <button className="text-red-600 text-sm" onClick={onDrop}>
            Remove
          </button>
        </div>
      </div>

      <div className="rounded-lg bg-brand-50 p-3 text-sm">
        <strong className="text-brand-900">In an emergency:</strong> there {snap.pets.length === 1 ? 'is 1 pet' : `are ${snap.pets.length} pet(s)`} who need care. Contact the caregivers below.
      </div>

      <Field label="Owner" value={[snap.owner.name, snap.owner.phone].filter(Boolean).join(' · ')} />
      {snap.owner.address && <Field label="Home" value={snap.owner.address} />}

      <div>
        <p className="label">Caregivers & trustees</p>
        {snap.contacts.length === 0 ? (
          <p className="text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="text-sm space-y-1">
            {snap.contacts.map((c, i) => (
              <li key={i}>
                <span className="font-semibold text-brand-700">{c.role}:</span> {c.name || '—'}
                {c.phone ? ` · ${c.phone}` : ''}
                {c.email ? ` · ${c.email}` : ''}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="label">Animals</p>
        {snap.pets.length === 0 ? (
          <p className="text-sm text-slate-500">None recorded.</p>
        ) : (
          <ul className="text-sm space-y-2">
            {snap.pets.map((p, i) => (
              <li key={i} className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
                <div className="font-semibold text-slate-900">
                  {p.name || '—'} {[p.species].filter(Boolean).join('')}
                </div>
                {p.microchip && <div className="text-slate-600">Microchip: {p.microchip}</div>}
                {p.medications && <div className="text-slate-600">Meds: {p.medications}</div>}
                {p.allergies && <div className="text-slate-600">Allergies: {p.allergies}</div>}
                {(p.vetPhone || p.emergencyVetPhone) && (
                  <div className="text-slate-600">
                    Vet: {[p.vetPhone, p.emergencyVetPhone].filter(Boolean).join(' · ')}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="text-sm text-slate-800">{value || '—'}</div>
    </div>
  );
}

function toShareText(snap: EmergencySnapshot): string {
  const lines = [`EMERGENCY PET CARE — ${snap.planName}`];
  lines.push(`Owner: ${[snap.owner.name, snap.owner.phone].filter(Boolean).join(' ')}`);
  snap.contacts.forEach((c) => lines.push(`${c.role}: ${[c.name, c.phone].filter(Boolean).join(' ')}`));
  snap.pets.forEach((p) => {
    const bits = [p.name, p.microchip && `chip ${p.microchip}`, p.medications && `meds ${p.medications}`]
      .filter(Boolean)
      .join(', ');
    lines.push(`Pet: ${bits}`);
  });
  return lines.join('\n');
}
