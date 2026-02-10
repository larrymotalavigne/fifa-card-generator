/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        'fifa-gold': '#FFD700',
        'fifa-silver': '#C0C0C0',
        'fifa-bronze': '#CD7F32',
        'fifa-totw': '#1a3a5c',
      },
      fontFamily: {
        'fifa': ['Roboto Condensed', 'Arial Narrow', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'inner-gold': 'inset 0 2px 4px rgba(255, 215, 0, 0.2)',
        'glow-gold': '0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.1)',
        'glow-blue': '0 0 20px rgba(59, 130, 246, 0.4), 0 0 40px rgba(59, 130, 246, 0.1)',
        'glow-silver': '0 0 20px rgba(192, 192, 192, 0.4), 0 0 40px rgba(192, 192, 192, 0.1)',
        'glow-bronze': '0 0 20px rgba(205, 127, 50, 0.4), 0 0 40px rgba(205, 127, 50, 0.1)',
      },
      backgroundImage: {
        'gold-grain': 'linear-gradient(45deg, #FFD700 0%, #FFA500 50%, #FFD700 100%)',
        'silver-grain': 'linear-gradient(45deg, #E5E5E5 0%, #C0C0C0 50%, #E5E5E5 100%)',
        'bronze-grain': 'linear-gradient(45deg, #CD853F 0%, #CD7F32 50%, #CD853F 100%)',
        'dark-gradient': 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
      },
      keyframes: {
        'card-entrance': {
          '0%': { opacity: '0', transform: 'scale(0.9) rotateY(-10deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotateY(0deg)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'toast-out': {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        'card-entrance': 'card-entrance 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'fade-in': 'fade-in 0.3s ease-out',
        'slide-up': 'slide-up 0.4s ease-out',
        'toast-in': 'toast-in 0.3s ease-out',
        'toast-out': 'toast-out 0.3s ease-in forwards',
        'shimmer': 'shimmer 2s infinite linear',
        'spin': 'spin 1s linear infinite',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}
