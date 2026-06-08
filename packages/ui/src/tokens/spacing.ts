// ============================================================================
// VaultSync — Spacing, Radius & Shadow Tokens
// 4px-base grid system with elevation shadows
// ============================================================================

export const spacing = {
  // 4px base
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  3.5: '0.875rem',  // 14px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
} as const;

export const radius = {
  none: '0',
  sm: '0.375rem',    // 6px
  md: '0.75rem',     // 12px
  lg: '1rem',        // 16px
  xl: '1.5rem',      // 24px
  '2xl': '2rem',     // 32px
  full: '9999px',
} as const;

export const shadows = {
  dark: {
    sm: '0 1px 3px hsla(0, 0%, 0%, 0.4), 0 1px 2px hsla(0, 0%, 0%, 0.3)',
    md: '0 4px 12px hsla(0, 0%, 0%, 0.4), 0 2px 4px hsla(0, 0%, 0%, 0.3)',
    lg: '0 8px 32px hsla(0, 0%, 0%, 0.5), 0 4px 8px hsla(0, 0%, 0%, 0.3)',
    xl: '0 16px 48px hsla(0, 0%, 0%, 0.6), 0 8px 16px hsla(0, 0%, 0%, 0.3)',
    glow: '0 0 20px hsla(190, 95%, 60%, 0.15), 0 0 40px hsla(270, 80%, 65%, 0.08)',
    inner: 'inset 0 1px 2px hsla(0, 0%, 0%, 0.3)',
  },
  light: {
    sm: '0 1px 3px hsla(222, 20%, 30%, 0.08), 0 1px 2px hsla(222, 20%, 30%, 0.06)',
    md: '0 4px 12px hsla(222, 20%, 30%, 0.1), 0 2px 4px hsla(222, 20%, 30%, 0.06)',
    lg: '0 8px 32px hsla(222, 20%, 30%, 0.12), 0 4px 8px hsla(222, 20%, 30%, 0.06)',
    xl: '0 16px 48px hsla(222, 20%, 30%, 0.15), 0 8px 16px hsla(222, 20%, 30%, 0.06)',
    glow: '0 0 20px hsla(220, 85%, 50%, 0.1), 0 0 40px hsla(270, 70%, 55%, 0.05)',
    inner: 'inset 0 1px 2px hsla(222, 20%, 30%, 0.08)',
  },
} as const;

export const blur = {
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '40px',
} as const;
