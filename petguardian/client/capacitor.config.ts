import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the PetGuardian iOS app.
 *
 * The React client is bundled on-device (webDir: dist) and talks to the hosted
 * API over HTTPS. Set the API base at build time with VITE_API_BASE_URL, e.g.:
 *
 *   VITE_API_BASE_URL=https://petguardian-6sfc.onrender.com npm run ios:sync
 *
 * First-time native project setup (run on a Mac with Xcode):
 *   npm run ios:add     # build web + create ios/ project
 *   npm run ios:open    # open in Xcode to set signing + archive
 */
const config: CapacitorConfig = {
  appId: 'com.petguardian.app',
  appName: 'PetGuardian',
  webDir: 'dist',
  ios: {
    contentInset: 'always',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_icon',
      iconColor: '#2F49B8',
    },
  },
};

export default config;
