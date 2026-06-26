import { useState } from 'react'
import { StoreProvider } from './store'
import { Dashboard } from '../components/Dashboard'
import { History } from '../components/History'
import { Foods } from '../components/Foods'
import { Settings } from '../components/Settings'

type Tab = 'today' | 'history' | 'foods' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'today', label: 'Today', icon: 'M12 3l9 7v11H3V10z' },
  { id: 'history', label: 'History', icon: 'M3 12h4l3 8 4-16 3 8h4' },
  { id: 'foods', label: 'Foods', icon: 'M5 3v18M5 8h6M11 3v18M16 3c-1.5 3-1.5 6 0 9v9' },
  { id: 'settings', label: 'Settings', icon: 'M12 8a4 4 0 100 8 4 4 0 000-8z M19 12l2-1-2-4-2 1' },
]

function TabIcon({ d, active }: { d: string; active: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? '#4ea1ff' : '#5d6573'}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

function Shell() {
  const [tab, setTab] = useState<Tab>('today')

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col px-4">
      <main className="flex-1">
        {tab === 'today' && <Dashboard />}
        {tab === 'history' && <History />}
        {tab === 'foods' && <Foods />}
        {tab === 'settings' && <Settings />}
      </main>

      {/* Bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-line bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex flex-1 flex-col items-center gap-0.5 py-2.5"
            >
              <TabIcon d={t.icon} active={tab === t.id} />
              <span
                className={`text-[10px] font-medium ${tab === t.id ? 'text-accent' : 'text-mute-soft'}`}
              >
                {t.label}
              </span>
            </button>
          ))}
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  )
}
