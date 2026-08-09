import { Link } from 'react-router-dom';

const PROBLEMS = [
  {
    title: 'No designated caregiver',
    body: 'Without a directive, no chosen person has clear authority or duty to take the animal — family, heirs, or the estate administrator decide.',
  },
  {
    title: 'No funded care arrangement',
    body: 'A willing caregiver may have no dedicated money for food, boarding, medication, insurance, or emergency vet bills.',
  },
  {
    title: 'Pets cannot inherit',
    body: 'An animal is legally property, not a beneficiary. Money left directly to a pet is ineffective.',
  },
  {
    title: 'Probate delay',
    body: 'A will alone operates through probate — months during which the pet’s care is uncertain and estate funds are not readily available.',
  },
  {
    title: 'Heir conflict',
    body: 'Heirs may disagree over who takes the pet or whether the estate should pay for costly health or behavioral needs.',
  },
  {
    title: 'No disposition standard',
    body: 'Without written instructions, decisions about rehoming, treatment, and end-of-life care aren’t guided by your preferences.',
  },
];

const STEPS = [
  ['Name caregivers', 'A primary plus at least one confirmed alternate, so there is no custody gap.'],
  ['Add a trustee', 'A separate person controls the money and can enforce the care terms.'],
  ['Fund it', 'Earmark life insurance, an account, or a bequest — a real, timely pool of money.'],
  ['Write the care memo', 'Vet, microchip, meds, diet, routine, behavior, and placement preferences.'],
  ['Generate documents', 'A state-specific trust directive, care memorandum, and emergency card, ready for your attorney.'],
];

export default function LandingPage() {
  return (
    <div className="space-y-12">
      <section className="text-center pt-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-brand-600">
          Pet estate planning · all 50 states + D.C.
        </p>
        <h1 className="mt-2 text-4xl sm:text-5xl font-extrabold text-brand-900 max-w-3xl mx-auto leading-tight">
          If something happens to you, who cares for your pet — and who pays?
        </h1>
        <p className="mt-4 text-lg text-slate-600 max-w-2xl mx-auto">
          A pet is legally property, not an heir. PetGuardian helps you build a funded,
          enforceable animal-care trust so your pet has a caregiver, money, and clear
          instructions from day one.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/register" className="btn-primary px-6 py-3 text-base">
            Build my plan
          </Link>
          <Link to="/learn" className="btn-ghost px-6 py-3 text-base">
            See my state’s law
          </Link>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-brand-900 mb-4">The problem when there’s no plan</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="card">
              <h3 className="font-semibold text-slate-900">{p.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="card bg-brand-900 text-white">
        <h2 className="text-xl font-bold mb-2">What a workable plan needs</h2>
        <p className="text-brand-100 text-sm mb-5 max-w-2xl">
          Every U.S. state now recognizes a trust for the care of an animal (most modeled on
          Uniform Trust Code § 408). PetGuardian walks you through each required piece.
        </p>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map(([t, b], i) => (
            <li key={t} className="rounded-lg bg-white/10 p-4">
              <div className="text-2xl font-bold text-brand-100">{i + 1}</div>
              <div className="mt-1 font-semibold">{t}</div>
              <div className="mt-1 text-xs text-brand-100/90">{b}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="text-center">
        <h2 className="text-2xl font-bold text-brand-900">Ready in an afternoon</h2>
        <p className="mt-2 text-slate-600">Start free — your information is saved to your account.</p>
        <Link to="/register" className="btn-primary mt-4 px-6 py-3 text-base">
          Get started
        </Link>
      </section>
    </div>
  );
}
