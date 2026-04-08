/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0F1117',
          card: '#1A1D27',
          border: '#2A2D3A',
          hover: '#252836',
        },
        accent: {
          green: '#22C55E',
          amber: '#F59E0B',
          red: '#EF4444',
          blue: '#3B82F6',
        },
      },
    },
  },
  plugins: [],
};
