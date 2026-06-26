import { useMemo } from 'react'
import { useStore } from '../app/store'
import { computeForecast } from '../lib/forecast'
import { formatShort, daysBetween } from '../lib/dates'
import type { DailyLog } from '../lib/types'

interface Series {
  label: string
  color: string
  points: { x: number; y: number }[]
  dashed?: boolean
}

/** Minimal responsive SVG line chart (no external deps). */
function LineChart({
  series,
  height = 120,
  yMin,
  yMax,
  format = (n) => n.toFixed(0),
}: {
  series: Series[]
  height?: number
  yMin?: number
  yMax?: number
  format?: (n: number) => string
}) {
  const W = 320
  const H = height
  const padL = 34
  const padR = 8
  const padT = 10
  const padB = 18

  const allY = series.flatMap((s) => s.points.map((p) => p.y))
  const allX = series.flatMap((s) => s.points.map((p) => p.x))
  if (allY.length === 0) {
    return <div className="py-8 text-center text-xs text-mute-soft">No data yet</div>
  }

  const minY = yMin ?? Math.min(...allY)
  const maxY = yMax ?? Math.max(...allY)
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const rangeY = maxY - minY || 1
  const rangeX = maxX - minX || 1

  const sx = (x: number) => padL + ((x - minX) / rangeX) * (W - padL - padR)
  const sy = (y: number) => padT + (1 - (y - minY) / rangeY) * (H - padT - padB)

  const ticks = [minY, minY + rangeY / 2, maxY]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
      {/* gridlines */}
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={padL} y1={sy(t)} x2={W - padR} y2={sy(t)} stroke="#222834" strokeWidth={0.5} />
          <text x={2} y={sy(t) + 3} fill="#5d6573" fontSize={8} className="tnum">
            {format(t)}
          </text>
        </g>
      ))}
      {series.map((s, si) => {
        if (s.points.length === 0) return null
        const d = s.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${sx(p.x).toFixed(1)} ${sy(p.y).toFixed(1)}`)
          .join(' ')
        return (
          <g key={si}>
            <path
              d={d}
              fill="none"
              stroke={s.color}
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dashed ? '3 3' : undefined}
            />
            {!s.dashed &&
              s.points.map((p, i) => (
                <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={1.6} fill={s.color} />
              ))}
          </g>
        )
      })}
    </svg>
  )
}

function ChartCard({
  title,
  legend,
  children,
}: {
  title: string
  legend?: { label: string; color: string }[]
  children: React.ReactNode
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-mute">{title}</h2>
        {legend && (
          <div className="flex gap-3">
            {legend.map((l) => (
              <span key={l.label} className="flex items-center gap-1 text-[10px] text-mute-soft">
                <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

interface WeekSummary {
  weekStart: string
  label: string
  avgWeight?: number
  weightChange?: number
  avgCalories: number
  avgProtein: number
  avgScore: number
  loggedDays: number
}

function buildWeeklySummaries(logs: DailyLog[]): WeekSummary[] {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) return []
  const start = sorted[0].date
  const groups = new Map<number, DailyLog[]>()
  for (const log of sorted) {
    const wk = Math.floor(daysBetween(start, log.date) / 7)
    if (!groups.has(wk)) groups.set(wk, [])
    groups.get(wk)!.push(log)
  }

  const summaries: WeekSummary[] = []
  let prevAvgWeight: number | undefined
  for (const [, days] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
    const weights = days.filter((d) => d.morningWeight != null).map((d) => d.morningWeight!)
    const logged = days.filter((d) => d.meals.length > 0)
    const avgWeight = weights.length
      ? weights.reduce((a, b) => a + b, 0) / weights.length
      : undefined
    const avgCalories = logged.length
      ? logged.reduce((a, d) => a + d.totalCalories, 0) / logged.length
      : 0
    const avgProtein = logged.length
      ? logged.reduce((a, d) => a + d.totalProtein, 0) / logged.length
      : 0
    const avgScore = logged.length
      ? logged.reduce((a, d) => a + d.complianceScore, 0) / logged.length
      : 0
    const weightChange =
      avgWeight != null && prevAvgWeight != null ? avgWeight - prevAvgWeight : undefined
    summaries.push({
      weekStart: days[0].date,
      label: `${formatShort(days[0].date)} – ${formatShort(days[days.length - 1].date)}`,
      avgWeight,
      weightChange,
      avgCalories,
      avgProtein,
      avgScore,
      loggedDays: logged.length,
    })
    if (avgWeight != null) prevAvgWeight = avgWeight
  }
  return summaries.reverse() // newest first
}

export function History() {
  const { state } = useStore()
  const logs = useMemo(
    () => Object.values(state.logs).sort((a, b) => a.date.localeCompare(b.date)),
    [state.logs],
  )
  const forecast = useMemo(
    () => computeForecast(state.logs, state.settings),
    [state.logs, state.settings],
  )

  const baseDate = logs[0]?.date

  const weightSeries: Series[] = useMemo(() => {
    if (!baseDate) return []
    const daily = forecast.trend.map((t) => ({ x: daysBetween(baseDate, t.date), y: t.weight }))
    const rolling = forecast.trend.map((t) => ({ x: daysBetween(baseDate, t.date), y: t.rolling }))
    return [
      { label: 'Daily', color: '#5d6573', points: daily },
      { label: '7-day avg', color: '#4ea1ff', points: rolling },
    ]
  }, [forecast.trend, baseDate])

  const loggedDays = useMemo(() => logs.filter((l) => l.meals.length > 0), [logs])

  const scoreSeries: Series[] = baseDate
    ? [
        {
          label: 'Score',
          color: '#3ecf8e',
          points: loggedDays.map((l) => ({ x: daysBetween(baseDate, l.date), y: l.complianceScore })),
        },
      ]
    : []
  const calSeries: Series[] = baseDate
    ? [
        {
          label: 'Calories',
          color: '#f5b94d',
          points: loggedDays.map((l) => ({ x: daysBetween(baseDate, l.date), y: l.totalCalories })),
        },
      ]
    : []
  const proteinSeries: Series[] = baseDate
    ? [
        {
          label: 'Protein',
          color: '#4ea1ff',
          points: loggedDays.map((l) => ({ x: daysBetween(baseDate, l.date), y: l.totalProtein })),
        },
      ]
    : []

  const weeks = useMemo(() => buildWeeklySummaries(logs), [logs])

  if (logs.length === 0) {
    return (
      <div className="pt-1">
        <h1 className="text-xl font-bold tracking-tight">History</h1>
        <p className="mt-6 text-sm text-mute-soft">
          No history yet. Log weight and meals to build your trend charts.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-24 pt-1">
      <h1 className="text-xl font-bold tracking-tight">History</h1>

      <ChartCard
        title="Weight"
        legend={[
          { label: 'Daily', color: '#5d6573' },
          { label: '7-day avg', color: '#4ea1ff' },
        ]}
      >
        <LineChart series={weightSeries} format={(n) => n.toFixed(0)} />
      </ChartCard>

      <ChartCard title="PSMF Score">
        <LineChart series={scoreSeries} yMin={0} yMax={10} format={(n) => n.toFixed(0)} />
      </ChartCard>

      <ChartCard title="Calories">
        <LineChart series={calSeries} format={(n) => n.toFixed(0)} />
      </ChartCard>

      <ChartCard title="Protein (g)">
        <LineChart series={proteinSeries} yMin={0} format={(n) => n.toFixed(0)} />
      </ChartCard>

      {/* Weekly summaries */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-mute">Weekly Summary</h2>
        <div className="mt-3 space-y-2">
          {weeks.map((w) => (
            <div
              key={w.weekStart}
              className="flex items-center justify-between rounded-xl border border-ink-line bg-ink-soft/50 p-3"
            >
              <div>
                <div className="text-sm font-medium">{w.label}</div>
                <div className="text-[11px] text-mute-soft tnum">
                  {w.loggedDays} days logged · avg score {w.avgScore.toFixed(1)}
                </div>
              </div>
              <div className="text-right">
                <div className="tnum text-sm font-semibold">
                  {w.weightChange != null ? (
                    <span className={w.weightChange <= 0 ? 'text-good' : 'text-warn'}>
                      {w.weightChange <= 0 ? '' : '+'}
                      {w.weightChange.toFixed(1)} lb
                    </span>
                  ) : (
                    '—'
                  )}
                </div>
                <div className="text-[11px] text-mute-soft tnum">
                  {w.avgCalories.toFixed(0)} kcal · {w.avgProtein.toFixed(0)}P
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
