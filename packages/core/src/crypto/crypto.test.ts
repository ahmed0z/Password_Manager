import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  deriveVaultKey,
  deriveAuthKey,
  createRecoveryKey,
  recoverVaultKey,
} from './vault-key';
import { encrypt, decrypt, encryptObject, decryptObject } from './encrypt';

// Mock Web Crypto API since standard Node might require polyfills or global crypto
// In H2 2026, globalThis.crypto is fully standard in modern Node versions.
describe('VaultSync Cryptographic Engine', () => {
  it('should generate unique salts', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    expect(salt1).toBeDefined();
    expect(salt2).toBeDefined();
    expect(salt1).not.toBe(salt2);
  });

  it('should derive correct keys and follow key separation', async () => {
    const password = 'SuperSecureMasterPassword123!';
    const salt = generateSalt();

    const vaultKey = await deriveVaultKey(password, salt);
    const authKey = await deriveAuthKey(password, salt);

    expect(vaultKey).toBeInstanceOf(CryptoKey);
    expect(typeof authKey).toBe('string');
    expect(authKey.length).toBe(64); // 256-bit key in hex is 64 chars
  });

  it('should encrypt and decrypt plaintext correctly', async () => {
    const password = 'MySecretPassword';
    const salt = generateSalt();
    const plaintext = 'This is a super secret message.';

    const vaultKey = await deriveVaultKey(password, salt);
    const encrypted = await encrypt(plaintext, vaultKey);

    expect(encrypted.ciphertext).toBeDefined();
    expect(encrypted.iv).toBeDefined();

    const decrypted = await decrypt(encrypted, vaultKey);
    expect(decrypted).toBe(plaintext);
  });

  it('should encrypt and decrypt objects correctly', async () => {
    const password = 'MySecretPassword';
    const salt = generateSalt();
    const payload = {
      username: 'alice',
      password: 'alice-secret-password-456',
      url: 'https://example.com',
    };

    const vaultKey = await deriveVaultKey(password, salt);
    const encrypted = await encryptObject(payload, vaultKey);
    const decrypted = await decryptObject<{ username: string; url: string }>(encrypted, vaultKey);

    expect(decrypted.username).toBe(payload.username);
    expect(decrypted.url).toBe(payload.url);
  });

  it('should successfully back up and recover vault key (Zero-Knowledge Recovery)', async () => {
    const email = 'user@example.com';
    const masterPassword = 'MasterPasswordForEverything!';
    const salt = generateSalt();

    // 1. User sets up vault key during registration
    const vaultKey = await deriveVaultKey(masterPassword, salt);

    // 2. Generate encrypted recovery key blob
    const recoveryBlob = await createRecoveryKey(vaultKey, email, masterPassword);

    expect(recoveryBlob.encryptedRecoveryKey).toBeDefined();
    expect(recoveryBlob.recoveryIv).toBeDefined();
    expect(recoveryBlob.recoverySalt).toBeDefined();

    // 3. User recovers their vault key using email and master password
    const recoveredVaultKey = await recoverVaultKey(
      recoveryBlob.encryptedRecoveryKey,
      recoveryBlob.recoveryIv,
      recoveryBlob.recoverySalt,
      email,
      masterPassword
    );

    expect(recoveredVaultKey).toBeInstanceOf(CryptoKey);

    // 4. Verify recovered key works on encrypted data
    const message = 'Recovery testing message';
    const encrypted = await encrypt(message, vaultKey);
    const decryptedWithRecoveredKey = await decrypt(encrypted, recoveredVaultKey);

    expect(decryptedWithRecoveredKey).toBe(message);
  });
});
