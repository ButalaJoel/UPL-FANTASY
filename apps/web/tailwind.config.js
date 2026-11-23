/** Kiwanja brand tokens (temporary original identity). */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#0B1A14', 800: '#12271E', 700: '#1B3529', 600: '#29483A' },
        pitch: { DEFAULT: '#0E7C66', 50: '#E7F5F1', 100: '#C6E9DF', 400: '#22A486', 600: '#0B6655', 700: '#09503F' },
        gold: { DEFAULT: '#F2B705', 50: '#FFF8DD', 100: '#FDEBA6', 600: '#C99600' },
        clay: { DEFAULT: '#E4572E', 50: '#FDECE6', 600: '#C0401C' },
        sky: { DEFAULT: '#3A86FF' },
        paper: '#F6F5F0',
      },
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: { card: '0 1px 2px rgba(11,26,20,.06), 0 4px 16px rgba(11,26,20,.06)' },
    },
  },
  plugins: [],
};
