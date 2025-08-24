import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'brent-blue': '#003366',
        'brent-green': '#00a652',
        'brent-red': '#dc2626',
        'brent-orange': '#f97316',
      },
    },
  },
  plugins: [],
}
export default config
