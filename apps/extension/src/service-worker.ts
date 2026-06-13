// ============================================================================
// VaultSync — Chrome Extension Service Worker (Background)
// Manages auth state, message routing, credential save/update, bookmark sync,
// and periodic data refresh for cross-platform sync.
// ============================================================================

import { getSupabaseClient, base64ToUint8Array, encryptObject, decryptObject } from '@vaultsync/core';

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

    case 'UPDATE_CREDENTIAL_BY_ID': {
      const payload = message.payload as {
        id: string; username: string; password: string; domain: string; url: string; title: string;
      };
      if (sender.tab?.id) pendingCredentialsMap.delete(sender.tab.id);
      return updateCredentialById(payload);
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
      // Record the last activity timestamp for session timeout tracking
      await chrome.storage.local.set({ lastActivityTimestamp: Date.now() });
      return { success: true };
    }

    case 'GET_VAULT_KEY': {
      const result = await chrome.storage.session.get(['vaultKey', 'vaultSalt']);
      return result;
    }

    case 'CLEAR_VAULT_KEY': {
      await chrome.storage.session.remove(['vaultKey', 'vaultSalt']);
      await chrome.storage.local.remove(['lastActivityTimestamp']);
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

    case 'UPDATE_ACTIVITY_TIMESTAMP': {
      await chrome.storage.local.set({ lastActivityTimestamp: Date.now() });
      return { success: true };
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

    const keyBytes = base64ToUint8Array(keyResult.vaultKey);

    for (const item of data) {
      try {
        const decrypted = await decryptObject<{ username: string; password: string }>(
          { ciphertext: item.encrypted_data, iv: item.iv },
          keyBytes
        );

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

    const keyBytes = base64ToUint8Array(keyResult.vaultKey);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const payload = {
      title: creds.title,
      username: creds.username,
      password: creds.password,
      url: creds.url,
      notes: '',
    };

    const encrypted = await encryptObject(payload, keyBytes);

    const { error } = await supabase.from('vault_items').insert({
      user_id: user.id,
      encrypted_data: encrypted.ciphertext,
      iv: encrypted.iv,
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

    const keyBytes = base64ToUint8Array(keyResult.vaultKey);

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
        const dec = await decryptObject<{ username: string }>(
          { ciphertext: item.encrypted_data, iv: item.iv },
          keyBytes
        );
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

    const encrypted = await encryptObject(payload, keyBytes);

    const { error } = await supabase
      .from('vault_items')
      .update({
        encrypted_data: encrypted.ciphertext,
        iv: encrypted.iv,
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

// ---- Update Credential By ID ----
async function updateCredentialById(payload: {
  id: string;
  username: string;
  password: string;
  domain: string;
  url: string;
  title: string;
}) {
  try {
    const keyResult = await chrome.storage.session.get(['vaultKey']);
    if (!keyResult.vaultKey) throw new Error('Vault locked');

    const keyBytes = base64ToUint8Array(keyResult.vaultKey);

    // Fetch existing item to preserve notes/folder/favorites
    const { data: item, error: fetchError } = await supabase
      .from('vault_items')
      .select('encrypted_data, iv, folder_id, is_favorite')
      .eq('id', payload.id)
      .single();

    if (fetchError || !item) throw new Error('Item not found');

    let notes = '';
    try {
      const dec = await decryptObject<{ notes?: string }>(
        { ciphertext: item.encrypted_data, iv: item.iv },
        keyBytes
      );
      notes = dec.notes || '';
    } catch {}

    const fullPayload = {
      title: payload.title,
      username: payload.username,
      password: payload.password,
      url: payload.url,
      notes: notes,
    };

    const encrypted = await encryptObject(fullPayload, keyBytes);

    const { error } = await supabase
      .from('vault_items')
      .update({
        encrypted_data: encrypted.ciphertext,
        iv: encrypted.iv,
        domain: payload.domain,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.id);

    if (error) throw error;
    return { success: true };
  } catch (e) {
    console.error('[VaultSync SW] Update by ID failed:', e);
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
  const result = await chrome.storage.local.get(['sessionTimeout', 'lastActivityTimestamp']);
  const timeout = result.sessionTimeout || 'always';
  if (timeout === 'always') return false;

  const lastActivityTimestamp = result.lastActivityTimestamp;
  if (!lastActivityTimestamp) return true; // No timestamp recorded — treat as expired

  const durationMs = TIMEOUT_DURATIONS[timeout] || 0;
  if (durationMs === 0) return false;

  return Date.now() - lastActivityTimestamp > durationMs;
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
          await chrome.storage.local.remove(['lastActivityTimestamp']);
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
