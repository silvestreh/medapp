/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        teal: {
          50:  '#EEF9FB',
          100: '#D5F0F5',
          200: '#ABE1EC',
          300: '#8AD5E4',
          400: '#69C6D8',
          500: '#53B3C6',
          600: '#4199AB',
          700: '#337B8B',
          800: '#265D6A',
          900: '#1A4049',
          950: '#0F2A31',
        },
      },
    },
  },
};
