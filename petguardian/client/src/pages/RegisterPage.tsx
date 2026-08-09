import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Banner, Field, SelectField } from '../components/ui';
import { US_STATES } from '../lib/states';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('OWNER');
  const [state, setState] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register({
        fullName,
        email,
        password,
        role: role as 'OWNER' | 'ATTORNEY',
        state: state || undefined,
      });
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <div className="card">
        <h1 className="text-2xl font-bold text-brand-900 mb-1">Create your account</h1>
        <p className="text-sm text-slate-500 mb-5">Your plan is saved securely to your account.</p>
        {error && <div className="mb-4"><Banner tone="error">{error}</Banner></div>}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name" value={fullName} onChange={setFullName} required />
          <Field label="Email" type="email" value={email} onChange={setEmail} required />
          <Field label="Password" type="password" value={password} onChange={setPassword} required placeholder="At least 8 characters" />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="I am a"
              value={role}
              onChange={setRole}
              options={[
                { value: 'OWNER', label: 'Pet owner' },
                { value: 'ATTORNEY', label: 'Attorney' },
              ]}
            />
            <SelectField
              label="Home state"
              value={state}
              onChange={setState}
              options={[{ value: '', label: 'Select…' }, ...US_STATES.map((s) => ({ value: s.code, label: s.name }))]}
            />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-brand-600">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
