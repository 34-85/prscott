import type { Confidence, RestaurantInfo } from '../lib/types'
import { errorBand } from '../lib/confidence'

const CONF_STYLE: Record<Confidence, string> = {
  high: 'text-good',
  medium: 'text-warn',
  low: 'text-bad',
}

/** Small "estimated" tag shown on restaurant meals. */
export function RestaurantTag() {
  return (
    <span className="inline-flex items-center rounded-full border border-warn/30 bg-warn/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warn">
      Restaurant ~est
    </span>
  )
}

function RangeRow({ label, lo, hi, unit }: { label: string; lo: number; hi: number; unit: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-[11px] text-mute-soft">{label}</span>
      <span className="tnum text-[13px] font-medium">
        {lo}–{hi}
        <span className="ml-0.5 text-[10px] text-mute-soft">{unit}</span>
      </span>
    </div>
  )
}

/** Full range / hidden-calorie / components breakdown for a restaurant estimate. */
export function RestaurantDetail({
  info,
  confidence,
}: {
  info: RestaurantInfo
  confidence?: Confidence
}) {
  const r = info.range
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-mute-soft">
          Estimated range
        </span>
        {confidence && (
          <span className={`text-[11px] font-medium ${CONF_STYLE[confidence]}`}>
            {confidence} {errorBand(confidence).label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <RangeRow label="Calories" lo={r.calories[0]} hi={r.calories[1]} unit="kcal" />
        <RangeRow label="Protein" lo={r.protein[0]} hi={r.protein[1]} unit="g" />
        <RangeRow label="Carbs" lo={r.carbs[0]} hi={r.carbs[1]} unit="g" />
        <RangeRow label="Fat" lo={r.fat[0]} hi={r.fat[1]} unit="g" />
      </div>

      <div className="rounded-lg bg-warn/10 px-2.5 py-1.5 text-[11px] text-warn">
        ~{info.hiddenCalories} kcal likely hidden in cooking oils &amp; sauces
      </div>

      {info.components.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {info.components.map((cmp, i) => (
            <span
              key={i}
              className="rounded-full border border-ink-line bg-ink-soft px-2 py-0.5 text-[10px] text-mute"
            >
              {cmp}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
