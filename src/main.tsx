import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'
import { applyTheme, getTheme } from './lib/theme'
import { initNative, restoreFromNativeBackup } from './lib/native'

function boot() {
  const theme = getTheme()
  applyTheme(theme)

  // Render immediately so the app paints without waiting on any native call.
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

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
