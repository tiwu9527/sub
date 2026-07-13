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
        canvas: '#F4F6F5',
        card: '#FFFFFF',
        primary: '#0F766E',
        secondary: '#2563EB',
        accent: '#0B5F59',
        danger: '#D95757',
        success: '#16845B',
        ink: '#17211B',
        muted: '#68746D'
      },
      fontFamily: {
        sans: ['Inter', 'PingFang SC', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        glow: '0 1px 2px rgba(23,33,27,.04)',
        lift: '0 12px 32px rgba(23,33,27,.10)',
        soft: '0 6px 18px rgba(23,33,27,.08)'
      },
      borderRadius: {
        '4xl': '8px'
      }
    }
  },
  plugins: []
};

export default config;
