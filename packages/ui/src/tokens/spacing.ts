// ============================================================================
// VaultSync — Spacing, Radius & Shadow Tokens
// Unified measurements matching design_spec.json
// ============================================================================

export const spacing = {
  // Generic scale
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  8: '32px',
  12: '48px',

  // Layout spacings from design_spec.json
  screenPadding: '20px',
  verticalRhythm: '18px',
  cardSpacing: '12px',
} as const;

export const radius = {
  none: '0px',
  avatar: '999px',
  pill: '999px',
  smallCard: '20px',
  largeCard: '28px',
  phoneFrame: '48px',
} as const;

export const shadows = {
  soft: '0 4px 20px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
  elevated: '0 10px 30px rgba(0, 0, 0, 0.16), 0 4px 10px rgba(0, 0, 0, 0.10)',
} as const;

export const blur = {
  sm: '8px',
  md: '16px',
} as const;
