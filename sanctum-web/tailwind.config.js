/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand A: Digital Sanctum (Premium)
        sanctum: {
          dark: '#0f172a', // Slate 900
          gold: '#fbbf24', // Amber 400
          blue: '#3b82f6', // Blue 500
        },
        // Brand B: Naked Tech (Fun)
        naked: {
          pink: '#ec4899', // Pink 500
          black: '#000000',
          white: '#ffffff',
        }
      }
    },
  },
  plugins: [],
}
