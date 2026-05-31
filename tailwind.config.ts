import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
          muted: 'hsl(var(--primary-muted))',
          strong: 'hsl(var(--primary-strong))',
        },
        secondary: { 
          DEFAULT: 'hsl(var(--secondary))', 
          foreground: 'hsl(var(--secondary-foreground))' 
        },
        destructive: { 
          DEFAULT: 'hsl(var(--destructive))', 
          foreground: 'hsl(var(--destructive-foreground))' 
        },
        muted: { 
          DEFAULT: 'hsl(var(--muted))', 
          foreground: 'hsl(var(--muted-foreground))' 
        },
        success: { 
          DEFAULT: 'hsl(var(--success))', 
          foreground: 'hsl(var(--success-foreground))' 
        },
        warning: { 
          DEFAULT: 'hsl(var(--warning))', 
          foreground: 'hsl(var(--warning-foreground))' 
        },
        info: { 
          DEFAULT: 'hsl(var(--info))', 
          foreground: 'hsl(var(--info-foreground))' 
        },
        card: { 
          DEFAULT: 'hsl(var(--card))', 
          foreground: 'hsl(var(--card-foreground))' 
        },
        popover: { 
          DEFAULT: 'hsl(var(--popover))', 
          foreground: 'hsl(var(--popover-foreground))' 
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar))',
          foreground: 'hsl(var(--sidebar-foreground))',
          border: 'hsl(var(--sidebar-border))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius-lg)',
        md: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],   // 11px
        xs: ['0.75rem', { lineHeight: '1.125rem' }],     // 12px
        sm: ['0.8125rem', { lineHeight: '1.25rem' }],    // 13px — body default in compact mode
        base: ['0.875rem', { lineHeight: '1.375rem' }],  // 14px
        lg: ['1rem', { lineHeight: '1.5rem' }],          // 16px
        xl: ['1.125rem', { lineHeight: '1.625rem' }],    // 18px
        '2xl': ['1.375rem', { lineHeight: '1.875rem' }], // 22px
        '3xl': ['1.75rem', { lineHeight: '2.125rem' }],  // 28px
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],    // 36px
        '5xl': ['3rem', { lineHeight: '1' }],            // 48px
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'slide-down': 'slideDown 200ms ease-out',
      },
      keyframes: {
        fadeIn: { 
          '0%': { opacity: '0' }, 
          '100%': { opacity: '1' } 
        },
        slideUp: { 
          '0%': { opacity: '0', transform: 'translateY(4px)' }, 
          '100%': { opacity: '1', transform: 'translateY(0)' } 
        },
        slideDown: { 
          '0%': { opacity: '0', transform: 'translateY(-4px)' }, 
          '100%': { opacity: '1', transform: 'translateY(0)' } 
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
