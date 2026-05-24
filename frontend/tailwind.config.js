/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#020207',
          dark: '#03070d',
          glow: '#00f0ff',
          alert: '#ff4d4f',
          warn: '#ffa940',
          ok: '#52c41a',
          text: '#cdefff',
          muted: '#5b8296',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
        mono: ['Orbitron', 'JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        cyber: '0 0 15px rgba(0, 240, 255, 0.15)',
        'cyber-lg': '0 0 25px rgba(0, 240, 255, 0.25)',
        alert: '0 0 15px rgba(255, 77, 79, 0.2)',
      }
    },
  },
  plugins: [],
}
