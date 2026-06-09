// ============================================================================
// VaultSync — Chrome Extension Service Worker (Background)
// Manages auth state, message routing, credential save/update, bookmark sync,
// and periodic data refresh for cross-platform sync.
// ============================================================================

import { getSupabaseClient } from '@vaultsync/core';

// Initialize Supabase client
const supabase = getSupabaseClient(
  'https://nbzrgenezurnecdmikxl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ienJnZW5lenVybmVjZG1pa3hsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Mjc1NzksImV4cCI6MjA5NjMwMzU3OX0.y1tmfWvIWXaeLbCFJHMJk7fggQhSrCcbXyqWxLWHj1w'
);

// ---- Extension Action Click ----
chrome.action.onClicked.addListener(async (tab: chrome.tabs.Tab) => {
  if (tab.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
});

// ---- Staged Pending Credentials (for Save/Update Toast on Page Navigation) ----
interface PendingCreds {
  username: string;
  password: string;
  domain: string;
  url: string;
  title: string;
  timestamp: number;
}
const pendingCredentialsMap = new Map<number, PendingCreds>();

// ---- Message Handling ----
chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: any) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // Keep message channel open for async response
});

async function handleMessage(
  message: { type: string; payload?: any },
  sender: chrome.runtime.MessageSender
): Promise<unknown> {
  switch (message.type) {
    case 'STAGE_PENDING_CREDENTIALS': {
      const creds = message.payload as Omit<PendingCreds, 'timestamp'>;
      if (sender.tab?.id) {
        pendingCredentialsMap.set(sender.tab.id, {
          ...creds,
          timestamp: Date.now()
        });
        console.log(`[VaultSync SW] Staged pending credentials for tab ${sender.tab.id}`, creds.username);
      }
      return { success: true };
    }

    case 'GET_PENDING_CREDENTIALS': {
      if (sender.tab?.id) {
        const creds = pendingCredentialsMap.get(sender.tab.id);
        if (creds) {
          // If it's less than 3 minutes old, return it
          if (Date.now() - creds.timestamp < 180000) {
            console.log(`[VaultSync SW] Retrieved pending credentials for tab ${sender.tab.id}`, creds.username);
            return { creds };
          } else {
            pendingCredentialsMap.delete(sender.tab.id);
          }
        }
      }
      return { creds: null };
    }

    case 'CLEAR_PENDING_CREDENTIALS': {
      if (sender.tab?.id) {
        pendingCredentialsMap.delete(sender.tab.id);
        console.log(`[VaultSync SW] Cleared pending credentials for tab ${sender.tab.id}`);
      }
      return { success: true };
    }

    case 'GET_CREDENTIALS_FOR_DOMAIN': {
      const { domain } = message.payload as { domain: string };
      return getCredentialsForDomain(domain);
    }

    case 'CHECK_CREDENTIALS_EXIST': {
      const { domain, username, password } = message.payload as { domain: string; username: string; password: string };
      return checkCredentialsExist(domain, username, password);
    }

    case 'SAVE_CREDENTIALS': {
      const creds = message.payload as {
        username: string; password: string; domain: string; url: string; title: string;
      };
      // Clear pending credentials for this tab upon saving
      if (sender.tab?.id) pendingCredentialsMap.delete(sender.tab.id);
      return saveCredentials(creds);
    }

    case 'UPDATE_CREDENTIALS': {
      const creds = message.payload as {
        username: string; password: string; domain: string; url: string; title: string;
      };
      // Clear pending credentials for this tab upon updating
      if (sender.tab?.id) pendingCredentialsMap.delete(sender.tab.id);
      return updateCredentials(creds);
    }

    case 'SYNC_BOOKMARKS': {
      return syncBrowserBookmarks();
    }

    case 'GET_AUTH_STATE': {
      const { data } = await supabase.auth.getSession();
      return { session: data.session };
    }

    case 'STORE_VAULT_KEY': {
      const { keyBase64, salt } = message.payload as { keyBase64: string; salt: string };
      await chrome.storage.session.set({ vaultKey: keyBase64, vaultSalt: salt });
      // Record the login timestamp for session timeout tracking
      await chrome.storage.local.set({ loginTimestamp: Date.now() });
      return { success: true };
    }

    case 'GET_VAULT_KEY': {
      const result = await chrome.storage.session.get(['vaultKey', 'vaultSalt']);
      return result;
    }

    case 'CLEAR_VAULT_KEY': {
      await chrome.storage.session.remove(['vaultKey', 'vaultSalt']);
      await chrome.storage.local.remove(['loginTimestamp']);
      return { success: true };
    }

    case 'SET_SESSION_TIMEOUT': {
      const { timeout } = message.payload as { timeout: string };
      await chrome.storage.local.set({ sessionTimeout: timeout });
      console.log(`[VaultSync] Session timeout set to: ${timeout}`);
      return { success: true };
    }

    case 'GET_SESSION_TIMEOUT': {
      const result = await chrome.storage.local.get(['sessionTimeout']);
      return { timeout: result.sessionTimeout || 'always' };
    }

    case 'CHECK_SESSION_EXPIRED': {
      const expired = await isSessionExpired();
      return { expired };
    }

    case 'OPEN_SIDE_PANEL': {
      if (sender.tab?.id) {
        try {
          await chrome.sidePanel.open({ tabId: sender.tab.id });
        } catch { /* Side panel may already be open */ }
      }
      return { success: true };
    }

    default:
      return { error: 'Unknown message type' };
  }
}

