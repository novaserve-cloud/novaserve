/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        background: '#090a0f',
        surface: {
          DEFAULT: '#11131b',
          elevated: '#181b26',
          hover: '#1f2332',
        },
        brand: {
          yellow: '#facc15', // Vibrant Electric Yellow
          yellowBright: '#fef08a',
          yellowDark: '#ca8a04',
          white: '#ffffff',
          slate: '#94a3b8',
        }
      },
      boxShadow: {
        'yellow-glow': '0 0 25px -5px rgba(250, 204, 21, 0.35)',
        'yellow-glow-lg': '0 0 40px -5px rgba(250, 204, 21, 0.45)',
        'white-glow': '0 0 25px -5px rgba(255, 255, 255, 0.25)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite alternate',
        'flow-line': 'flowLine 10s linear infinite',
      },
      keyframes: {
        glowPulse: {
          '0%': { boxShadow: '0 0 15px rgba(250, 204, 21, 0.2)' },
          '100%': { boxShadow: '0 0 30px rgba(250, 204, 21, 0.6)' },
        },
        flowLine: {
          '0%': { strokeDashoffset: '100' },
          '100%': { strokeDashoffset: '0' },
        }
      }
    },
  },
  plugins: [],
}

