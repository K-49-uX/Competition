/** @type {import('tailwindcss').Config} */
// Hospital-recommended palette:
//  - Primary blue: trust, calm, professionalism (used by NHS, WHO, most hospitals)
//  - Teal/mint: cleanliness, healing (operating-room scrubs)
//  - Soft pink/rose: maternal, paediatric and compassionate care
//  - Amber: warmth + warnings
//  - Emerald success / Rose danger for accessibility contrast
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0056b3',
          50: '#e6f0fa',
          100: '#cce0f5',
          200: '#99c2ec',
          300: '#66a3e2',
          400: '#3385d9',
          500: '#0056b3',
          600: '#004a99',
          700: '#003d80',
          800: '#003066',
          900: '#00224d',
        },
        accent: {
          DEFAULT: '#14b8a6', // teal — clinical, calming
          50: '#f0fdfa',
          100: '#ccfbf1',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
        },
        care: {
          DEFAULT: '#ec4899', // soft pink — maternal & paediatric
          50: '#fdf2f8',
          100: '#fce7f3',
          500: '#ec4899',
          600: '#db2777',
        },
        success: {
          DEFAULT: '#16a34a',
          50: '#f0fdf4',
          500: '#16a34a',
          600: '#15803d',
        },
        warning: {
          DEFAULT: '#f59e0b',
          50: '#fffbeb',
          500: '#f59e0b',
          600: '#d97706',
        },
        danger: {
          DEFAULT: '#dc2626',
          50: '#fef2f2',
          500: '#dc2626',
          600: '#b91c1c',
        },
        neutral: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Dedicated dark-mode surface tokens
        surface: {
          light: '#ffffff',
          dark: '#0b1220',
          'dark-2': '#111a2e',
          'dark-3': '#1a2542',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 4px 12px rgba(15, 23, 42, 0.06)',
        'card-hover': '0 12px 28px rgba(15, 23, 42, 0.12)',
        sos: '0 8px 24px rgba(220, 38, 38, 0.45)',
        glow: '0 0 0 4px rgba(0, 86, 179, 0.15)',
      },
      borderRadius: {
        card: '14px',
        pill: '9999px',
      },
      backgroundImage: {
        'hero-gradient':
          'linear-gradient(135deg, #0056b3 0%, #0d9488 50%, #14b8a6 100%)',
        'hero-gradient-dark':
          'linear-gradient(135deg, #00224d 0%, #0f766e 50%, #134e4a 100%)',
      },
    },
  },
  plugins: [],
};