// ---- Domain Credential Lookup (for Autofill) ----
async function getCredentialsForDomain(domain: string) {
  try {
    const { data, error } = await supabase
      .from('vault_items')
      .select('id, encrypted_data, iv, domain, favicon_url')
      .eq('domain', domain);

    if (error || !data) return { items: [] };
    return { items: data };
  } catch {
    return { items: [] };
  }
}

// ---- Check if Credentials Already Exist ----
async function checkCredentialsExist(domain: string, username: string, newPassword: string) {
  try {
    const { data, error } = await supabase
      .from('vault_items')
      .select('id, encrypted_data, iv')
      .eq('domain', domain);

    if (error || !data || data.length === 0) {
      return { exists: false, passwordChanged: false };
    }

    // Decrypt to check username match and password difference
    const keyResult = await chrome.storage.session.get(['vaultKey']);
    if (!keyResult.vaultKey) {
      // Vault is locked — we can't decrypt to compare, but items exist for this domain.
      // Return exists: false so the save toast shows (user can still save).
      return { exists: false, passwordChanged: false };
    }

    const keyBytes = Uint8Array.from(atob(keyResult.vaultKey), (c: string) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );

    for (const item of data) {
      try {
        const ciphertext = Uint8Array.from(atob(item.encrypted_data), (c: string) => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(item.iv), (c: string) => c.charCodeAt(0));
        const decryptedBuffer = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv }, cryptoKey, ciphertext
        );
        const decrypted = JSON.parse(new TextDecoder().decode(decryptedBuffer));

        if (decrypted.username === username) {
          // Found a matching username — compare passwords
          const passwordChanged = decrypted.password !== newPassword;
          return {
            exists: true,
            passwordChanged,
            itemId: item.id,
          };
        }
      } catch {
        // Decryption failed for this item, continue
      }
    }

    return { exists: false, passwordChanged: false };
  } catch {
    return { exists: false, passwordChanged: false };
  }
}

// ---- Save New Credentials ----
async function saveCredentials(creds: {
  username: string; password: string; domain: string; url: string; title: string;
}) {
  try {
    const keyResult = await chrome.storage.session.get(['vaultKey']);
    if (!keyResult.vaultKey) throw new Error('Vault locked');

    const keyBytes = Uint8Array.from(atob(keyResult.vaultKey), (c: string) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const payload = {
      title: creds.title,
      username: creds.username,
      password: creds.password,
      url: creds.url,
      notes: '',
    };

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);

    const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    const { error } = await supabase.from('vault_items').insert({
      user_id: user.id,
      encrypted_data: ciphertextBase64,
      iv: ivBase64,
      domain: creds.domain,
      favicon_url: `https://www.google.com/s2/favicons?domain=${creds.domain}&sz=64`,
      is_favorite: false,
    });

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('[VaultSync] Save credentials failed:', e);
    return { success: false, error: String(e) };
  }
}

// ---- Update Existing Credentials ----
async function updateCredentials(creds: {
  username: string; password: string; domain: string; url: string; title: string;
}) {
  try {
    const keyResult = await chrome.storage.session.get(['vaultKey']);
    if (!keyResult.vaultKey) throw new Error('Vault locked');

    const keyBytes = Uint8Array.from(atob(keyResult.vaultKey), (c: string) => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyBytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
    );

    // Find the existing item for this domain
    const { data: items } = await supabase
      .from('vault_items')
      .select('id, encrypted_data, iv')
      .eq('domain', creds.domain);

    if (!items || items.length === 0) {
      // No existing item, save as new
      return saveCredentials(creds);
    }

    // Find matching username
    let targetId = items[0].id;
    for (const item of items) {
      try {
        const ct = Uint8Array.from(atob(item.encrypted_data), (c: string) => c.charCodeAt(0));
        const existingIv = Uint8Array.from(atob(item.iv), (c: string) => c.charCodeAt(0));
        const buf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: existingIv }, cryptoKey, ct);
        const dec = JSON.parse(new TextDecoder().decode(buf));
        if (dec.username === creds.username) {
          targetId = item.id;
          break;
        }
      } catch { /* continue */ }
    }

    // Re-encrypt with new password
    const payload = {
      title: creds.title,
      username: creds.username,
      password: creds.password,
      url: creds.url,
      notes: '',
    };

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(payload));
    const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, encoded);

    const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    const ivBase64 = btoa(String.fromCharCode(...iv));

    const { error } = await supabase
      .from('vault_items')
      .update({
        encrypted_data: ciphertextBase64,
        iv: ivBase64,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetId);

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('[VaultSync] Update credentials failed:', e);
    return { success: false, error: String(e) };
  }
}

