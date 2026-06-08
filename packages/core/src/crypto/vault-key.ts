// ============================================================================
// VaultSync — Vault Key Derivation
// Zero-knowledge key derivation using PBKDF2 + AES-256-GCM
// The vault key NEVER leaves the user's device.
// ============================================================================

const PBKDF2_ITERATIONS = 600_000; // OWASP 2025 recommendation for SHA-256
const KEY_LENGTH = 256;            // AES-256
const SALT_LENGTH = 16;            // 128-bit salt
const HASH_ALGORITHM = 'SHA-256';

/**
 * Generates a cryptographically random salt.
 * @returns Base64-encoded 128-bit salt
 */
export function generateSalt(): string {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return uint8ArrayToBase64(salt);
}

/**
 * Derives a vault encryption key from the master password.
 * Uses PBKDF2 with 600,000 iterations to resist brute-force attacks.
 *
 * @param masterPassword - The user's master password (plaintext)
 * @param saltBase64 - Base64-encoded salt (unique per user)
 * @returns CryptoKey suitable for AES-256-GCM encryption/decryption
 */
export async function deriveVaultKey(
  masterPassword: string,
  saltBase64: string
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const salt = base64ToUint8Array(saltBase64);

  // Import the raw password as key material
  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  // Derive AES-256-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true, // extractable — needed for recovery key export
    ['encrypt', 'decrypt']
  );
}

/**
 * Derives a separate authentication key from the master password.
 * This key is used as the Supabase auth password — NEVER the same as the vault key.
 * Uses a different salt to ensure key separation.
 *
 * @param masterPassword - The user's master password
 * @param authSaltBase64 - Base64-encoded auth-specific salt
 * @returns Hex string suitable for use as a Supabase auth password
 */
export async function deriveAuthKey(
  masterPassword: string,
  authSaltBase64: string
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = base64ToUint8Array(authSaltBase64);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(masterPassword),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  // Derive 256 bits for use as auth password
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    baseKey,
    KEY_LENGTH
  );

  // Convert to hex string for use as password
  return uint8ArrayToHex(new Uint8Array(derivedBits));
}

/**
 * Exports a CryptoKey to a raw ArrayBuffer for recovery key generation.
 */
export async function exportKey(key: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.exportKey('raw', key);
}

/**
 * Imports a raw key buffer back into a CryptoKey.
 * Used during vault key recovery.
 */
export async function importKey(rawKey: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Creates an encrypted recovery blob.
 * The recovery key is derived from the user's email + a recovery password,
 * and is used to encrypt the vault key material for emergency recovery.
 */
export async function createRecoveryKey(
  vaultKey: CryptoKey,
  email: string,
  recoveryPassword: string
): Promise<{ encryptedRecoveryKey: string; recoveryIv: string; recoverySalt: string }> {
  // Generate a unique salt for recovery key derivation
  const recoverySalt = generateSalt();

  // Derive recovery encryption key from email + recovery password
  const recoveryMaterial = `${email.toLowerCase().trim()}:${recoveryPassword}`;
  const recoveryEncKey = await deriveVaultKey(recoveryMaterial, recoverySalt);

  // Export the vault key as raw bytes
  const vaultKeyRaw = await exportKey(vaultKey);

  // Encrypt the vault key with the recovery key
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);

  const encryptedVaultKey = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    recoveryEncKey,
    vaultKeyRaw
  );

  return {
    encryptedRecoveryKey: uint8ArrayToBase64(new Uint8Array(encryptedVaultKey)),
    recoveryIv: uint8ArrayToBase64(iv),
    recoverySalt,
  };
}

/**
 * Recovers the vault key using email + recovery password.
 * The user must verify their email via OTP before this is called.
 */
export async function recoverVaultKey(
  encryptedRecoveryKeyBase64: string,
  recoveryIvBase64: string,
  recoverySaltBase64: string,
  email: string,
  recoveryPassword: string
): Promise<CryptoKey> {
  // Re-derive the recovery encryption key
  const recoveryMaterial = `${email.toLowerCase().trim()}:${recoveryPassword}`;
  const recoveryEncKey = await deriveVaultKey(recoveryMaterial, recoverySaltBase64);

  // Decrypt the vault key
  const encryptedData = base64ToUint8Array(encryptedRecoveryKeyBase64);
  const iv = base64ToUint8Array(recoveryIvBase64);

  const decryptedVaultKey = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    recoveryEncKey,
    encryptedData as BufferSource
  );

  // Import it back as a CryptoKey
  return importKey(decryptedVaultKey);
}

// ---------------------------------------------------------------------------
// Encoding Utilities
// ---------------------------------------------------------------------------

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('');
  return btoa(binString);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  const binString = atob(base64);
  return Uint8Array.from(binString, (char) => char.codePointAt(0)!);
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
