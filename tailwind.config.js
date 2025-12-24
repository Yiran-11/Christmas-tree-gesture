/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'trump-gold': '#FFD700',
        'emerald-deep': '#004020',
      },
      fontFamily: {
        serif: ['serif'],
      }
    },
  },
  plugins: [],
}
