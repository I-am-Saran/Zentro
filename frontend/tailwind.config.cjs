const withMT = require("@material-tailwind/react/utils/withMT");

module.exports = withMT({
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        /* Modern, vibrant Alchemy palette with gradients support */
        primary: '#2D5F4F',        // deep emerald for headings and primary UI
        primaryLight: '#4A7C6B',   // lighter emerald for hover states
        primaryDark: '#1a3a31',    // darker emerald for active states
        secondary: '#6BA898',      // sage green for secondary text/elements
        secondaryLight: '#92C4B6', // lighter sage for backgrounds
        accent: '#00D9A3',         // vibrant teal accent for highlights
        accentLight: '#33E5B2',    // lighter teal for hover effects
        accentDark: '#00B88A',     // darker teal for active states
        background: '#FFFFFF',     // base page background
        backgroundAlt: '#F8FBFA',  // subtle alt background
        card: '#F6F8F5',           // off-white green-tinted card surface
        cardDark: '#E8F0ED',       // darker card variant
        text: '#0F1419',           // near-black for readable body copy
        textLight: '#4B5563',      // light gray text
        textMuted: '#9CA3AF',      // muted gray text
        border: '#D1D5DB',         // border color
        borderLight: '#E5E7EB',    // light border
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