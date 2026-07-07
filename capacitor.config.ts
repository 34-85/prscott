import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.prscott.psmftracker',
  appName: 'PSMF Tracker',
  // Vite build output. Build with `npm run ios:build` (base '/') before syncing.
  webDir: 'dist',
  ios: {
    // Respect the notch / home indicator; content handles its own safe areas.
    contentInset: 'always',
    backgroundColor: '#f4f6f9',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 600,
      backgroundColor: '#f4f6f9',
      showSpinner: false,
    },
    Keyboard: {
      resize: 'native',
    },
  },
}

export default config
