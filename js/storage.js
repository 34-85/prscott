// Local persistence layer. All data lives in a single JSON blob under one key.
const Store = (() => {
  const KEY = "psmf-tracker-v1";

  const defaults = () => ({
    profile: {
      sex: "male",
      age: 35,
      heightIn: 70,
      weightLb: 200,
      bodyFatPct: 25,
      activity: "sedentary",
      proteinPerLbLbm: 1.4,
      fatGramsTarget: 30,
      carbGramsTarget: 30,
      goalWeightLb: 175,
      startWeightLb: 200,
      startDate: new Date().toISOString().slice(0, 10),
      units: "imperial"
    },
    foodLog: {},   // { "YYYY-MM-DD": [ { id, name, qty, unit, kcal, p, f, c } ] }
    weightLog: {}, // { "YYYY-MM-DD": <lb number> }
    customFoods: [] // user-added foods, same shape as preset
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaults();
      const parsed = JSON.parse(raw);
      // shallow merge so new fields appear
      const d = defaults();
      return {
        ...d,
        ...parsed,
        profile: { ...d.profile, ...(parsed.profile || {}) }
      };
    } catch (e) {
      console.warn("Storage load failed, resetting", e);
      return defaults();
    }
  }

  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  return {
    get: () => state,
    profile: () => state.profile,
    saveProfile(patch) {
      state.profile = { ...state.profile, ...patch };
      save();
    },
    getDayFoods(date) {
      return state.foodLog[date] || [];
    },
    addFood(date, entry) {
      if (!state.foodLog[date]) state.foodLog[date] = [];
      const id = "f_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
      state.foodLog[date].push({ id, ...entry });
      save();
    },
    removeFood(date, id) {
      if (!state.foodLog[date]) return;
      state.foodLog[date] = state.foodLog[date].filter(f => f.id !== id);
      save();
    },
    getWeight(date) {
      return state.weightLog[date];
    },
    setWeight(date, weight) {
      if (weight == null || weight === "") delete state.weightLog[date];
      else state.weightLog[date] = Number(weight);
      save();
    },
    weightSeries() {
      return Object.entries(state.weightLog)
        .map(([d, w]) => ({ date: d, weight: Number(w) }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    addCustomFood(food) {
      state.customFoods.push({ id: "c_" + Date.now(), ...food });
      save();
    },
    allFoods() {
      return [...(window.PRESET_FOODS || []), ...state.customFoods];
    },
    exportJson() {
      return JSON.stringify(state, null, 2);
    },
    importJson(text) {
      const obj = JSON.parse(text);
      state = { ...defaults(), ...obj, profile: { ...defaults().profile, ...(obj.profile || {}) } };
      save();
    },
    reset() {
      state = defaults();
      save();
    }
  };
})();
