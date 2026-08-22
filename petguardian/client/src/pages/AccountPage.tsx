import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { US_STATES } from '../lib/states';
import { Banner, Field } from '../components/ui';

export default function AccountPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!user) return null;
  const stateName = user.state ? US_STATES.find((s) => s.code === user.state)?.name ?? user.state : '—';

  async function deleteAccount(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.del('/auth/me', { password });
      logout();
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete account');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-900">Your account</h1>
        <p className="text-sm text-slate-500">Manage your profile and data.</p>
      </div>

      <div className="card space-y-2">
        <Row label="Name" value={user.fullName} />
        <Row label="Email" value={user.email} />
        <Row label="Role" value={user.role === 'ATTORNEY' ? 'Attorney' : 'Pet owner'} />
        <Row label="Home state" value={stateName} />
      </div>

      <div className="card border border-red-200">
        <h2 className="font-bold text-red-700">Delete account</h2>
        <p className="text-sm text-slate-600 mt-1">
          Permanently delete your account and <strong>all</strong> of your plans, pets, caregivers, trustees,
          and funding records. This cannot be undone.
        </p>

        {!confirming ? (
          <button className="btn-danger mt-3" onClick={() => setConfirming(true)}>
            Delete my account
          </button>
        ) : (
          <form onSubmit={deleteAccount} className="mt-4 space-y-3">
            {error && <Banner tone="error">{error}</Banner>}
            <Field
              label="Confirm your password to delete"
              type="password"
              value={password}
              onChange={setPassword}
              required
            />
            <div className="flex gap-2">
              <button className="btn-danger" disabled={busy || !password}>
                {busy ? 'Deleting…' : 'Permanently delete'}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setConfirming(false);
                  setPassword('');
                  setError('');
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="text-xs text-slate-500">
        See our <Link to="/privacy" className="text-brand-600 font-medium">Privacy Policy</Link> for how your
        data is stored and deleted.
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  );
}
