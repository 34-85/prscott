import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import type { StateLaw, StateLawSummary } from '../lib/types';
import { US_STATES } from '../lib/states';
import { Banner, SelectField } from '../components/ui';

export default function LearnPage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [list, setList] = useState<StateLawSummary[]>([]);
  const [law, setLaw] = useState<StateLaw | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [selected, setSelected] = useState(code?.toUpperCase() ?? 'GA');

  useEffect(() => {
    api.get<{ states: StateLawSummary[]; disclaimer: string }>('/states').then((r) => {
      setList(r.states);
      setDisclaimer(r.disclaimer);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get<{ state: StateLaw }>(`/states/${selected}`).then((r) => setLaw(r.state)).catch(() => setLaw(null));
  }, [selected]);

  function choose(c: string) {
    setSelected(c);
    navigate(`/learn/${c}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Pet trust law by state</h1>
        <p className="text-sm text-slate-500">
          Every U.S. jurisdiction recognizes a trust for the care of an animal. Pick a state to see how it works.
        </p>
      </div>

      <div className="max-w-sm">
        <SelectField
          label="State or territory"
          value={selected}
          onChange={choose}
          options={(list.length ? list.map((s) => ({ value: s.code, label: s.name })) : US_STATES.map((s) => ({ value: s.code, label: s.name })))}
        />
      </div>

      {law && (
        <div className="card space-y-4">
          <div className="flex items-baseline justify-between flex-wrap gap-2">
            <h2 className="text-xl font-bold text-brand-900">{law.name}</h2>
            <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
              {law.statuteCitation}
            </span>
          </div>
          <dl className="grid gap-4 sm:grid-cols-2">
            <Info term="Statutory model" val={law.model} />
            <Info term="How long the trust lasts" val={law.durationRule} />
            <Info term="Who can enforce it" val={law.enforcement} />
            <Info term="Unused funds default to" val={law.remainderDefault} />
            <Info
              term="Court may reduce excessive funds?"
              val={law.courtMayReduceExcessFunds ? 'Yes — a court may reduce funds it finds excessive' : 'No specific statutory reduction power'}
            />
          </dl>
          {law.notes && (
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
              <strong>Note:</strong> {law.notes}
            </div>
          )}
        </div>
      )}

      {disclaimer && <Banner>{disclaimer}</Banner>}
    </div>
  );
}

function Info({ term, val }: { term: string; val: string }) {
  return (
    <div>
      <dt className="label">{term}</dt>
      <dd className="text-sm text-slate-800">{val}</dd>
    </div>
  );
}
