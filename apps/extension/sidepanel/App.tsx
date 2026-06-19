import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Key, Search, Star, Copy, Eye, EyeOff,
  ExternalLink, Bookmark, Plus, RefreshCw, Check,
  Settings, LogOut, ChevronRight, Lock, Loader2, X, Clock, Edit3,
  Sparkles, Laptop, Smartphone
} from 'lucide-react';
import {
  signIn, signOut, getSession, getVaultItems, syncBookmarks, createVaultItem, getBookmarks,
  getFolders, createFolder, renameFolder, deleteFolder, buildFolderTree,
  renameBookmarkFolder, deleteBookmarkFolder, buildBookmarkFolderTree,
  generatePassword, estimateStrength, type DecryptedFolder, type BookmarkFolderNode
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

function getFaviconUrl(domain: string): string {
  if (isLocalOrInvalidDomain(domain)) return '';
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

type Tab = 'vault' | 'generator' | 'security' | 'devices' | 'settings';
type SubTab = 'logins' | 'bookmarks';
type StrengthFilter = 'all' | 'weak' | 'reused' | 'strong';

interface VaultEntry {
  id: string;
  title: string;
  username: string;
  domain: string;
  favicon?: string;
  folderId?: string | null;
  passwordDecrypted: string;
  notes?: string;
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
  const [subTab, setSubTab] = useState<SubTab>('logins');
  const [strengthFilter, setStrengthFilter] = useState<StrengthFilter>('all');
  
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

  // Modals state
  const [showAddFolderModal, setShowAddFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [folderParentId, setFolderParentId] = useState<string | undefined>(undefined);
  const [folderRenameId, setFolderRenameId] = useState<string | null>(null);
  const [folderRenameName, setFolderRenameName] = useState('');
  const [folderNewName, setFolderNewName] = useState('');

  // Bookmarks Folder Modals
  const [showBookmarkFolderModal, setShowBookmarkFolderModal] = useState<'add' | 'rename' | null>(null);
  const [bookmarkOldPath, setBookmarkOldPath] = useState('');
  const [bookmarkNewPath, setBookmarkNewPath] = useState('');
  
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('vaultsync-theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', username: '', password: '', domain: '', notes: '' });
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

  // Generator screen state
  const [genLength, setGenLength] = useState(20);
  const [genUpper, setGenUpper] = useState(true);
  const [genLower, setGenLower] = useState(true);
  const [genDigits, setGenDigits] = useState(true);
  const [genSymbols, setGenSymbols] = useState(true);
  const [generatedPass, setGeneratedPass] = useState('');
  const [genCopied, setGenCopied] = useState(false);

  // Active Device details State
  const [activeDeviceIdx, setActiveDeviceIdx] = useState(0);

  const { s, fStyles, mStyles, isDark, c } = getThemeStyles(theme);

  // Trigger password generation
  const handleRegeneratePassword = useCallback(() => {
    const p = generatePassword({
      length: genLength,
      uppercase: genUpper,
      lowercase: genLower,
      digits: genDigits,
      symbols: genSymbols,
      excludeAmbiguous: false
    });
    setGeneratedPass(p);
    setGenCopied(false);
  }, [genLength, genUpper, genLower, genDigits, genSymbols]);

  useEffect(() => {
    if (tab === 'generator' && !generatedPass) {
      handleRegeneratePassword();
    }
  }, [tab, generatedPass, handleRegeneratePassword]);

  // Load session timeout
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_SESSION_TIMEOUT' })
        .then((resp: { timeout: string }) => {
          if (resp?.timeout) setSessionTimeout(resp.timeout);
        })
        .catch(() => {});
    }
  }, []);

  // Track activity
  useEffect(() => {
    if (typeof window === 'undefined' || typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;

    const updateActivity = () => {
      chrome.runtime.sendMessage({ type: 'UPDATE_ACTIVITY_TIMESTAMP' }).catch(() => {});
    };

    updateActivity();
    const events = ['mousedown', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, updateActivity));

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, updateActivity));
    };
  }, []);

  // Track tab domain
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

  // Check auth state
  useEffect(() => {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) return;
    try {
      chrome.runtime.sendMessage({ type: 'GET_AUTH_STATE' })
        .then(async (resp: { session: any }) => {
          if (resp?.session) {
            const expiryResp = await chrome.runtime.sendMessage({ type: 'CHECK_SESSION_EXPIRED' });
            if (expiryResp?.expired) {
              await chrome.runtime.sendMessage({ type: 'CLEAR_VAULT_KEY' });
              setIsAuthed(false);
              return;
            }

            const { getSupabaseClient } = await import('@vaultsync/core');
            const supabase = getSupabaseClient();
            await supabase.auth.setSession(resp.session);

            const keyData = await chrome.runtime.sendMessage({ type: 'GET_VAULT_KEY' });
            if (keyData?.vaultKey) {
              const binary = atob(keyData.vaultKey);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              setVaultKey(bytes);
              setIsAuthed(true);
            } else {
              setIsAuthed(false);
            }
          }
        })
        .catch((e: Error) => console.warn('[VaultSync] Service worker not active yet:', e));
    } catch (e) {
      console.warn('[VaultSync] runtime.sendMessage failed:', e);
    }
  }, []);

  // Data loader
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
          notes: i.decrypted.notes || '',
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

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'REFRESH_BADGE' }).catch(() => {});
      }
    } catch (e) {
      console.error('[VaultSync] Failed to load data:', e);
    }
  }, []);

  // CRUD events
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
          onClick={() => setSelectedFolderId(isActive ? null : folder.id)}
        >
          <div 
            style={{ display: 'flex', alignItems: 'center', cursor: hasChildren ? 'pointer' : 'default', width: 14, height: 14, justifyContent: 'center' }}
            onClick={(e) => hasChildren && toggleFolder(folder.id, e)}
          >
            {hasChildren ? (
              <ChevronRight size={12} color="#9CA1AA" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            ) : (
              <div style={{ width: 12, height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }} />
            )}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
          <div style={fStyles.actions} onClick={e => e.stopPropagation()}>
            <button
              style={fStyles.actionBtn}
              onClick={() => { setFolderParentId(folder.id); setFolderNewName(''); setShowAddFolderModal(true); }}
              title="Add Subfolder"
            >
              <Plus size={10} color="#9CA1AA" />
            </button>
            <button
              style={fStyles.actionBtn}
              onClick={() => { setFolderRenameId(folder.id); setFolderRenameName(folder.name); setShowRenameFolderModal(true); }}
              title="Rename"
            >
              <Settings size={10} color="#9CA1AA" />
            </button>
            <button
              style={fStyles.actionBtn}
              onClick={() => handleDeleteFolder(folder.id)}
              title="Delete"
            >
              <X size={10} color="#EF4444" />
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
            ...(isActive ? { ...fStyles.activeRow, color: c.accent, background: c.accentHover } : {}),
            paddingLeft: `${level * 12 + 12}px`
          }}
          onClick={() => setSelectedFolderPath(isActive ? null : node.path)}
        >
          <div 
            style={{ display: 'flex', alignItems: 'center', cursor: hasChildren ? 'pointer' : 'default', width: 14, height: 14, justifyContent: 'center' }}
            onClick={(e) => hasChildren && toggleFolder(node.path, e)}
          >
            {hasChildren ? (
              <ChevronRight size={12} color="#9CA1AA" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }} />
            ) : (
              <div style={{ width: 12, height: 12, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }} />
            )}
          </div>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
          <div style={fStyles.actions} onClick={e => e.stopPropagation()}>
            <button
              style={fStyles.actionBtn}
              onClick={() => { setBookmarkOldPath(node.path); setBookmarkNewPath(node.path); setShowBookmarkFolderModal('rename'); }}
              title="Rename"
            >
              <Settings size={10} color="#9CA1AA" />
            </button>
            <button
              style={fStyles.actionBtn}
              onClick={() => handleDeleteBookmarkFolder(node.path)}
              title="Delete"
            >
              <X size={10} color="#EF4444" />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && node.children!.map(child => renderBookmarkFolder(child, level + 1))}
      </div>
    );
  };

  // Realtime syncing and badge notifications setup
  useEffect(() => {
    if (!vaultKey) return;
    loadAllData(vaultKey);

    refreshIntervalRef.current = setInterval(() => {
      loadAllData(vaultKey);
    }, 15000);

    const handleMessage = (message: { type: string }) => {
      if (message.type === 'VAULT_DATA_CHANGED') {
        loadAllData(vaultKey);
      }
      if (message.type === 'SESSION_EXPIRED') {
        setIsAuthed(false);
        setVaultItems([]);
        setBookmarks([]);
        setVaultKey(null);
      }
    };
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }

    let vaultItemsSub: any = null;
    let foldersSub: any = null;
    let bookmarksSub: any = null;

    const setupRealtime = async () => {
      try {
        const session = await getSession();
        if (!session || !session.user) return;
        const userId = session.user.id;

        const { subscribeToVaultItems, subscribeToFolders, subscribeToBookmarks } = await import('@vaultsync/core');
        
        vaultItemsSub = subscribeToVaultItems(userId, () => {
          loadAllData(vaultKey);
        });
        foldersSub = subscribeToFolders(userId, () => {
          loadAllData(vaultKey);
        });
        bookmarksSub = subscribeToBookmarks(userId, () => {
          loadAllData(vaultKey);
        });
      } catch (err) {
        console.error('[Extension Realtime] Failed to setup subscriptions:', err);
      }
    };

    setupRealtime();

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
      if (vaultItemsSub) vaultItemsSub.unsubscribe();
      if (foldersSub) foldersSub.unsubscribe();
      if (bookmarksSub) bookmarksSub.unsubscribe();
    };
  }, [vaultKey, loadAllData]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { vaultKey: material } = await signIn({ email, masterPassword: password });
      const keyBase64 = btoa(String.fromCharCode(...material.key));

      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        await chrome.runtime.sendMessage({
          type: 'STORE_VAULT_KEY',
          payload: { keyBase64, salt: material.salt }
        });

        const session = await getSession();
        await chrome.runtime.sendMessage({
          type: 'SYNC_SESSION',
          payload: { session }
        });
      }

      setVaultKey(material.key);
      setIsAuthed(true);
    } catch (e) {
      console.error(e);
      alert('Login failed. Master password may be incorrect.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSave = async () => {
    if (!editingItem || !vaultKey) return;
    setLoading(true);
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const resp = await chrome.runtime.sendMessage({
          type: 'UPDATE_CREDENTIAL_BY_ID',
          payload: {
            id: editingItem.id,
            username: editForm.username,
            password: editForm.password,
            domain: editForm.domain,
            url: editForm.domain,
            title: editForm.title,
            notes: editForm.notes
          }
        });
        if (resp.error) throw new Error(resp.error);
      }
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
      domain: item.domain,
      notes: item.notes || ''
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
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const resp = await chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' });
        if (resp.bookmarks) {
          await syncBookmarks(resp.bookmarks, vaultKey);
          await loadAllData(vaultKey);
          alert('Smart bookmarks sync completed!');
        }
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
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        const resp = await chrome.runtime.sendMessage({ type: 'SYNC_BOOKMARKS' });
        if (resp.bookmarks) {
          const existingUrls = new Set(bookmarks.map(b => b.url.toLowerCase().trim().replace(/\/$/, '')));
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
          alert(`Successfully synced ${missing.length} missing bookmarks!`);
        }
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

  // Filter items by strength and search
  const getPasswordStrengthScore = (password: string): number => {
    const strength = estimateStrength(password);
    return strength.score;
  };

  const filteredVaultItems = vaultItems.filter(item => {
    if (selectedFolderId && item.folderId !== selectedFolderId) return false;
    
    // Apply strength filters
    if (strengthFilter !== 'all') {
      const score = getPasswordStrengthScore(item.passwordDecrypted);
      if (strengthFilter === 'weak' && score > 1) return false;
      if (strengthFilter === 'reused' && (score !== 2 && score !== 3)) return false; // repurpose reused as medium score
      if (strengthFilter === 'strong' && score !== 4) return false;
    }

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

  // Security score metrics
  const totalPasswords = vaultItems.length;
  const weakCount = vaultItems.filter(i => getPasswordStrengthScore(i.passwordDecrypted) <= 1).length;
  const reusedCount = vaultItems.filter(i => {
    const score = getPasswordStrengthScore(i.passwordDecrypted);
    return score === 2 || score === 3;
  }).length;
  const strongCount = vaultItems.filter(i => getPasswordStrengthScore(i.passwordDecrypted) === 4).length;
  const healthPercent = totalPasswords > 0 
    ? Math.round(((strongCount + reusedCount * 0.5) / totalPasswords) * 100) 
    : 100;

  // Active devices mock data
  const devicesList = [
    { name: 'Chrome Extension', icon: <Laptop size={20} />, location: 'Paris, France', flag: '🇫🇷', ip: '194.254.120.10', time: 'Active Now', trusted: true },
    { name: 'iPhone 16 Pro', icon: <Smartphone size={20} />, location: 'Paris, France', flag: '🇫🇷', ip: '194.254.120.11', time: '10 mins ago', trusted: true },
    { name: 'MacBook Pro', icon: <Laptop size={20} />, location: 'New York, USA', flag: '🇺🇸', ip: '64.233.160.10', time: 'Jan 12, 13:00', trusted: false },
  ];

  // Auth screen
  if (!isAuthed) {
    return (
      <div style={s.panel}>
        <div style={s.authContainer}>
          <div style={s.logo}>
            <Shield size={20} color="#1F2228" />
          </div>
          <h1 style={{ fontSize: '32px', fontWeight: 600, color: '#FFFFFF', margin: '16px 0 4px', letterSpacing: '-0.5px' }}>VaultSync</h1>
          <p style={{ fontSize: '14px', color: '#C7CBD1', textAlign: 'center', marginBottom: '24px' }}>
            Slate & Yellow Zero-Knowledge Vault
          </p>
          <input
            style={s.authInput}
            placeholder="Email Address"
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
            {loading ? <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={18} />}
            {loading ? 'Unlocking Vault...' : 'Unlock Vault'}
          </button>
        </div>
      </div>
    );
  }

  // Main panel
  return (
    <div style={s.panel}>
      {/* Header */}
      <div style={s.header}>
        <div style={{ ...s.headerRow, marginBottom: 0, justifyContent: 'space-between', position: 'relative', height: 44, alignItems: 'center' }}>
          {!isSearchOpen ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={s.logo}><Shield size={16} color="#1F2228" /></div>
                <span style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF' }}>VaultSync</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {tab === 'vault' && (
                  <button
                    style={s.iconBtn}
                    onClick={() => setIsSearchOpen(true)}
                    title="Search"
                  >
                    <Search size={16} />
                  </button>
                )}
                {tab === 'vault' && (
                  <button
                    style={{ ...s.iconBtn, color: c.accent }}
                    title="Open Web Dashboard"
                    onClick={() => typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create({ url: 'https://vaultsync-passwords.netlify.app/vault' })}
                  >
                    <ExternalLink size={16} />
                  </button>
                )}
                <button
                  style={{ ...s.iconBtn, animation: syncing ? 'spin 1s linear' : 'none' }}
                  title="Refresh data"
                  onClick={() => vaultKey && loadAllData(vaultKey)}
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '8px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={16} style={{ position: 'absolute', left: 12, top: 14, color: c.textMuted }} />
                <input
                  style={{ ...s.searchInput, width: '100%', paddingLeft: 38 }}
                  placeholder={subTab === 'bookmarks' ? 'Search bookmarks...' : 'Search vault...'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <button
                style={{ ...s.iconBtn, background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}
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
        
        {/* VAULT TAB */}
        {tab === 'vault' && (
          <>
            {/* PillTab for switching Logins/Bookmarks */}
            <div style={{ display: 'flex', background: 'rgba(23, 24, 25, 0.2)', padding: '4px', borderRadius: '999px', marginBottom: '16px' }}>
              <button 
                style={{ 
                  flex: 1, padding: '10px 0', border: 'none', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: subTab === 'logins' ? c.accent : 'transparent',
                  color: subTab === 'logins' ? '#1F2228' : '#C7CBD1'
                }}
                onClick={() => setSubTab('logins')}
              >
                Logins
              </button>
              <button 
                style={{ 
                  flex: 1, padding: '10px 0', border: 'none', borderRadius: '999px', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                  background: subTab === 'bookmarks' ? c.accent : 'transparent',
                  color: subTab === 'bookmarks' ? '#1F2228' : '#C7CBD1'
                }}
                onClick={() => setSubTab('bookmarks')}
              >
                Bookmarks
              </button>
            </div>

            {/* LOGINS SECTION */}
            {subTab === 'logins' && (
              <>
                {/* Stat Capsule Filters */}
                <div style={{ ...s.statsBar, padding: '0 0 16px 0' }}>
                  <div 
                    style={strengthFilter === 'all' ? s.statPillActive : s.statPill}
                    onClick={() => setStrengthFilter('all')}
                  >
                    <div style={strengthFilter === 'all' ? s.statNumberActive : s.statNumber}>{totalPasswords}</div>
                    <div style={strengthFilter === 'all' ? s.statLabelActive : s.statLabel}>Total</div>
                  </div>
                  <div 
                    style={strengthFilter === 'weak' ? s.statPillActive : s.statPill}
                    onClick={() => setStrengthFilter('weak')}
                  >
                    <div style={strengthFilter === 'weak' ? s.statNumberActive : s.statNumber}>{weakCount}</div>
                    <div style={strengthFilter === 'weak' ? s.statLabelActive : s.statLabel}>Weak</div>
                  </div>
                  <div 
                    style={strengthFilter === 'reused' ? s.statPillActive : s.statPill}
                    onClick={() => setStrengthFilter('reused')}
                  >
                    <div style={strengthFilter === 'reused' ? s.statNumberActive : s.statNumber}>{reusedCount}</div>
                    <div style={strengthFilter === 'reused' ? s.statLabelActive : s.statLabel}>Medium</div>
                  </div>
                  <div 
                    style={strengthFilter === 'strong' ? s.statPillActive : s.statPill}
                    onClick={() => setStrengthFilter('strong')}
                  >
                    <div style={strengthFilter === 'strong' ? s.statNumberActive : s.statNumber}>{strongCount}</div>
                    <div style={strengthFilter === 'strong' ? s.statLabelActive : s.statLabel}>Strong</div>
                  </div>
                </div>

                {/* Folders Accordion */}
                <div style={fStyles.section}>
                  <div style={fStyles.header}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setShowFoldersList(!showFoldersList)}>
                      📁 Folders {showFoldersList ? '▲' : '▼'}
                    </span>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                      onClick={() => { setFolderParentId(undefined); setFolderNewName(''); setShowAddFolderModal(true); }}
                    >
                      <Plus size={14} color={c.accent} />
                    </button>
                  </div>
                  
                  {showFoldersList && (
                    <div style={fStyles.card}>
                      {passwordFolderTree.length === 0 ? (
                        <div style={{ padding: '12px', color: c.textMuted, fontSize: '13px', textAlign: 'center' }}>No folders created yet</div>
                      ) : (
                        passwordFolderTree.map(f => renderPasswordFolder(f, 0))
                      )}
                    </div>
                  )}
                </div>

                {selectedFolderId && (
                  <div style={fStyles.filterBadge}>
                    <span>Active Folder: {folders.find(f => f.id === selectedFolderId)?.name}</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.accent, display: 'flex' }} onClick={() => setSelectedFolderId(null)}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                {/* This Site matching passwords */}
                {currentDomain && (
                  <>
                    <div style={s.sectionLabel}>This Site ({currentDomain})</div>
                    {domainItems.length > 0 && (
                      domainItems.map(item => {
                        const isSelected = editingItem?.id === item.id;
                        const score = getPasswordStrengthScore(item.passwordDecrypted);
                        const isWeak = score <= 1;
                        
                        return (
                          <div
                            key={item.id}
                            style={isSelected ? s.itemCardSelected : s.itemCard}
                            onClick={() => handleEditOpen(item, item.passwordDecrypted)}
                          >
                            <div style={s.favicon}>
                              {getFaviconUrl(currentDomain) ? (
                                <img src={getFaviconUrl(currentDomain)} width={24} height={24} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                              ) : (
                                <Key size={16} color={isSelected ? '#1F2228' : '#FFFFFF'} />
                              )}
                            </div>
                            <div style={s.itemInfo}>
                              <div style={isSelected ? s.itemTitleDark : s.itemTitle}>{item.title}</div>
                              <div style={isSelected ? s.itemSubDark : s.itemSub}>{item.username}</div>
                            </div>

                            {/* Status badge representing strength */}
                            <div style={{
                              padding: '4px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                              background: isWeak ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                              color: isWeak ? '#EF4444' : '#22C55E'
                            }}>
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: isWeak ? '#EF4444' : '#22C55E' }}></span>
                              {isWeak ? 'Weak' : 'Strong'}
                            </div>

                            <button
                              style={{ ...s.iconBtn, background: 'transparent', color: isSelected ? '#1F2228' : (copiedId === item.id ? '#22C55E' : '#9CA1AA') }}
                              onClick={(e) => { e.stopPropagation(); handleCopy(item.passwordDecrypted, item.id); }}
                            >
                              {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                            </button>
                          </div>
                        );
                      })
                    )}
                    {isAdding ? (
                      <div style={{ ...s.itemCard, flexDirection: 'column', alignItems: 'stretch', gap: 10, background: 'rgba(255, 255, 255, 0.04)' }}>
                        <input style={s.authInput} placeholder="Username/Email" value={addUsername} onChange={(e) => setAddUsername(e.target.value)} />
                        <input style={s.authInput} type="password" placeholder="Password" value={addPassword} onChange={(e) => setAddPassword(e.target.value)} />
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button style={{ ...mStyles.saveBtn, height: 36, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={handleAdd} disabled={loading}>{loading ? 'Saving...' : 'Save'}</button>
                          <button style={{ ...mStyles.cancelBtn, height: 36, flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: 0 }} onClick={() => setIsAdding(false)}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ ...s.itemCard, border: `1px solid ${c.accent}22`, background: c.accentSoft }}>
                        <div style={s.favicon}><Key size={18} color={c.accent} /></div>
                        <div style={s.itemInfo}>
                          <div style={s.itemTitle}>New Credentials</div>
                          <div style={s.itemSub}>Save password for {currentDomain}</div>
                        </div>
                        <button style={s.iconBtn} onClick={() => setIsAdding(true)}><Plus size={16} color="#1F2228" /></button>
                      </div>
                    )}
                  </>
                )}

                {/* All Passwords list */}
                <div style={s.sectionLabel}>All Logins</div>
                {otherItems.length === 0 && domainItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: c.textSec }}>
                    <Key size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>Your vault is empty</div>
                    <div style={{ fontSize: '13px', marginTop: 4 }}>Add passwords from the dashboard or mobile app</div>
                  </div>
                ) : (
                  otherItems.map((item) => {
                    const isSelected = editingItem?.id === item.id;
                    const score = getPasswordStrengthScore(item.passwordDecrypted);
                    const isWeak = score <= 1;
                    
                    return (
                      <div
                        key={item.id}
                        style={isSelected ? s.itemCardSelected : s.itemCard}
                        onClick={() => handleEditOpen(item, item.passwordDecrypted)}
                      >
                        <div style={s.favicon}>
                          {item.domain && getFaviconUrl(item.domain) ? (
                            <img src={getFaviconUrl(item.domain)} width={24} height={24} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          ) : (
                            <Key size={16} color={isSelected ? '#1F2228' : '#FFFFFF'} />
                          )}
                        </div>
                        <div style={s.itemInfo}>
                          <div style={isSelected ? s.itemTitleDark : s.itemTitle}>{item.title}</div>
                          <div style={isSelected ? s.itemSubDark : s.itemSub}>{item.username}</div>
                        </div>

                        {/* Status Badge */}
                        <div style={{
                          padding: '4px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                          background: isWeak ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                          color: isWeak ? '#EF4444' : '#22C55E'
                        }}>
                          <span style={{ width: 4, height: 4, borderRadius: '50%', background: isWeak ? '#EF4444' : '#22C55E' }}></span>
                          {isWeak ? 'Weak' : 'Strong'}
                        </div>

                        <button
                          style={{ ...s.iconBtn, background: 'transparent', color: isSelected ? '#1F2228' : (copiedId === item.id ? '#22C55E' : '#9CA1AA') }}
                          onClick={(e) => { e.stopPropagation(); handleCopy(item.passwordDecrypted, item.id); }}
                        >
                          {copiedId === item.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                      </div>
                    );
                  })
                )}
              </>
            )}

            {/* BOOKMARKS SECTION */}
            {subTab === 'bookmarks' && (
              <>
                {/* Folders Accordion for Bookmarks */}
                <div style={fStyles.section}>
                  <div style={fStyles.header}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }} onClick={() => setShowFoldersList(!showFoldersList)}>
                      📁 Folders {showFoldersList ? '▲' : '▼'}
                    </span>
                    <button
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}
                      onClick={() => { setBookmarkNewPath(''); setShowBookmarkFolderModal('add'); }}
                    >
                      <Plus size={14} color={c.accent} />
                    </button>
                  </div>

                  {showFoldersList && (
                    <div style={fStyles.card}>
                      {bookmarkFolderTree.length === 0 ? (
                        <div style={{ padding: '12px', color: c.textMuted, fontSize: '13px', textAlign: 'center' }}>No folders created yet</div>
                      ) : (
                        bookmarkFolderTree.map(n => renderBookmarkFolder(n, 0))
                      )}
                    </div>
                  )}
                </div>

                {selectedFolderPath && (
                  <div style={{ ...fStyles.filterBadge, background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.accent}`, color: c.accent }}>
                    <span>Active Folder: {selectedFolderPath}</span>
                    <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.accent, display: 'flex' }} onClick={() => setSelectedFolderPath(null)}>
                      <X size={14} />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={s.sectionLabel}>Synced Bookmarks</div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      style={{
                        background: c.accentSoft,
                        border: `1px solid ${c.accent}`,
                        color: c.accent,
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '999px',
                        fontFamily: 'inherit',
                      }}
                      onClick={handleSyncBookmarksOnlyMissing}
                      disabled={syncing}
                      title="Sync missing bookmarks only"
                    >
                      Smart Sync
                    </button>
                    <button
                      style={{ ...s.iconBtn, color: syncing ? c.accent : '#9CA1AA', animation: syncing ? 'spin 1s linear infinite' : 'none' }}
                      onClick={handleSyncBookmarks}
                      title="Sync all bookmarks"
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                {filteredBookmarks.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: c.textSec }}>
                    <Bookmark size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>No bookmarks yet</div>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 }}>
                      <button
                        style={{ ...s.authBtn, width: 'auto', padding: '10px 16px', fontSize: '12px' }}
                        onClick={handleSyncBookmarksOnlyMissing}
                        disabled={syncing}
                      >
                        <RefreshCw size={14} /> Smart Sync
                      </button>
                    </div>
                  </div>
                ) : (
                  filteredBookmarks.map((b) => (
                    <a key={b.id} href={b.url} target="_blank" rel="noreferrer" style={{ ...s.itemCard, textDecoration: 'none' }}>
                      <div style={s.favicon}>
                        {b.favicon ? (
                          <img src={b.favicon} width={24} height={24} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        ) : (
                          <Bookmark size={16} color="#FFFFFF" />
                        )}
                      </div>
                      <div style={s.itemInfo}>
                        <div style={s.itemTitle}>{b.title}</div>
                        <div style={s.itemSub}>{b.domain}</div>
                      </div>
                      <ExternalLink size={14} color="#9CA1AA" />
                    </a>
                  ))
                )}
              </>
            )}
          </>
        )}

        {/* GENERATOR TAB */}
        {tab === 'generator' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Display Box */}
            <div style={{ background: c.card, borderRadius: '28px', border: `1px solid ${c.cardBorder}`, padding: '24px', textAlign: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
              <div style={{
                fontFamily: "monospace", fontSize: '18px', color: '#FFFFFF', wordBreak: 'break-all',
                background: 'rgba(23, 24, 25, 0.2)', padding: '16px', borderRadius: '12px', marginBottom: '16px', letterSpacing: '0.5px'
              }}>
                {generatedPass || 'Loading...'}
              </div>

              {/* Password strength progress bar */}
              {(() => {
                const sScore = getPasswordStrengthScore(generatedPass);
                const sColors = ['#EF4444', '#F97316', '#F4E11A', '#84CC16', '#22C55E'];
                const sLabels = ['Very Weak', 'Weak', 'Medium', 'Strong', 'Excellent'];
                return (
                  <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', gap: '4px', height: '6px', width: '100%', marginBottom: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                      {[0, 1, 2, 3, 4].map(idx => (
                        <div key={idx} style={{ flex: 1, background: idx <= sScore ? sColors[sScore] : 'transparent', transition: 'background 0.2s' }}></div>
                      ))}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: sColors[sScore] }}>
                      {sLabels[sScore]} Strength
                    </div>
                  </div>
                );
              })()}

              <div style={{ display: 'flex', gap: '12px' }}>
                <button 
                  style={{ ...mStyles.saveBtn, flex: 1, height: '44px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={async () => {
                    await navigator.clipboard.writeText(generatedPass);
                    setGenCopied(true);
                    setTimeout(() => setGenCopied(false), 2000);
                  }}
                >
                  <Copy size={16} />
                  {genCopied ? 'Copied!' : 'Copy Password'}
                </button>
                <button 
                  style={{ ...mStyles.cancelBtn, flex: 1, height: '44px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: `1px solid ${c.cardBorder}` }}
                  onClick={handleRegeneratePassword}
                >
                  <RefreshCw size={16} />
                  Regenerate
                </button>
              </div>
            </div>

            {/* Slider */}
            <div style={{ background: c.card, borderRadius: '28px', border: `1px solid ${c.cardBorder}`, padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Length</span>
                <span style={{ fontSize: '16px', fontWeight: 700, color: c.accent }}>{genLength}</span>
              </div>
              <input 
                type="range" min="8" max="64" value={genLength} 
                style={{ width: '100%', accentColor: c.accent, cursor: 'pointer' }}
                onChange={(e) => {
                  setGenLength(Number(e.target.value));
                  // Debounced/immediate regenerate
                  setTimeout(handleRegeneratePassword, 1);
                }} 
              />
            </div>

            {/* Checkbox Options */}
            <div style={{ background: c.card, borderRadius: '28px', border: `1px solid ${c.cardBorder}`, padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { state: genUpper, setter: setGenUpper, label: 'Uppercase (A-Z)' },
                { state: genLower, setter: setGenLower, label: 'Lowercase (a-z)' },
                { state: genDigits, setter: setGenDigits, label: 'Numbers (0-9)' },
                { state: genSymbols, setter: setGenSymbols, label: 'Symbols (!@#$)' },
              ].map((opt, idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
                  <span style={{ fontSize: '14px', color: '#FFFFFF' }}>{opt.label}</span>
                  <input 
                    type="checkbox" checked={opt.state} 
                    style={{ width: '18px', height: '18px', accentColor: c.accent }}
                    onChange={() => {
                      opt.setter(!opt.state);
                      setTimeout(handleRegeneratePassword, 1);
                    }} 
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {/* SECURITY TAB */}
        {tab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Health Score Gauge */}
            <div style={{ background: c.card, borderRadius: '28px', border: `1px solid ${c.cardBorder}`, padding: '24px', textCenter: 'center', boxShadow: '0 4px 16px rgba(0,0,0,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: '#C7CBD1', marginBottom: '16px' }}>Security Score</span>
              
              {/* Semi-circular donut chart */}
              <div style={{ position: 'relative', width: '160px', height: '90px', overflow: 'hidden', display: 'flex', justifyContent: 'center' }}>
                <svg width="160" height="160" style={{ position: 'absolute', top: 0 }}>
                  <circle cx="80" cy="80" r="60" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" strokeDasharray="188.5 188.5" strokeDashoffset="0" strokeLinecap="round" transform="rotate(-180 80 80)" />
                  <circle cx="80" cy="80" r="60" fill="none" stroke={c.accent} strokeWidth="18" strokeDasharray="188.5 188.5" strokeDashoffset={188.5 - (188.5 * healthPercent) / 100} strokeLinecap="round" transform="rotate(-180 80 80)" style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }} />
                </svg>
                <div style={{ position: 'absolute', bottom: '4px', textAlign: 'center' }}>
                  <span style={{ fontSize: '32px', fontWeight: 700, color: '#FFFFFF' }}>{healthPercent}%</span>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: healthPercent >= 75 ? '#22C55E' : (healthPercent >= 45 ? '#F4E11A' : '#EF4444'), marginTop: '2px' }}>
                    {healthPercent >= 75 ? 'Safe Vault' : (healthPercent >= 45 ? 'Medium Risk' : 'High Threat')}
                  </div>
                </div>
              </div>
            </div>

            {/* Exposed credentials or alerts list */}
            <div style={s.sectionLabel}>Weak & Vulnerable Passwords</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {vaultItems.filter(i => getPasswordStrengthScore(i.passwordDecrypted) <= 1).length === 0 ? (
                <div style={{ background: c.card, borderRadius: '20px', padding: '24px', textAlign: 'center', border: `1px solid ${c.cardBorder}` }}>
                  <span style={{ fontSize: '14px', color: '#22C55E', fontWeight: 600 }}>✓ No security alerts. Great job!</span>
                </div>
              ) : (
                vaultItems.filter(i => getPasswordStrengthScore(i.passwordDecrypted) <= 1).map(item => (
                  <div 
                    key={item.id} 
                    style={{ ...s.itemCard, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.04)' }}
                    onClick={() => handleEditOpen(item, item.passwordDecrypted)}
                  >
                    <div style={{ ...s.favicon, background: 'rgba(239,68,68,0.1)' }}>
                      <Lock size={16} color="#EF4444" />
                    </div>
                    <div style={s.itemInfo}>
                      <div style={s.itemTitle}>{item.title}</div>
                      <div style={{ ...s.itemSub, color: '#EF4444' }}>Weak master password hash</div>
                    </div>
                    <span style={{ fontSize: '11px', color: '#EF4444', fontWeight: 700 }}>Vulnerable</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* DEVICES TAB */}
        {tab === 'devices' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Device chips */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
              {devicesList.map((dev, idx) => (
                <div 
                  key={idx} 
                  style={{
                    background: activeDeviceIdx === idx ? c.accent : c.card,
                    border: `1px solid ${activeDeviceIdx === idx ? c.accent : c.cardBorder}`,
                    borderRadius: '20px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px',
                    cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)'
                  }}
                  onClick={() => setActiveDeviceIdx(idx)}
                >
                  <div style={{ color: activeDeviceIdx === idx ? '#1F2228' : '#FFFFFF' }}>{dev.icon}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: activeDeviceIdx === idx ? '#1F2228' : '#FFFFFF' }}>{dev.name}</div>
                    <div style={{ fontSize: '11px', color: activeDeviceIdx === idx ? '#1F2228' : '#C7CBD1' }}>{dev.time}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Map session */}
            <div style={s.sectionLabel}>Map Session</div>
            <div style={{
              background: '#6B7280', borderRadius: '28px', border: `1px solid ${c.cardBorder}`, height: '160px',
              position: 'relative', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.1)'
            }}>
              {/* Illustrated map representation */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.15,
                backgroundSize: 'cover', backgroundImage: "url('data:image/svg+xml;utf8,<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"200\" height=\"100\" viewBox=\"0 0 200 100\"><path fill=\"white\" d=\"M 10 10 L 40 10 L 50 40 L 20 80 Z M 80 20 L 120 30 L 110 60 L 90 70 Z M 140 40 L 180 30 L 190 70 L 150 80 Z\" /></svg>')"
              }}></div>
              
              {/* Map Pins */}
              <div 
                style={{
                  position: 'absolute', top: '40%', left: '35%', width: '24px', height: '24px',
                  borderRadius: '50%', background: '#F4E11A', border: '3px solid #1F2228',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 700, color: '#1F2228', cursor: 'pointer'
                }}
                title="Europe Session Location"
                onClick={() => setActiveDeviceIdx(0)}
              >
                2
              </div>
              <div 
                style={{
                  position: 'absolute', top: '35%', left: '70%', width: '24px', height: '24px',
                  borderRadius: '50%', background: '#171819', border: '3px solid #F4E11A',
                  boxShadow: '0 4px 8px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '9px', fontWeight: 700, color: '#FFFFFF', cursor: 'pointer'
                }}
                title="North America Session Location"
                onClick={() => setActiveDeviceIdx(2)}
              >
                1
              </div>
            </div>

            {/* Bottom device detail sheet */}
            <div style={{ background: '#FFFFFF', borderRadius: '28px', border: '1px solid rgba(0,0,0,0.06)', padding: '20px', color: '#1F2228', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '16px', fontWeight: 700 }}>{devicesList[activeDeviceIdx].name}</span>
                <span style={{
                  padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                  background: devicesList[activeDeviceIdx].trusted ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
                  color: devicesList[activeDeviceIdx].trusted ? '#22C55E' : '#EF4444'
                }}>
                  {devicesList[activeDeviceIdx].trusted ? 'Trusted' : 'Untrusted'}
                </span>
              </div>
              <div style={{ borderBottom: '1px dotted rgba(31,34,40,0.12)', margin: '12px 0' }}></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6B7280' }}>IP Address</span>
                  <span style={{ fontWeight: 600 }}>{devicesList[activeDeviceIdx].ip}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6B7280' }}>Location</span>
                  <span style={{ fontWeight: 600 }}>{devicesList[activeDeviceIdx].flag} {devicesList[activeDeviceIdx].location}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6B7280' }}>Last Active</span>
                  <span style={{ fontWeight: 600 }}>{devicesList[activeDeviceIdx].time}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === 'settings' && (
          <>
            {/* Stats */}
            <div style={s.statsBar}>
              <div style={s.statPill}>
                <div style={{ ...s.statNumber, color: c.accent }}>{vaultItems.length || '0'}</div>
                <div style={s.statLabel}>Vault</div>
              </div>
              <div style={s.statPill}>
                <div style={{ ...s.statNumber, color: c.accent }}>{bookmarks.length || '0'}</div>
                <div style={s.statLabel}>Bookmarks</div>
              </div>
              <div style={s.statPill}>
                <div style={{ ...s.statNumber, color: '#22c55e' }}>256</div>
                <div style={s.statLabel}>AES</div>
              </div>
            </div>

            {/* Appearance */}
            <div style={s.sectionLabel}>Preferences</div>
            <div style={{ ...s.itemCard, justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={s.itemInfo}>
                <div style={s.itemTitle}>Visual Theme</div>
                <div style={s.itemSub}>{theme === 'dark' ? 'Dark slate' : 'Off-white light'}</div>
              </div>
              <button
                style={{
                  padding: '10px 16px',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${c.cardBorder}`,
                  color: c.text,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
                onClick={() => {
                  const n = theme === 'dark' ? 'light' : 'dark';
                  setTheme(n);
                  localStorage.setItem('vaultsync-theme', n);
                }}
              >
                Switch
              </button>
            </div>

            <div style={s.sectionLabel}>System Details</div>
            <div style={s.itemCard}>
              <div style={s.itemInfo}>
                <div style={s.itemTitle}>Encryption Mode</div>
                <div style={s.itemSub}>AES-256-GCM + PBKDF2 (Zero-Knowledge)</div>
              </div>
              <span style={{ fontSize: '11px', color: '#22C55E', fontWeight: 700 }}>✓ Verified</span>
            </div>

            <div style={s.sectionLabel}>Session Expiry</div>
            <div style={{ ...s.itemCard, flexDirection: 'column', alignItems: 'stretch', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Clock size={16} color={c.accent} />
                <div style={s.itemInfo}>
                  <div style={s.itemTitle}>Auto Lock Timeout</div>
                  <div style={s.itemSub}>Locks vault after background delay</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { value: '12h', label: '12h' },
                  { value: '24h', label: '24h' },
                  { value: '2d', label: '2 Days' },
                  { value: 'always', label: 'Never' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={async () => {
                      setSessionTimeout(opt.value);
                      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                        await chrome.runtime.sendMessage({
                          type: 'SET_SESSION_TIMEOUT',
                          payload: { timeout: opt.value }
                        });
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: '999px',
                      border: sessionTimeout === opt.value
                        ? `1px solid ${c.accent}`
                        : `1px solid ${c.cardBorder}`,
                      background: sessionTimeout === opt.value
                        ? c.accentSoft
                        : 'rgba(255,255,255,0.04)',
                      color: sessionTimeout === opt.value ? c.accent : c.textSec,
                      fontSize: '12px',
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
              style={{ ...s.itemCard, border: '1px solid rgba(239,68,68,0.2)', background: 'transparent' }}
              onClick={async () => {
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                  await chrome.runtime.sendMessage({ type: 'CLEAR_VAULT_KEY' });
                }
                try {
                  await signOut();
                } catch (e) {
                  console.error(e);
                }
                if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
                  await chrome.runtime.sendMessage({
                    type: 'SYNC_SESSION',
                    payload: { session: null }
                  });
                }
                setIsAuthed(false);
                setVaultItems([]);
                setBookmarks([]);
                setVaultKey(null);
              }}
            >
              <LogOut size={16} color="#EF4444" />
              <div style={s.itemInfo}>
                <div style={{ ...s.itemTitle, color: '#EF4444' }}>Lock & Sign Out</div>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Floating Bottom Navigation Tab Bar */}
      <div style={s.tabBar}>
        {[
          { id: 'vault' as Tab, icon: <Key size={16} />, label: 'Vault' },
          { id: 'generator' as Tab, icon: <Sparkles size={16} />, label: 'Generator' },
          { id: 'security' as Tab, icon: <Shield size={16} />, label: 'Security' },
          { id: 'devices' as Tab, icon: <Laptop size={16} />, label: 'Devices' },
          { id: 'settings' as Tab, icon: <Settings size={16} />, label: 'Settings' },
        ].map((t) => {
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              style={isActive ? s.tabActive : s.tab}
              onClick={() => setTab(t.id)}
            >
              {t.icon}
              {t.label}
            </button>
          );
        })}
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

      {/* Floating Panel detail sheet */}
      {editingItem && (
        <div style={mStyles.overlay}>
          <div style={{ ...mStyles.modal, maxWidth: '340px', background: '#FFFFFF', color: '#1F2228' }}>
            <div style={mStyles.header}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(31,34,40,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden'
                }}>
                  {editForm.domain && getFaviconUrl(editForm.domain) ? (
                    <img src={getFaviconUrl(editForm.domain)} width={20} height={20} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  ) : (
                    <Key size={16} color="#1F2228" />
                  )}
                </div>
                <span style={{ ...mStyles.title, fontSize: '16px', fontWeight: 700, color: '#1F2228' }}>
                  {isEditing ? 'Edit Item' : 'Credentials'}
                </span>
              </div>
              <button style={{ ...mStyles.closeBtn, background: 'rgba(0,0,0,0.06)', color: '#1F2228' }} onClick={() => { setEditingItem(null); setIsEditing(false); }}><X size={18} /></button>
            </div>
            
            <div style={{ ...mStyles.form, marginTop: 8 }}>
              {/* Title Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Title</span>
                <input
                  style={{
                    ...s.authInput,
                    background: isEditing ? 'rgba(0,0,0,0.03)' : 'transparent',
                    border: isEditing ? '1px solid rgba(0,0,0,0.12)' : 'none',
                    padding: isEditing ? '0 12px' : '0 4px',
                    height: isEditing ? 38 : 28,
                    fontSize: '13px',
                    fontWeight: isEditing ? 500 : 600,
                    color: '#1F2228'
                  }}
                  value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  readOnly={!isEditing}
                />
              </div>

              {/* Username Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Username / Email</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    style={{
                      ...s.authInput,
                      background: isEditing ? 'rgba(0,0,0,0.03)' : 'transparent',
                      border: isEditing ? '1px solid rgba(0,0,0,0.12)' : 'none',
                      padding: isEditing ? '0 12px' : '0 4px',
                      paddingRight: isEditing ? 12 : 60,
                      height: isEditing ? 38 : 28,
                      fontSize: '13px',
                      width: '100%',
                      color: '#1F2228'
                    }}
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    readOnly={!isEditing}
                  />
                  {!isEditing && (
                    <button
                      style={{
                        position: 'absolute', right: 4, background: 'rgba(31,34,40,0.06)',
                        border: 'none', borderRadius: '999px', color: '#1F2228', padding: '4px 10px',
                        fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
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
                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Password</span>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                  <input
                    style={{
                      ...s.authInput,
                      background: isEditing ? 'rgba(0,0,0,0.03)' : 'transparent',
                      border: isEditing ? '1px solid rgba(0,0,0,0.12)' : 'none',
                      padding: isEditing ? '0 12px' : '0 4px',
                      paddingRight: isEditing ? 40 : 76,
                      height: isEditing ? 38 : 28,
                      fontSize: '13px',
                      fontFamily: (!isEditing && !isPasswordVisible) ? 'monospace' : 'inherit',
                      width: '100%',
                      color: '#1F2228'
                    }}
                    type={(isEditing || isPasswordVisible) ? 'text' : 'password'}
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    readOnly={!isEditing}
                  />
                  <div style={{ position: 'absolute', right: 4, display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <button
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                        color: '#6B7280', display: 'flex', borderRadius: 4
                      }}
                      onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                    >
                      {isPasswordVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    {!isEditing && (
                      <button
                        style={{
                          background: 'rgba(31,34,40,0.06)',
                          border: 'none', borderRadius: '999px', color: '#1F2228', padding: '4px 10px',
                          fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit'
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
                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Domain</span>
                <input
                  style={{
                    ...s.authInput,
                    background: isEditing ? 'rgba(0,0,0,0.03)' : 'transparent',
                    border: isEditing ? '1px solid rgba(0,0,0,0.12)' : 'none',
                    padding: isEditing ? '0 12px' : '0 4px',
                    height: isEditing ? 38 : 28,
                    fontSize: '13px',
                    color: '#1F2228'
                  }}
                  value={editForm.domain}
                  onChange={(e) => setEditForm({ ...editForm, domain: e.target.value })}
                  readOnly={!isEditing}
                />
              </div>

              {/* Notes Field */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</span>
                <textarea
                  style={{
                    ...s.authInput,
                    background: isEditing ? 'rgba(0,0,0,0.03)' : 'transparent',
                    border: isEditing ? '1px solid rgba(0,0,0,0.12)' : 'none',
                    padding: isEditing ? '8px 12px' : '4px 4px',
                    height: isEditing ? 70 : 'auto',
                    minHeight: isEditing ? 70 : 28,
                    fontSize: '13px',
                    color: '#1F2228',
                    resize: isEditing ? 'vertical' : 'none'
                  }}
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  readOnly={!isEditing}
                  rows={isEditing ? 3 : 1}
                  placeholder={isEditing ? "Add notes..." : "No notes"}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ ...mStyles.buttons, marginTop: 14 }}>
                {!isEditing ? (
                  <>
                    <button
                      type="button"
                      style={mStyles.cancelBtn}
                      onClick={() => { setEditingItem(null); setIsEditing(false); }}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      style={{
                        ...mStyles.saveBtn,
                        display: 'flex', alignItems: 'center', gap: '6px'
                      }}
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit3 size={14} /> Edit
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      style={mStyles.cancelBtn}
                      onClick={() => setIsEditing(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      style={mStyles.saveBtn}
                      onClick={handleEditSave}
                      disabled={loading}
                    >
                      {loading ? 'Saving...' : 'Save'}
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
