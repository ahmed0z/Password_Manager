// ============================================================================
// VaultSync — Shared Type Definitions
// All interfaces for the cross-platform password & bookmark manager
// ============================================================================

// ---------------------------------------------------------------------------
// Vault Items (Passwords)
// ---------------------------------------------------------------------------

/** Encrypted vault item as stored in Supabase */
export interface VaultItem {
  id: string;
  user_id: string;
  folder_id: string | null;
  encrypted_data: string;   // Base64-encoded AES-256-GCM ciphertext
  iv: string;               // Base64-encoded 96-bit initialization vector
  domain: string | null;    // Plaintext domain for autofill matching
  favicon_url: string | null;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

/** Decrypted vault item — only exists in memory on client */
export interface DecryptedVaultItem {
  title: string;
  username: string;
  password: string;
  url: string;
  notes?: string;
  tags?: string[];
  totp_secret?: string;
}

/** Input for creating/updating a vault item (before encryption) */
export interface VaultItemInput {
  title: string;
  username: string;
  password: string;
  url: string;
  notes?: string;
  tags?: string[];
  folderId?: string;
  isFavorite?: boolean;
}

// ---------------------------------------------------------------------------
// Folders
// ---------------------------------------------------------------------------

/** Encrypted folder as stored in Supabase */
export interface Folder {
  id: string;
  user_id: string;
  encrypted_name: string;
  name_iv: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Decrypted folder — only exists in memory on client */
export interface DecryptedFolder {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  itemCount?: number;
  children?: DecryptedFolder[];
}

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

/** Encrypted bookmark as stored in Supabase */
export interface Bookmark {
  id: string;
  user_id: string;
  encrypted_data: string;
  iv: string;
  browser_bookmark_id: string | null;
  folder_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** Decrypted bookmark — only exists in memory on client */
export interface DecryptedBookmark {
  title: string;
  url: string;
  favicon?: string;
  folderPath?: string;
  description?: string;
}

// ---------------------------------------------------------------------------
// Encryption Payloads
// ---------------------------------------------------------------------------

/** Result of an encryption operation */
export interface EncryptedPayload {
  ciphertext: string;  // Base64-encoded
  iv: string;          // Base64-encoded
}

/** Vault key material stored in memory during a session */
export interface VaultKeyMaterial {
  key: CryptoKey;
  salt: string;  // Base64-encoded salt used for derivation
}

// ---------------------------------------------------------------------------
// Auth & User Profile
// ---------------------------------------------------------------------------

export interface UserProfile {
  id: string;
  email: string;
  encrypted_vault_salt: string;
  auth_salt: string;
  encrypted_recovery_key: string | null;
  recovery_iv: string | null;
  recovery_salt: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  user: {
    id: string;
    email: string;
  };
  accessToken: string;
  refreshToken: string;
}

export interface SignUpInput {
  email: string;
  masterPassword: string;
}

export interface SignInInput {
  email: string;
  masterPassword: string;
}

// ---------------------------------------------------------------------------
// Password Generator
// ---------------------------------------------------------------------------

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  excludeAmbiguous: boolean;   // Exclude 0/O, 1/l/I
  customSymbols?: string;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4;   // 0=very weak, 4=very strong
  label: string;
  entropy: number;              // bits of entropy
  crackTime: string;            // human-readable crack time estimate
}

// ---------------------------------------------------------------------------
// Sync & Realtime
// ---------------------------------------------------------------------------

export type SyncEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface SyncEvent<T> {
  type: SyncEventType;
  table: string;
  record: T;
  oldRecord?: T;
}

// ---------------------------------------------------------------------------
// App Theme
// ---------------------------------------------------------------------------

export type ThemeMode = 'light' | 'dark' | 'system';

// ---------------------------------------------------------------------------
// Autofill (Chrome Extension)
// ---------------------------------------------------------------------------

export interface AutofillCandidate {
  domain: string;
  items: DecryptedVaultItem[];
}

export interface DetectedField {
  element: HTMLInputElement;
  fieldType: 'username' | 'email' | 'password' | 'unknown';
  confidence: number;  // 0-1
}
