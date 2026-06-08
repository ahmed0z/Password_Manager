'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, Key, Bookmark, Wand2, Settings, FolderClosed,
  LogOut, Sun, Moon, Monitor, Search, ChevronDown,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import { signOut, getSession } from '@vaultsync/core';

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);

  useEffect(() => {
    // Check auth on mount
    const checkAuth = async () => {
      const session = await getSession();
      if (!session) {
        router.replace('/auth/login');
      }
    };
    checkAuth();
  }, [router]);

  const handleSignOut = async () => {
    await signOut();
    sessionStorage.removeItem('vaultsync-vault-key');
    sessionStorage.removeItem('vaultsync-vault-salt');
    router.replace('/auth/login');
  };

  const navItems = [
    { href: '/vault', icon: <Key size={18} />, label: 'Vault' },
    { href: '/bookmarks', icon: <Bookmark size={18} />, label: 'Bookmarks' },
    { href: '/generator', icon: <Wand2 size={18} />, label: 'Generator' },
    { href: '/settings', icon: <Settings size={18} />, label: 'Settings' },
  ];

  const themeOptions = [
    { value: 'dark' as const, icon: <Moon size={14} />, label: 'Dark' },
    { value: 'light' as const, icon: <Sun size={14} />, label: 'Light' },
    { value: 'system' as const, icon: <Monitor size={14} />, label: 'System' },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-gradient)' }}>
      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            padding: 'var(--space-2) var(--space-3)',
            marginBottom: 'var(--space-6)',
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Shield size={18} color="white" />
          </div>
          <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            VaultSync
          </span>
        </div>

        {/* Nav Links */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href || pathname?.startsWith(item.href + '/') ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Theme Switcher */}
        <div style={{ position: 'relative', marginBottom: 'var(--space-2)' }}>
          <button
            className="sidebar-link"
            style={{
              width: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: '0.875rem',
              justifyContent: 'space-between',
            }}
            onClick={() => setShowThemeMenu(!showThemeMenu)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              Theme
            </span>
            <ChevronDown size={14} style={{ transform: showThemeMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>

          {showThemeMenu && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                background: 'var(--bg-elevated)',
                border: '1px solid var(--surface-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-1)',
                marginBottom: 'var(--space-1)',
                animation: 'fadeInUp 0.2s var(--ease-out-expo)',
                zIndex: 50,
              }}
            >
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  className="sidebar-link"
                  style={{
                    width: '100%',
                    background: theme === opt.value ? 'var(--accent-soft)' : 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: '0.8125rem',
                    color: theme === opt.value ? 'var(--accent-text)' : 'var(--text-secondary)',
                  }}
                  onClick={() => {
                    setTheme(opt.value);
                    setShowThemeMenu(false);
                  }}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sign Out */}
        <button
          className="sidebar-link"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.875rem',
            color: 'var(--danger)',
          }}
          onClick={handleSignOut}
        >
          <LogOut size={18} />
          Sign Out
        </button>
      </aside>

      {/* Main Content */}
      <main
        style={{
          flex: 1,
          padding: 'var(--space-8)',
          overflow: 'auto',
        }}
      >
        <div className="page-enter" style={{ maxWidth: 1200, margin: '0 auto' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
