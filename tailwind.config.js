module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{html,ts}", // שים לב לשימוש בתו / במקום \ גם בסביבת Windows
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00bcd4',
        accent: '#ffca28',
        background: '#121212',
        surface: '#1e1e1e'
      },
      fontFamily: {
        sans: ['Rubik', 'sans-serif']
      },
      keyframes: {
        wave: {
          '0%, 100%': { transform: 'scaleY(0.5)' },
          '50%': { transform: 'scaleY(1)' },
        }
      },
      animation: {
        wave: 'wave 1s ease-in-out infinite',
      }
    },
  },
  plugins: [],
};