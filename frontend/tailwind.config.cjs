const withMT = require("@material-tailwind/react/utils/withMT");

module.exports = withMT({
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        /* Palette aligned with master branch UI colors */
        primary: '#E39A7B',
        primaryLight: '#FFB5AB',
        primaryDark: '#DBB06B',
        secondary: '#FFD3AC',
        secondaryLight: '#FFE1C6',
        accent: '#DBB06B',
        accentLight: '#EBC07C',
        accentDark: '#C49A5D',
        background: '#FFF6EC',
        backgroundAlt: '#FFF1E4',
        card: '#FFFFFF',
        cardDark: '#FFF0E1',
        text: '#1A1D1F',
        textLight: '#4B5563',
        textMuted: '#9CA3AF',
        border: '#D1D5DB',
        borderLight: '#E5E7EB',
        /* Brand aliases present in master for gradients */
        brandCoral: '#E39A7B',
        brandPeach: '#FFB5AB',
        brandGold: '#DBB06B',
        brandPurple: '#8B5CF6',
        success: '#10B981',        // green success
        warning: '#F59E0B',        // amber warning
        error: '#EF4444',          // red error
        info: '#3B82F6',           // blue info
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'Noto Sans', 'sans-serif'],
        display: ['Poppins', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'glow-sm': '0 0 20px rgba(0, 217, 163, 0.3)',
        'glow-md': '0 0 30px rgba(0, 217, 163, 0.4)',
        'glow-lg': '0 0 40px rgba(0, 217, 163, 0.5)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(0, 217, 163, 0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(0, 217, 163, 0.6)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
      },
    }
  },
  plugins: []
});
