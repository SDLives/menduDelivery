import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mendu: {
          red: '#E31E24',
          reddark: '#8C0F13',
          ink: '#17181C',
          inksoft: '#4B4D55',
          muted: '#83858C',
          bg: '#FAF9F7',
          border: '#ECEAE5',
          gold: '#F5A623',
          green: '#1E8E5A',
        },
      },
      fontFamily: {
        brand: ['var(--font-fredoka)', 'sans-serif'],
        sans: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
