/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        ink: '#14231C',
        brand: {
          DEFAULT: '#0E8A5A',
          dark: '#0F4A32',
          light: '#E6F7EF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          alt: '#F6F8F6',
          card: '#F4F3F3',
          cardHover: '#EAECEB',
        },
        line: '#E5E7EB',
      },
      maxWidth: {
        content: '1200px',
      },
    },
  },
  plugins: [],
}
