import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        paper:  '#FFFCF5',
        paper2: '#F2EEE6',
        ink:    '#10100F',
        cherry: '#FF4B5C',
        sun:    '#FFD60A',
        mint:   '#00E5A0',
        sky:    '#5CC9FF',
        violet: '#7A5CFF',
      },
      fontFamily: {
        grotesk: ['"Space Grotesk"', 'sans-serif'],
        inter:   ['Inter', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        btn:  '12px',
        pill: '999px',
      },
      boxShadow: {
        hard:    '4px 4px 0px #10100F',
        'hard-lg': '6px 6px 0px #10100F',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(20px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.92)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        stampIn: {
          '0%':   { transform: 'scale(2) rotate(-8deg)', opacity: '0' },
          '60%':  { transform: 'scale(0.92) rotate(2deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(0deg)', opacity: '1' },
        },
        confettiFall: {
          '0%':   { transform: 'translateY(-20px) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(110vh) rotate(720deg)', opacity: '0' },
        },
        pulseDot: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.5' },
          '50%':       { transform: 'scale(1.6)', opacity: '1' },
        },
        floatUp: {
          '0%':   { opacity: '1', transform: 'translateX(-50%) translateY(0) scale(1)' },
          '60%':  { opacity: '1', transform: 'translateX(-50%) translateY(-40px) scale(1.1)' },
          '100%': { opacity: '0', transform: 'translateX(-50%) translateY(-80px) scale(0.9)' },
        },
      },
      animation: {
        'fade-up':      'fadeUp 0.35s ease forwards',
        'scale-in':     'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'stamp-in':     'stampIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
        'confetti-fall': 'confettiFall var(--duration, 3s) ease forwards',
        'pulse-dot':    'pulseDot 1s ease-in-out infinite',
        'float-up':     'floatUp 1.4s ease forwards',
      },
    },
  },
  plugins: [],
}
export default config
