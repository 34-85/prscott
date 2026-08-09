import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, downloadDocument } from '../api/client';
import type { FullPlanResponse } from '../lib/types';
import { US_STATES } from '../lib/states';
import { Banner, ReadinessBadge, ScoreRing } from '../components/ui';
import { OverviewTab } from '../components/plan/OverviewTab';
import { PetsTab } from '../components/plan/PetsTab';
import { PeopleTab } from '../components/plan/PeopleTab';
import { FundingTab } from '../components/plan/FundingTab';

const TABS = ['Overview', 'Pets', 'People', 'Funding', 'Documents'] as const;
type Tab = (typeof TABS)[number];

const DOCS = [
  { type: 'trust-directive', name: 'Animal Care Trust Directive', desc: 'The state-specific trust instrument for your attorney to finalize.', file: 'PetGuardian-Trust-Directive.pdf' },
  { type: 'care-memorandum', name: 'Pet Care Memorandum', desc: 'Detailed care instructions to travel with the animal.', file: 'PetGuardian-Care-Memorandum.pdf' },
  { type: 'emergency-card', name: 'Emergency Wallet Card', desc: 'Cut-out card and home posting so a caregiver can act immediately.', file: 'PetGuardian-Emergency-Card.pdf' },
];

export default function PlanPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<FullPlanResponse | null>(null);
  const [tab, setTab] = useState<Tab>('Overview');
  const [error, setError] = useState('');
  const [busyDoc, setBusyDoc] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await api.get<FullPlanResponse>(`/plans/${id}`);
      setData(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load plan');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function deletePlan() {
    if (!confirm('Delete this plan and all its data? This cannot be undone.')) return;
    await api.del(`/plans/${id}`);
    navigate('/dashboard');
  }

  async function getDoc(type: string, file: string) {
    setBusyDoc(type);
    try {
      await downloadDocument(id!, type, file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setBusyDoc('');
    }
  }

  if (error) return <Banner tone="error">{error}</Banner>;
  if (!data) return <p className="text-slate-500">Loading…</p>;

  const stateName = US_STATES.find((s) => s.code === data.plan.state)?.name ?? data.plan.state;

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/dashboard')} className="text-sm text-brand-600 font-semibold">
        ← All plans
      </button>

      <div className="card flex flex-col sm:flex-row sm:items-center gap-5">
        <ScoreRing score={data.readiness.score} />
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-brand-900">{data.plan.name}</h1>
            <ReadinessBadge level={data.readiness.level} />
          </div>
          <p className="text-sm text-slate-500 mt-1">
            {stateName} · {data.stateLaw?.statuteCitation ?? 'statute reference unavailable'}
          </p>
          {data.readiness.gaps.length > 0 && (
            <p className="text-sm text-amber-700 mt-2">
              Next: {data.readiness.gaps.slice(0, 3).join(' · ')}
              {data.readiness.gaps.length > 3 ? ' …' : ''}
            </p>
          )}
        </div>
        <button className="btn-danger self-start" onClick={deletePlan}>
          Delete plan
        </button>
      </div>

      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px whitespace-nowrap ${
              tab === t ? 'border-brand-500 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Overview' && <OverviewTab data={data} onChange={load} />}
      {tab === 'Pets' && <PetsTab planId={id!} pets={data.pets} onChange={load} />}
      {tab === 'People' && (
        <PeopleTab planId={id!} caregivers={data.caregivers} trustees={data.trustees} onChange={load} />
      )}
      {tab === 'Funding' && <FundingTab planId={id!} sources={data.fundingSources} onChange={load} />}
      {tab === 'Documents' && (
        <div className="space-y-4">
          <Banner>
            Documents are generated from what you’ve entered. Complete more of your plan for stronger
            documents, then review them with a licensed attorney in {stateName} before signing.
          </Banner>
          <div className="grid gap-4 sm:grid-cols-3">
            {DOCS.map((d) => (
              <div key={d.type} className="card flex flex-col">
                <h3 className="font-semibold text-slate-900">{d.name}</h3>
                <p className="text-sm text-slate-600 mt-1 flex-1">{d.desc}</p>
                <button
                  className="btn-primary mt-4"
                  disabled={busyDoc === d.type}
                  onClick={() => getDoc(d.type, d.file)}
                >
                  {busyDoc === d.type ? 'Generating…' : 'Download PDF'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
