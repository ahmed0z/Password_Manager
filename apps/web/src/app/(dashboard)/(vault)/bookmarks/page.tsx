'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Bookmark, ExternalLink, Trash2, Search, RefreshCw, Grid, List, Edit, Loader2 } from 'lucide-react';
import { getBookmarks, deleteBookmark, updateBookmark, type Bookmark as BookmarkType, type DecryptedBookmark, base64ToUint8Array } from '@vaultsync/core';

function BookmarksContent() {
  const searchParams = useSearchParams();
  const selectedFolderPath = searchParams.get('folder');

  const [bookmarks, setBookmarks] = useState<Array<BookmarkType & { decrypted: DecryptedBookmark }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [editingBookmark, setEditingBookmark] = useState<(BookmarkType & { decrypted: DecryptedBookmark }) | null>(null);

  const getVaultKey = useCallback(async (): Promise<Uint8Array | null> => {
    const keyBase64 = localStorage.getItem('vaultsync-vault-key');
    if (!keyBase64) return null;
    return base64ToUint8Array(keyBase64);
  }, []);

  const loadBookmarks = useCallback(async () => {
    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) return;
      const data = await getBookmarks(vaultKey);
      setBookmarks(data);
    } catch (err) {
      console.error('Failed to load bookmarks:', err);
    } finally {
      setLoading(false);
    }
  }, [getVaultKey]);

  useEffect(() => {
    loadBookmarks();

    // Listen to custom reload events from sidebar actions
    window.addEventListener('bookmarks-data-changed', loadBookmarks);
    return () => {
      window.removeEventListener('bookmarks-data-changed', loadBookmarks);
    };
  }, [loadBookmarks]);

  const filtered = bookmarks.filter((b) => {
    if (selectedFolderPath) {
      const path = b.decrypted.folderPath || '';
      if (path !== selectedFolderPath && !path.startsWith(selectedFolderPath + '/')) {
        return false;
      }
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return b.decrypted.title.toLowerCase().includes(q) || b.decrypted.url.toLowerCase().includes(q);
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bookmark?')) return;
    await deleteBookmark(id);
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const startEditing = (b: BookmarkType & { decrypted: DecryptedBookmark }) => {
    setEditingBookmark(b);
  };

  // Group by folder path
  const grouped = new Map<string, typeof filtered>();
  filtered.forEach((b) => {
    const key = b.decrypted.folderPath || 'Ungrouped';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(b);
  });

  const subtitle = selectedFolderPath ? `Folder: ${selectedFolderPath}` : `${bookmarks.length} synced bookmarks`;

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Bookmarks</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {subtitle}
          </p>
        </div>
        <div className="dashboard-actions">
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: 2 }}>
            <button
              className="vs-btn vs-btn-ghost"
              style={{ padding: '4px 8px', background: viewMode === 'grid' ? 'var(--bg-elevated)' : 'transparent', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={14} />
            </button>
            <button
              className="vs-btn vs-btn-ghost"
              style={{ padding: '4px 8px', background: viewMode === 'list' ? 'var(--bg-elevated)' : 'transparent', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setViewMode('list')}
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>

      <div className="search-container" style={{ marginBottom: 'var(--space-6)', maxWidth: 400 }}>
        <Search size={16} className="search-icon" />
        <input
          type="text"
          className="vs-input search-input"
          placeholder="Search bookmarks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          id="bookmarks-search"
        />
      </div>

      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr', gap: 'var(--space-3)' }}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="vs-card-static" style={{ padding: 'var(--space-4)' }}>
              <div className="vs-skeleton" style={{ width: '80%', height: 16, marginBottom: 8 }} />
              <div className="vs-skeleton" style={{ width: '60%', height: 12 }} />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <Bookmark size={64} className="empty-state-icon" />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            No bookmarks yet
          </h2>
          <p>Use the Chrome extension to sync your browser bookmarks.</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([folderPath, items]) => (
          <div key={folderPath} style={{ marginBottom: 'var(--space-8)' }}>
            <h3 style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 'var(--space-3)' }}>
              {folderPath}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(280px, 1fr))' : '1fr', gap: 'var(--space-3)' }}>
              {items.map((b) => (
                <div key={b.id} className="vs-card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                    {(() => {
                      try {
                        const domain = new URL(b.decrypted.url).hostname;
                        const src = b.decrypted.favicon || `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
                        return <img src={src} alt="" width={20} height={20} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />;
                      } catch {
                        return <Bookmark size={16} style={{ color: 'var(--text-tertiary)' }} />;
                      }
                    })()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.decrypted.title}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.decrypted.url}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <a href={b.decrypted.url} target="_blank" rel="noopener noreferrer" className="vs-btn vs-btn-ghost" style={{ padding: 4 }}>
                      <ExternalLink size={14} />
                    </a>
                    <button className="vs-btn vs-btn-ghost" style={{ padding: 4 }} onClick={() => startEditing(b)} title="Edit">
                      <Edit size={14} />
                    </button>
                    <button className="vs-btn vs-btn-ghost" style={{ padding: 4, color: 'var(--danger)' }} onClick={() => handleDelete(b.id)} title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {editingBookmark && (
        <EditBookmarkModal
          bookmark={editingBookmark}
          onClose={() => setEditingBookmark(null)}
          onSaved={() => {
            setEditingBookmark(null);
            loadBookmarks();
          }}
          getVaultKey={getVaultKey}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Edit Bookmark Modal
// ---------------------------------------------------------------------------

function EditBookmarkModal({
  bookmark,
  onClose,
  onSaved,
  getVaultKey,
}: {
  bookmark: BookmarkType & { decrypted: DecryptedBookmark };
  onClose: () => void;
  onSaved: () => void;
  getVaultKey: () => Promise<Uint8Array | null>;
}) {
  const [title, setTitle] = useState(bookmark.decrypted.title);
  const [url, setUrl] = useState(bookmark.decrypted.url);
  const [folderPath, setFolderPath] = useState(bookmark.decrypted.folderPath || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) throw new Error('Vault key not found. Please sign in again.');

      await updateBookmark(
        bookmark.id,
        {
          title,
          url,
          folderPath: folderPath || undefined,
          favicon: bookmark.decrypted.favicon,
          description: bookmark.decrypted.description,
        },
        vaultKey
      );
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bookmark.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-6)' }}>
          Edit Bookmark
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="edit-title">Title</label>
            <input id="edit-title" className="vs-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-url">URL</label>
            <input id="edit-url" className="vs-input" value={url} onChange={(e) => setUrl(e.target.value)} required />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-folder-path">Folder Path</label>
            <input id="edit-folder-path" className="vs-input" placeholder="e.g., Bookmarks Bar, Work" value={folderPath} onChange={(e) => setFolderPath(e.target.value)} />
          </div>

          {error && <p className="form-error">{error}</p>}

          <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 'var(--space-4)' }}>
            <button type="button" className="vs-btn vs-btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="vs-btn vs-btn-primary" disabled={loading}>
              {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</> : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BookmarksPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 'var(--space-6)', display: 'flex', justifyContent: 'center' }}>
        <Loader2 size={24} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    }>
      <BookmarksContent />
    </Suspense>
  );
}
