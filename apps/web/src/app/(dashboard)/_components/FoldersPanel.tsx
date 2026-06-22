'use client';
 
import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ChevronDown, FolderClosed, Plus, Edit2, Trash2, FolderPlus, Loader2
} from 'lucide-react';
import {
  getFolders, createFolder, renameFolder, deleteFolder, buildFolderTree,
  getBookmarks, renameBookmarkFolder, deleteBookmarkFolder, buildBookmarkFolderTree,
  type DecryptedFolder, type BookmarkFolderNode, base64ToUint8Array, signOut
} from '@vaultsync/core';
 
interface FoldersPanelProps {
  pathname: string;
}

export default function FoldersPanel({ pathname }: FoldersPanelProps) {
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
  }, [getVaultKey, pathname, router]);

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
      // Trigger update event
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
      await renameBookmarkFolder(bookmarkOldPath, newPath, key);
      
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
      
      await deleteBookmarkFolder(path, key);
      
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
          style={{ paddingLeft: level * 12 + 8 }}
          onClick={() => router.push(`/vault?folder=${folder.id}`)}
        >
          <div 
            style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasChildren ? 'pointer' : 'default', flexShrink: 0 }}
            onClick={(e) => hasChildren && toggleFolder(folder.id, e)}
          >
            {hasChildren ? (
              <ChevronDown size={12} style={{ transform: isExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
            ) : (
              <FolderClosed size={12} style={{ color: isActive ? 'var(--accent-text)' : 'var(--text-tertiary)' }} />
            )}
          </div>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{folder.name}</span>
          <div className="sidebar-folder-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleAddFolderClick(folder.id)}
              title="Add Subfolder"
            >
              <Plus size={10} />
            </button>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleRenameClick(folder.id, folder.name)}
              title="Rename"
            >
              <Edit2 size={10} />
            </button>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleDeleteClick(folder.id)}
              title="Delete"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={10} />
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
          style={{ paddingLeft: level * 12 + 8 }}
          onClick={() => router.push(`/bookmarks?folder=${encodeURIComponent(node.path)}`)}
        >
          <div 
            style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: hasChildren ? 'pointer' : 'default', flexShrink: 0 }}
            onClick={(e) => hasChildren && toggleFolder(node.path, e)}
          >
            {hasChildren ? (
              <ChevronDown size={12} style={{ transform: isExpanded ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
            ) : (
              <FolderClosed size={12} style={{ color: isActive ? 'var(--accent-text)' : 'var(--text-tertiary)' }} />
            )}
          </div>
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginLeft: 4 }}>{node.name}</span>
          <div className="sidebar-folder-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleRenameBookmarkFolderClick(node.path)}
              title="Rename"
            >
              <Edit2 size={10} />
            </button>
            <button
              className="sidebar-folder-action-btn"
              onClick={() => handleDeleteBookmarkFolderClick(node.path)}
              title="Delete"
              style={{ color: 'var(--danger)' }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        </div>
        {hasChildren && isExpanded && node.children!.map(child => renderBookmarkFolder(child, level + 1))}
      </div>
    );
  };

  return (
    <div className="sidebar-folder-section" style={{ marginTop: 0 }}>
      <div 
        className="sidebar-folder-header" 
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', marginBottom: '8px' }}
        onClick={() => setIsMainFoldersCollapsed(!isMainFoldersCollapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
          <ChevronDown size={12} style={{ transform: isMainFoldersCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', color: 'var(--text-tertiary)' }} />
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Folders</span>
        </div>
        <button
          className="sidebar-folder-action-btn"
          onClick={(e) => {
            e.stopPropagation();
            pathname.startsWith('/vault') ? handleAddFolderClick() : handleAddBookmarkFolderClick();
          }}
          title="New Folder"
        >
          <FolderPlus size={12} />
        </button>
      </div>

      {!isMainFoldersCollapsed && (
        <div className="sidebar-folder-card" style={{ border: 'none', background: 'transparent' }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '12px' }}>
              <Loader2 size={16} className="vs-spin" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : pathname.startsWith('/vault') ? (
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
          <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)', padding: '16px 16px 0' }}>
              New Folder
            </h2>
            <form onSubmit={handleAddFolderSubmit} style={{ padding: '12px 16px 16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="folder-name-input-shared">Folder Name</label>
                <input
                  id="folder-name-input-shared"
                  className="vs-input"
                  placeholder="e.g., Work, Personal"
                  value={folderNewName}
                  onChange={(e) => setFolderNewName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 12 }}>
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
          <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)', padding: '16px 16px 0' }}>
              Rename Folder
            </h2>
            <form onSubmit={handleRenameSubmit} style={{ padding: '12px 16px 16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="folder-rename-input-shared">New Name</label>
                <input
                  id="folder-rename-input-shared"
                  className="vs-input"
                  value={folderRenameName}
                  onChange={(e) => setFolderRenameName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 12 }}>
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
          <div className="vs-card-static modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 'var(--space-4)', padding: '16px 16px 0' }}>
              {showBookmarkFolderModal === 'add' ? 'New Bookmark Folder' : 'Rename Bookmark Folder'}
            </h2>
            <form onSubmit={showBookmarkFolderModal === 'add' ? handleAddBookmarkFolderSubmit : handleRenameBookmarkFolderSubmit} style={{ padding: '12px 16px 16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="bookmark-folder-input-shared">
                  {showBookmarkFolderModal === 'add' ? 'Folder Path (e.g. Work/Design)' : 'New Path Name'}
                </label>
                <input
                  id="bookmark-folder-input-shared"
                  className="vs-input"
                  placeholder="e.g. Personal, Work/Code"
                  value={bookmarkNewPath}
                  onChange={(e) => setBookmarkNewPath(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end', marginTop: 12 }}>
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
