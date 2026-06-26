/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: '#0b0e11',
          card: '#161a1e',
          border: '#2b2f36',
          green: '#0ecb81',
          red: '#f6465d',
          yellow: '#f0b90b',
          text: '#848e9c',
        }
      }
    },
  },
  plugins: [],
}
