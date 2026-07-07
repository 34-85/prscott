import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './index.css'
import { applyTheme, getTheme } from './lib/theme'
import { initNative, restoreFromNativeBackup } from './lib/native'

async function boot() {
  const theme = getTheme()
  applyTheme(theme)
  // On iOS, recover state from durable native storage if the WebView cleared
  // localStorage. Resolves immediately on web.
  await restoreFromNativeBackup()
  // No-op on web; on iOS this hides the splash and matches the status bar.
  void initNative(theme)

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

void boot()
