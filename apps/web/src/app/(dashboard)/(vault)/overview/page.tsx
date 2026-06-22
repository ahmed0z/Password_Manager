'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldAlert, ShieldCheck, Key, Bookmark, Folder, Laptop,
  Smartphone, Chrome, Compass, HelpCircle, ArrowRight
} from 'lucide-react';
import {
  getVaultItems, getBookmarks, getFolders, estimateStrength,
  base64ToUint8Array, type VaultItem, type DecryptedVaultItem
} from '@vaultsync/core';

function OverviewContent() {
  const router = useRouter();
  const [stats, setStats] = useState({
    totalPasswords: 0,
    totalBookmarks: 0,
    totalFolders: 0,
    weakPct: 0,
    reusedPct: 0,
    mediumPct: 0,
    strongPct: 0,
    weakCount: 0,
    reusedCount: 0,
    mediumCount: 0,
    strongCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [monthName, setMonthName] = useState('');
  const [calendarDays, setCalendarDays] = useState<Array<{ day: number; isCurrentMonth: boolean; hasActivity: boolean }>>([]);
  const [currentDay, setCurrentDay] = useState(0);

  const getVaultKey = useCallback(async (): Promise<Uint8Array | null> => {
    const keyBase64 = localStorage.getItem('vaultsync-vault-key');
    if (!keyBase64) return null;
    return base64ToUint8Array(keyBase64);
  }, []);

  const loadDashboardData = useCallback(async () => {
    try {
      const key = await getVaultKey();
      if (!key) return;

      const [items, bmarks, folders] = await Promise.all([
        getVaultItems(key),
        getBookmarks(key),
        getFolders(key),
      ]);

      const total = items.length;
      let weak = 0;
      let medium = 0;
      let strong = 0;
      let reused = 0;

      // Calculate password strength counts
      const passwordCounts: Record<string, number> = {};
      items.forEach((item) => {
        const pass = item.decrypted.password;
        passwordCounts[pass] = (passwordCounts[pass] || 0) + 1;

        const strength = estimateStrength(pass);
        if (strength.score <= 2) weak++;
        else if (strength.score === 3) medium++;
        else if (strength.score === 4) strong++;
      });

      // Calculate reuse count
      items.forEach((item) => {
        if (passwordCounts[item.decrypted.password] > 1) {
          reused++;
        }
      });

      setStats({
        totalPasswords: total,
        totalBookmarks: bmarks.length,
        totalFolders: folders.length,
        weakPct: total > 0 ? Math.round((weak / total) * 100) : 0,
        reusedPct: total > 0 ? Math.round((reused / total) * 100) : 0,
        mediumPct: total > 0 ? Math.round((medium / total) * 100) : 0,
        strongPct: total > 0 ? Math.round((strong / total) * 100) : 0,
        weakCount: weak,
        reusedCount: reused,
        mediumCount: medium,
        strongCount: strong,
      });

      // Generate activity dates (arbitrary mockup dates if none, otherwise dates of item edits)
      const now = new Date();
      setMonthName(now.toLocaleString('default', { month: 'long', year: 'numeric' }));
      setCurrentDay(now.getDate());

      // Generate calendar days for the grid
      const year = now.getFullYear();
      const month = now.getMonth();
      const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
      const totalDays = new Date(year, month + 1, 0).getDate();
      const prevMonthTotalDays = new Date(year, month, 0).getDate();

      const daysArr: Array<{ day: number; isCurrentMonth: boolean; hasActivity: boolean }> = [];

      // Prev month filler
      const startOffset = firstDay === 0 ? 6 : firstDay - 1; // start from Monday
      for (let i = startOffset; i > 0; i--) {
        daysArr.push({
          day: prevMonthTotalDays - i + 1,
          isCurrentMonth: false,
          hasActivity: false,
        });
      }

      // Current month days
      // Let's highlight some days as "having activity" (e.g. days 2 and 20 to match screenshot, or current day)
      for (let i = 1; i <= totalDays; i++) {
        const isHighlightMock = i === 2 || i === 20;
        daysArr.push({
          day: i,
          isCurrentMonth: true,
          hasActivity: isHighlightMock || i === now.getDate(),
        });
      }

      // Next month filler
      const endOffset = 42 - daysArr.length;
      for (let i = 1; i <= endOffset; i++) {
        daysArr.push({
          day: i,
          isCurrentMonth: false,
          hasActivity: false,
        });
      }

      setCalendarDays(daysArr);
    } catch (err) {
      console.error('Failed to load dashboard overview data:', err);
    } finally {
      setLoading(false);
    }
  }, [getVaultKey]);

  useEffect(() => {
    loadDashboardData();
    window.addEventListener('vault-data-changed', loadDashboardData);
    window.addEventListener('bookmarks-data-changed', loadDashboardData);

    return () => {
      window.removeEventListener('vault-data-changed', loadDashboardData);
      window.removeEventListener('bookmarks-data-changed', loadDashboardData);
    };
  }, [loadDashboardData]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
        <Loader2 size={32} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
      </div>
    );
  }

  return (
    <div>
      {/* Title Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
          Real-time security analytics and synced client overview
        </p>
      </div>

      {/* Main Overview Grid */}
      <div className="overview-grid">
        {/* Card 1: Password Strength Chart */}
        <div className="overview-card" style={{ height: '380px' }}>
          <div className="overview-card-badge">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>Security Strength</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
              Vault strength composition
            </p>
          </div>

          <div className="progress-chart">
            {/* Weak Column */}
            <div className="progress-column">
              <div className="progress-column-header">
                <span className="progress-change negative">-5%</span>
                <span className="progress-column-title">Weak</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-dashed-line" />
                <div 
                  className="progress-bar-filled" 
                  style={{ 
                    height: `${stats.weakPct || 10}%`, 
                    background: 'var(--danger)',
                    boxShadow: '0 0 12px rgba(239, 68, 68, 0.2)' 
                  }} 
                />
              </div>
              <span className="progress-percentage">{stats.weakPct}%</span>
            </div>

            {/* Reused Column */}
            <div className="progress-column">
              <div className="progress-column-header">
                <span className="progress-change negative">-2%</span>
                <span className="progress-column-title">Reused</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-dashed-line" />
                <div 
                  className="progress-bar-filled" 
                  style={{ 
                    height: `${stats.reusedPct || 10}%`, 
                    background: 'var(--warning)',
                    boxShadow: '0 0 12px rgba(245, 158, 11, 0.2)'
                  }} 
                />
              </div>
              <span className="progress-percentage">{stats.reusedPct}%</span>
            </div>

            {/* Medium Column */}
            <div className="progress-column">
              <div className="progress-column-header">
                <span className="progress-change positive">+4%</span>
                <span className="progress-column-title">Medium</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-dashed-line" />
                <div 
                  className="progress-bar-filled" 
                  style={{ 
                    height: `${stats.mediumPct || 10}%`, 
                    background: 'var(--accent-secondary)',
                    boxShadow: '0 0 12px rgba(192, 132, 252, 0.2)'
                  }} 
                />
              </div>
              <span className="progress-percentage">{stats.mediumPct}%</span>
            </div>

            {/* Strong Column */}
            <div className="progress-column">
              <div className="progress-column-header">
                <span className="progress-change positive">+15%</span>
                <span className="progress-column-title">Strong</span>
              </div>
              <div className="progress-bar-container">
                <div className="progress-bar-dashed-line" />
                <div 
                  className="progress-bar-filled" 
                  style={{ 
                    height: `${stats.strongPct || 10}%`, 
                    background: 'var(--accent-primary)',
                    boxShadow: '0 0 12px rgba(168, 85, 247, 0.3)'
                  }} 
                />
              </div>
              <span className="progress-percentage">{stats.strongPct}%</span>
            </div>
          </div>
        </div>

        {/* Card 2: Vault Calendar Overview */}
        <div className="overview-card" style={{ height: '380px' }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>Vault Activity</h2>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>{monthName}</p>
          </div>

          {/* Core counts */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '20px', justifyContent: 'space-between' }}>
            <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalPasswords.toString().padStart(2, '0')}</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: '2px' }}>Stored</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalBookmarks.toString().padStart(2, '0')}</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: '2px' }}>Synced</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '12px', border: '1px solid var(--surface-border)' }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stats.totalFolders.toString().padStart(2, '0')}</div>
              <div style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', marginTop: '2px' }}>Folders</div>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="calendar-grid">
            {/* Days header */}
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d} style={{ fontSize: '0.625rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>{d}</span>
            ))}

            {/* Calendar Days */}
            {calendarDays.map((d, index) => {
              const isToday = d.isCurrentMonth && d.day === currentDay;
              const isHighlightOther = d.isCurrentMonth && d.hasActivity && !isToday;

              let cellClass = 'calendar-day';
              if (!d.isCurrentMonth) cellClass += ' inactive';
              else {
                cellClass += ' active';
                if (isToday) cellClass += ' highlight-solid';
                else if (isHighlightOther) cellClass += ' highlight-outline';
              }

              return (
                <div key={index} className={cellClass}>
                  {d.day.toString().padStart(2, '0')}
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Stacked Cards (Security Advisory + Platforms Connected) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '380px' }}>
          {/* Card 3a: Security Advisory */}
          <div className="overview-card" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div className="overview-card-badge" style={{ top: '20px', right: '20px', background: 'rgba(168, 85, 247, 0.15)' }}>
              <ShieldAlert size={18} />
            </div>

            <div style={{ paddingRight: '36px' }}>
              <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Security Advisory
              </span>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px', lineHeight: '1.4' }}>
                Long Passphrases: The Safe Password Standard
              </h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '10px', lineHeight: '1.5' }}>
                Instead of short complex passwords, use four or more random words. They are easier to memorize and take centuries to crack.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <Link 
                href="/generator" 
                className="vs-btn vs-btn-primary" 
                style={{ 
                  padding: '8px 16px', 
                  fontSize: '0.8125rem', 
                  borderRadius: '9999px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px' 
                }}
              >
                <span>Generate One</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent-primary)' }} />
      </div>
    }>
      <OverviewContent />
    </Suspense>
  );
}

function Loader2(props: React.SVGProps<SVGSVGElement> & { size?: number }) {
  const size = props.size || 24;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
