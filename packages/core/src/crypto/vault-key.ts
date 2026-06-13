// ============================================================================
// VaultSync — Universal Crypto Engine
// Platform-agnostic key derivation and encoding using @noble/hashes.
// Works identically on Web, Chrome Extension, and React Native — no polyfills needed.
// ============================================================================

import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';

// ---------------------------------------------------------------------------
// Constants — single source of truth, never changes
// ---------------------------------------------------------------------------

const PBKDF2_ITERATIONS = 600_000; // OWASP 2025 recommendation for SHA-256
const KEY_LENGTH = 32;             // 256 bits
const SALT_LENGTH = 16;            // 128-bit salt

// ---------------------------------------------------------------------------
// Salt Generation
// ---------------------------------------------------------------------------

/**
 * Generates a cryptographically random salt.
 * @returns Base64-encoded 128-bit salt
 */
export function generateSalt(): string {
  const salt = new Uint8Array(SALT_LENGTH);
  // crypto.getRandomValues works on all platforms (web, extension, React Native)
  crypto.getRandomValues(salt);
  return uint8ArrayToBase64(salt);
}

// ---------------------------------------------------------------------------
// Key Derivation — PBKDF2-SHA256 via @noble/hashes (pure JS, cross-platform)
// ---------------------------------------------------------------------------

/**
 * Derives the vault encryption key as raw bytes.
 * Used for AES-256-GCM data encryption/decryption.
 *
 * @param masterPassword - The user's master password (plaintext)
 * @param saltBase64 - Base64-encoded vault salt (unique per user)
 * @returns 32-byte Uint8Array ready for use with @noble/ciphers AES-256-GCM
 */
export async function deriveVaultKeyBytes(
  masterPassword: string,
  saltBase64: string
): Promise<Uint8Array> {
  const passwordBytes = new TextEncoder().encode(masterPassword);
  const salt = base64ToUint8Array(saltBase64);
  return pbkdf2Async(sha256, passwordBytes, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_LENGTH,
  });
}

/**
 * Derives the Supabase authentication key as a hex string.
 * This is used as the Supabase user's password — it is NEVER the master password
 * and NEVER the same as the vault key (different salt).
 *
 * @param masterPassword - The user's master password (plaintext)
 * @param authSaltBase64 - Base64-encoded auth-specific salt (different from vault salt)
 * @returns Hex string used as Supabase auth password
 */
export async function deriveAuthKeyHex(
  masterPassword: string,
  authSaltBase64: string
): Promise<string> {
  const passwordBytes = new TextEncoder().encode(masterPassword);
  const salt = base64ToUint8Array(authSaltBase64);
  const keyBytes = await pbkdf2Async(sha256, passwordBytes, salt, {
    c: PBKDF2_ITERATIONS,
    dkLen: KEY_LENGTH,
  });
  return uint8ArrayToHex(keyBytes);
}

// ---------------------------------------------------------------------------
// Recovery Key — encrypted backup of the vault key bytes
// ---------------------------------------------------------------------------

/**
 * Creates an encrypted recovery blob.
 * The vault key bytes are encrypted with a key derived from email + master password.
 * This allows vault key recovery without storing the vault key on the server.
 */
export async function createRecoveryKeyBlob(
  vaultKeyBytes: Uint8Array,
  email: string,
  masterPassword: string
): Promise<{ encryptedRecoveryKey: string; recoveryIv: string; recoverySalt: string }> {
  // Import at runtime to avoid circular imports
  const { encryptRaw } = await import('../crypto/encrypt');

  const recoverySalt = generateSalt();
  const recoveryMaterial = `${email.toLowerCase().trim()}:${masterPassword}`;
  const recoveryKeyBytes = await deriveVaultKeyBytes(recoveryMaterial, recoverySalt);

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encryptedBytes = encryptRaw(vaultKeyBytes, recoveryKeyBytes, iv);

  return {
    encryptedRecoveryKey: uint8ArrayToBase64(encryptedBytes),
    recoveryIv: uint8ArrayToBase64(iv),
    recoverySalt,
  };
}

/**
 * Recovers vault key bytes from the encrypted recovery blob.
 */
export async function recoverVaultKeyBytes(
  encryptedRecoveryKeyBase64: string,
  recoveryIvBase64: string,
  recoverySaltBase64: string,
  email: string,
  masterPassword: string
): Promise<Uint8Array> {
  const { decryptRaw } = await import('../crypto/encrypt');

  const recoveryMaterial = `${email.toLowerCase().trim()}:${masterPassword}`;
  const recoveryKeyBytes = await deriveVaultKeyBytes(recoveryMaterial, recoverySaltBase64);

  const encrypted = base64ToUint8Array(encryptedRecoveryKeyBase64);
  const iv = base64ToUint8Array(recoveryIvBase64);

  return decryptRaw(encrypted, recoveryKeyBytes, iv);
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
