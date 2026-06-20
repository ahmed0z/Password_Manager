import React from 'react';

export function getThemeStyles(theme: 'dark' | 'light') {
  const isDark = theme === 'dark';
  
  // Theme Palette derived from design_spec.json
  const c = {
    bgStart: isDark ? '#707784' : '#E9EAEC',
    bgEnd: isDark ? '#4A515C' : '#C7CBD1',
    card: isDark ? '#3D434D' : '#FFFFFF',
    cardSelected: isDark ? '#E9EAEC' : '#171819',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    text: isDark ? '#FFFFFF' : '#1F2228',
    textSec: isDark ? '#C7CBD1' : '#5C6470',
    textMuted: isDark ? '#9CA1AA' : '#8C909C',
    textDarkOnLight: '#1F2228',
    inputBg: isDark ? 'rgba(23, 24, 25, 0.2)' : 'rgba(255, 255, 255, 0.8)',
    inputBorder: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
    tabBarBg: isDark ? '#3D434D' : '#FFFFFF',
    tabBarBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    modalOverlay: 'rgba(23, 24, 25, 0.75)',
    modalBg: isDark ? '#3D434D' : '#FFFFFF',
    accentHover: 'rgba(244, 225, 26, 0.08)',
    accentSoft: 'rgba(244, 225, 26, 0.12)',
    borderActive: '#F4E11A',
    headerBg: 'transparent',
    accent: '#F4E11A',
    success: '#C7E8B0',
    successText: '#1E4620',
    blackPill: '#171819',
  };

  const s: Record<string, React.CSSProperties> = {
    panel: {
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: `linear-gradient(180deg, ${c.bgStart}, ${c.bgEnd})`,
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden',
    },
    header: {
      padding: '20px 20px 12px',
      background: c.headerBg,
      borderBottom: `1px solid ${c.cardBorder}`,
    },
    headerRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
    logo: {
      width: 32, height: 32, borderRadius: '50%',
      background: c.accent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: '32px', fontWeight: 600, color: '#FFFFFF', flex: 1, letterSpacing: '-0.5px' },
    searchInput: {
      width: '100%', height: 44, padding: '0 16px 0 38px',
      background: c.inputBg, border: `1px solid ${c.inputBorder}`,
      borderRadius: '20px', color: c.text, fontSize: '14px', outline: 'none',
      fontFamily: 'inherit', boxSizing: 'border-box',
      transition: 'all 0.15s ease',
    },
    content: {
      flex: 1, overflow: 'auto', padding: '20px',
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    itemCard: {
      padding: '10px 12px', borderRadius: '12px',
      background: c.card, border: `1px solid ${c.cardBorder}`,
      cursor: 'pointer', transition: 'all 0.15s ease',
      display: 'flex', alignItems: 'center', gap: '10px',
      position: 'relative',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    },
    itemCardSelected: {
      padding: '10px 12px', borderRadius: '12px',
      background: '#E9EAEC', border: `1px solid ${c.cardBorder}`,
      cursor: 'pointer', transition: 'all 0.15s ease',
      display: 'flex', alignItems: 'center', gap: '10px',
      position: 'relative',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    },
    favicon: {
      width: 32, height: 32, borderRadius: '50%',
      background: 'rgba(255, 255, 255, 0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
    },
    itemInfo: { flex: 1, minWidth: 0 },
    itemTitle: { fontSize: '13px', fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    itemTitleDark: { fontSize: '13px', fontWeight: 600, color: '#1F2228', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    itemSub: { fontSize: '11px', color: c.textSec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' },
    itemSubDark: { fontSize: '11px', color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' },
    iconBtn: {
      background: '#A8ACB5', border: 'none', cursor: 'pointer', padding: '8px',
      color: '#1F2228', display: 'flex', borderRadius: '50%', width: '32px', height: '32px',
      alignItems: 'center', justifyContent: 'center', opacity: 0.8,
    },
    sectionLabel: {
      fontSize: '14px', fontWeight: 500, textTransform: 'none',
      letterSpacing: 'normal', color: '#C7CBD1', padding: '8px 4px 4px',
    },
    statsBar: {
      display: 'flex', flexWrap: 'nowrap', gap: '4px', padding: '0 0 12px 0',
      justifyContent: 'space-between', width: '100%', boxSizing: 'border-box',
    },
    statPill: {
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '4px', padding: '6px 8px', borderRadius: '10px',
      background: c.card, border: `1px solid ${c.cardBorder}`,
      cursor: 'pointer', minWidth: 0, transition: 'all 0.15s ease',
    },
    statPillActive: {
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: '4px', padding: '6px 8px', borderRadius: '10px',
      background: c.accent, border: `1px solid ${c.accent}`,
      color: '#1F2228', cursor: 'pointer', minWidth: 0, transition: 'all 0.15s ease',
    },
    statNumber: { fontSize: '15px', fontWeight: 700, color: c.text },
    statNumberActive: { fontSize: '15px', fontWeight: 700, color: '#1F2228' },
    statLabel: { fontSize: '11px', fontWeight: 600, color: c.textSec, marginTop: 2 },
    statLabelActive: { fontSize: '11px', fontWeight: 600, color: '#1F2228', marginTop: 2 },
    tabBar: {
      display: 'flex', padding: '12px 20px',
      background: c.tabBarBg,
      borderTop: `1px solid ${c.tabBarBorder}`,
      borderRadius: '28px 28px 0 0',
      boxShadow: '0 -8px 32px rgba(0,0,0,0.15)',
      gap: '8px',
      position: 'relative',
      zIndex: 10,
    },
    tab: {
      flex: 1, padding: '8px 0', borderRadius: '999px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '10px', fontWeight: 600, fontFamily: 'inherit',
      color: c.textMuted, transition: 'all 0.2s ease',
    },
    tabActive: {
      flex: 1, padding: '8px 0', borderRadius: '999px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      background: c.accent, border: 'none', cursor: 'pointer',
      fontSize: '10px', fontWeight: 600, fontFamily: 'inherit',
      color: '#1F2228', transition: 'all 0.2s ease',
    },
    authContainer: {
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px',
    },
    authInput: {
      width: '100%', height: 48, padding: '0 16px',
      background: c.inputBg, border: `1px solid ${c.inputBorder}`,
      borderRadius: '12px', color: c.text, fontSize: '14px', outline: 'none',
      fontFamily: 'inherit', boxSizing: 'border-box',
    },
    authBtn: {
      width: '100%', height: 48, borderRadius: '12px', border: 'none',
      background: c.accent,
      color: '#1F2228', fontSize: '15px', fontWeight: 700, cursor: 'pointer',
      fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    },
  };

  const fStyles: Record<string, React.CSSProperties> = {
    section: {
      display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 4px', color: c.textSec, fontSize: '14px', fontWeight: 500,
    },
    card: {
      border: `1px solid ${c.cardBorder}`, borderRadius: '20px',
      background: c.card, overflow: 'hidden', display: 'flex',
      flexDirection: 'column', maxHeight: '180px', overflowY: 'auto',
    },
    row: {
      display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
      color: c.textSec, fontSize: '11px', fontWeight: 500, cursor: 'pointer',
      borderBottom: `1px solid ${c.cardBorder}`, userSelect: 'none', transition: 'all 0.1s ease',
    },
    activeRow: {
      background: c.accentHover, color: c.accent, fontWeight: 600,
    },
    actions: {
      display: 'flex', marginLeft: 'auto', gap: '4px',
    },
    actionBtn: {
      background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
      color: c.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    filterBadge: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 14px', borderRadius: '999px', background: c.accentHover,
      border: `1px solid ${c.accent}`, color: c.accent, fontSize: '13px', marginBottom: '10px',
    }
  };

  const mStyles: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: c.modalOverlay, backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '16px',
    },
    modal: {
      width: '100%', maxWidth: '320px', background: c.modalBg,
      border: `1px solid ${c.cardBorder}`, borderRadius: '28px',
      padding: '20px', boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
      display: 'flex', flexDirection: 'column', gap: '16px',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    title: {
      fontSize: '18px', fontWeight: 600, color: c.text,
    },
    closeBtn: {
      background: 'rgba(255,255,255,0.06)', border: 'none', color: c.textSec, cursor: 'pointer', padding: '6px', display: 'flex', borderRadius: '50%',
    },
    form: {
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    buttons: {
      display: 'flex', justifyContent: 'flex-end', gap: '8px',
      marginTop: '8px',
    },
    cancelBtn: {
      padding: '10px 18px', borderRadius: '999px', border: `1px solid ${c.cardBorder}`,
      background: c.inputBg, color: c.textSec, fontSize: '13px', fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit',
    },
    saveBtn: {
      padding: '10px 18px', borderRadius: '999px', border: 'none',
      background: c.accent, color: '#1F2228',
      fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    },
  };

  return { s, fStyles, mStyles, isDark, c };
}
