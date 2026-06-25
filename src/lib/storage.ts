import type { AppState, DailyLog, FoodEntry, Meal, UserSettings } from './types'
import { computeCompliance } from './compliance'

const STORAGE_KEY = 'psmf-tracker-state'
const STATE_VERSION = 1

export const DEFAULT_SETTINGS: UserSettings = {
  startingWeight: 212,
  goalLoss: 20,
  targetWeeks: 11,
  proteinMin: 180,
  proteinMax: 220,
  carbMax: 60,
  fatMax: 45,
  calorieMin: 1000,
  calorieMax: 1600,
  meatWeightsDefault: 'cooked',
}

export function createEmptyLog(date: string): DailyLog {
  return {
    date,
    meals: [],
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFat: 0,
    complianceScore: 0,
    coachNotes: [],
  }
}

/** Recompute cached totals + compliance for a day. */
export function recomputeLog(log: DailyLog, settings: UserSettings): DailyLog {
  const totals = log.meals.reduce(
    (acc, m) => {
      acc.cal += m.calories
      acc.p += m.protein
      acc.c += m.carbs
      acc.f += m.fat
      return acc
    },
    { cal: 0, p: 0, c: 0, f: 0 },
  )
  const round = (n: number) => Math.round(n * 10) / 10
  const next: DailyLog = {
    ...log,
    totalCalories: Math.round(totals.cal),
    totalProtein: round(totals.p),
    totalCarbs: round(totals.c),
    totalFat: round(totals.f),
  }
  next.complianceScore = computeCompliance(next, settings).score
  return next
}

export function makeMealId(): string {
  return `m_${Date.now().toString(36)}_${Math.floor(Math.random() * 1e6).toString(36)}`
}

export function defaultState(): AppState {
  return {
    settings: DEFAULT_SETTINGS,
    logs: {},
    customFoods: [],
    seeded: false,
    version: STATE_VERSION,
  }
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppState
    // Merge settings so new fields get defaults on upgrade.
    parsed.settings = { ...DEFAULT_SETTINGS, ...parsed.settings }
    parsed.customFoods ??= []
    parsed.logs ??= {}
    return parsed
  } catch (e) {
    console.error('Failed to load state', e)
    return null
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.error('Failed to save state', e)
  }
}

export function clearState(): void {
  localStorage.removeItem(STORAGE_KEY)
}

// ---- Pure mutators (return new state) ------------------------------------

export function upsertMeal(state: AppState, date: string, meal: Meal): AppState {
  const log = state.logs[date] ?? createEmptyLog(date)
  const existingIdx = log.meals.findIndex((m) => m.id === meal.id)
  const meals =
    existingIdx >= 0
      ? log.meals.map((m) => (m.id === meal.id ? meal : m))
      : [...log.meals, meal]
  const updated = recomputeLog({ ...log, meals }, state.settings)
  return { ...state, logs: { ...state.logs, [date]: updated } }
}

export function removeMeal(state: AppState, date: string, mealId: string): AppState {
  const log = state.logs[date]
  if (!log) return state
  const meals = log.meals.filter((m) => m.id !== mealId)
  const updated = recomputeLog({ ...log, meals }, state.settings)
  return { ...state, logs: { ...state.logs, [date]: updated } }
}

export function setMorningWeight(
  state: AppState,
  date: string,
  weight: number | undefined,
  note?: string,
): AppState {
  const log = state.logs[date] ?? createEmptyLog(date)
  const updated = recomputeLog(
    { ...log, morningWeight: weight, weightNote: note },
    state.settings,
  )
  return { ...state, logs: { ...state.logs, [date]: updated } }
}

export function updateSettings(state: AppState, patch: Partial<UserSettings>): AppState {
  const settings = { ...state.settings, ...patch }
  // Recompute every log's compliance under new targets.
  const logs: Record<string, DailyLog> = {}
  for (const [date, log] of Object.entries(state.logs)) {
    logs[date] = recomputeLog(log, settings)
  }
  return { ...state, settings, logs }
}

export function addCustomFood(state: AppState, food: FoodEntry): AppState {
  return { ...state, customFoods: [...state.customFoods, food] }
}

export function removeCustomFood(state: AppState, id: string): AppState {
  return { ...state, customFoods: state.customFoods.filter((f) => f.id !== id) }
}
