// ============================================================================
// VaultSync — Folders CRUD
// Folder names are encrypted for privacy.
// ============================================================================

import { getSupabaseClient } from './client';
import { encrypt, decrypt } from '../crypto/encrypt';
import type { Folder, DecryptedFolder } from '../types';

/**
 * Creates a new folder with an encrypted name.
 */
export async function createFolder(
  name: string,
  vaultKey: Uint8Array,
  parentId?: string
): Promise<Folder> {
  const supabase = getSupabaseClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const encrypted = await encrypt(name, vaultKey);

  // Get max sort order for ordering
  const { data: existing } = await supabase
    .from('folders')
    .select('sort_order')
    .eq('user_id', user.id)
    .eq('parent_id', parentId || null)
    .order('sort_order', { ascending: false })
    .limit(1);

  const nextOrder = existing && existing.length > 0 ? existing[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('folders')
    .insert({
      user_id: user.id,
      encrypted_name: encrypted.ciphertext,
      name_iv: encrypted.iv,
      parent_id: parentId || null,
      sort_order: nextOrder,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create folder: ${error.message}`);
  return data as Folder;
}

/**
 * Fetches and decrypts all folders for the current user.
 * Returns a flat array — caller can build the tree structure.
 */
export async function getFolders(
  vaultKey: Uint8Array
): Promise<DecryptedFolder[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('folders')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Failed to fetch folders: ${error.message}`);
  if (!data) return [];

  const decrypted = await Promise.all(
    data.map(async (folder: Folder) => {
      try {
        const name = await decrypt(
          { ciphertext: folder.encrypted_name, iv: folder.name_iv },
          vaultKey
        );
        return {
          id: folder.id,
          name,
          parentId: folder.parent_id,
          sortOrder: folder.sort_order,
        };
      } catch {
        return {
          id: folder.id,
          name: '[Decryption Failed]',
          parentId: folder.parent_id,
          sortOrder: folder.sort_order,
        };
      }
    })
  );

  return decrypted;
}

/**
 * Builds a tree structure from a flat list of folders.
 */
export function buildFolderTree(folders: DecryptedFolder[]): DecryptedFolder[] {
  const map = new Map<string, DecryptedFolder>();
  const roots: DecryptedFolder[] = [];

  // First pass: create map
  for (const folder of folders) {
    map.set(folder.id, { ...folder, children: [] });
  }

  // Second pass: build tree
  for (const folder of folders) {
    const node = map.get(folder.id)!;
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Renames a folder (re-encrypts the name).
 */
export async function renameFolder(
  id: string,
  newName: string,
  vaultKey: Uint8Array
): Promise<void> {
  const supabase = getSupabaseClient();
  const encrypted = await encrypt(newName, vaultKey);

  const { error } = await supabase
    .from('folders')
    .update({
      encrypted_name: encrypted.ciphertext,
      name_iv: encrypted.iv,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`Failed to rename folder: ${error.message}`);
}

/**
 * Deletes a folder. Items in the folder will have folder_id set to null.
 */
export async function deleteFolder(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete folder: ${error.message}`);
}

/**
 * Subscribes to realtime changes on folders.
 */
export function subscribeToFolders(
  userId: string,
  callback: (payload: { eventType: string; new: Folder; old: Folder }) => void
) {
  const supabase = getSupabaseClient();

  return supabase
    .channel('folders_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'folders',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload as unknown as { eventType: string; new: Folder; old: Folder });
      }
    )
    .subscribe();
}
