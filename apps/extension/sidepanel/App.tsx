import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Shield, Key, Search, Star, Copy, Eye, EyeOff,
  ExternalLink, Bookmark, Plus, RefreshCw, Check,
  Settings, LogOut, ChevronRight, Lock, Loader2, X, Clock
} from 'lucide-react';
import { signIn, getVaultItems, syncBookmarks, createVaultItem, getBookmarks } from '@vaultsync/core';

// Inline styles for the floating side panel
const s = {
  panel: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    background: 'linear-gradient(160deg, #0a0f1e, #111827)',
    fontFamily: "'Inter', -apple-system, sans-serif",
    overflow: 'hidden',
  },
  header: {
    padding: '16px 16px 12px',
    background: 'linear-gradient(135deg, rgba(92,224,214,0.08), rgba(167,139,250,0.05))',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  headerRow: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' },
  logo: {
    width: 28, height: 28, borderRadius: 8,
    background: 'linear-gradient(135deg, #5ce0d6, #a78bfa)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: '15px', fontWeight: 700, color: '#f2f2f2', flex: 1 },
  searchInput: {
    width: '100%', height: 36, padding: '0 12px 0 34px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#f2f2f2', fontSize: '13px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  },
  content: {
    flex: 1, overflow: 'auto', padding: '12px',
    display: 'flex', flexDirection: 'column' as const, gap: '8px',
  },
  itemCard: {
    padding: '12px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    cursor: 'pointer', transition: 'all 0.15s ease',
    display: 'flex', alignItems: 'center', gap: '10px',
  },
  favicon: {
    width: 32, height: 32, borderRadius: 8,
    background: 'rgba(255,255,255,0.06)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, overflow: 'hidden',
  },
  itemInfo: { flex: 1, minWidth: 0 },
  itemTitle: { fontSize: '13px', fontWeight: 600, color: '#f2f2f2', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  itemSub: { fontSize: '11px', color: '#8a8f9e', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis' },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    color: '#8a8f9e', display: 'flex', borderRadius: 6,
  },
  sectionLabel: {
    fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.1em', color: '#4a5068', padding: '8px 4px 4px',
  },
  statsBar: {
    display: 'flex', gap: '6px', padding: '0 16px 12px',
  },
  statPill: {
    flex: 1, padding: '10px', borderRadius: 10,
    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
    textAlign: 'center' as const,
  },
  statNumber: { fontSize: '18px', fontWeight: 800 },
  statLabel: { fontSize: '9px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', color: '#8a8f9e', marginTop: 2 },
  tabBar: {
    display: 'flex', padding: '8px 12px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    background: '#0a0f1e', gap: '4px',
  },
  tab: {
    flex: 1, padding: '8px 0', borderRadius: 8,
    display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '4px',
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: '10px', fontWeight: 600, fontFamily: 'inherit',
  },
  authContainer: {
    flex: 1, display: 'flex', flexDirection: 'column' as const,
    alignItems: 'center', justifyContent: 'center', padding: '24px', gap: '16px',
  },
  authInput: {
    width: '100%', height: 44, padding: '0 14px',
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10, color: '#f2f2f2', fontSize: '14px', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box' as const,
  },
  authBtn: {
    width: '100%', height: 44, borderRadius: 10, border: 'none',
    background: 'linear-gradient(135deg, #5ce0d6, #a78bfa)',
    color: '#0a0f1e', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
    fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  },
};

// Helper: get favicon URL for a domain
function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

type Tab = 'vault' | 'bookmarks' | 'settings';

interface VaultEntry {
  id: string;
  title: string;
  username: string;
  domain: string;
  favicon?: string;
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
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [currentDomain, setCurrentDomain] = useState<string>('');
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isAdding, setIsAdding] = useState(false);
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState<string>('always');
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        .then(async (resp: { session: unknown }) => {
          if (resp?.session) {
            // Check if session has expired based on timeout setting
            const expiryResp = await chrome.runtime.sendMessage({ type: 'CHECK_SESSION_EXPIRED' });
            if (expiryResp?.expired) {
              console.log('[VaultSync] Session timeout expired — prompting re-login');
              await chrome.runtime.sendMessage({ type: 'CLEAR_VAULT_KEY' });
              setIsAuthed(false);
              return;
            }

            const keyData = await chrome.runtime.sendMessage({ type: 'GET_VAULT_KEY' });
            if (keyData?.vaultKey) {
              // Session AND key are present — fully authenticated
              const binary = atob(keyData.vaultKey);
              const bytes = new Uint8Array(binary.length);
              for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
              const key = await crypto.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
              setVaultKey(key);
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
  const loadAllData = useCallback(async (key: CryptoKey) => {
    try {
      const [items, bmarks] = await Promise.all([
        getVaultItems(key),
        getBookmarks(key),
      ]);

      setVaultItems(items.map(i => {
        const domain = i.domain || '';
        return {
          id: i.id,
          title: i.decrypted.title,
          username: i.decrypted.username,
          domain,
          favicon: i.favicon_url || (domain ? getFaviconUrl(domain) : undefined),
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
        };
      }));
    } catch (e) {
      console.error('[VaultSync] Failed to load data:', e);
    }
  }, []);

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

      const exported = await crypto.subtle.exportKey('raw', material.key);
      const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));

      await chrome.runtime.sendMessage({
        type: 'STORE_VAULT_KEY',
        payload: { keyBase64, salt: material.salt }
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

  // -- Search filtering --
  const filteredVaultItems = vaultItems.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.username.toLowerCase().includes(q) || item.domain.toLowerCase().includes(q);
  });

  const filteredBookmarks = bookmarks.filter(b => {
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
        <div style={s.headerRow}>
          <div style={s.logo}>
            <Shield size={14} color="white" />
          </div>
          <span style={s.title}>VaultSync</span>
          <button
            style={{ ...s.iconBtn, color: '#5ce0d6', marginRight: 6 }}
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
        <div style={{ position: 'relative' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: '#4a5068' }} />
          <input
            style={s.searchInput}
            placeholder={tab === 'bookmarks' ? 'Search bookmarks...' : 'Search vault...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div style={s.statsBar}>
        <div style={s.statPill}>
          <div style={{ ...s.statNumber, color: '#5ce0d6' }}>{vaultItems.length || '—'}</div>
          <div style={s.statLabel}>Passwords</div>
        </div>
        <div style={s.statPill}>
          <div style={{ ...s.statNumber, color: '#a78bfa' }}>{bookmarks.length || '—'}</div>
          <div style={s.statLabel}>Bookmarks</div>
        </div>
        <div style={s.statPill}>
          <div style={{ ...s.statNumber, color: '#22c55e' }}>256</div>
          <div style={s.statLabel}>AES Bits</div>
        </div>
      </div>

      {/* Content */}
      <div style={s.content}>
        {tab === 'vault' && (
          <>
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
                        <div key={item.id} style={{ ...s.itemCard, border: '1px solid rgba(92,224,214,0.15)', background: 'rgba(92,224,214,0.04)' }}>
                          <div style={s.favicon}>
                            <img src={getFaviconUrl(currentDomain)} width={20} height={20} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          </div>
                          <div style={s.itemInfo}>
                            <div style={s.itemTitle}>{item.title}</div>
                            <div style={s.itemSub}>{item.username}</div>
                          </div>
                          <button
                            style={{ ...s.iconBtn, color: copiedId === item.id ? '#22c55e' : '#8a8f9e' }}
                            onClick={() => handleCopy(item.username, item.id)}
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
                <div key={item.id} style={s.itemCard}>
                  <div style={s.favicon}>
                    {item.domain ? (
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
                    onClick={() => handleCopy(item.username, item.id)}
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
    </div>
  );
}
