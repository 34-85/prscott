// LLM-backed chat coach. Bring-your-own-key: the user's Anthropic API key is
// pasted in Settings, stored only in this browser's localStorage, and used to
// call api.anthropic.com directly from the browser (with the
// `anthropic-dangerous-direct-browser-access` header, which the API requires
// as an explicit acknowledgement that the key is exposed client-side).
//
// This module has no dependency on the Anthropic SDK — a static site should
// ship as few bytes as possible, and one streaming Messages call is trivial.

import type { AppState, DailyLog } from './types'
import { addDays, todayKey } from './dates'
import { computeCompliance } from './compliance'
import { computeForecast } from './forecast'
import { streakSummary } from './streaks'
import { profileFor } from './dayType'

// Coach voice — matches the existing rule-based coach. Data-forward, no
// cheerleading, no shame. Every claim must reference the numbers provided.
export const SYSTEM_PROMPT = `You are the user's PSMF diet coach. You are an
experienced nutrition coach + data analyst + emotionally neutral performance
advisor. Priorities: accuracy, trend analysis over single readings, preventing
overreaction, reinforcing consistency. Absolutely no cheerleading, shame,
generic motivation, or overconfidence.

Rules:
- Every claim is tied to the DATA_CONTEXT numbers provided below.
- Prefer 7-day rolling averages over single-day weights.
- When the user asks something the data can't answer, say so plainly and
  explain what would let you answer it (more logged days, morning weights,
  planned day types, etc.).
- Refeeds are optional, not required. Only recommend one after 10+ days of
  flat 7-day trend despite high compliance, or 12+ consecutive PSMF days.
- Never give medical advice. If the user reports symptoms (dizziness,
  cramps, extreme fatigue), suggest electrolytes / a break and recommend
  seeing a clinician for anything beyond mild.
- Keep answers short. 3–5 sentences unless the user asks for detail.
- Use PSMF, protein, calories, and streak vocabulary the app already uses.
- Do not invent foods or numbers the user did not log.`

// -------- Context assembly --------

interface DayCtx {
  date: string
  planned: string
  weight?: number
  cal: number
  p: number
  c: number
  f: number
  water?: number
  score: number
  isPsmf: boolean
}

function summarizeDay(l: DailyLog, settings: AppState['settings']): DayCtx {
  const profile = profileFor(settings, l.plannedType ?? 'PSMF Day')
  return {
    date: l.date,
    planned: l.plannedType ?? 'PSMF Day',
    weight: l.morningWeight,
    cal: Math.round(l.totalCalories),
    p: Math.round(l.totalProtein),
    c: Math.round(l.totalCarbs),
    f: Math.round(l.totalFat),
    water: l.waterOz,
    score: Math.round(computeCompliance(l, settings).score * 10) / 10,
    isPsmf:
      l.meals.length > 0 &&
      l.complianceScore >= 7 &&
      (!l.plannedType || l.plannedType === 'PSMF Day') &&
      l.totalProtein >= profile.proteinMin * 0.9,
  }
}

/**
 * Compact JSON blob the LLM can reason from. Includes the last N days of
 * logged data, the user's goal + target, current streak, and forecast pace.
 * Excludes per-meal detail (too much noise) and the API key.
 */
export function buildContextSummary(state: AppState, today = todayKey(), lookbackDays = 14): string {
  const days: DayCtx[] = []
  for (let i = lookbackDays - 1; i >= 0; i--) {
    const key = addDays(today, -i)
    const log = state.logs[key]
    if (log && (log.morningWeight != null || log.meals.length > 0)) {
      days.push(summarizeDay(log, state.settings))
    }
  }
  const streak = streakSummary(state.logs, today)
  const fc = computeForecast(state.logs, state.settings, today)
  const s = state.settings
  const psmfProfile = profileFor(s, 'PSMF Day')

  const ctx = {
    today,
    goal: {
      startingWeight: s.startingWeight,
      goalWeight: s.startingWeight - s.goalLoss,
      goalLoss: s.goalLoss,
      targetWeeks: s.targetWeeks,
      waterGoalOz: s.waterGoalOz,
    },
    psmfTargets: {
      proteinMin: psmfProfile.proteinMin,
      proteinMax: psmfProfile.proteinMax,
      carbMax: psmfProfile.carbMax,
      fatMax: psmfProfile.fatMax,
      calorieMin: psmfProfile.calorieMin,
      calorieMax: psmfProfile.calorieMax,
    },
    streak: {
      current: streak.current,
      longest: streak.longest,
      thisWeek: streak.thisWeek,
      lastWeek: streak.lastWeek,
      todayCounts: streak.todayCounts,
    },
    forecast: {
      currentWeight: fc.currentWeight,
      currentTrend: fc.currentTrend,
      totalLost: fc.totalLost,
      remainingLoss: fc.remainingLoss,
      requiredWeeklyLoss: fc.requiredWeeklyLoss,
      observedWeeklyLoss: fc.observedWeeklyLoss,
      status: fc.status,
      projectedGoalDate: fc.projectedGoalDate,
      targetGoalDate: fc.targetGoalDate,
    },
    recentDays: days,
  }
  return JSON.stringify(ctx, null, 2)
}

