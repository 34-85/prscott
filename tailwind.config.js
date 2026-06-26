/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Calm executive-dashboard palette
        ink: {
          DEFAULT: '#0a0c10',
          soft: '#12151b',
          card: '#171b23',
          line: '#222834',
        },
        mute: {
          DEFAULT: '#8b94a3',
          soft: '#5d6573',
        },
        accent: {
          DEFAULT: '#4ea1ff',
          dim: '#2e6bb0',
        },
        good: '#3ecf8e',
        warn: '#f5b94d',
        bad: '#f06a6a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
}
