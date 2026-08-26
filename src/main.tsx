import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'
import { applyTheme, getTheme } from './lib/theme'
import { initNative, restoreFromNativeBackup } from './lib/native'

/** Fade out and remove the instant-paint splash once the app is on screen. */
function dismissSplash() {
  const el = document.getElementById('psmf-splash')
  if (!el) return
  const start = (window as unknown as { __psmfSplashStart?: number }).__psmfSplashStart ?? 0
  const MIN_VISIBLE = 2000 // hold the brand mark on screen for ~2s before fading
  const wait = Math.max(0, MIN_VISIBLE - (Date.now() - start))
  window.setTimeout(() => {
    el.classList.add('psmf-hide')
    // Remove after the CSS fade so it never intercepts taps.
    window.setTimeout(() => el.remove(), 450)
  }, wait)
}

function boot() {
  const theme = getTheme()
  applyTheme(theme)

  // Render immediately so the app paints without waiting on any native call.
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  // Hand off from the branded splash to the live app.
  dismissSplash()

  // No-op on web; on iOS this hides the splash and matches the status bar.
  void initNative(theme)

  // Durability recovery (native only, rare): if the WebView had cleared
  // localStorage but a native backup exists, restore it and reload once so
  // the store picks it up. Normal launches do nothing here.
  void restoreFromNativeBackup().then((restored) => {
    if (restored) location.reload()
  })
}

boot()
