import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}'
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F7F7FC',
        card: '#FFFFFF',
        primary: '#7C5CFF',
        secondary: '#A98BFF',
        accent: '#6E4BFF',
        danger: '#FF5A5F',
        success: '#34C759',
        ink: '#111827',
        muted: '#6B7280'
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 10px 40px rgba(124,92,255,.08)',
        lift: '0 24px 70px rgba(124,92,255,.16)',
        soft: '0 16px 50px rgba(17,24,39,.08)'
      },
      borderRadius: {
        '4xl': '28px'
      }
    }
  },
  plugins: []
};

export default config;
