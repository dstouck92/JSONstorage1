/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./client/index.html",
    "./client/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        herd: {
          sky: '#87CEEB',
          green: '#90EE90',
          dark: '#2D5A27',
          accent: '#4CAF50'
        }
      }
    },
  },
  plugins: [],
}
