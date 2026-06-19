// ============================================================================
// VaultSync — Typography Tokens
// Rounded sans-serif / System defaults with exact layout kit styles
// ============================================================================

export const typography = {
  fontFamily: {
    primary: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    mono: "monospace, ui-monospace, 'Courier New'",
  },

  // Generic font sizes
  fontSize: {
    xs: '0.6875rem',    // 11px
    sm: '0.8125rem',    // 13px
    base: '0.875rem',   // 14px
    md: '1rem',         // 16px
    lg: '1.125rem',     // 18px
    xl: '1.25rem',      // 20px
    '2xl': '1.5rem',    // 24px
    '3xl': '2rem',      // 32px
    '4xl': '2.5rem',    // 40px
  },

  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },

  // Component-specific specifications from design_spec.json
  screenTitle: {
    size: '32px',
    weight: '600',
  },
  sectionLabel: {
    size: '14px',
    weight: '500',
  },
  cardTitle: {
    size: '16px',
    weight: '600',
  },
  cardSubtitle: {
    size: '13px',
    weight: '400',
  },
  statValue: {
    size: '15px',
    weight: '700',
  },
  bigStatPercent: {
    size: '40px',
    weight: '700',
  }
} as const;
