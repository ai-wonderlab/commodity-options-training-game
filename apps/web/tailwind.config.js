/** @type {import('tailwindcss').Config} */
const colors = require('tailwindcss/colors');

module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Include all default colors
        ...colors,
        // Custom colors for the game
        'brent-blue': '#003366',
        'brent-green': '#00a652',
        'brent-red': '#dc2626',
        'brent-orange': '#f97316',
      },
      fontFamily: {
        'mono': ['Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}