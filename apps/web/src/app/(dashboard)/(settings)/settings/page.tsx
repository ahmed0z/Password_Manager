'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, Sun, Moon, Monitor, Shield, Download, Upload, Trash2,
  ChevronRight, Key, Bookmark, Clock, AlertTriangle, RefreshCw,
  FileText, Check, Loader2,
} from 'lucide-react';
import { useTheme } from '@/components/ThemeProvider';
import {
  getVaultItems, getBookmarks, deleteVaultItem, clearAllBookmarks,
  type VaultItem, type DecryptedVaultItem, type Bookmark as BookmarkType,
  type DecryptedBookmark, base64ToUint8Array,
} from '@vaultsync/core';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [vaultCount, setVaultCount] = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [autoLockMinutes, setAutoLockMinutes] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('vaultsync-autolock') || '30', 10);
    }
    return 30;
  });

  const getVaultKey = useCallback(async (): Promise<Uint8Array | null> => {
    const keyBase64 = localStorage.getItem('vaultsync-vault-key');
    if (!keyBase64) return null;
    return base64ToUint8Array(keyBase64);
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const vaultKey = await getVaultKey();
        if (!vaultKey) return;
        const [items, bmarks] = await Promise.all([
          getVaultItems(vaultKey),
          getBookmarks(vaultKey),
        ]);
        setVaultCount(items.length);
        setBookmarkCount(bmarks.length);
      } catch { /* ignore */ }
    };
    loadCounts();
  }, [getVaultKey]);

  const handleAutoLockChange = (minutes: number) => {
    setAutoLockMinutes(minutes);
    localStorage.setItem('vaultsync-autolock', String(minutes));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) throw new Error('Vault key not found. Please sign in again.');

      const [items, bmarks] = await Promise.all([
        getVaultItems(vaultKey),
        getBookmarks(vaultKey),
      ]);

      const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        vaultItems: items.map(item => ({
          title: item.decrypted.title,
          username: item.decrypted.username,
          password: item.decrypted.password,
          url: item.decrypted.url,
          notes: item.decrypted.notes || '',
          domain: item.domain,
          isFavorite: item.is_favorite,
        })),
        bookmarks: bmarks.map(b => ({
          title: b.decrypted.title,
          url: b.decrypted.url,
          folderPath: b.decrypted.folderPath || '',
        })),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vaultsync-export-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult('');

    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) throw new Error('Vault key not found.');

      const text = await importFile.text();
      let imported: { title: string; username: string; password: string; url: string; notes?: string }[] = [];

      if (importFile.name.endsWith('.csv')) {
        // Parse CSV (Chrome/Firefox/1Password/LastPass format)
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length < 2) throw new Error('CSV file is empty.');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));

        // Detect column positions
        const nameIdx = headers.findIndex(h => /name|title|entry/.test(h));
        const urlIdx = headers.findIndex(h => /url|website|hostname/.test(h));
        const userIdx = headers.findIndex(h => /user|login|email/.test(h));
        const passIdx = headers.findIndex(h => /pass/.test(h));
        const notesIdx = headers.findIndex(h => /note|comment|extra/.test(h));

        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (cols.length <= Math.max(userIdx, passIdx)) continue;
          imported.push({
            title: cols[nameIdx] || cols[urlIdx] || 'Imported',
            username: cols[userIdx] || '',
            password: cols[passIdx] || '',
            url: cols[urlIdx] || '',
            notes: notesIdx >= 0 ? cols[notesIdx] : '',
          });
        }
      } else if (importFile.name.endsWith('.json')) {
        const json = JSON.parse(text);
        // VaultSync format
        if (json.vaultItems) {
          imported = json.vaultItems;
        } else if (Array.isArray(json)) {
          imported = json;
        }
      }

      if (imported.length === 0) throw new Error('No valid entries found in file.');

      // Import each item
      const { createVaultItem } = await import('@vaultsync/core');
      let success = 0;
      for (const item of imported) {
        try {
          await createVaultItem({
            title: item.title,
            username: item.username,
            password: item.password,
            url: item.url,
            notes: item.notes,
          }, vaultKey);
          success++;
        } catch { /* skip duplicates or errors */ }
      }

      setImportResult(`Successfully imported ${success} of ${imported.length} passwords.`);
      setVaultCount(prev => prev + success);
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setImporting(false);
      setImportFile(null);
    }
  };

  const handleDeleteAll = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      const vaultKey = await getVaultKey();
      if (!vaultKey) throw new Error('Vault key not found.');

      const items = await getVaultItems(vaultKey);
      for (const item of items) {
        await deleteVaultItem(item.id);
      }
      await clearAllBookmarks();

      setVaultCount(0);
      setBookmarkCount(0);
      setDeleteConfirm('');
      setShowDangerZone(false);
      alert('All vault data has been permanently deleted.');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  };

  const themeOptions = [
    { value: 'dark' as const, icon: <Moon size={18} />, label: 'Dark', description: 'Easy on the eyes' },
    { value: 'light' as const, icon: <Sun size={18} />, label: 'Light', description: 'Classic brightness' },
    { value: 'system' as const, icon: <Monitor size={18} />, label: 'System', description: 'Match your device' },
  ];

  const autoLockOptions = [
    { value: 5, label: '5 minutes' },
    { value: 15, label: '15 minutes' },
    { value: 30, label: '30 minutes' },
    { value: 60, label: '1 hour' },
    { value: 0, label: 'Never' },
  ];

  return (
    <div>
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Settings</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Manage your vault preferences
          </p>
        </div>
      </div>

      <div style={{ maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {/* Vault Stats */}
        <div className="vs-card-static" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Vault Overview
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-text)' }}>{vaultCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Key size={12} /> Passwords
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent-text)' }}>{bookmarkCount}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Bookmark size={12} /> Bookmarks
              </div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-4)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--success)' }}>256</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 500, marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Shield size={12} /> AES Bits
              </div>
            </div>
          </div>
        </div>

        {/* Theme */}
        <div className="vs-card-static" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Appearance
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-3)' }}>
            {themeOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 'var(--space-2)', padding: 'var(--space-4)',
                  background: theme === opt.value ? 'var(--accent-soft)' : 'var(--bg-secondary)',
                  border: `2px solid ${theme === opt.value ? 'var(--accent-primary)' : 'var(--surface-border)'}`,
                  borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                  transition: 'all var(--transition-normal) ease',
                  color: theme === opt.value ? 'var(--accent-text)' : 'var(--text-secondary)',
                  fontFamily: 'inherit',
                }}
              >
                {opt.icon}
                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{opt.label}</span>
                <span style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>{opt.description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Auto-Lock */}
        <div className="vs-card-static" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            Auto-Lock
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
            Automatically lock the vault after a period of inactivity
          </p>
          <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            {autoLockOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleAutoLockChange(opt.value)}
                className={`vs-btn ${autoLockMinutes === opt.value ? 'vs-btn-primary' : 'vs-btn-secondary'}`}
                style={{ fontSize: '0.8125rem' }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Security */}
        <div className="vs-card-static" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Security
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            {[
              { label: 'Encryption', sub: 'AES-256-GCM with PBKDF2 (600K iterations)', badge: 'Active', color: 'var(--success)' },
              { label: 'Zero-Knowledge Architecture', sub: 'Server never sees your plaintext data', badge: 'Enforced', color: 'var(--success)' },
              { label: 'Recovery Key', sub: 'Email-based vault recovery enabled', badge: 'Set Up', color: 'var(--info)' },
              { label: 'Cross-Platform Sync', sub: 'Automatic 15-second refresh interval', badge: 'Active', color: 'var(--success)' },
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: 'var(--space-3) var(--space-4)', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.875rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{item.sub}</div>
                </div>
                <span className="vs-badge" style={{ background: `color-mix(in srgb, ${item.color} 15%, transparent)`, color: item.color }}>
                  {item.badge}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Data Management */}
        <div className="vs-card-static" style={{ padding: 'var(--space-6)' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 'var(--space-4)' }}>
            Data Management
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <button
              className="vs-btn vs-btn-secondary"
              style={{ justifyContent: 'flex-start' }}
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
              {exporting ? 'Exporting...' : 'Export Vault (JSON)'}
              <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
            </button>

            <div>
              <label
                className="vs-btn vs-btn-secondary"
                style={{ justifyContent: 'flex-start', cursor: 'pointer', width: '100%' }}
              >
                <Upload size={16} />
                Import Passwords (CSV/JSON)
                <ChevronRight size={14} style={{ marginLeft: 'auto' }} />
                <input
                  type="file"
                  accept=".csv,.json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setImportFile(e.target.files[0]);
                      setImportResult('');
                    }
                  }}
                />
              </label>
              {importFile && (
                <div style={{ marginTop: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)' }}>
                      <FileText size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />
                      {importFile.name}
                    </div>
                  </div>
                  <button
                    className="vs-btn vs-btn-primary"
                    style={{ fontSize: '0.8125rem' }}
                    onClick={handleImport}
                    disabled={importing}
                  >
                    {importing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Upload size={14} />}
                    {importing ? 'Importing...' : 'Import'}
                  </button>
                </div>
              )}
              {importResult && (
                <p style={{ fontSize: '0.8125rem', color: importResult.startsWith('Success') ? 'var(--success)' : 'var(--danger)', marginTop: 'var(--space-2)' }}>
                  {importResult}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="vs-card-static" style={{ padding: 'var(--space-6)', border: '1px solid var(--danger-soft)' }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', color: 'var(--danger)', fontWeight: 600, fontSize: '1rem',
            }}
            onClick={() => setShowDangerZone(!showDangerZone)}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <AlertTriangle size={18} />
              Danger Zone
            </span>
            <ChevronRight size={16} style={{ transform: showDangerZone ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>
          {showDangerZone && (
            <div style={{ marginTop: 'var(--space-4)', animation: 'fadeInDown 0.2s ease' }}>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-4)' }}>
                This will permanently delete all {vaultCount} passwords and {bookmarkCount} bookmarks.
                Type <strong style={{ color: 'var(--danger)' }}>DELETE</strong> to confirm.
              </p>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <input
                  className="vs-input"
                  placeholder='Type "DELETE" to confirm'
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="vs-btn vs-btn-danger"
                  onClick={handleDeleteAll}
                  disabled={deleteConfirm !== 'DELETE' || deleting}
                >
                  {deleting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
                  {deleting ? 'Deleting...' : 'Delete All'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- CSV Parser Helper ----
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}
