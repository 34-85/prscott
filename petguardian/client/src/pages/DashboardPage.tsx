import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import type { PlanSummary } from '../lib/types';
import { US_STATES } from '../lib/states';
import { useAuth } from '../auth/AuthContext';
import { Banner, Field, ReadinessBadge, SelectField } from '../components/ui';

export default function DashboardPage() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<PlanSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [state, setState] = useState(user?.state ?? 'GA');
  const [creating, setCreating] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<{ plans: PlanSummary[] }>('/plans');
      setPlans(r.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load plans');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createPlan(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.post('/plans', { name: name || 'My pet-care plan', state });
      setShowNew(false);
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create plan');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-900">My pet-care plans</h1>
          <p className="text-sm text-slate-500">Each plan becomes a funded, enforceable animal-care trust.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowNew((v) => !v)}>
          + New plan
        </button>
      </div>

      {error && <Banner tone="error">{error}</Banner>}

      {showNew && (
        <form onSubmit={createPlan} className="card grid gap-4 sm:grid-cols-[1fr,200px,auto] sm:items-end">
          <Field label="Plan name" value={name} onChange={setName} placeholder="e.g. The Miller household pets" />
          <SelectField
            label="Governing state"
            value={state}
            onChange={setState}
            options={US_STATES.map((s) => ({ value: s.code, label: s.name }))}
          />
          <button className="btn-primary" disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-500">Loading…</p>
      ) : plans.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-slate-600">You don’t have any plans yet.</p>
          <button className="btn-primary mt-3" onClick={() => setShowNew(true)}>
            Create your first plan
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p) => (
            <Link key={p.id} to={`/plans/${p.id}`} className="card hover:ring-brand-300 transition">
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-slate-900">{p.name}</h3>
                <ReadinessBadge level={p.readinessLevel} />
              </div>
              <p className="text-xs text-slate-500 mt-1">
                {US_STATES.find((s) => s.code === p.state)?.name ?? p.state} · {p.petCount} pet
                {p.petCount === 1 ? '' : 's'}
              </p>
              <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-brand-500" style={{ width: `${p.readinessScore}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-500">{p.readinessScore}% ready</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
