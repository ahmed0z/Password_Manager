// ============================================================================
// VaultSync — Color Design Tokens
// Slate background + Yellow accent aesthetic based on design_spec.json
// ============================================================================

export const colors = {
  dark: {
    // Backgrounds
    bgPrimary: '#5C6470',
    bgSecondary: '#4A515C',
    bgTertiary: '#3D434D',
    bgElevated: '#E9EAEC',
    bgGradientStart: '#707784',
    bgGradientEnd: '#4A515C',

    // Surfaces
    surfaceCard: '#3D434D',
    surfaceCardSelected: '#E9EAEC',
    surfaceMap: '#6B7280',
    surfaceBorder: 'rgba(255, 255, 255, 0.08)',
    surfaceBorderHover: 'rgba(255, 255, 255, 0.15)',

    // Text
    textPrimary: '#FFFFFF',
    textSecondary: '#C7CBD1',
    textTertiary: '#9CA1AA',
    textInverse: '#1F2228',
    textMuted: '#A9AEB6',

    // Accent
    accentPrimary: '#F4E11A',
    accentSoft: 'rgba(244, 225, 26, 0.12)',
    success: '#C7E8B0',
    successText: '#1E4620',
    blackPill: '#171819',
    
    // Iconography
    iconBtnBg: '#A8ACB5',
    iconColor: '#1F2228',

    // Strength levels (derived)
    strengthWeak: '#EF4444',
    strengthMedium: '#F4E11A',
    strengthStrong: '#22C55E',
  },
  light: {
    // A clean light slate theme
    bgPrimary: '#E9EAEC',
    bgSecondary: '#C7CBD1',
    bgTertiary: '#A9AEB6',
    bgElevated: '#FFFFFF',
    bgGradientStart: '#E9EAEC',
    bgGradientEnd: '#C7CBD1',

    // Surfaces
    surfaceCard: '#FFFFFF',
    surfaceCardSelected: '#E9EAEC',
    surfaceMap: '#6B7280',
    surfaceBorder: 'rgba(0, 0, 0, 0.08)',
    surfaceBorderHover: 'rgba(0, 0, 0, 0.15)',

    // Text
    textPrimary: '#1F2228',
    textSecondary: '#3D434D',
    textTertiary: '#5C6470',
    textInverse: '#FFFFFF',
    textMuted: '#6B7280',

    // Accent
    accentPrimary: '#F4E11A',
    accentSoft: 'rgba(244, 225, 26, 0.12)',
    success: '#C7E8B0',
    successText: '#1E4620',
    blackPill: '#171819',
    
    // Iconography
    iconBtnBg: '#A8ACB5',
    iconColor: '#1F2228',

    // Strength levels
    strengthWeak: '#EF4444',
    strengthMedium: '#F4E11A',
    strengthStrong: '#22C55E',
  }
} as const;

export type ThemeColors = typeof colors.dark;
