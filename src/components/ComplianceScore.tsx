import type { DailyLog, UserSettings } from '../lib/types'
import { computeCompliance, statusColor } from '../lib/compliance'

interface Props {
  log: DailyLog
  settings: UserSettings
  compact?: boolean
}

/** Circular PSMF compliance gauge with status label and component breakdown. */
export function ComplianceScore({ log, settings, compact }: Props) {
  const result = computeCompliance(log, settings)
  const { score, status, breakdown } = result

  const pct = score / 10
  const radius = compact ? 26 : 40
  const stroke = compact ? 6 : 8
  const c = 2 * Math.PI * radius
  const dash = c * pct

  const ringColor =
    status === 'Excellent' || status === 'Strong'
      ? '#3ecf8e'
      : status === 'Acceptable'
        ? '#4ea1ff'
        : status === 'Marginal'
          ? '#f5b94d'
          : '#f06a6a'

  const size = (radius + stroke) * 2

  return (
    <div className={compact ? 'flex items-center gap-3' : 'flex items-center gap-5'}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#222834"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`tnum font-bold ${compact ? 'text-lg' : 'text-2xl'}`}>
            {result.hasData ? score.toFixed(1) : '—'}
          </span>
          {!compact && <span className="text-[10px] text-mute-soft">/ 10</span>}
        </div>
      </div>

      <div className="min-w-0">
        <div className="stat-label">PSMF Score</div>
        <div className={`text-lg font-semibold ${statusColor(status)}`}>
          {result.hasData ? status : 'No Data'}
        </div>
        {!compact && (
          <>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-mute">
              <Component label="Protein" value={breakdown.protein} max={3} />
              <Component label="Carbs" value={breakdown.carbs} max={2} />
              <Component label="Fat" value={breakdown.fat} max={2} />
              <Component label="Cals" value={breakdown.calories} max={2} />
              <Component label="Logging" value={breakdown.logging} max={1} />
            </div>
            {result.gradedAs !== 'PSMF Day' && (
              <div className="mt-1.5 text-[11px] text-mute-soft">
                Graded against <span className="text-warn">{result.gradedAs}</span> targets
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Component({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <span className="tnum">
      {label} <span className="text-fg font-medium">{value}</span>
      <span className="text-mute-soft">/{max}</span>
    </span>
  )
}
