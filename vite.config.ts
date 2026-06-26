import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
// The app deploys to GitHub Pages at https://34-85.github.io/prscott/, so the
// production build needs a base path of "/prscott/". Dev stays at "/".
// Override with VITE_BASE if you deploy somewhere else (e.g. "/" for a custom domain).
export default defineConfig(({ command }) => ({
  base: process.env.VITE_BASE ?? (command === 'build' ? '/prscott/' : '/'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}))
