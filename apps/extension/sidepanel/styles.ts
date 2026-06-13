import React from 'react';

export function getThemeStyles(theme: 'dark' | 'light') {
  const isDark = theme === 'dark';
  
  const c = {
    bgStart: isDark ? '#0a0f1e' : '#f8fafc',
    bgEnd: isDark ? '#111827' : '#e2e8f0',
    card: isDark ? 'rgba(255,255,255,0.04)' : '#ffffff',
    cardBorder: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    text: isDark ? '#f2f2f2' : '#0f172a',
    textSec: isDark ? '#8a8f9e' : '#64748b',
    inputBg: isDark ? 'rgba(255,255,255,0.06)' : '#ffffff',
    inputBorder: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)',
    tabBarBg: isDark ? 'rgba(10, 15, 30, 0.75)' : 'rgba(255, 255, 255, 0.85)',
    tabBarBorder: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
    modalOverlay: isDark ? 'rgba(5, 8, 16, 0.85)' : 'rgba(0, 0, 0, 0.3)',
    modalBg: isDark ? '#0d1527' : '#ffffff',
    accentHover: isDark ? 'rgba(92, 224, 214, 0.08)' : 'rgba(92, 224, 214, 0.15)',
    borderActive: isDark ? 'rgba(92, 224, 214, 0.2)' : 'rgba(92, 224, 214, 0.3)',
    headerBg: isDark ? 'linear-gradient(135deg, rgba(92,224,214,0.08), rgba(167,139,250,0.05))' : 'linear-gradient(135deg, rgba(92,224,214,0.15), rgba(167,139,250,0.1))',
    accent: '#5ce0d6',
    accent2: '#a78bfa',
    textMain: isDark ? '#f2f2f2' : '#0f172a',
    textSub: isDark ? '#8a8f9e' : '#64748b',
  };

  const s: Record<string, React.CSSProperties> = {
    panel: {
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: `linear-gradient(160deg, ${c.bgStart}, ${c.bgEnd})`,
      fontFamily: "'Inter', -apple-system, sans-serif",
      overflow: 'hidden',
    },
    header: {
      padding: '16px 16px 12px',
      background: c.headerBg,
      borderBottom: `1px solid ${c.cardBorder}`,
    },
    headerRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
    logo: {
      width: 28, height: 28, borderRadius: 8,
      background: 'linear-gradient(135deg, #5ce0d6, #a78bfa)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: '15px', fontWeight: 700, color: c.text, flex: 1 },
    searchInput: {
      width: '100%', height: 36, padding: '0 12px 0 34px',
      background: c.inputBg, border: `1px solid ${c.inputBorder}`,
      borderRadius: 10, color: c.text, fontSize: '13px', outline: 'none',
      fontFamily: 'inherit', boxSizing: 'border-box',
    },
    content: {
      flex: 1, overflow: 'auto', padding: '12px',
      display: 'flex', flexDirection: 'column', gap: '8px',
    },
    itemCard: {
      padding: '12px', borderRadius: 10,
      background: c.card, border: `1px solid ${c.cardBorder}`,
      cursor: 'pointer', transition: 'all 0.15s ease',
      display: 'flex', alignItems: 'center', gap: '10px',
    },
    favicon: {
      width: 32, height: 32, borderRadius: 8,
      background: c.inputBg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden',
    },
    itemInfo: { flex: 1, minWidth: 0 },
    itemTitle: { fontSize: '13px', fontWeight: 600, color: c.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    itemSub: { fontSize: '11px', color: c.textSec, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
    iconBtn: {
      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
      color: c.textSec, display: 'flex', borderRadius: 6,
    },
    sectionLabel: {
      fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.1em', color: c.textSec, padding: '8px 4px 4px',
    },
    statsBar: {
      display: 'flex', gap: '6px', padding: '0 16px 12px',
    },
    statPill: {
      flex: 1, padding: '10px', borderRadius: 10,
      background: c.card, border: `1px solid ${c.cardBorder}`,
      textAlign: 'center',
    },
    statNumber: { fontSize: '18px', fontWeight: 800 },
    statLabel: { fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: c.textSec, marginTop: 2 },
    tabBar: {
      display: 'flex', padding: '10px 16px',
      borderTop: `1px solid ${c.tabBarBorder}`,
      background: c.tabBarBg,
      backdropFilter: 'blur(20px)',
      boxShadow: isDark ? '0 -8px 32px rgba(0,0,0,0.5)' : '0 -8px 32px rgba(15,23,42,0.08)',
      gap: '6px',
      position: 'relative',
      zIndex: 10,
    },
    tab: {
      flex: 1, padding: '8px 0', borderRadius: 8,
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
      background: 'none', border: 'none', cursor: 'pointer',
      fontSize: '10px', fontWeight: 600, fontFamily: 'inherit',
    },
    authContainer: {
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px',
    },
    authInput: {
      width: '100%', height: 44, padding: '0 14px',
      background: c.inputBg, border: `1px solid ${c.inputBorder}`,
      borderRadius: 10, color: c.text, fontSize: '14px', outline: 'none',
      fontFamily: 'inherit', boxSizing: 'border-box',
    },
    authBtn: {
      width: '100%', height: 44, borderRadius: 10, border: 'none',
      background: 'linear-gradient(135deg, #5ce0d6, #a78bfa)',
      color: '#0a0f1e', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
      fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
    },
  };

  const fStyles: Record<string, React.CSSProperties> = {
    section: {
      display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 4px', color: c.textSec, fontSize: '11px', fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '0.05em',
    },
    card: {
      border: `1px solid ${c.cardBorder}`, borderRadius: '8px',
      background: c.card, overflow: 'hidden', display: 'flex',
      flexDirection: 'column', maxHeight: '180px', overflowY: 'auto',
    },
    row: {
      display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
      color: c.textSec, fontSize: '12px', fontWeight: 500, cursor: 'pointer',
      borderBottom: `1px solid ${c.cardBorder}`, userSelect: 'none', transition: 'all 0.1s ease',
    },
    activeRow: {
      background: c.accentHover, color: '#5ce0d6', fontWeight: 600,
    },
    actions: {
      display: 'flex', marginLeft: 'auto', gap: '4px',
    },
    actionBtn: {
      background: 'none', border: 'none', cursor: 'pointer', padding: '2px',
      color: c.textSec, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    filterBadge: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '6px 12px', borderRadius: '8px', background: c.accentHover,
      border: `1px solid ${c.borderActive}`, color: '#5ce0d6', fontSize: '12px', marginBottom: '10px',
    }
  };

  const mStyles: Record<string, React.CSSProperties> = {
    overlay: {
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: c.modalOverlay, backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000, padding: '16px',
    },
    modal: {
      width: '100%', maxWidth: '320px', background: c.modalBg,
      border: `1px solid ${c.cardBorder}`, borderRadius: '12px',
      padding: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    },
    title: {
      fontSize: '14px', fontWeight: 700, color: c.text,
    },
    closeBtn: {
      background: 'none', border: 'none', color: c.textSec, cursor: 'pointer', padding: '4px', display: 'flex',
    },
    form: {
      display: 'flex', flexDirection: 'column', gap: '12px',
    },
    buttons: {
      display: 'flex', justifyContent: 'flex-end', gap: '8px',
    },
    cancelBtn: {
      padding: '8px 16px', borderRadius: '8px', border: `1px solid ${c.cardBorder}`,
      background: c.inputBg, color: c.textSec, fontSize: '12px', fontWeight: 600,
      cursor: 'pointer', fontFamily: 'inherit',
    },
    saveBtn: {
      padding: '8px 16px', borderRadius: '8px', border: 'none',
      background: 'linear-gradient(135deg, #5ce0d6, #a78bfa)', color: '#0a0f1e',
      fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
    },
  };

  return { s, fStyles, mStyles, isDark, c };
}
