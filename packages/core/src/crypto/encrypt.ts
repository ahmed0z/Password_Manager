// ============================================================================
// VaultSync — AES-256-GCM Encryption / Decryption
// All user data is encrypted locally before touching the network.
// ============================================================================

import { uint8ArrayToBase64, base64ToUint8Array } from './vault-key';
import type { EncryptedPayload } from '../types';

const IV_LENGTH = 12; // 96-bit IV for AES-GCM (NIST recommended)

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * A unique IV is generated for each encryption operation.
 *
 * @param plaintext - The data to encrypt
 * @param vaultKey - The user's derived vault key
 * @returns EncryptedPayload with Base64-encoded ciphertext and IV
 */
export async function encrypt(
  plaintext: string,
  vaultKey: CryptoKey
): Promise<EncryptedPayload> {
  const encoder = new TextEncoder();
  const iv = new Uint8Array(IV_LENGTH);
  crypto.getRandomValues(iv);

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    vaultKey,
    encoder.encode(plaintext)
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload back to plaintext.
 *
 * @param payload - The encrypted payload (Base64 ciphertext + IV)
 * @param vaultKey - The user's derived vault key
 * @returns Decrypted plaintext string
 * @throws If decryption fails (wrong key, tampered data, etc.)
 */
export async function decrypt(
  payload: EncryptedPayload,
  vaultKey: CryptoKey
): Promise<string> {
  const decoder = new TextDecoder();
  const ciphertext = base64ToUint8Array(payload.ciphertext);
  const iv = base64ToUint8Array(payload.iv);

  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    vaultKey,
    ciphertext as BufferSource
  );

  return decoder.decode(plaintextBuffer);
}

/**
 * Encrypts a structured object by serializing to JSON first.
 *
 * @param data - Any JSON-serializable object
 * @param vaultKey - The user's derived vault key
 * @returns EncryptedPayload
 */
export async function encryptObject<T>(
  data: T,
  vaultKey: CryptoKey
): Promise<EncryptedPayload> {
  const json = JSON.stringify(data);
  return encrypt(json, vaultKey);
}

/**
 * Decrypts an encrypted payload back into a structured object.
 *
 * @param payload - The encrypted payload
 * @param vaultKey - The user's derived vault key
 * @returns Parsed object of type T
 */
export async function decryptObject<T>(
  payload: EncryptedPayload,
  vaultKey: CryptoKey
): Promise<T> {
  const json = await decrypt(payload, vaultKey);
  return JSON.parse(json) as T;
}
