// Shared "how to use the app" content, used by both the onboarding tour and the
// always-available Guide in Settings, so they never drift apart.

export interface GuideSection {
  emoji: string
  title: string
  body: string
}

const logMeals: GuideSection = {
  emoji: '🍽️',
  title: 'Log meals in plain English',
  body: 'On the Today tab, just type what you ate — "6 oz chicken, 1 cup rice" — and the app estimates calories, protein, carbs, and fat. Switch between a quick chat entry and a structured form anytime.',
}
const goalTimeline: GuideSection = {
  emoji: '🎯',
  title: 'Your goal & timeline',
  body: 'Set your starting weight, how much you want to lose, and over how many weeks. The dashboard turns that into a live forecast — whether you are ahead of, on, or behind schedule.',
}
const weighIn: GuideSection = {
  emoji: '⚖️',
  title: 'Weigh in each morning',
  body: 'Tap your weight at the top of Today each morning. Your trend line and forecast update automatically as the numbers come in.',
}
const dayTypes: GuideSection = {
  emoji: '📅',
  title: 'Day types & targets',
  body: 'Each day can be a PSMF, Moderate Cut, Maintenance, Refeed, or Travel day — each with its own calorie and protein targets. Pick the day type on Today; edit the targets in Settings → Day Targets. Your compliance score grades against the day you planned.',
}
const water: GuideSection = {
  emoji: '💧',
  title: 'Water',
  body: 'Log your water through the day toward your daily goal. Set the goal in Settings.',
}
const history: GuideSection = {
  emoji: '🗓️',
  title: 'Edit any day in History',
  body: 'Miss a day or need to fix one? Open the History tab and tap any past day to add or edit its meals, weight, and water — nothing is locked once the day passes.',
}
const foods: GuideSection = {
  emoji: '📖',
  title: 'Your food library',
  body: 'Save foods you eat often in the Foods tab. Your personal entries always override the generic database, so your regulars come out exact.',
}
const account: GuideSection = {
  emoji: '☁️',
  title: 'Account & sync',
  body: 'While signed in, everything backs up to the cloud and syncs across your phone and the web automatically — no export or import needed. Manage your account in Settings.',
}
const safety: GuideSection = {
  emoji: '🩺',
  title: 'Safety first',
  body: 'This app estimates trends; it is not medical advice. Use it alongside your physician. The full disclaimer lives on the Safety tab.',
}

/** Full guide, shown in the always-available Guide overlay. */
export const GUIDE_SECTIONS: GuideSection[] = [
  logMeals,
  goalTimeline,
  weighIn,
  dayTypes,
  water,
  history,
  foods,
  account,
  safety,
]

/** Curated subset paged through at the end of onboarding. */
export const TOUR_SECTIONS: GuideSection[] = [logMeals, goalTimeline, weighIn, dayTypes, history]
