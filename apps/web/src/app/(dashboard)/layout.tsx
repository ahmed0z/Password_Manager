'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Shield, Key, Bookmark, Wand2, Settings, FolderClosed,
  LogOut, Sun, Moon, Monitor, ChevronDown, Menu, Plus,
  FolderPlus, Edit2, Trash2, Loader2
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import {
  signOut, getSession, getFolders, createFolder, renameFolder,
  deleteFolder, buildFolderTree, getBookmarks, renameBookmarkFolder,
  deleteBookmarkFolder, buildBookmarkFolderTree, type DecryptedFolder,
  type BookmarkFolderNode, base64ToUint8Array
} from '@vaultsync/core';

export default function VaultLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('vaultsync-sidebar-collapsed') === 'true';
    }
    return false;
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('vaultsync-sidebar-collapsed', String(next));
      if (next) setShowThemeMenu(false);
      return next;
    });
  };

  useEffect(() => {
    // Check auth on mount
    const checkAuth = async () => {
      const session = await getSession();
      if (!session) {
        router.replace('/auth/login');
        return;
      }
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

    // Initialize activity on mount
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

  const handleSignOut = async () => {
    await signOut();
    localStorage.removeItem('vaultsync-vault-key');
    localStorage.removeItem('vaultsync-vault-salt');
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
      <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top bar: menu toggle + logo */}
        <div className="sidebar-header">
          <button
            id="sidebar-toggle"
            className="sidebar-link sidebar-menu-btn"
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={20} />
          </button>
          {!collapsed && (
            <div className="sidebar-brand">
              <div className="sidebar-brand-icon">
                <Shield size={16} color="white" />
              </div>
              <span className="sidebar-brand-text">VaultSync</span>
            </div>
          )}
        </div>

        {/* Nav Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href || (pathname?.startsWith(item.href + '/') && item.href !== '/') ? 'active' : ''}`}
              title={collapsed ? item.label : undefined}
              style={collapsed ? { justifyContent: 'center', padding: 'var(--space-2)' } : undefined}
            >
              {item.icon}
              {!collapsed && <span className="sidebar-label">{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Contextual Folder List in Sidebar */}
        {!collapsed && (pathname.startsWith('/vault') || pathname.startsWith('/bookmarks')) && (
          <Suspense fallback={<div className="vs-skeleton" style={{ height: 100, marginTop: 'var(--space-4)' }} />}>
            <SidebarFolders pathname={pathname} />
          </Suspense>
        )}

        <div style={{ flex: 1 }} />

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
              justifyContent: collapsed ? 'center' : 'space-between',
              padding: collapsed ? 'var(--space-2)' : undefined,
            }}
            onClick={() => setShowThemeMenu(!showThemeMenu)}
            title={collapsed ? 'Theme' : undefined}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              {resolvedTheme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
              {!collapsed && 'Theme'}
            </span>
            {!collapsed && <ChevronDown size={14} style={{ transform: showThemeMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />}
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
            justifyContent: collapsed ? 'center' : undefined,
            padding: collapsed ? 'var(--space-2)' : undefined,
          }}
          onClick={handleSignOut}
          title={collapsed ? 'Sign Out' : undefined}
        >
          <LogOut size={18} />
          {!collapsed && 'Sign Out'}
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

function SidebarFolders({ pathname }: { pathname: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedFolderId = searchParams.get('folder');
  const selectedFolderPath = searchParams.get('folder');

  const [passwordFolders, setPasswordFolders] = useState<DecryptedFolder[]>([]);
  const [bookmarkFolders, setBookmarkFolders] = useState<BookmarkFolderNode[]>([]);
  const [loading, setLoading] = useState(false);

  // Modals / forms state
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [folderParentId, setFolderParentId] = useState<string | undefined>(undefined);
  const [folderRenameId, setFolderRenameId] = useState<string | null>(null);
  const [folderRenameName, setFolderRenameName] = useState('');
  const [folderNewName, setFolderNewName] = useState('');

  // Bookmarks Folder Add / Rename / Delete
  const [showBookmarkFolderModal, setShowBookmarkFolderModal] = useState<'add' | 'rename' | null>(null);
  const [bookmarkOldPath, setBookmarkOldPath] = useState('');
  const [bookmarkNewPath, setBookmarkNewPath] = useState('');

  // Expand/Collapse state
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [isMainFoldersCollapsed, setIsMainFoldersCollapsed] = useState(false);

  const toggleFolder = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getVaultKey = useCallback(async (): Promise<Uint8Array | null> => {
    const keyBase64 = localStorage.getItem('vaultsync-vault-key');
    if (!keyBase64) return null;
    return base64ToUint8Array(keyBase64);
  }, []);

  const loadFolders = useCallback(async () => {
    setLoading(true);
    try {
      const key = await getVaultKey();
      if (!key) return;

      if (pathname.startsWith('/vault')) {
        const userFolders = await getFolders(key);
        setPasswordFolders(buildFolderTree(userFolders));
      } else if (pathname.startsWith('/bookmarks')) {
        const bmarks = await getBookmarks(key);
        
        // Extract all paths from bookmarks
        const paths = new Set<string>();
        bmarks.forEach(b => {
          if (b.decrypted.folderPath) paths.add(b.decrypted.folderPath);
        });

        // Also add empty folders stored in localStorage
        const storedEmpty = localStorage.getItem('vaultsync-empty-bookmark-folders');
        if (storedEmpty) {
          try {
            const emptyList: string[] = JSON.parse(storedEmpty);
            emptyList.forEach(p => paths.add(p));
          } catch {}
        }

        setBookmarkFolders(buildBookmarkFolderTree(Array.from(paths)));
      }
    } catch (err) {
      console.error('Failed to load folders:', err);
      if (err instanceof Error && err.message === 'Not authenticated') {
        await signOut();
        router.replace('/auth/login');
      }
    } finally {
      setLoading(false);
    }
  }, [getVaultKey, pathname]);

  useEffect(() => {
    loadFolders();

    // Listen to custom reload events
    const reloadPasswords = () => { if (pathname.startsWith('/vault')) loadFolders(); };
    const reloadBookmarks = () => { if (pathname.startsWith('/bookmarks')) loadFolders(); };

    window.addEventListener('vault-data-changed', reloadPasswords);
    window.addEventListener('bookmarks-data-changed', reloadBookmarks);

    return () => {
      window.removeEventListener('vault-data-changed', reloadPasswords);
      window.removeEventListener('bookmarks-data-changed', reloadBookmarks);
    };
  }, [loadFolders, pathname]);

  // Passwords Folder handlers
  const handleAddFolderClick = (parentId?: string) => {
    setFolderParentId(parentId);
    setFolderNewName('');
    setShowAddFolderModal(true);
  };

  const handleAddFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNewName.trim()) return;
    try {
      const key = await getVaultKey();
      if (!key) return;
      await createFolder(folderNewName.trim(), key, folderParentId);
      setShowAddFolderModal(false);
      loadFolders();
      // Dispatch custom event to trigger vault page reload
      window.dispatchEvent(new Event('vault-data-changed'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameClick = (id: string, currentName: string) => {
    setFolderRenameId(id);
    setFolderRenameName(currentName);
    setShowRenameFolderModal(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderRenameId || !folderRenameName.trim()) return;
    try {
      const key = await getVaultKey();
      if (!key) return;
      await renameFolder(folderRenameId, folderRenameName.trim(), key);
      setShowRenameFolderModal(false);
      loadFolders();
      window.dispatchEvent(new Event('vault-data-changed'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm('Are you sure you want to delete this folder? Password items inside will be moved to ungrouped.')) return;
    try {
      await deleteFolder(id);
      loadFolders();
      window.dispatchEvent(new Event('vault-data-changed'));
      if (selectedFolderId === id) {
        router.push('/vault');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Bookmark Folder handlers
  const handleAddBookmarkFolderClick = () => {
    setBookmarkNewPath('');
    setShowBookmarkFolderModal('add');
  };

  const handleAddBookmarkFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookmarkNewPath.trim()) return;
    try {
      const newPath = bookmarkNewPath.trim();
      
      // Save empty folder path in localStorage
      const storedEmpty = localStorage.getItem('vaultsync-empty-bookmark-folders');
      let emptyList: string[] = [];
      if (storedEmpty) {
        try { emptyList = JSON.parse(storedEmpty); } catch {}
      }
      if (!emptyList.includes(newPath)) {
        emptyList.push(newPath);
        localStorage.setItem('vaultsync-empty-bookmark-folders', JSON.stringify(emptyList));
      }
      
      setShowBookmarkFolderModal(null);
      loadFolders();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameBookmarkFolderClick = (path: string) => {
    setBookmarkOldPath(path);
    setBookmarkNewPath(path);
    setShowBookmarkFolderModal('rename');
  };

  const handleRenameBookmarkFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookmarkNewPath.trim() || !bookmarkOldPath) return;
    try {
      const key = await getVaultKey();
      if (!key) return;
      
      const newPath = bookmarkNewPath.trim();
      
      // Rename in Supabase for matching bookmarks
      await renameBookmarkFolder(bookmarkOldPath, newPath, key);
      
      // Rename empty folders in localStorage
      const storedEmpty = localStorage.getItem('vaultsync-empty-bookmark-folders');
      if (storedEmpty) {
        try {
          let emptyList: string[] = JSON.parse(storedEmpty);
          emptyList = emptyList.map(p => {
            if (p === bookmarkOldPath) return newPath;
            if (p.startsWith(bookmarkOldPath + '/')) {
              return newPath + p.substring(bookmarkOldPath.length);
            }
            return p;
          });
          localStorage.setItem('vaultsync-empty-bookmark-folders', JSON.stringify(emptyList));
        } catch {}
      }

      setShowBookmarkFolderModal(null);
      loadFolders();
      // Dispatch custom event to reload page data
      window.dispatchEvent(new Event('bookmarks-data-changed'));
      
      if (selectedFolderPath === bookmarkOldPath) {
        router.push(`/bookmarks?folder=${encodeURIComponent(newPath)}`);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteBookmarkFolderClick = async (path: string) => {
    if (!confirm(`Are you sure you want to delete "${path}" folder? Synced bookmarks will be moved to root.`)) return;
    try {
      const key = await getVaultKey();
      if (!key) return;
      
      // Delete in Supabase (updates bookmarks to root)
      await deleteBookmarkFolder(path, key);
      
      // Remove empty folders from localStorage
      const storedEmpty = localStorage.getItem('vaultsync-empty-bookmark-folders');
      if (storedEmpty) {
        try {
          let emptyList: string[] = JSON.parse(storedEmpty);
          emptyList = emptyList.filter(p => p !== path && !p.startsWith(path + '/'));
          localStorage.setItem('vaultsync-empty-bookmark-folders', JSON.stringify(emptyList));
        } catch {}
      }

      loadFolders();
      window.dispatchEvent(new Event('bookmarks-data-changed'));
      
      if (selectedFolderPath === path) {
        router.push('/bookmarks');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderPasswordFolder = (folder: DecryptedFolder, level = 0) => {
    const isActive = selectedFolderId === folder.id;
    const isExpanded = expandedFolders[folder.id];
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id}>
        <div
          className={`sidebar-folder-row ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: level * 16 + 12 }}
          onClick={() => router.push(`/vault?folder=${folder.id}`)}
        >
          <div 
            style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasChildren ? 'pointer' : 'default', flexShrink: 0 }}
            onClick={(e) => hasChildren && toggleFolder(folder.id, e)}
          >
            {hasChildren ? (
              <ChevronDown size={14} style={{ transform: isExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
            ) : (
              <FolderClosed size={14} style={{ color: isActive ? 'var(--accent-text)' : 'var(--text-tertiary)' }} />
            )}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
          <div className="sidebar-folder-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleAddFolderClick(folder.id)}
              title="Add Subfolder"
            >
              <Plus size={11} />
            </button>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleRenameClick(folder.id, folder.name)}
              title="Rename"
            >
              <Edit2 size={11} />
            </button>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleDeleteClick(folder.id)}
              title="Delete"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && folder.children!.map(child => renderPasswordFolder(child, level + 1))}
      </div>
    );
  };

  const renderBookmarkFolder = (node: BookmarkFolderNode, level = 0) => {
    const isActive = selectedFolderPath === node.path;
    const isExpanded = expandedFolders[node.path];
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <div
          className={`sidebar-folder-row ${isActive ? 'active' : ''}`}
          style={{ paddingLeft: level * 16 + 12 }}
          onClick={() => router.push(`/bookmarks?folder=${encodeURIComponent(node.path)}`)}
        >
          <div 
            style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasChildren ? 'pointer' : 'default', flexShrink: 0 }}
            onClick={(e) => hasChildren && toggleFolder(node.path, e)}
          >
            {hasChildren ? (
              <ChevronDown size={14} style={{ transform: isExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
            ) : (
              <FolderClosed size={14} style={{ color: isActive ? 'var(--accent-text)' : 'var(--text-tertiary)' }} />
            )}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
          <div className="sidebar-folder-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleRenameBookmarkFolderClick(node.path)}
              title="Rename"
            >
              <Edit2 size={11} />
            </button>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleDeleteBookmarkFolderClick(node.path)}
              title="Delete"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && node.children!.map(child => renderBookmarkFolder(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="sidebar-folder-section">
      <div 
        className="sidebar-folder-header" 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
        onClick={() => setIsMainFoldersCollapsed(!isMainFoldersCollapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <ChevronDown size={14} style={{ transform: isMainFoldersCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
          <span>Folders</span>
        </div>
        <button
          className="sidebar-folder-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            pathname.startsWith('/vault') ? handleAddFolderClick() : handleAddBookmarkFolderClick();
          }}
          title="New Folder"
        >
          <FolderPlus size={14} />
        </button>
      </div>

      {!isMainFoldersCollapsed && (
        <div className="sidebar-folder-card">
          {pathname.startsWith('/vault') ? (
            passwordFolders.length === 0 ? (
              <div style={{ padding: 'var(--space-3)', color: 'var(--text-tertiary)', fontSize: '0.75rem', textAlign: 'center' }}>
                No folders. Click + to add.
              </div>
            ) : (
              passwordFolders.map(f => renderPasswordFolder(f, 0))
            )
          ) : (
            bookmarkFolders.length === 0 ? (
              <div style={{ padding: 'var(--space-3)', color: 'var(--text-tertiary)', fontSize: '0.75rem', textAlign: 'center' }}>
                No folders. Click + to add.
              </div>
            ) : (
              bookmarkFolders.map(n => renderBookmarkFolder(n, 0))
            )
          )}
        </div>
      )}

      {/* Add Password Folder Modal */}
      {showAddFolderModal && (
        <div className="modal-overlay" onClick={() => setShowAddFolderModal(false)} style={{ zIndex: 1001 }}>
          <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
              New Password Folder
            </h2>
            <form onSubmit={handleAddFolderSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="folder-name-input">Folder Name</label>
                <input
                  id="folder-name-input"
                  className="vs-input"
                  placeholder="e.g., Work, Personal"
                  value={folderNewName}
                  onChange={(e) => setFolderNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="vs-btn vs-btn-secondary" onClick={() => setShowAddFolderModal(false)}>Cancel</button>
                <button type="submit" className="vs-btn vs-btn-primary">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Password Folder Modal */}
      {showRenameFolderModal && (
        <div className="modal-overlay" onClick={() => setShowRenameFolderModal(false)} style={{ zIndex: 1001 }}>
          <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
              Rename Folder
            </h2>
            <form onSubmit={handleRenameSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="folder-rename-input">New Name</label>
                <input
                  id="folder-rename-input"
                  className="vs-input"
                  value={folderRenameName}
                  onChange={(e) => setFolderRenameName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="vs-btn vs-btn-secondary" onClick={() => setShowRenameFolderModal(false)}>Cancel</button>
                <button type="submit" className="vs-btn vs-btn-primary">Rename</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Rename Bookmark Folder Modal */}
      {showBookmarkFolderModal !== null && (
        <div className="modal-overlay" onClick={() => setShowBookmarkFolderModal(null)} style={{ zIndex: 1001 }}>
          <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
              {showBookmarkFolderModal === 'add' ? 'New Bookmark Folder' : 'Rename Bookmark Folder'}
            </h2>
            <form onSubmit={showBookmarkFolderModal === 'add' ? handleAddBookmarkFolderSubmit : handleRenameBookmarkFolderSubmit}>
              <div className="form-group">
                <label className="form-label" htmlFor="bookmark-folder-input">
                  {showBookmarkFolderModal === 'add' ? 'Folder Path (e.g. Work/Design)' : 'New Path Name'}
                </label>
                <input
                  id="bookmark-folder-input"
                  className="vs-input"
                  placeholder="e.g. Personal, Work/Code"
                  value={bookmarkNewPath}
                  onChange={(e) => setBookmarkNewPath(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
                <button type="button" className="vs-btn vs-btn-secondary" onClick={() => setShowBookmarkFolderModal(null)}>Cancel</button>
                <button type="submit" className="vs-btn vs-btn-primary">
                  {showBookmarkFolderModal === 'add' ? 'Create' : 'Rename'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

