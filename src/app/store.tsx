import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { AppState, FoodEntry, Meal, UserSettings } from '../lib/types'
import {
  addCustomFood as addCustomFoodFn,
  defaultState,
  loadState,
  makeMealId,
  removeCustomFood as removeCustomFoodFn,
  removeMeal as removeMealFn,
  saveState,
  setMorningWeight as setMorningWeightFn,
  updateSettings as updateSettingsFn,
  upsertMeal,
} from '../lib/storage'
import { estimateMeal } from '../lib/macroEstimator'
import { buildSeedState } from '../lib/seed'

interface StoreApi {
  state: AppState
  addMeal: (date: string, rawText: string, notes?: string) => void
  updateMeal: (date: string, meal: Meal) => void
  deleteMeal: (date: string, mealId: string) => void
  setWeight: (date: string, weight: number | undefined, note?: string) => void
  updateSettings: (patch: Partial<UserSettings>) => void
  addCustomFood: (food: FoodEntry) => void
  removeCustomFood: (id: string) => void
  loadDemoData: () => void
  resetAll: () => void
}

const StoreContext = createContext<StoreApi | null>(null)

function initialState(): AppState {
  const loaded = loadState()
  if (loaded) return loaded
  // First run: seed demo data so the dashboard is immediately meaningful.
  return buildSeedState()
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
    }
    saveState(state)
  }, [state])

  const addMeal = useCallback((date: string, rawText: string, notes?: string) => {
    setState((s) => {
      const est = estimateMeal(rawText, s.customFoods)
      const meal: Meal = {
        id: makeMealId(),
        timestamp: new Date().toISOString(),
        rawText,
        parsedFoods: est.parsedFoods,
        calories: est.calories,
        protein: est.protein,
        carbs: est.carbs,
        fat: est.fat,
        confidence: est.confidence,
        notes,
      }
      return upsertMeal(s, date, meal)
    })
  }, [])

  const updateMeal = useCallback((date: string, meal: Meal) => {
    setState((s) => upsertMeal(s, date, meal))
  }, [])

  const deleteMeal = useCallback((date: string, mealId: string) => {
    setState((s) => removeMealFn(s, date, mealId))
  }, [])

  const setWeight = useCallback(
    (date: string, weight: number | undefined, note?: string) => {
      setState((s) => setMorningWeightFn(s, date, weight, note))
    },
    [],
  )

  const updateSettings = useCallback((patch: Partial<UserSettings>) => {
    setState((s) => updateSettingsFn(s, patch))
  }, [])

  const addCustomFood = useCallback((food: FoodEntry) => {
    setState((s) => addCustomFoodFn(s, food))
  }, [])

  const removeCustomFood = useCallback((id: string) => {
    setState((s) => removeCustomFoodFn(s, id))
  }, [])

  const loadDemoData = useCallback(() => {
    setState(buildSeedState())
  }, [])

  const resetAll = useCallback(() => {
    setState({ ...defaultState(), seeded: true })
  }, [])

  const api = useMemo<StoreApi>(
    () => ({
      state,
      addMeal,
      updateMeal,
      deleteMeal,
      setWeight,
      updateSettings,
      addCustomFood,
      removeCustomFood,
      loadDemoData,
      resetAll,
    }),
    [
      state,
      addMeal,
      updateMeal,
      deleteMeal,
      setWeight,
      updateSettings,
      addCustomFood,
      removeCustomFood,
      loadDemoData,
      resetAll,
    ],
  )

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>
}

export function useStore(): StoreApi {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
