import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#07111F',
          900: '#0B1A2E',
          800: '#12243D',
          700: '#1C3354',
        },
        signal: {
          400: '#5EEAD4',
          500: '#2EC4B6',
          600: '#1FA396',
        },
        cloud: {
          50: '#F6F8FB',
          100: '#EEF2F7',
          200: '#DCE4EE',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      boxShadow: {
        panel: '0 18px 40px -24px rgba(7, 17, 31, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
