/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Calm executive-dashboard palette, theme-driven via CSS variables
        // (RGB triplets) so the same tokens render in dark and light mode.
        ink: {
          DEFAULT: 'rgb(var(--ink) / <alpha-value>)',
          soft: 'rgb(var(--ink-soft) / <alpha-value>)',
          card: 'rgb(var(--ink-card) / <alpha-value>)',
          line: 'rgb(var(--ink-line) / <alpha-value>)',
        },
        mute: {
          DEFAULT: 'rgb(var(--mute) / <alpha-value>)',
          soft: 'rgb(var(--mute-soft) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          dim: 'rgb(var(--accent-dim) / <alpha-value>)',
        },
        good: 'rgb(var(--good) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        bad: 'rgb(var(--bad) / <alpha-value>)',
        // Primary foreground text, and the text color that sits on accent fills.
        fg: 'rgb(var(--fg) / <alpha-value>)',
        onaccent: 'rgb(var(--onaccent) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
