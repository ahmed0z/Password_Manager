'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Plus, Search, Key, Star, Copy, Eye, EyeOff, Check,
  ExternalLink, Trash2, Edit3, Loader2, FolderPlus, FolderClosed,
} from 'lucide-react';
import {
  getVaultItems, deleteVaultItem, toggleFavorite,
  createVaultItem, updateVaultItem, getFolders, createFolder,
  type DecryptedVaultItem, type VaultItem, type DecryptedFolder, base64ToUint8Array
} from '@vaultsync/core';
import FoldersPanel from '../../_components/FoldersPanel';

function VaultContent() {
  const searchParams = useSearchParams();
  const selectedFolderId = searchParams.get('folder');

  const [items, setItems] = useState<Array<VaultItem & { decrypted: DecryptedVaultItem }>>([]);
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  const getVaultKey = useCallback(async (): Promise<Uint8Array | null> => {
    const keyBase64 = localStorage.getItem('vaultsync-vault-key');
    if (!keyBase64) return null;
    return base64ToUint8Array(keyBase64);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) return;

      const [vaultItems, userFolders] = await Promise.all([
        getVaultItems(vaultKey),
        getFolders(vaultKey),
      ]);

      setItems(vaultItems);
      setFolders(userFolders);
    } catch (err) {
      console.error('Failed to load vault data:', err);
    } finally {
      setLoading(false);
    }
  }, [getVaultKey]);

  useEffect(() => {
    loadData();

    // Listen to custom reload events from the sidebar
    window.addEventListener('vault-data-changed', loadData);
    return () => {
      window.removeEventListener('vault-data-changed', loadData);
    };
  }, [loadData]);

  // Persist sidebar width via cookies on resizing completed
  useEffect(() => {
    const handleMouseUp = () => {
      const el = document.querySelector('.page-sidebar-panel');
      if (el) {
        const width = el.getBoundingClientRect().width;
        const widthStr = `${width}px`;
        document.cookie = `vaultsync-sidebar-width=${widthStr}; path=/; max-age=31536000; SameSite=Lax`;
        document.documentElement.style.setProperty('--sidebar-width', widthStr);
      }
    };
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const filteredItems = items.filter((item) => {
    if (selectedFolderId && item.folder_id !== selectedFolderId) return false;

    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const d = item.decrypted;
    return (
      d.title.toLowerCase().includes(q) ||
      d.username.toLowerCase().includes(q) ||
      d.url.toLowerCase().includes(q) ||
      (item.domain && item.domain.includes(q))
    );
  });

  const favorites = filteredItems.filter((i) => i.is_favorite);
  const regular = filteredItems.filter((i) => !i.is_favorite);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleToggleFavorite = async (id: string, current: boolean) => {
    await toggleFavorite(id, !current);
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, is_favorite: !current } : i))
    );
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this password?')) return;
    await deleteVaultItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const togglePasswordReveal = (id: string) => {
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div>
        <div className="dashboard-header">
          <div className="vs-skeleton" style={{ width: 180, height: 32 }} />
          <div className="vs-skeleton" style={{ width: 120, height: 36 }} />
        </div>
        <div className="vault-grid">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="vs-card-static vault-card">
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <div className="vs-skeleton" style={{ width: 40, height: 40, borderRadius: 'var(--radius-md)' }} />
                <div>
                  <div className="vs-skeleton" style={{ width: 120, height: 16, marginBottom: 6 }} />
                  <div className="vs-skeleton" style={{ width: 80, height: 12 }} />
                </div>
              </div>
              <div className="vs-skeleton" style={{ width: '100%', height: 14, marginTop: 'var(--space-3)' }} />
              <div className="vs-skeleton" style={{ width: '70%', height: 14 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const selectedFolder = folders.find((f) => f.id === selectedFolderId);
  const subtitle = selectedFolder
    ? `Folder: ${selectedFolder.name}`
    : `${items.length} ${items.length === 1 ? 'item' : 'items'} stored securely`;

  return (
    <div className="page-layout-container">
      <aside className="page-sidebar-panel">
        <FoldersPanel pathname="/vault" />
      </aside>

      {/* Main Panel */}
      <div className="page-main-panel">
        {/* Header */}
        <div className="dashboard-header">
          <div>
            <h1 className="dashboard-title">Vault</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              {subtitle}
            </p>
          </div>
          <div className="dashboard-actions">
            <button className="vs-btn vs-btn-primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} />
              Add Password
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="search-container" style={{ marginBottom: 'var(--space-6)', maxWidth: 400 }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            className="vs-input search-input"
            placeholder="Search vault items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            id="vault-search"
          />
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div style={{ marginBottom: 'var(--space-8)' }}>
            <h2 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-4)' }}>
              ★ Favorites
            </h2>
            <div className="vault-grid">
              {favorites.map((item) => (
                <VaultCard
                  key={item.id}
                  item={item}
                  isRevealed={revealedPasswords.has(item.id)}
                  isCopied={copiedId === item.id}
                  onToggleReveal={() => togglePasswordReveal(item.id)}
                  onCopy={(text) => handleCopy(text, item.id)}
                  onToggleFavorite={() => handleToggleFavorite(item.id, item.is_favorite)}
                  onDelete={() => handleDelete(item.id)}
                  onEdit={() => setEditingItem(item)}
                />
              ))}
            </div>
          </div>
        )}

        {/* All Items */}
        {regular.length > 0 ? (
          <div className="vault-grid">
            {regular.map((item) => (
              <VaultCard
                key={item.id}
                item={item}
                isRevealed={revealedPasswords.has(item.id)}
                isCopied={copiedId === item.id}
                onToggleReveal={() => togglePasswordReveal(item.id)}
                onCopy={(text) => handleCopy(text, item.id)}
                onToggleFavorite={() => handleToggleFavorite(item.id, item.is_favorite)}
                onDelete={() => handleDelete(item.id)}
                onEdit={() => setEditingItem(item)}
              />
            ))}
          </div>
        ) : (
          items.length === 0 && (
            <div className="empty-state">
              <Key size={64} className="empty-state-icon" />
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                Your vault is empty
              </h2>
              <p style={{ maxWidth: 400, marginBottom: 'var(--space-6)' }}>
                Start adding passwords to your encrypted vault. They&apos;ll sync across all your devices.
              </p>
              <button className="vs-btn vs-btn-primary" onClick={() => setShowAddModal(true)}>
                <Plus size={16} />
                Add Your First Password
              </button>
            </div>
          )
        )}

        {/* Add Password Modal */}
        {showAddModal && (
          <AddPasswordModal
            folders={folders}
            onClose={() => setShowAddModal(false)}
            onAdded={() => {
              setShowAddModal(false);
              loadData();
            }}
            getVaultKey={getVaultKey}
          />
        )}

        {/* Password Detail Modal */}
        {editingItem && (
          <PasswordDetailModal
            item={editingItem}
            folders={folders}
            onClose={() => setEditingItem(null)}
            onUpdated={() => {
              setEditingItem(null);
              loadData();
            }}
            getVaultKey={getVaultKey}
            onDelete={handleDelete}
          />
        )}

        {/* Add Folder Modal */}
        {showFolderModal && (
          <AddFolderModal
            onClose={() => setShowFolderModal(false)}
            onAdded={() => {
              setShowFolderModal(false);
              loadData();
            }}
            getVaultKey={getVaultKey}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vault Card Component
// ---------------------------------------------------------------------------

function VaultCard({
  item,
  isRevealed,
  isCopied,
  onToggleReveal,
  onCopy,
  onToggleFavorite,
  onDelete,
  onEdit,
}: {
  item: VaultItem & { decrypted: DecryptedVaultItem };
  isRevealed: boolean;
  isCopied: boolean;
  onToggleReveal: () => void;
  onCopy: (text: string) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="vs-card vault-card" style={{ animation: 'fadeInUp 0.3s var(--ease-out-expo)', cursor: 'pointer' }} onClick={onEdit}>
      {/* Header */}
      <div className="vault-card-header">
        <div className="vault-card-favicon">
          {item.favicon_url ? (
            <img src={item.favicon_url} alt="" width={24} height={24} />
          ) : (
            <Key size={20} style={{ color: 'var(--text-tertiary)' }} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.decrypted.title}
          </div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.domain || item.decrypted.url}
          </div>
        </div>
        <button
          className="vs-btn vs-btn-ghost"
          style={{ padding: 4, color: item.is_favorite ? 'var(--warning)' : 'var(--text-tertiary)' }}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }}
          title={item.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={16} fill={item.is_favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Username */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Username
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            {item.decrypted.username}
          </div>
        </div>
        <button
          className="vs-btn vs-btn-ghost"
          style={{ padding: 4 }}
          onClick={(e) => { e.stopPropagation(); onCopy(item.decrypted.username); }}
          title="Copy username"
        >
          <Copy size={14} />
        </button>
      </div>

      {/* Password */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Password
          </div>
          <div
            className={`vs-password-reveal ${!isRevealed ? 'blurred' : ''}`}
            style={{
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              letterSpacing: '0.05em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {isRevealed ? item.decrypted.password : '••••••••••••••••'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
          <button
            className="vs-btn vs-btn-ghost"
            style={{ padding: 4 }}
            onClick={(e) => { e.stopPropagation(); onToggleReveal(); }}
            title={isRevealed ? 'Hide password' : 'Reveal password'}
          >
            {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          <button
            className="vs-btn vs-btn-ghost"
            style={{ padding: 4, color: isCopied ? 'var(--success)' : undefined }}
            onClick={(e) => { e.stopPropagation(); onCopy(item.decrypted.password); }}
            title="Copy password"
          >
            <Copy size={14} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="vs-divider" />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        {item.decrypted.url && (
          <a
            href={item.decrypted.url.startsWith('http') ? item.decrypted.url : `https://${item.decrypted.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="vs-btn vs-btn-ghost"
            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink size={14} />
            Visit
          </a>
        )}
        <div style={{ display: 'flex', gap: 'var(--space-1)', marginLeft: 'auto' }}>
          <button className="vs-btn vs-btn-ghost" style={{ padding: 4 }} title="Edit" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Edit3 size={14} />
          </button>
          <button className="vs-btn vs-btn-danger" style={{ padding: 4 }} onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Password Detail Modal (Preview & Edit)
// ---------------------------------------------------------------------------

function PasswordDetailModal({
  item,
  folders,
  onClose,
  onUpdated,
  getVaultKey,
  onDelete,
}: {
  item: VaultItem & { decrypted: DecryptedVaultItem };
  folders: DecryptedFolder[];
  onClose: () => void;
  onUpdated: () => void;
  getVaultKey: () => Promise<Uint8Array | null>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [passwordRevealed, setPasswordRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null);

  // Edit form state
  const [title, setTitle] = useState(item.decrypted.title || '');
  const [username, setUsername] = useState(item.decrypted.username || '');
  const [password, setPassword] = useState(item.decrypted.password || '');
  const [url, setUrl] = useState(item.decrypted.url || '');
  const [notes, setNotes] = useState(item.decrypted.notes || '');
  const [folderId, setFolderId] = useState(item.folder_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCopy = async (text: string, field: 'username' | 'password') => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) throw new Error('Vault key not found. Please sign in again.');

      await updateVaultItem(
        item.id,
        { title, username, password, url, notes, folderId: folderId || undefined },
        item.decrypted,
        vaultKey
      );
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password.');
    } finally {
      setLoading(false);
    }
  };

  const selectedFolder = folders.find((f) => f.id === (mode === 'edit' ? folderId : item.folder_id));
  const folderName = selectedFolder?.name;

  if (mode === 'preview') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420, padding: 0 }}>
          {/* Header */}
          <div style={{ padding: 'var(--space-6)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', borderBottom: '1px solid var(--surface-border)' }}>
            <div className="vault-card-favicon" style={{ width: 48, height: 48, borderRadius: 'var(--radius-md)', flexShrink: 0 }}>
              {item.favicon_url ? (
                <img src={item.favicon_url} alt="" width={32} height={32} />
              ) : (
                <Key size={24} style={{ color: 'var(--text-tertiary)' }} />
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: 0 }}>
                {item.decrypted.title}
              </h2>
              {item.decrypted.url && (
                <a
                  href={item.decrypted.url.startsWith('http') ? item.decrypted.url : `https://${item.decrypted.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.8125rem', color: 'var(--accent-text)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', width: 'fit-content', marginTop: 2 }}
                >
                  <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {item.domain || item.decrypted.url}
                  </span>
                  <ExternalLink size={12} style={{ flexShrink: 0 }} />
                </a>
              )}
            </div>
          </div>

          {/* Details Body */}
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            {/* Username / Email */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Username / Email
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.decrypted.username}
                </div>
              </div>
              <button
                className="vs-btn vs-btn-ghost"
                style={{ padding: 6, color: 'var(--text-secondary)' }}
                onClick={() => handleCopy(item.decrypted.username, 'username')}
                title="Copy username"
              >
                {copiedField === 'username' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
              </button>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Password
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono), monospace',
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    marginTop: 4,
                    letterSpacing: passwordRevealed ? '0.05em' : '0.15em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {passwordRevealed ? item.decrypted.password : '••••••••••••'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  className="vs-btn vs-btn-ghost"
                  style={{ padding: 6, color: 'var(--text-secondary)' }}
                  onClick={() => setPasswordRevealed(!passwordRevealed)}
                  title={passwordRevealed ? 'Hide password' : 'Reveal password'}
                >
                  {passwordRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  className="vs-btn vs-btn-ghost"
                  style={{ padding: 6, color: 'var(--text-secondary)' }}
                  onClick={() => handleCopy(item.decrypted.password, 'password')}
                  title="Copy password"
                >
                  {copiedField === 'password' ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* Folder */}
            {folderName && (
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Folder
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FolderClosed size={14} style={{ color: 'var(--text-tertiary)' }} />
                  <span>{folderName}</span>
                </div>
              </div>
            )}

            {/* Notes */}
            {item.decrypted.notes && (
              <div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
                  Notes
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', whiteSpace: 'pre-wrap', maxHeight: '100px', overflowY: 'auto' }}>
                  {item.decrypted.notes}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <div style={{ padding: 'var(--space-4) var(--space-6)', borderTop: '1px solid var(--surface-border)', display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', background: 'var(--bg-secondary)', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)' }}>
            <button 
              type="button" 
              className="vs-btn vs-btn-danger" 
              style={{ marginRight: 'auto', padding: '6px 12px', fontSize: '0.8125rem' }} 
              onClick={() => { onDelete(item.id); onClose(); }}
            >
              <Trash2 size={14} />
              <span>Delete</span>
            </button>
            <button type="button" className="vs-btn vs-btn-secondary" onClick={onClose} style={{ padding: '6px 12px', fontSize: '0.8125rem' }}>
              Close
            </button>
            <button type="button" className="vs-btn vs-btn-primary" onClick={() => setMode('edit')} style={{ padding: '6px 16px', fontSize: '0.8125rem' }}>
              <Edit3 size={14} />
              <span>Edit Details</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-6)' }}>
          Edit Password Details
        </h2>

        <form onSubmit={handleEditSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-title">Title</label>
            <input id="edit-title" className="vs-input" placeholder="e.g., Gmail, Netflix" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-url">Website URL</label>
            <input id="edit-url" className="vs-input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-username">Username / Email</label>
            <input id="edit-username" className="vs-input" placeholder="your@email.com" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-password">Password</label>
            <input id="edit-password" type="text" className="vs-input" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {folders.length > 0 && (
            <div className="form-group">
              <label className="form-label" htmlFor="edit-folder">Folder (optional)</label>
              <select id="edit-folder" className="vs-input" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                <option value="">No folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="edit-notes">Notes (optional)</label>
            <textarea id="edit-notes" className="vs-input" rows={3} placeholder="Any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button type="button" className="vs-btn vs-btn-secondary" onClick={() => setMode('preview')}>Cancel</button>
            <button type="submit" className="vs-btn vs-btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : <><Edit3 size={16} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Password Modal
// ---------------------------------------------------------------------------

function AddPasswordModal({
  folders,
  onClose,
  onAdded,
  getVaultKey,
}: {
  folders: DecryptedFolder[];
  onClose: () => void;
  onAdded: () => void;
  getVaultKey: () => Promise<Uint8Array | null>;
}) {
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [folderId, setFolderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) throw new Error('Vault key not found. Please sign in again.');

      await createVaultItem(
        { title, username, password, url, notes, folderId: folderId || undefined },
        vaultKey
      );
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-6)' }}>
          Add New Password
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="add-title">Title</label>
            <input id="add-title" className="vs-input" placeholder="e.g., Gmail, Netflix" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-url">Website URL</label>
            <input id="add-url" className="vs-input" placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-username">Username / Email</label>
            <input id="add-username" className="vs-input" placeholder="your@email.com" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-password">Password</label>
            <input id="add-password" type="password" className="vs-input vs-input-password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {folders.length > 0 && (
            <div className="form-group">
              <label className="form-label" htmlFor="add-folder">Folder (optional)</label>
              <select id="add-folder" className="vs-input" value={folderId} onChange={(e) => setFolderId(e.target.value)}>
                <option value="">No folder</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="add-notes">Notes (optional)</label>
            <textarea id="add-notes" className="vs-input" rows={3} placeholder="Any additional notes..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ resize: 'vertical' }} />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button type="button" className="vs-btn vs-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="vs-btn vs-btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Encrypting...</> : <><Plus size={16} /> Add to Vault</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Folder Modal
// ---------------------------------------------------------------------------

function AddFolderModal({
  onClose,
  onAdded,
  getVaultKey,
}: {
  onClose: () => void;
  onAdded: () => void;
  getVaultKey: () => Promise<Uint8Array | null>;
}) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) throw new Error('Vault key not found.');
      await createFolder(name, vaultKey);
      onAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
          New Folder
        </h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="folder-name">Folder Name</label>
            <input id="folder-name" className="vs-input" placeholder="e.g., Work, Personal" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
            <button type="button" className="vs-btn vs-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="vs-btn vs-btn-primary" disabled={loading}>
              {loading ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function VaultPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <VaultContent />
    </Suspense>
  );
}