// -------- Streaming Messages call --------

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamOptions {
  apiKey: string
  model: string
  systemPrompt: string
  context: string
  messages: ChatMessage[]
  /** Called with each text delta as it streams in. */
  onDelta: (text: string) => void
  /** Called once when the stream ends cleanly. */
  onDone?: () => void
  /** AbortController signal — call abort() to cancel mid-stream. */
  signal?: AbortSignal
}

/**
 * Stream a chat turn from Anthropic. Uses the browser-direct header the API
 * requires, parses the SSE event stream inline, and emits text deltas via
 * onDelta. Throws (with a user-friendly message) on 401 / 429 / network fail.
 */
export async function streamChat(opts: StreamOptions): Promise<void> {
  const { apiKey, model, systemPrompt, context, messages, onDelta, onDone, signal } = opts

  const body = {
    model,
    max_tokens: 1024,
    system: [
      { type: 'text', text: systemPrompt },
      { type: 'text', text: `DATA_CONTEXT (JSON, current state of the user's tracker):\n${context}` },
    ],
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    stream: true,
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  })

  if (!resp.ok) {
    // Read error body for a useful message. Anthropic returns JSON like
    // { type: "error", error: { type: "...", message: "..." } }.
    let msg = `HTTP ${resp.status}`
    try {
      const errBody = await resp.json()
      if (errBody?.error?.message) msg = errBody.error.message
    } catch {
      /* fall back to status */
    }
    if (resp.status === 401) throw new Error(`Invalid API key. ${msg}`)
    if (resp.status === 403) throw new Error(`Key rejected. ${msg}`)
    if (resp.status === 429) throw new Error(`Rate limited. ${msg}`)
    if (resp.status === 400) throw new Error(msg)
    throw new Error(`Anthropic API error: ${msg}`)
  }

  if (!resp.body) throw new Error('No response body from Anthropic API')

  const reader = resp.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE events are separated by \n\n. Each event has "event: <name>" and
    // one or more "data: <json>" lines.
    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)

      for (const line of rawEvent.split('\n')) {
        if (!line.startsWith('data:')) continue
        const dataStr = line.slice(5).trim()
        if (!dataStr) continue
        try {
          const evt = JSON.parse(dataStr)
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            onDelta(evt.delta.text)
          } else if (evt.type === 'message_stop') {
            // stream ends naturally right after this
          } else if (evt.type === 'error') {
            throw new Error(evt.error?.message ?? 'stream error')
          }
        } catch (e) {
          // Ignore parse errors for keep-alive pings and partial payloads.
          if (e instanceof Error && e.message.startsWith('stream error')) throw e
        }
      }
    }
  }

  onDone?.()
}

// -------- Model list surfaced to the UI --------

export interface CoachModel {
  id: string
  label: string
  hint: string
}

export const COACH_MODELS: CoachModel[] = [
  {
    id: 'claude-haiku-4-5-20251001',
    label: 'Haiku 4.5',
    hint: 'Fast & cheap (~$0.002/question). Recommended.',
  },
  {
    id: 'claude-sonnet-5',
    label: 'Sonnet 5',
    hint: 'Smarter answers, ~10× the cost.',
  },
  {
    id: 'claude-opus-5',
    label: 'Opus 5',
    hint: "Anthropic's largest model. Costly — reserve for hard questions.",
  },
]

export const DEFAULT_COACH_MODEL = 'claude-haiku-4-5-20251001'
