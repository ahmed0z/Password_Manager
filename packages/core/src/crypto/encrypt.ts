// ============================================================================
// VaultSync — AES-256-GCM Encryption / Decryption
// Uses @noble/ciphers for cross-platform AES-GCM — no crypto.subtle needed.
// Works identically on Web, Chrome Extension, and React Native.
// ============================================================================

import { gcm } from '@noble/ciphers/aes';
import { uint8ArrayToBase64, base64ToUint8Array } from './vault-key';
import type { EncryptedPayload } from '../types';

const IV_LENGTH = 12; // 96-bit IV for AES-GCM (NIST recommended)

// ---------------------------------------------------------------------------
// Low-level raw byte operations (used by recovery key functions)
// ---------------------------------------------------------------------------

/**
 * Encrypts raw bytes with AES-256-GCM using @noble/ciphers.
 * @param plaintext - Raw bytes to encrypt
 * @param keyBytes  - 32-byte AES-256 key
 * @param iv        - 12-byte initialization vector
 * @returns Encrypted bytes (ciphertext + 16-byte GCM tag appended)
 */
export function encryptRaw(
  plaintext: Uint8Array,
  keyBytes: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  const cipher = gcm(keyBytes, iv);
  return cipher.encrypt(plaintext);
}

/**
 * Decrypts raw bytes with AES-256-GCM using @noble/ciphers.
 * @throws If authentication tag verification fails (tampered/wrong key)
 */
export function decryptRaw(
  ciphertext: Uint8Array,
  keyBytes: Uint8Array,
  iv: Uint8Array
): Uint8Array {
  const cipher = gcm(keyBytes, iv);
  return cipher.decrypt(ciphertext);
}

// ---------------------------------------------------------------------------
// High-level string / object operations (used by vault items, folders, bookmarks)
// ---------------------------------------------------------------------------

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * A unique random IV is generated for each call.
 *
 * @param plaintext   - The string data to encrypt
 * @param vaultKeyBytes - 32-byte vault key (from deriveVaultKeyBytes)
 * @returns EncryptedPayload with Base64-encoded ciphertext and IV
 */
export async function encrypt(
  plaintext: string,
  vaultKeyBytes: Uint8Array
): Promise<EncryptedPayload> {
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);

  const plaintextBytes = new TextEncoder().encode(plaintext);
  const ciphertextBytes = encryptRaw(plaintextBytes, vaultKeyBytes, iv);

  return {
    ciphertext: uint8ArrayToBase64(ciphertextBytes),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload back to plaintext.
 *
 * @param payload       - The encrypted payload (Base64 ciphertext + IV)
 * @param vaultKeyBytes - 32-byte vault key (from deriveVaultKeyBytes)
 * @returns Decrypted plaintext string
 * @throws If decryption fails (wrong key, tampered data, etc.)
 */
export async function decrypt(
  payload: EncryptedPayload,
  vaultKeyBytes: Uint8Array
): Promise<string> {
  const ciphertextBytes = base64ToUint8Array(payload.ciphertext);
  const iv = base64ToUint8Array(payload.iv);

  const plaintextBytes = decryptRaw(ciphertextBytes, vaultKeyBytes, iv);
  return new TextDecoder().decode(plaintextBytes);
}

/**
 * Encrypts a structured object by serializing to JSON first.
 */
export async function encryptObject<T>(
  data: T,
  vaultKeyBytes: Uint8Array
): Promise<EncryptedPayload> {
  return encrypt(JSON.stringify(data), vaultKeyBytes);
}

/**
 * Decrypts an encrypted payload back into a structured object.
 */
export async function decryptObject<T>(
  payload: EncryptedPayload,
  vaultKeyBytes: Uint8Array
): Promise<T> {
  const json = await decrypt(payload, vaultKeyBytes);
  return JSON.parse(json) as T;
}
