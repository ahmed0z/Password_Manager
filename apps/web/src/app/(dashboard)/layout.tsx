'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, Search, LogOut, ChevronDown, Moon, Sun, Monitor,
  LayoutDashboard, Key, Bookmark, Wand2, Settings
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import {
  signOut, getSession, subscribeToVaultItems, subscribeToFolders, subscribeToBookmarks, type UserProfile, base64ToUint8Array
} from '@vaultsync/core';

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    // Check auth on mount
    const checkAuth = async () => {
      const activeSession = await getSession();
      if (!activeSession) {
        router.replace('/auth/login');
        return;
      }
      setSession(activeSession);

      // Check if session has already expired on cold load
      const autolockMinutes = parseInt(localStorage.getItem('vaultsync-autolock') || '30', 10);
      const lastActivityStr = localStorage.getItem('vaultsync-last-activity');
      if (autolockMinutes > 0 && lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        if (Date.now() - lastActivity > autolockMinutes * 60 * 1000) {
          console.log('[VaultSync] Auto-lock expired on startup');
          await signOut();
          localStorage.removeItem('vaultsync-vault-key');
          localStorage.removeItem('vaultsync-vault-salt');
          router.replace('/auth/login');
        }
      }
    };
    checkAuth();
  }, [router]);

  // Monitor user activity and handle auto-lock
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateActivity = () => {
      localStorage.setItem('vaultsync-last-activity', Date.now().toString());
    };

    updateActivity();

    const events = ['mousedown', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, updateActivity));

    const interval = setInterval(async () => {
      const autolockMinutes = parseInt(localStorage.getItem('vaultsync-autolock') || '30', 10);
      if (autolockMinutes === 0) return; // 'Never'

      const lastActivityStr = localStorage.getItem('vaultsync-last-activity');
      if (lastActivityStr) {
        const lastActivity = parseInt(lastActivityStr, 10);
        if (Date.now() - lastActivity > autolockMinutes * 60 * 1000) {
          console.log('[VaultSync] Auto-lock triggered due to inactivity');
          await signOut();
          localStorage.removeItem('vaultsync-vault-key');
          localStorage.removeItem('vaultsync-vault-salt');
          router.replace('/auth/login');
        }
      }
    }, 10000); // Check every 10 seconds

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
      clearInterval(interval);
    };
  }, [router]);

  // Realtime database synchronization subscriptions
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;

    const vaultItemsSub = subscribeToVaultItems(userId, () => {
      console.log('[Realtime SW] Vault items changed in Supabase');
      window.dispatchEvent(new Event('vault-data-changed'));
    });

    const foldersSub = subscribeToFolders(userId, () => {
      console.log('[Realtime SW] Folders changed in Supabase');
      window.dispatchEvent(new Event('vault-data-changed'));
    });

    const bookmarksSub = subscribeToBookmarks(userId, () => {
      console.log('[Realtime SW] Bookmarks changed in Supabase');
      window.dispatchEvent(new Event('bookmarks-data-changed'));
    });

    return () => {
      if (vaultItemsSub) vaultItemsSub.unsubscribe();
      if (foldersSub) foldersSub.unsubscribe();
      if (bookmarksSub) bookmarksSub.unsubscribe();
    };
  }, [session?.user?.id]);

  const handleSignOut = async () => {
    await signOut();
    localStorage.removeItem('vaultsync-vault-key');
    localStorage.removeItem('vaultsync-vault-salt');
    router.replace('/auth/login');
  };

  const focusSearch = () => {
    const input = document.getElementById('vault-search') || document.getElementById('bookmarks-search');
    if (input) {
      input.focus();
    }
  };

  // Nav configuration mapping to horizontal tabs
  const navItems = [
    { href: '/overview', label: 'Overview', icon: <LayoutDashboard size={14} /> },
    { href: '/vault', label: 'Vault', icon: <Key size={14} /> },
    { href: '/bookmarks', label: 'Bookmarks', icon: <Bookmark size={14} /> },
    { href: '/generator', label: 'Generator', icon: <Wand2 size={14} /> },
    { href: '/settings', label: 'Settings', icon: <Settings size={14} /> },
  ];

  const themeOptions = [
    { value: 'dark' as const, icon: <Moon size={14} />, label: 'Dark' },
    { value: 'light' as const, icon: <Sun size={14} />, label: 'Light' },
    { value: 'system' as const, icon: <Monitor size={14} />, label: 'System' },
  ];

  // User formatting for avatar & profile
  const userEmail = session?.user?.email || 'user@vaultsync.sec';
  const displayEmail = session?.user?.email || 'Kate Hudson';
  const displayName = displayEmail.split('@')[0]
    .replace(/[._-]/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
  const initials = displayEmail.substring(0, 2).toUpperCase();

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Top Navigation Bar */}
      <header className="top-nav">
        {/* Logo */}
        <Link href="/overview" className="top-nav-logo">
          <div className="top-nav-logo-icon">
            <Shield size={16} fill="white" />
          </div>
          <span>VaultSync</span>
        </Link>

        {/* Center Pill Nav tabs */}
        <nav className="top-nav-tabs">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/overview');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`top-nav-tab ${isActive ? 'active' : ''}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right action items */}
        <div className="top-nav-actions">
          {/* Search Button */}
          <button className="circle-btn" onClick={focusSearch} title="Search Vault/Bookmarks">
            <Search size={18} />
          </button>

          {/* User Profile dropdown */}
          <div style={{ position: 'relative' }}>
            <div className="profile-card" onClick={() => setShowUserMenu(!showUserMenu)}>
              <div className="profile-avatar">
                {initials}
              </div>
              <div className="profile-info">
                <span className="profile-name">{displayName}</span>
                <span className="profile-role">Security User</span>
              </div>
              <ChevronDown size={14} style={{ color: 'var(--text-tertiary)', transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
            </div>

            {showUserMenu && (
              <>
                <div 
                  style={{ position: 'fixed', inset: 0, zIndex: 100 }} 
                  onClick={() => setShowUserMenu(false)} 
                />
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    width: '240px',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '8px',
                    marginTop: '8px',
                    boxShadow: 'var(--shadow-xl)',
                    animation: 'fadeInUp 0.2s var(--ease-out-expo)',
                    zIndex: 101,
                  }}
                >
                  {/* User meta info */}
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--surface-border)', marginBottom: '8px' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase' }}>
                      Signed In As
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {userEmail}
                    </div>
                  </div>

                  {/* Theme switcher inside user menu */}
                  <div style={{ padding: '4px 12px 8px' }}>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px' }}>
                      Theme
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                      {themeOptions.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setTheme(opt.value)}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '6px',
                            background: theme === opt.value ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                            border: `1px solid ${theme === opt.value ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                            borderRadius: 'var(--radius-md)',
                            color: theme === opt.value ? 'var(--accent-text)' : 'var(--text-secondary)',
                            fontFamily: 'inherit',
                            fontSize: '0.6875rem',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {opt.icon}
                          <span style={{ fontWeight: 500 }}>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--surface-border)', marginTop: '4px', paddingTop: '4px' }}>
                    <button
                      onClick={handleSignOut}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'none',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.8125rem',
                        color: 'var(--danger)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--danger-soft)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                    >
                      <LogOut size={14} />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Quick Sign Out Button */}
          <button className="circle-btn" onClick={handleSignOut} title="Sign Out">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main View Area */}
      <main style={{ flex: 1, padding: '24px', position: 'relative' }}>
        <div className="page-enter" style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
