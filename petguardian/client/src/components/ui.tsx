import type { ReactNode } from 'react';

export function Field({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  textarea,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  textarea?: boolean;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="label">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {textarea ? (
        <textarea
          className="input min-h-[80px]"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input"
          type={type}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ReadinessBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    Complete: 'bg-green-100 text-green-800',
    Solid: 'bg-brand-100 text-brand-700',
    'Getting there': 'bg-amber-100 text-amber-800',
    'Not started': 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${map[level] ?? 'bg-slate-100'}`}>
      {level}
    </span>
  );
}

export function ScoreRing({ score }: { score: number }) {
  const color = score >= 100 ? '#16a34a' : score >= 75 ? '#2f49b8' : score >= 35 ? '#d97706' : '#94a3b8';
  return (
    <div
      className="relative grid place-items-center rounded-full"
      style={{
        width: 96,
        height: 96,
        background: `conic-gradient(${color} ${score * 3.6}deg, #e2e8f0 0deg)`,
      }}
    >
      <div className="grid place-items-center rounded-full bg-white" style={{ width: 74, height: 74 }}>
        <span className="text-xl font-bold" style={{ color }}>
          {score}
        </span>
        <span className="text-[10px] text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

export function Banner({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'error' }) {
  const cls =
    tone === 'error'
      ? 'bg-red-50 text-red-700 ring-red-200'
      : 'bg-brand-50 text-brand-900 ring-brand-100';
  return <div className={`rounded-lg px-4 py-3 text-sm ring-1 ${cls}`}>{children}</div>;
}
