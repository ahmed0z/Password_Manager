// ============================================================================
// VaultSync — Vault Items CRUD
// All data is encrypted before insertion and decrypted after retrieval.
// ============================================================================

import { getSupabaseClient } from './client';
import { encryptObject, decryptObject, encrypt } from '../crypto/encrypt';
import type {
  VaultItem,
  DecryptedVaultItem,
  VaultItemInput,
  EncryptedPayload,
} from '../types';

/**
 * Creates a new vault item (password entry).
 * Encrypts all sensitive data locally before inserting.
 */
export async function createVaultItem(
  input: VaultItemInput,
  vaultKey: CryptoKey
): Promise<VaultItem> {
  const supabase = getSupabaseClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Encrypt the sensitive data
  const decryptedData: DecryptedVaultItem = {
    title: input.title,
    username: input.username,
    password: input.password,
    url: input.url,
    notes: input.notes,
    tags: input.tags,
  };

  const encrypted: EncryptedPayload = await encryptObject(decryptedData, vaultKey);

  // Extract domain for autofill matching (not sensitive)
  const domain = extractDomain(input.url);

  const { data, error } = await supabase
    .from('vault_items')
    .insert({
      user_id: user.id,
      folder_id: input.folderId || null,
      encrypted_data: encrypted.ciphertext,
      iv: encrypted.iv,
      domain,
      favicon_url: domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null,
      is_favorite: input.isFavorite || false,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create vault item: ${error.message}`);
  return data as VaultItem;
}

/**
 * Fetches and decrypts all vault items for the current user.
 */
export async function getVaultItems(
  vaultKey: CryptoKey
): Promise<Array<VaultItem & { decrypted: DecryptedVaultItem }>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('vault_items')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch vault items: ${error.message}`);
  if (!data) return [];

  // Decrypt each item locally
  const decrypted = await Promise.all(
    data.map(async (item: VaultItem) => {
      try {
        const decryptedData = await decryptObject<DecryptedVaultItem>(
          { ciphertext: item.encrypted_data, iv: item.iv },
          vaultKey
        );
        return { ...item, decrypted: decryptedData };
      } catch {
        // If decryption fails for a single item, don't break the entire list
        console.warn(`Failed to decrypt vault item ${item.id}`);
        return {
          ...item,
          decrypted: {
            title: '[Decryption Failed]',
            username: '',
            password: '',
            url: '',
          },
        };
      }
    })
  );

  return decrypted;
}

/**
 * Fetches and decrypts vault items for a specific folder.
 */
export async function getVaultItemsByFolder(
  folderId: string,
  vaultKey: CryptoKey
): Promise<Array<VaultItem & { decrypted: DecryptedVaultItem }>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('vault_items')
    .select('*')
    .eq('folder_id', folderId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(`Failed to fetch folder items: ${error.message}`);
  if (!data) return [];

  const decrypted = await Promise.all(
    data.map(async (item: VaultItem) => {
      try {
        const decryptedData = await decryptObject<DecryptedVaultItem>(
          { ciphertext: item.encrypted_data, iv: item.iv },
          vaultKey
        );
        return { ...item, decrypted: decryptedData };
      } catch {
        return {
          ...item,
          decrypted: {
            title: '[Decryption Failed]',
            username: '',
            password: '',
            url: '',
          },
        };
      }
    })
  );

  return decrypted;
}

/**
 * Fetches and decrypts vault items matching a domain (for autofill).
 */
export async function getVaultItemsByDomain(
  domain: string,
  vaultKey: CryptoKey
): Promise<Array<VaultItem & { decrypted: DecryptedVaultItem }>> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('vault_items')
    .select('*')
    .eq('domain', domain);

  if (error) throw new Error(`Failed to fetch items for domain: ${error.message}`);
  if (!data) return [];

  return Promise.all(
    data.map(async (item: VaultItem) => {
      const decryptedData = await decryptObject<DecryptedVaultItem>(
        { ciphertext: item.encrypted_data, iv: item.iv },
        vaultKey
      );
      return { ...item, decrypted: decryptedData };
    })
  );
}

/**
 * Updates an existing vault item. Re-encrypts all data.
 */
export async function updateVaultItem(
  id: string,
  input: Partial<VaultItemInput>,
  existingDecrypted: DecryptedVaultItem,
  vaultKey: CryptoKey
): Promise<VaultItem> {
  const supabase = getSupabaseClient();

  // Merge updates with existing data
  const merged: DecryptedVaultItem = {
    ...existingDecrypted,
    ...(input.title !== undefined && { title: input.title }),
    ...(input.username !== undefined && { username: input.username }),
    ...(input.password !== undefined && { password: input.password }),
    ...(input.url !== undefined && { url: input.url }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.tags !== undefined && { tags: input.tags }),
  };

  // Re-encrypt with fresh IV
  const encrypted = await encryptObject(merged, vaultKey);
  const domain = extractDomain(input.url || existingDecrypted.url);

  const updatePayload: Record<string, unknown> = {
    encrypted_data: encrypted.ciphertext,
    iv: encrypted.iv,
    domain,
    updated_at: new Date().toISOString(),
  };

  if (input.folderId !== undefined) updatePayload.folder_id = input.folderId;
  if (input.isFavorite !== undefined) updatePayload.is_favorite = input.isFavorite;

  const { data, error } = await supabase
    .from('vault_items')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update vault item: ${error.message}`);
  return data as VaultItem;
}

/**
 * Deletes a vault item permanently.
 */
export async function deleteVaultItem(id: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('vault_items')
    .delete()
    .eq('id', id);

  if (error) throw new Error(`Failed to delete vault item: ${error.message}`);
}

/**
 * Toggles the favorite status of a vault item.
 */
export async function toggleFavorite(
  id: string,
  isFavorite: boolean
): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('vault_items')
    .update({ is_favorite: isFavorite, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`Failed to toggle favorite: ${error.message}`);
}

/**
 * Subscribes to realtime changes on vault_items for cross-device sync.
 */
export function subscribeToVaultItems(
  userId: string,
  callback: (payload: { eventType: string; new: VaultItem; old: VaultItem }) => void
) {
  const supabase = getSupabaseClient();

  return supabase
    .channel('vault_items_changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'vault_items',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        callback(payload as unknown as { eventType: string; new: VaultItem; old: VaultItem });
      }
    )
    .subscribe();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDomain(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return parsed.hostname.replace('www.', '');
  } catch {
    return null;
  }
}
