import type { ProteinBadge } from '../lib/types'

const STYLES: Record<ProteinBadge, string> = {
  'Elite PSMF': 'bg-good/15 text-good border-good/30',
  Strong: 'bg-accent/15 text-accent border-accent/30',
  Acceptable: 'bg-warn/15 text-warn border-warn/30',
  'Poor for cut': 'bg-bad/15 text-bad border-bad/30',
}

export function BadgePill({ badge }: { badge: ProteinBadge }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STYLES[badge]}`}
    >
      {badge}
    </span>
  )
}