// ---- Bookmark Sync ----
async function syncBrowserBookmarks() {
  try {
    const bookmarkTree = await chrome.bookmarks.getTree();
    const flatBookmarks = flattenBookmarks(bookmarkTree);
    return { bookmarks: flatBookmarks, count: flatBookmarks.length };
  } catch (e) {
    return { error: 'Failed to read bookmarks' };
  }
}

function flattenBookmarks(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  path = ''
): Array<{ title: string; url: string; browserBookmarkId: string; folderPath: string; favicon?: string }> {
  const results: Array<{ title: string; url: string; browserBookmarkId: string; folderPath: string; favicon?: string }> = [];

  for (const node of nodes) {
    const currentPath = path ? `${path}/${node.title}` : node.title;

    if (node.url) {
      let favicon: string | undefined;
      try {
        const domain = new URL(node.url).hostname;
        favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      } catch { /* ignore */ }

      results.push({
        title: node.title,
        url: node.url,
        browserBookmarkId: node.id,
        folderPath: path || 'Root',
        favicon,
      });
    }

    if (node.children) {
      results.push(...flattenBookmarks(node.children, currentPath));
    }
  }

  return results;
}

// ---- Session Timeout Helpers ----
const TIMEOUT_DURATIONS: Record<string, number> = {
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '2d':  2 * 24 * 60 * 60 * 1000,
  'always': 0, // 0 = never expires
};

async function isSessionExpired(): Promise<boolean> {
  const result = await chrome.storage.local.get(['sessionTimeout', 'loginTimestamp']);
  const timeout = result.sessionTimeout || 'always';
  if (timeout === 'always') return false;

  const loginTimestamp = result.loginTimestamp;
  if (!loginTimestamp) return true; // No timestamp recorded — treat as expired

  const durationMs = TIMEOUT_DURATIONS[timeout] || 0;
  if (durationMs === 0) return false;

  return Date.now() - loginTimestamp > durationMs;
}

// ---- Periodic Data Refresh (15-second sync alarm) ----
chrome.alarms.create('vault-sync', { periodInMinutes: 0.25 }); // 15 seconds
chrome.alarms.create('bookmark-sync', { periodInMinutes: 30 });
chrome.alarms.create('session-timeout-check', { periodInMinutes: 1 }); // Check every minute

chrome.alarms.onAlarm.addListener(async (alarm: any) => {
  if (alarm.name === 'vault-sync') {
    // Broadcast a refresh signal to all side panels
    try {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        chrome.runtime.sendMessage({ type: 'VAULT_DATA_CHANGED' }).catch(() => {
          // No listeners — side panel is closed, ignore
        });
      }
    } catch { /* ignore */ }
  }

  if (alarm.name === 'bookmark-sync') {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      console.log('[VaultSync] Periodic bookmark sync triggered');
    }
  }

  if (alarm.name === 'session-timeout-check') {
    // Auto-sign out if session has expired
    try {
      const expired = await isSessionExpired();
      if (expired) {
        const keyResult = await chrome.storage.session.get(['vaultKey']);
        if (keyResult.vaultKey) {
          console.log('[VaultSync] Session timeout expired — clearing vault key');
          await chrome.storage.session.remove(['vaultKey', 'vaultSalt']);
          await chrome.storage.local.remove(['loginTimestamp']);
          // Notify side panels to show the login screen
          chrome.runtime.sendMessage({ type: 'SESSION_EXPIRED' }).catch(() => {});
        }
      }
    } catch { /* ignore */ }
  }
});

// ---- Browser Startup: refresh Supabase session so data loads immediately ----
chrome.runtime.onStartup.addListener(async () => {
  console.log('[VaultSync] Browser started — refreshing auth session');
  try {
    const { data, error } = await supabase.auth.getSession();
    if (data.session && !error) {
      // Proactively refresh the token so it's valid for the next side panel open
      await supabase.auth.refreshSession();
      console.log('[VaultSync] Session refreshed on startup');
    }
  } catch (e) {
    console.warn('[VaultSync] Session refresh on startup failed:', e);
  }
});

console.log('[VaultSync] Service worker initialized');
