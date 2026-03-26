/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 扑克主题色
        'poker-green': {
          DEFAULT: '#2d5a3d',
          light: '#3d7a53',
          dark: '#1d3a29',
        },
        'poker-red': '#dc2626',
        'poker-black': '#1a1a1a',
        'poker-gold': '#fbbf24',
        // 牌花色色
        'suit-spade': '#1a1a1a',
        'suit-heart': '#dc2626',
        'suit-diamond': '#dc2626',
        'suit-club': '#1a1a1a',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'deal': 'deal 0.3s ease-out',
        'flip': 'flip 0.5s ease-in-out',
      },
      keyframes: {
        deal: {
          '0%': { transform: 'translateY(-100px) rotateY(180deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotateY(0)', opacity: '1' },
        },
        flip: {
          '0%': { transform: 'rotateY(180deg)' },
          '100%': { transform: 'rotateY(0deg)' },
        },
      },
    },
  },
  plugins: [],
}
