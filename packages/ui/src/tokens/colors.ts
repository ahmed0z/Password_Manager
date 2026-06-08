// ============================================================================
// VaultSync — Color Design Tokens
// Unified color palette for dark and light modes across all platforms.
// ============================================================================

export const colors = {
  dark: {
    // Backgrounds
    bgPrimary: 'hsl(222, 47%, 7%)',
    bgSecondary: 'hsl(222, 42%, 10%)',
    bgTertiary: 'hsl(222, 38%, 13%)',
    bgElevated: 'hsl(222, 35%, 15%)',
    bgHover: 'hsl(222, 35%, 18%)',
    bgOverlay: 'hsla(222, 47%, 5%, 0.85)',

    // Surfaces (glassmorphism)
    surfaceCard: 'hsla(222, 40%, 14%, 0.7)',
    surfaceBorder: 'hsla(0, 0%, 100%, 0.06)',
    surfaceBorderHover: 'hsla(0, 0%, 100%, 0.12)',

    // Text
    textPrimary: 'hsl(0, 0%, 95%)',
    textSecondary: 'hsl(0, 0%, 65%)',
    textTertiary: 'hsl(0, 0%, 45%)',
    textInverse: 'hsl(222, 47%, 7%)',

    // Accent gradient
    accentPrimary: 'hsl(190, 95%, 60%)',
    accentSecondary: 'hsl(270, 80%, 65%)',
    accentGradient: 'linear-gradient(135deg, hsl(190, 95%, 60%), hsl(270, 80%, 65%))',
    accentSoft: 'hsla(190, 95%, 60%, 0.12)',

    // Semantic
    success: 'hsl(152, 69%, 55%)',
    successSoft: 'hsla(152, 69%, 55%, 0.12)',
    warning: 'hsl(38, 95%, 60%)',
    warningSoft: 'hsla(38, 95%, 60%, 0.12)',
    danger: 'hsl(0, 84%, 62%)',
    dangerSoft: 'hsla(0, 84%, 62%, 0.12)',
    info: 'hsl(210, 90%, 62%)',
    infoSoft: 'hsla(210, 90%, 62%, 0.12)',

    // Strength indicator
    strengthVeryWeak: 'hsl(0, 84%, 62%)',
    strengthWeak: 'hsl(25, 90%, 58%)',
    strengthFair: 'hsl(38, 95%, 60%)',
    strengthStrong: 'hsl(85, 65%, 55%)',
    strengthVeryStrong: 'hsl(152, 69%, 55%)',
  },

  light: {
    // Backgrounds
    bgPrimary: 'hsl(220, 20%, 97%)',
    bgSecondary: 'hsl(220, 20%, 94%)',
    bgTertiary: 'hsl(220, 18%, 91%)',
    bgElevated: 'hsl(0, 0%, 100%)',
    bgHover: 'hsl(220, 18%, 95%)',
    bgOverlay: 'hsla(220, 20%, 97%, 0.85)',

    // Surfaces
    surfaceCard: 'hsla(0, 0%, 100%, 0.8)',
    surfaceBorder: 'hsla(222, 20%, 50%, 0.12)',
    surfaceBorderHover: 'hsla(222, 20%, 50%, 0.22)',

    // Text
    textPrimary: 'hsl(222, 47%, 11%)',
    textSecondary: 'hsl(222, 15%, 40%)',
    textTertiary: 'hsl(222, 10%, 60%)',
    textInverse: 'hsl(0, 0%, 97%)',

    // Accent
    accentPrimary: 'hsl(220, 85%, 50%)',
    accentSecondary: 'hsl(270, 70%, 55%)',
    accentGradient: 'linear-gradient(135deg, hsl(220, 85%, 50%), hsl(270, 70%, 55%))',
    accentSoft: 'hsla(220, 85%, 50%, 0.10)',

    // Semantic
    success: 'hsl(152, 55%, 42%)',
    successSoft: 'hsla(152, 55%, 42%, 0.10)',
    warning: 'hsl(38, 80%, 48%)',
    warningSoft: 'hsla(38, 80%, 48%, 0.10)',
    danger: 'hsl(0, 72%, 52%)',
    dangerSoft: 'hsla(0, 72%, 52%, 0.10)',
    info: 'hsl(210, 80%, 52%)',
    infoSoft: 'hsla(210, 80%, 52%, 0.10)',

    // Strength indicator
    strengthVeryWeak: 'hsl(0, 72%, 52%)',
    strengthWeak: 'hsl(25, 80%, 50%)',
    strengthFair: 'hsl(38, 80%, 48%)',
    strengthStrong: 'hsl(85, 55%, 42%)',
    strengthVeryStrong: 'hsl(152, 55%, 42%)',
  },
} as const;

export type ThemeColors = typeof colors.dark;
