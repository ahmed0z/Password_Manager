import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Key, Search, Star, Copy, Eye, EyeOff,
  ExternalLink, Bookmark, Plus, RefreshCw, Check,
  Settings, LogOut, ChevronRight, Lock, Loader2, X, Clock, Edit3
} from 'lucide-react';
import {
  signIn, signOut, getSession, getVaultItems, syncBookmarks, createVaultItem, getBookmarks,
  getFolders, createFolder, renameFolder, deleteFolder, buildFolderTree,
  renameBookmarkFolder, deleteBookmarkFolder, buildBookmarkFolderTree,
  type DecryptedFolder, type BookmarkFolderNode
} from '@vaultsync/core';
import { getThemeStyles } from './styles';


function isLocalOrInvalidDomain(domain: string): boolean {
  if (!domain) return true;
  const d = domain.trim().toLowerCase();
  if (d === 'localhost' || d.endsWith('.local') || d.endsWith('.localhost') || d.endsWith('.lan') || d.endsWith('.test')) {
    return true;
  }
  if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(d)) {
    return true;
  }
  if (d.includes(':')) {
    return true;
  }
  if (!d.includes('.')) {
    return true;
  }
  return false;
}

// Helper: get favicon URL for a domain
function getFaviconUrl(domain: string): string {
  if (isLocalOrInvalidDomain(domain)) return '';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

type Tab = 'vault' | 'bookmarks' | 'settings';

interface VaultEntry {
  id: string;
  title: string;
  username: string;
  domain: string;
  favicon?: string;
  folderId?: string | null;
  passwordDecrypted: string;
}

interface BookmarkEntry {
  id: string;
  title: string;
  url: string;
  domain: string;
  favicon?: string;
}

export function SidePanel() {
  const [isAuthed, setIsAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('vault');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [vaultItems, setVaultItems] = useState<VaultEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [passwordFolderTree, setPasswordFolderTree] = useState<DecryptedFolder[]>([]);
  const [bookmarkFolderTree, setBookmarkFolderTree] = useState<BookmarkFolderNode[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [showFoldersList, setShowFoldersList] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Modals / forms state inside extension panel
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
  
  // Theme and search and modal states
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('vaultsync-theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', username: '', password: '', domain: '' });
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const [vaultKey, setVaultKey] = useState<Uint8Array | null>(null);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState<string>('always');
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { s, fStyles, mStyles, isDark, c } = getThemeStyles(theme);

  // -- Load session timeout preference on mount --
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_SESSION_TIMEOUT' })
      .then((resp: { timeout: string }) => {
        if (resp?.timeout) setSessionTimeout(resp.timeout);
      })
      .catch(() => {});
  }, []);

  // -- Dynamic tab domain tracking --
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs) return;

    const updateDomainFromTab = (tab: chrome.tabs.Tab) => {
      if (tab.url) {
        try {
          const url = new URL(tab.url);
          if (url.protocol.startsWith('http')) {
            setCurrentDomain(url.hostname.replace('www.', ''));
            setCurrentUrl(tab.url);
          } else {
            setCurrentDomain('');
            setCurrentUrl('');
          }
        } catch { /* ignore */ }
      }
    };

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs: chrome.tabs.Tab[]) => {
      if (tabs[0]) updateDomainFromTab(tabs[0]);
    });

    const handleActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      chrome.tabs.get(activeInfo.tabId, (tab: chrome.tabs.Tab) => {
        updateDomainFromTab(tab);
      });
    };

    const handleUpdated = (_tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) => {
      if (tab.active && changeInfo.url) {
        updateDomainFromTab(tab);
      }
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
    };
  }, []);

  // -- Check auth state on mount --
  // After a browser restart, the Supabase session persists (chrome.storage.local)
  // but the vault decryption key is lost (chrome.storage.session is ephemeral).
  // In that case, we must show the login screen so the user re-enters their
  // master password to re-derive the encryption key.
  useEffect(() => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' })
        .then(async (resp: { session: any }) => {
          if (resp?.session) {
            // Check if session has expired based on timeout setting
            const expiryResp = await chrome.runtime.sendMessage({ type: 'CHECK_SESSION_EXPIRED' });
            if (expiryResp?.expired) {
              console.log('[VaultSync] Session timeout expired — prompting re-login');
              await chrome.runtime.sendMessage({ type: 'CLEAR_VAULT_KEY' });
              setIsAuthed(false);
              return;
            }

            // Sync session to local Supabase client instance
            const { getSupabaseClient } = await import('@vaultsync/core');
            const supabase = getSupabaseClient();
            await supabase.auth.setSession(resp.session);

            const keyData = await chrome.runtime.sendMessage({ type: 'GET_VAULT_KEY' });
            if (keyData?.vaultKey) {
              // Session AND key are present — fully authenticated
              const binary = atob(keyData.vaultKey);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              setVaultKey(bytes);
              setIsAuthed(true);
            } else {
              // Session exists but vault key was lost (browser restart).
              // Show login screen so user can re-derive the key.
              console.log('[VaultSync] Session found but vault key missing — prompting re-login');
              setIsAuthed(false);
            }
          }
        })
        .catch((e: Error) => console.warn('[VaultSync] Service worker not active yet:', e));
    } catch (e) {
      console.warn('[VaultSync] runtime.sendMessage failed:', e);
    }
  }, []);

  // -- Data loading function --
  const loadAllData = useCallback(async (key: Uint8Array) => {
    try {
      const [items, bmarks, userFolders] = await Promise.all([
        getVaultItems(key),
        getBookmarks(key),
        getFolders(key),
      ]);

      setFolders(userFolders);
      setPasswordFolderTree(buildFolderTree(userFolders));

      setVaultItems(items.map(i => {
        const domain = i.domain || '';
        return {
          id: i.id,
          title: i.decrypted.title,
          username: i.decrypted.username,
          domain,
          favicon: i.favicon_url || (domain ? getFaviconUrl(domain) : undefined),
          folderId: i.folder_id,
          passwordDecrypted: i.decrypted.password,
        };
      }));

      setBookmarks(bmarks.map(i => {
        let domain = '';
        try { domain = new URL(i.decrypted.url).hostname; } catch { /* ignore */ }
        return {
          id: i.id,
          title: i.decrypted.title,
          url: i.decrypted.url,
          domain,
          favicon: i.decrypted.favicon || (domain ? getFaviconUrl(domain) : undefined),
          folderPath: i.decrypted.folderPath,
        };
      }));

      // Bookmark Folder Tree parsing
      const paths = new Set<string>();
      bmarks.forEach(b => {
        if (b.decrypted.folderPath) paths.add(b.decrypted.folderPath);
      });
      const storedEmpty = localStorage.getItem('vaultsync-empty-bookmark-folders');
      if (storedEmpty) {
        try {
          const emptyList: string[] = JSON.parse(storedEmpty);
          emptyList.forEach(p => paths.add(p));
        } catch {}
      }
      setBookmarkFolderTree(buildBookmarkFolderTree(Array.from(paths)));

    } catch (e) {
      console.error('[VaultSync] Failed to load data:', e);
    }
  }, []);

  // -- Folder CRUD Handlers --
  const handleCreateFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultKey || !folderNewName.trim()) return;
    try {
      await createFolder(folderNewName.trim(), vaultKey, folderParentId);
      setShowAddFolderModal(false);
      await loadAllData(vaultKey);
    } catch (err) {
      alert('Failed to create folder');
    }
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultKey || !folderRenameId || !folderRenameName.trim()) return;
    try {
      await renameFolder(folderRenameId, folderRenameName.trim(), vaultKey);
      setShowRenameFolderModal(false);
      await loadAllData(vaultKey);
    } catch (err) {
      alert('Failed to rename folder');
    }
  };

  const handleDeleteFolder = async (id: string) => {
    if (!confirm('Are you sure you want to delete this folder? Passwords will be moved to root.')) return;
    try {
      await deleteFolder(id);
      if (selectedFolderId === id) setSelectedFolderId(null);
      if (vaultKey) await loadAllData(vaultKey);
    } catch (err) {
      alert('Failed to delete folder');
    }
  };

  const handleCreateBookmarkFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookmarkNewPath.trim()) return;
    const path = bookmarkNewPath.trim();
    const storedEmpty = localStorage.getItem('vaultsync-empty-bookmark-folders');
    let emptyList: string[] = [];
    if (storedEmpty) {
      try { emptyList = JSON.parse(storedEmpty); } catch {}
    }
    if (!emptyList.includes(path)) {
      emptyList.push(path);
      localStorage.setItem('vaultsync-empty-bookmark-folders', JSON.stringify(emptyList));
    }
    setShowBookmarkFolderModal(null);
    if (vaultKey) await loadAllData(vaultKey);
  };

  const handleRenameBookmarkFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vaultKey || !bookmarkNewPath.trim() || !bookmarkOldPath) return;
    try {
      const newPath = bookmarkNewPath.trim();
      await renameBookmarkFolder(bookmarkOldPath, newPath, vaultKey);
      
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
      if (selectedFolderPath === bookmarkOldPath) setSelectedFolderPath(newPath);
      await loadAllData(vaultKey);
    } catch (err) {
      alert('Failed to rename folder');
    }
  };

  const handleDeleteBookmarkFolder = async (path: string) => {
    if (!confirm(`Are you sure you want to delete folder "${path}"? Bookmarks will move to root.`)) return;
    try {
      if (!vaultKey) return;
      await deleteBookmarkFolder(path, vaultKey);
      
      const storedEmpty = localStorage.getItem('vaultsync-empty-bookmark-folders');
      if (storedEmpty) {
        try {
          let emptyList: string[] = JSON.parse(storedEmpty);
          emptyList = emptyList.filter(p => p !== path && !p.startsWith(path + '/'));
          localStorage.setItem('vaultsync-empty-bookmark-folders', JSON.stringify(emptyList));
        } catch {}
      }
      if (selectedFolderPath === path) setSelectedFolderPath(null);
      await loadAllData(vaultKey);
    } catch (err) {
      alert('Failed to delete folder');
    }
  };

  const renderPasswordFolder = (folder: DecryptedFolder, level = 0): React.ReactNode => {
    const isActive = selectedFolderId === folder.id;
    const isExpanded = expandedFolders[folder.id];
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <div key={folder.id}>
        <div
          style={{
            ...fStyles.row,
            ...(isActive ? fStyles.activeRow : {}),
            paddingLeft: `${level * 12 + 12}px`
          }}
          onClick={() => setSelectedFolderId(folder.id)}
        >
          <div 
            style={{ display: 'flex', alignItems: 'center', cursor: hasChildren ? 'pointer' : 'default', width: 14, height: 14, justifyContent: 'center' }}
            onClick={(e) => hasChildren && toggleFolder(folder.id, e)}
          >
            {hasChildren ? (
              <ChevronRight size={12} color="#8a8f9e" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            ) : (
              <div style={{ width: 12, height: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
            )}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
          <div style={fStyles.actions} onClick={e => e.stopPropagation()}>
            <button
              style={fStyles.actionBtn}
              onClick={() => { setFolderParentId(folder.id); setFolderNewName(''); setShowAddFolderModal(true); }}
              title="Add Subfolder"
            >
              <Plus size={10} color="#8a8f9e" />
            </button>
            <button
              style={fStyles.actionBtn}
              onClick={() => { setFolderRenameId(folder.id); setFolderRenameName(folder.name); setShowRenameFolderModal(true); }}
              title="Rename"
            >
              <Settings size={10} color="#8a8f9e" />
            </button>
            <button
              style={fStyles.actionBtn}
              onClick={() => handleDeleteFolder(folder.id)}
              title="Delete"
            >
              <X size={10} color="#ef4444" />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && folder.children!.map(child => renderPasswordFolder(child, level + 1))}
      </div>
    );
  };

  const renderBookmarkFolder = (node: BookmarkFolderNode, level = 0): React.ReactNode => {
    const isActive = selectedFolderPath === node.path;
    const isExpanded = expandedFolders[node.path];
    const hasChildren = node.children && node.children.length > 0;

    return (
      <div key={node.path}>
        <div
          style={{
            ...fStyles.row,
            ...(isActive ? { ...fStyles.activeRow, color: '#a78bfa', background: 'rgba(167, 139, 250, 0.08)' } : {}),
            paddingLeft: `${level * 12 + 12}px`
          }}
          onClick={() => setSelectedFolderPath(node.path)}
        >
          <div 
            style={{ display: 'flex', alignItems: 'center', cursor: hasChildren ? 'pointer' : 'default', width: 14, height: 14, justifyContent: 'center' }}
            onClick={(e) => hasChildren && toggleFolder(node.path, e)}
          >
            {hasChildren ? (
              <ChevronRight size={12} color="#8a8f9e" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            ) : (
              <div style={{ width: 12, height: 12, background: 'rgba(255,255,255,0.2)', borderRadius: 2 }} />
            )}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
          <div style={fStyles.actions} onClick={e => e.stopPropagation()}>
            <button
              style={fStyles.actionBtn}
              onClick={() => { setBookmarkOldPath(node.path); setBookmarkNewPath(node.path); setShowBookmarkFolderModal('rename'); }}
              title="Rename"
            >
              <Settings size={10} color="#8a8f9e" />
            </button>
            <button
              style={fStyles.actionBtn}
              onClick={() => handleDeleteBookmarkFolder(node.path)}
              title="Delete"
            >
              <X size={10} color="#ef4444" />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && node.children!.map(child => renderBookmarkFolder(child, level + 1))}
      </div>
    );
  };

  // -- Load data immediately when vault key becomes available, then refresh every 15s --
  useEffect(() => {
    if (!vaultKey) return;

    // Initial load
    loadAllData(vaultKey);

    // Periodic refresh
    refreshIntervalRef.current = setInterval(() => {
      loadAllData(vaultKey);
    }, 15000);

    // Listen for data change broadcasts and session expiry from service worker
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'VAULT_DATA_CHANGED') {
        loadAllData(vaultKey);
      }
      if (message.type === 'SESSION_EXPIRED') {
        // Service worker detected timeout expiry — sign out
        setIsAuthed(false);
        setVaultItems([]);
        setBookmarks([]);
        setVaultKey(null);
      }
    };
    chrome.runtime.onMessage.addListener(handleMessage);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      chrome.runtime.onMessage.removeListener(handleMessage);
    };
  }, [vaultKey, loadAllData]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { vaultKey: material } = await signIn({ email, masterPassword: password });

      const keyBase64 = btoa(String.fromCharCode(...material.key));

      await chrome.runtime.sendMessage({
        type: 'STORE_VAULT_KEY',
        payload: { keyBase64, salt: material.salt }
      });

      const session = await getSession();
      await chrome.runtime.sendMessage({
        type: 'SYNC_SESSION',
        payload: { session }
      });

      setVaultKey(material.key);
      setIsAuthed(true);
    } catch (e) {
      console.error(e);
      alert('Login failed. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingItem || !vaultKey) return;
    setLoading(true);
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'UPDATE_CREDENTIAL_BY_ID',
        payload: {
          id: editingItem.id,
          username: editForm.username,
          password: editForm.password,
          domain: editForm.domain,
          url: editForm.domain,
          title: editForm.title
        }
      });
      if (resp.error) throw new Error(resp.error);
      setEditingItem(null);
      setIsEditing(false);
      await loadAllData(vaultKey);
    } catch (e) {
      alert('Failed to save edits: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const handleEditOpen = (item: VaultEntry, passwordDecrypted: string) => {
    setEditingItem(item);
    setEditForm({
      title: item.title,
      username: item.username,
      password: passwordDecrypted,
      domain: item.domain
    });
    setIsEditing(false);
    setIsPasswordVisible(false);
  };


  const handleAdd = async () => {
    if (!vaultKey) return;
    setLoading(true);
    try {
      await createVaultItem({
        title: currentDomain || 'New Item',
        username: addUsername,
        password: addPassword,
        url: currentUrl
      }, vaultKey);

      setIsAdding(false);
      setAddUsername('');
      setAddPassword('');
      await loadAllData(vaultKey);
    } catch (e) {
      alert('Failed to add item');
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncBookmarks = async () => {
    setSyncing(true);
    if (!vaultKey) { alert('Vault locked'); setSyncing(false); return; }
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' });
      if (resp.bookmarks) {
        await syncBookmarks(resp.bookmarks, vaultKey);
        await loadAllData(vaultKey);
        alert('All bookmarks sync completed!');
      }
    } catch (e) {
      console.error('[VaultSync] Bookmark sync failed:', e);
      alert('Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncBookmarksOnlyMissing = async () => {
    setSyncing(true);
    if (!vaultKey) { alert('Vault locked'); setSyncing(false); return; }
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' });
      if (resp.bookmarks) {
        // Normalize URLs for reliable comparison
        const existingUrls = new Set(bookmarks.map(b => b.url.toLowerCase().trim().replace(/\/$/, '')));
        
        // Filter out browser bookmarks that already exist in vault
        const missing = resp.bookmarks.filter((b: any) => {
          const urlNormalized = b.url.toLowerCase().trim().replace(/\/$/, '');
          return !existingUrls.has(urlNormalized);
        });

        if (missing.length === 0) {
          alert('All your browser bookmarks are already in the vault!');
          setSyncing(false);
          return;
        }

        await syncBookmarks(missing, vaultKey);
        await loadAllData(vaultKey);
        alert(`Successfully added ${missing.length} missing bookmarks to the vault!`);
      }
    } catch (e) {
      console.error('[VaultSync] Smart bookmark sync failed:', e);
      alert('Sync failed.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // -- Search and Folder filtering --
  const filteredVaultItems = vaultItems.filter(item => {
    if (selectedFolderId && (item as any).folderId !== selectedFolderId) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.username.toLowerCase().includes(q) || item.domain.toLowerCase().includes(q);
  });

  const filteredBookmarks = bookmarks.filter(b => {
    if (selectedFolderPath) {
      const path = (b as any).folderPath || '';
      if (path !== selectedFolderPath && !path.startsWith(selectedFolderPath + '/')) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.domain.toLowerCase().includes(q);
  });

  const domainItems = filteredVaultItems.filter(i => i.domain === currentDomain);
  const otherItems = filteredVaultItems.filter(i => i.domain !== currentDomain);

  // Auth Screen
  if (!isAuthed) {
    return (
      <div style={s.panel}>
        <div style={s.authContainer}>
          <div style={{ ...s.logo, width: 48, height: 48, borderRadius: 14 }}>
            <Shield size={24} color="white" />
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#f2f2f2', margin: '8px 0 4px' }}>VaultSync</h1>
          <p style={{ fontSize: '13px', color: '#8a8f9e', textAlign: 'center', marginBottom: '16px' }}>
            Sign in to access your encrypted vault
          </p>
          <input
            style={s.authInput}
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <input
            style={s.authInput}
            type="password"
            placeholder="Master Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
          />
          <button style={s.authBtn} onClick={handleLogin} disabled={loading}>
            {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={16} />}
            {loading ? 'Unlocking...' : 'Unlock Vault'}
          </button>
        </div>
      </div>
    );
  }

  // Main Panel
  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ ...s.headerRow, marginBottom: 0, justifyContent: 'space-between', position: 'relative', height: 28, alignItems: 'center' }}>
          {!isSearchOpen ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={s.logo}><Shield size={14} color="white" /></div>
                <span style={s.title}>VaultSync</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  style={s.iconBtn}
                  onClick={() => setIsSearchOpen(true)}
                  title="Search"
                >
                  <Search size={14} />
                </button>
                <button
                  style={{ ...s.iconBtn, color: c.accent }}
                  title="Open Web Dashboard"
                  onClick={() => typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create({ url: 'https://vaultsync-passwords.netlify.app/vault' })}
                >
                  <ExternalLink size={14} />
                </button>
                <button
                  style={{ ...s.iconBtn, animation: syncing ? 'spin 1s linear infinite' : 'none' }}
                  title="Refresh vault"
                  onClick={() => vaultKey && loadAllData(vaultKey)}
                >
                  <RefreshCw size={14} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px', animation: 'fadeIn 0.2s ease-out' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: c.textSub }} />
                <input
                  style={{ ...s.searchInput, width: '100%', paddingLeft: 34 }}
                  placeholder={tab === 'bookmarks' ? 'Search bookmarks...' : 'Search vault...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                style={{ ...s.iconBtn, color: '#ef4444' }}
                onClick={() => {
                  setIsSearchOpen(false);
                  setSearch('');
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {tab === 'vault' && (
          <>
            <div style={fStyles.section}>
              <div style={fStyles.header}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => setShowFoldersList(!showFoldersList)}>
                  📁 Folders {showFoldersList ? '▲' : '▼'}
                </span>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  onClick={() => { setFolderParentId(undefined); setFolderNewName(''); setShowAddFolderModal(true); }}
                >
                  <Plus size={12} color="#5ce0d6" />
                </button>
              </div>
              
              {showFoldersList && (
                <div style={fStyles.card}>
                  {passwordFolderTree.length === 0 ? (
                    <div style={{ padding: '10px', color: '#4a5068', fontSize: '11px', textAlign: 'center' }}>No folders</div>
                  ) : (
                    passwordFolderTree.map(f => renderPasswordFolder(f, 0))
                  )}
                </div>
              )}
            </div>

            {selectedFolderId && (
              <div style={fStyles.filterBadge}>
                <span>Active Folder: {folders.find(f => f.id === selectedFolderId)?.name}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5ce0d6', display: 'flex' }} onClick={() => setSelectedFolderId(null)}>
                  <X size={14} />
                </button>
              </div>
            )}

            {currentDomain && (
              <>
                <div style={s.sectionLabel}>This Site ({currentDomain})</div>
                {isAdding ? (
                  <div style={{ ...s.itemCard, flexDirection: 'column', alignItems: 'stretch', gap: 8, background: 'rgba(92,224,214,0.08)' }}>
                    <input style={s.authInput} placeholder="Username" value={addUsername} onChange={(e) => setAddUsername(e.target.value)} />
                    <input style={s.authInput} type="password" placeholder="Password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ ...s.authBtn, height: 32, flex: 1 }} onClick={handleAdd} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
                      <button style={{ ...s.authBtn, height: 32, flex: 1, background: 'rgba(255,255,255,0.1)', color: '#f2f2f2' }} onClick={() => setIsAdding(false)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {domainItems.length > 0 ? (
                      domainItems.map(item => (
                        <div
                          key={item.id}
                          className="premium-card"
                          style={{ ...s.itemCard, border: `1px solid ${c.accent}33`, background: `${c.accent}0A` }}
                          onClick={() => handleEditOpen(item, item.passwordDecrypted)}
                        >
                          <div style={s.favicon}>
                            {getFaviconUrl(currentDomain) ? (
                              <img src={getFaviconUrl(currentDomain)} width={20} height={20} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            ) : (
                              <Key size={14} color="#8a8f9e" />
                            )}
                          </div>
                          <div style={s.itemInfo}>
                            <div style={s.itemTitle}>{item.title}</div>
                            <div style={s.itemSub}>{item.username}</div>
                          </div>
                          <button
                            style={{ ...s.iconBtn, color: copiedId === item.id ? '#22c55e' : '#8a8f9e' }}
                            onClick={(e) => { e.stopPropagation(); handleCopy(item.username, item.id); }}
                          >
                            {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      ))
                    ) : null}
                    <div style={{ ...s.itemCard, border: '1px solid rgba(92,224,214,0.15)', background: 'rgba(92,224,214,0.04)' }}>
                      <div style={s.favicon}><Key size={16} color="#5ce0d6" /></div>
                      <div style={s.itemInfo}>
                        <div style={s.itemTitle}>New Credential</div>
                        <div style={s.itemSub}>Add password for {currentDomain}</div>
                      </div>
                      <button style={s.iconBtn} onClick={() => setIsAdding(true)}><Plus size={14} color="#5ce0d6" /></button>
                    </div>
                  </>
                )}
              </>
            )}

            <div style={s.sectionLabel}>All Passwords</div>
            {otherItems.length === 0 && domainItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#4a5068' }}>
                <Key size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <div style={{ fontSize: '13px', fontWeight: 500 }}>Your vault is empty</div>
                <div style={{ fontSize: '11px', marginTop: 4 }}>Add passwords from the web app or use autofill</div>
              </div>
            ) : (
              otherItems.map((item) => (
                <div
                  key={item.id}
                  className="premium-card"
                  style={s.itemCard}
                  onClick={() => handleEditOpen(item, item.passwordDecrypted)}
                >
                  <div style={s.favicon}>
                    {item.domain && getFaviconUrl(item.domain) ? (
                      <img src={getFaviconUrl(item.domain)} width={20} height={20} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <Key size={14} color="#8a8f9e" />
                    )}
                  </div>
                  <div style={s.itemInfo}>
                    <div style={s.itemTitle}>{item.title}</div>
                    <div style={s.itemSub}>{item.username}</div>
                  </div>
                  <button
                    style={{ ...s.iconBtn, color: copiedId === item.id ? '#22c55e' : '#8a8f9e' }}
                    onClick={(e) => { e.stopPropagation(); handleCopy(item.username, item.id); }}
                  >
                    {copiedId === item.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              ))
            )}
          </>
        )}

        {tab === 'bookmarks' && (
          <>
            <div style={fStyles.section}>
              <div style={fStyles.header}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }} onClick={() => setShowFoldersList(!showFoldersList)}>
                  📁 Folders {showFoldersList ? '▲' : '▼'}
                </span>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                  onClick={() => { setBookmarkNewPath(''); setShowBookmarkFolderModal('add'); }}
                >
                  <Plus size={12} color="#a78bfa" />
                </button>
              </div>

              {showFoldersList && (
                <div style={fStyles.card}>
                  {bookmarkFolderTree.length === 0 ? (
                    <div style={{ padding: '10px', color: '#4a5068', fontSize: '11px', textAlign: 'center' }}>No folders</div>
                  ) : (
                    bookmarkFolderTree.map(n => renderBookmarkFolder(n, 0))
                  )}
                </div>
              )}
            </div>

            {selectedFolderPath && (
              <div style={{ ...fStyles.filterBadge, background: 'rgba(167, 139, 250, 0.1)', borderColor: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa' }}>
                <span>Active Folder: {selectedFolderPath}</span>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#a78bfa', display: 'flex' }} onClick={() => setSelectedFolderPath(null)}>
                  <X size={14} />
                </button>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={s.sectionLabel}>Synced Bookmarks</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <button
                  style={{
                    background: 'rgba(92,224,214,0.15)',
                    border: '1px solid rgba(92,224,214,0.3)',
                    color: '#5ce0d6',
                    cursor: 'pointer',
                    fontSize: '9px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontFamily: 'inherit',
                  }}
                  onClick={handleSyncBookmarksOnlyMissing}
                  disabled={syncing}
                  title="Compare and sync missing bookmarks only"
                >
                  Smart Sync
                </button>
                <button
                  style={{ ...s.iconBtn, color: syncing ? '#5ce0d6' : '#4a5068', animation: syncing ? 'spin 1s linear infinite' : 'none' }}
                  onClick={handleSyncBookmarks}
                  title="Sync all bookmarks (upsert)"
                >
                  <RefreshCw size={12} />
                </button>
              </div>
            </div>
            {filteredBookmarks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 16px', color: '#4a5068' }}>
                <Bookmark size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
                <div style={{ fontSize: '13px', fontWeight: 500 }}>No bookmarks yet</div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
                  <button
                    style={{ ...s.authBtn, width: 'auto', padding: '8px 16px', fontSize: '11px' }}
                    onClick={handleSyncBookmarksOnlyMissing}
                    disabled={syncing}
                  >
                    <RefreshCw size={12} /> Smart Sync
                  </button>
                  <button
                    style={{ ...s.authBtn, width: 'auto', padding: '8px 16px', fontSize: '11px', background: 'rgba(255,255,255,0.06)', color: '#f2f2f2', border: '1px solid rgba(255,255,255,0.08)' }}
                    onClick={handleSyncBookmarks}
                    disabled={syncing}
                  >
                    Sync All
                  </button>
                </div>
              </div>
            ) : (
              filteredBookmarks.map((b) => (
                <a key={b.id} href={b.url} target="_blank" rel="noreferrer" style={{ ...s.itemCard, textDecoration: 'none' }}>
                  <div style={s.favicon}>
                    {b.favicon ? (
                      <img src={b.favicon} width={20} height={20} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    ) : (
                      <Bookmark size={14} color="#8a8f9e" />
                    )}
                  </div>
                  <div style={s.itemInfo}>
                    <div style={s.itemTitle}>{b.title}</div>
                    <div style={s.itemSub}>{b.domain}</div>
                  </div>
                  <ExternalLink size={12} color="#4a5068" />
                </a>
              ))
            )}
          </>
        )}

        {tab === 'settings' && (
          <>
            {/* Stats */}
            <div style={s.statsBar}>
              <div style={s.statPill}>
                <div style={{ ...s.statNumber, color: c.accent }}>{vaultItems.length || '—'}</div>
                <div style={s.statLabel}>Passwords</div>
              </div>
              <div style={s.statPill}>
                <div style={{ ...s.statNumber, color: c.accent2 }}>{bookmarks.length || '—'}</div>
                <div style={s.statLabel}>Bookmarks</div>
              </div>
              <div style={s.statPill}>
                <div style={{ ...s.statNumber, color: '#22c55e' }}>256</div>
                <div style={s.statLabel}>AES Bits</div>
              </div>
            </div>

            {/* Appearance */}
            <div style={s.sectionLabel}>Appearance</div>
            <div style={{ ...s.itemCard, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={s.itemInfo}>
                <div style={s.itemTitle}>Theme</div>
                <div style={s.itemSub}>{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</div>
              </div>
              <button
                className="premium-btn"
                style={{
                  padding: '6px 12px',
                  borderRadius: '8px',
                  background: c.inputBg,
                  border: `1px solid ${c.cardBorder}`,
                  color: c.textMain,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '11px',
                  fontWeight: 600,
                }}
                onClick={() => {
                  const n = theme === 'dark' ? 'light' : 'dark';
                  setTheme(n);
                  localStorage.setItem('vaultsync-theme', n);
                }}
              >
                Toggle Theme
              </button>
            </div>

            <div style={s.sectionLabel}>Security</div>
            <div style={s.itemCard}>
              <div style={s.itemInfo}>
                <div style={s.itemTitle}>Encryption</div>
                <div style={s.itemSub}>AES-256-GCM · PBKDF2 600K</div>
              </div>
              <span style={{ fontSize: '11px', color: '#22c55e', fontWeight: 700 }}>✓ Active</span>
            </div>
            <div style={s.itemCard}>
              <div style={s.itemInfo}>
                <div style={s.itemTitle}>Zero-Knowledge</div>
                <div style={s.itemSub}>Server never sees plaintext</div>
              </div>
              <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 700 }}>✓ Enforced</span>
            </div>
            <div style={s.itemCard}>
              <div style={s.itemInfo}>
                <div style={s.itemTitle}>Auto-Sync</div>
                <div style={s.itemSub}>Refreshes every 15 seconds</div>
              </div>
              <span style={{ fontSize: '11px', color: '#5ce0d6', fontWeight: 700 }}>✓ Active</span>
            </div>

            <div style={s.sectionLabel}>Session Duration</div>
            <div style={{ ...s.itemCard, flexDirection: 'column', alignItems: 'stretch', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={16} color="#a78bfa" />
                <div style={s.itemInfo}>
                  <div style={s.itemTitle}>Auto Sign-Out</div>
                  <div style={s.itemSub}>How long the vault stays unlocked</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { value: '12h', label: '12h' },
                  { value: '24h', label: '24h' },
                  { value: '2d', label: '2 Days' },
                  { value: 'always', label: 'Always' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={async () => {
                      setSessionTimeout(opt.value);
                      await chrome.runtime.sendMessage({
                        type: 'SET_SESSION_TIMEOUT',
                        payload: { timeout: opt.value }
                      });
                    }}
                    style={{
                      flex: 1,
                      padding: '7px 0',
                      borderRadius: 8,
                      border: sessionTimeout === opt.value
                        ? '1px solid rgba(167,139,250,0.5)'
                        : '1px solid rgba(255,255,255,0.08)',
                      background: sessionTimeout === opt.value
                        ? 'rgba(167,139,250,0.15)'
                        : 'rgba(255,255,255,0.04)',
                      color: sessionTimeout === opt.value ? '#c4b5fd' : '#8a8f9e',
                      fontSize: '11px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.sectionLabel}>Account</div>
            <button
              style={{ ...s.itemCard, border: '1px solid rgba(239,68,68,0.2)' }}
              onClick={async () => {
                await chrome.runtime.sendMessage({ type: 'CLEAR_VAULT_KEY' });
                try {
                  await signOut();
                } catch (e) {
                  console.error(e);
                }
                await chrome.runtime.sendMessage({
                  type: 'SYNC_SESSION',
                  payload: { session: null }
                });
                setIsAuthed(false);
                setVaultItems([]);
                setBookmarks([]);
                setVaultKey(null);
              }}
            >
              <LogOut size={16} color="#ef4444" />
              <div style={s.itemInfo}>
                <div style={{ ...s.itemTitle, color: '#ef4444' }}>Sign Out</div>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Tab Bar */}
      <div style={s.tabBar}>
        {[
          { id: 'vault' as Tab, icon: <Key size={16} />, label: 'Vault' },
          { id: 'bookmarks' as Tab, icon: <Bookmark size={16} />, label: 'Bookmarks' },
          { id: 'settings' as Tab, icon: <Settings size={16} />, label: 'Settings' },
        ].map((t) => (
          <button
            key={t.id}
            style={{
              ...s.tab,
              color: tab === t.id ? '#5ce0d6' : '#4a5068',
              background: tab === t.id ? 'rgba(92,224,214,0.06)' : 'transparent',
            }}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Folder Modals */}
      {showAddFolderModal && (
        <div style={mStyles.overlay}>
          <div style={mStyles.modal}>
            <div style={mStyles.header}>
              <span style={mStyles.title}>{folderParentId ? 'Add Subfolder' : 'Add Folder'}</span>
              <button style={mStyles.closeBtn} onClick={() => setShowAddFolderModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleCreateFolderSubmit} style={mStyles.form}>
              <input
                style={s.authInput}
                placeholder="Folder Name"
                value={folderNewName}
                onChange={(e) => setFolderNewName(e.target.value)}
                autoFocus
              />
              <div style={mStyles.buttons}>
                <button type="button" style={mStyles.cancelBtn} onClick={() => setShowAddFolderModal(false)}>Cancel</button>
                <button type="submit" style={mStyles.saveBtn}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRenameFolderModal && (
        <div style={mStyles.overlay}>
          <div style={mStyles.modal}>
            <div style={mStyles.header}>
              <span style={mStyles.title}>Rename Folder</span>
              <button style={mStyles.closeBtn} onClick={() => setShowRenameFolderModal(false)}><X size={16} /></button>
            </div>
            <form onSubmit={handleRenameFolderSubmit} style={mStyles.form}>
              <input
                style={s.authInput}
                placeholder="Folder Name"
                value={folderRenameName}
                onChange={(e) => setFolderRenameName(e.target.value)}
                autoFocus
              />
              <div style={mStyles.buttons}>
                <button type="button" style={mStyles.cancelBtn} onClick={() => setShowRenameFolderModal(false)}>Cancel</button>
                <button type="submit" style={mStyles.saveBtn}>Rename</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showBookmarkFolderModal && (
        <div style={mStyles.overlay}>
          <div style={mStyles.modal}>
            <div style={mStyles.header}>
              <span style={mStyles.title}>
                {showBookmarkFolderModal === 'add' ? 'Add Bookmark Folder' : 'Rename Bookmark Folder'}
              </span>
              <button style={mStyles.closeBtn} onClick={() => setShowBookmarkFolderModal(null)}><X size={16} /></button>
            </div>
            <form
              onSubmit={
                showBookmarkFolderModal === 'add'
                  ? handleCreateBookmarkFolderSubmit
                  : handleRenameBookmarkFolderSubmit
              }
              style={mStyles.form}
            >
              <input
                style={s.authInput}
                placeholder="Folder Path (e.g. Work/Finance)"
                value={bookmarkNewPath}
                onChange={(e) => setBookmarkNewPath(e.target.value)}
                autoFocus
              />
              <div style={mStyles.buttons}>
                <button type="button" style={mStyles.cancelBtn} onClick={() => setShowBookmarkFolderModal(null)}>Cancel</button>
                <button type="submit" style={mStyles.saveBtn}>
                  {showBookmarkFolderModal === 'add' ? 'Create' : 'Rename'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View/Edit Card Modal */}
      {editingItem && (
        <div style={mStyles.overlay} className="modal-overlay">
          <div style={{ ...mStyles.modal, maxWidth: '340px' }} className="modal-content">
            <div style={mStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {editForm.domain && getFaviconUrl(editForm.domain) ? (
                    <img src={getFaviconUrl(editForm.domain)} width={20} height={20} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <Key size={16} color={c.accent} />
                  )}
                </div>
                <span style={{ ...mStyles.title, fontSize: '15px', fontWeight: 700 }}>
                  {isEditing ? 'Edit Item' : 'Item Details'}
                </span>
              </div>
              <button style={mStyles.closeBtn} onClick={() => { setEditingItem(null); setIsEditing(false); }}><X size={18} /></button>
            </div>
            
            <div style={{ ...mStyles.form, marginTop: 8 }}>
              {/* Title Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: c.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</span>
                <input
                  style={{
                    ...s.authInput,
                    background: isEditing ? c.inputBg : 'transparent',
                    border: isEditing ? `1px solid ${c.inputBorder}` : 'none',
                    padding: isEditing ? '0 12px' : '0 4px',
                    height: isEditing ? 38 : 28,
                    fontSize: '13px',
                    fontWeight: isEditing ? 500 : 600,
                    color: c.textMain
                  }}
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  readOnly={!isEditing}
                />
              </div>

              {/* Username Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: c.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username / Email</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    style={{
                      ...s.authInput,
                      background: isEditing ? c.inputBg : 'transparent',
                      border: isEditing ? `1px solid ${c.inputBorder}` : 'none',
                      padding: isEditing ? '0 12px' : '0 4px',
                      paddingRight: isEditing ? 12 : 40,
                      height: isEditing ? 38 : 28,
                      fontSize: '13px',
                      width: '100%',
                      color: c.textMain
                    }}
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    readOnly={!isEditing}
                  />
                  {!isEditing && (
                    <button
                      className="premium-btn"
                      style={{
                        position: 'absolute', right: 4, background: 'rgba(255,255,255,0.06)',
                        border: 'none', borderRadius: '6px', color: c.accent, padding: '4px 8px',
                        fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                      }}
                      onClick={() => handleCopy(editForm.username, 'usr')}
                    >
                      Copy
                    </button>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: c.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    style={{
                      ...s.authInput,
                      background: isEditing ? c.inputBg : 'transparent',
                      border: isEditing ? `1px solid ${c.inputBorder}` : 'none',
                      padding: isEditing ? '0 12px' : '0 4px',
                      paddingRight: isEditing ? 40 : 76,
                      height: isEditing ? 38 : 28,
                      fontSize: '13px',
                      fontFamily: (!isEditing && !isPasswordVisible) ? 'monospace' : 'inherit',
                      width: '100%',
                      color: c.textMain
                    }}
                    type={(isEditing || isPasswordVisible) ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    readOnly={!isEditing}
                  />
                  <div style={{ position: 'absolute', right: 4, display: 'flex', gap: '4px' }}>
                    <button
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        color: c.textSub, display: 'flex', borderRadius: 4
                      }}
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                      title={isPasswordVisible ? 'Hide Password' : 'Show Password'}
                    >
                      {isPasswordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    {!isEditing && (
                      <button
                        className="premium-btn"
                        style={{
                          background: 'rgba(255,255,255,0.06)',
                          border: 'none', borderRadius: '6px', color: c.accent, padding: '4px 8px',
                          fontSize: '10px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit'
                        }}
                        onClick={() => handleCopy(editForm.password, 'pwd')}
                      >
                        Copy
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Domain Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '10px', color: c.textSub, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Domain</span>
                <input
                  style={{
                    ...s.authInput,
                    background: isEditing ? c.inputBg : 'transparent',
                    border: isEditing ? `1px solid ${c.inputBorder}` : 'none',
                    padding: isEditing ? '0 12px' : '0 4px',
                    height: isEditing ? 38 : 28,
                    fontSize: '13px',
                    color: c.textMain
                  }}
                  value={editForm.domain}
                  onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                  readOnly={!isEditing}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ ...mStyles.buttons, marginTop: 14 }}>
                {!isEditing ? (
                  <>
                    <button
                      type="button"
                      className="premium-btn"
                      style={mStyles.cancelBtn}
                      onClick={() => { setEditingItem(null); setIsEditing(false); }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className="premium-btn"
                      style={{
                        ...mStyles.saveBtn,
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="premium-btn"
                      style={mStyles.cancelBtn}
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="premium-btn"
                      style={mStyles.saveBtn}
                      onClick={handleEditSave}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
