// ============================================================================
// VaultSync — Bookmarks CRUD
// Syncs Chrome browser bookmarks with encryption.
// ============================================================================

import { getSupabaseClient } from './client';
import { encryptObject, decryptObject } from '../crypto/encrypt';
import type { Bookmark, DecryptedBookmark } from '../types';

/**
 * Syncs a batch of bookmarks from the browser.
 * Encrypts each bookmark before upserting.
 */
export async function syncBookmarks(
  bookmarks: Array<DecryptedBookmark & { browserBookmarkId?: string }>,
  vaultKey: Uint8Array
): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Encrypt and prepare all bookmarks
  const encryptedBookmarks = await Promise.all(
    bookmarks.map(async (bookmark, index) => {
      const encrypted = await encryptObject(
        {
          title: bookmark.title,
          url: bookmark.url,
          favicon: bookmark.favicon,
          folderPath: bookmark.folderPath,
          description: bookmark.description,
        },
        vaultKey
      );

      return {
        user_id: user.id,
        encrypted_data: encrypted.ciphertext,
        iv: encrypted.iv,
        browser_bookmark_id: bookmark.browserBookmarkId || null,
        folder_path: bookmark.folderPath || null,
        sort_order: index,
      };
    })
  );

  // Upsert in batches of 100
  for (let i = 0; i < encryptedBookmarks.length; i += 100) {
    const batch = encryptedBookmarks.slice(i, i + 100);

    const { error } = await supabase
      .from('bookmarks')
      .upsert(batch, {
        onConflict: 'user_id,browser_bookmark_id',
        ignoreDuplicates: false,
      });

    if (error) {
      // Fallback: insert individually if upsert fails
      for (const item of batch) {
        await supabase.from('bookmarks').insert(item);
      }
    }
  }
}

/**
 * Fetches and decrypts all bookmarks for the current user.
 */
export async function getBookmarks(
  vaultKey: Uint8Array
): Promise<Array<Bookmark & { decrypted: DecryptedBookmark }>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('bookmarks')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Failed to fetch bookmarks: ${error.message}`);
  if (!data) return [];

  return Promise.all(
    data.map(async (bookmark: Bookmark) => {
      try {
        const decrypted = await decryptObject<DecryptedBookmark>(
          { ciphertext: bookmark.encrypted_data, iv: bookmark.iv },
          vaultKey
        );
        return { ...bookmark, decrypted };
      } catch {
        return {
          ...bookmark,
          decrypted: {
            title: '[Decryption Failed]',
            url: '',
          },
        };
      }
    })
  );
}

/**
 * Deletes a synced bookmark.
 */
export async function deleteBookmark(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete bookmark: ${error.message}`);
}

/**
 * Deletes all bookmarks for the current user (full resync).
 */
export async function clearAllBookmarks(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('bookmarks')
    .delete()
    .eq('user_id', user.id);

  if (error) throw new Error(`Failed to clear bookmarks: ${error.message}`);
}

/**
 * Subscribes to realtime changes on bookmarks.
 */
export function subscribeToBookmarks(
  userId: string,
  callback: (payload: { eventType: string; new: Bookmark; old: Bookmark }) => void
) {
  const supabase = getSupabaseClient();

  return supabase
    .channel('bookmarks_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'bookmarks',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload as unknown as { eventType: string; new: Bookmark; old: Bookmark });
      }
    )
    .subscribe();
}

/**
 * Updates an existing synced bookmark.
 * Encrypts the bookmark before updating.
 */
export async function updateBookmark(
  id: string,
  bookmark: Omit<DecryptedBookmark, 'browserBookmarkId'>,
  vaultKey: Uint8Array
): Promise<void> {
  const supabase = getSupabaseClient();

  const encrypted = await encryptObject(
    {
      title: bookmark.title,
      url: bookmark.url,
      favicon: bookmark.favicon,
      folderPath: bookmark.folderPath,
      description: bookmark.description,
    },
    vaultKey
  );

  const { error } = await supabase
    .from('bookmarks')
    .update({
      encrypted_data: encrypted.ciphertext,
      iv: encrypted.iv,
      folder_path: bookmark.folderPath || null,
    })
    .eq('id', id);

  if (error) throw new Error(`Failed to update bookmark: ${error.message}`);
}

/**
 * Renames a folder for bookmarks by updating folder paths of matching bookmarks.
 */
export async function renameBookmarkFolder(
  oldPath: string,
  newPath: string,
  vaultKey: Uint8Array
): Promise<void> {
  const allBookmarks = await getBookmarks(vaultKey);
  const matching = allBookmarks.filter((b) => {
    const p = b.decrypted.folderPath || '';
    return p === oldPath || p.startsWith(oldPath + '/');
  });

  await Promise.all(
    matching.map((b) => {
      const p = b.decrypted.folderPath || '';
      const updatedPath = p === oldPath ? newPath : newPath + p.substring(oldPath.length);
      return updateBookmark(
        b.id,
        {
          title: b.decrypted.title,
          url: b.decrypted.url,
          favicon: b.decrypted.favicon,
          description: b.decrypted.description,
          folderPath: updatedPath || undefined,
        },
        vaultKey
      );
    })
  );
}

/**
 * Deletes a bookmark folder by moving all its contents to root.
 */
export async function deleteBookmarkFolder(
  path: string,
  vaultKey: Uint8Array
): Promise<void> {
  const allBookmarks = await getBookmarks(vaultKey);
  const matching = allBookmarks.filter((b) => {
    const p = b.decrypted.folderPath || '';
    return p === path || p.startsWith(path + '/');
  });

  await Promise.all(
    matching.map((b) => {
      return updateBookmark(
        b.id,
        {
          title: b.decrypted.title,
          url: b.decrypted.url,
          favicon: b.decrypted.favicon,
          description: b.decrypted.description,
          folderPath: undefined,
        },
        vaultKey
      );
    })
  );
}

