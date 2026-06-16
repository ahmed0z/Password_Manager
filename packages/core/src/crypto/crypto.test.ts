import { describe, it, expect } from 'vitest';
import {
  generateSalt,
  deriveVaultKeyBytes,
  deriveAuthKeyHex,
  createRecoveryKeyBlob,
  recoverVaultKeyBytes,
} from './vault-key';
import { encrypt, decrypt, encryptObject, decryptObject } from './encrypt';

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

    const vaultKey = await deriveVaultKeyBytes(password, salt);
    const authKey = await deriveAuthKeyHex(password, salt);

    expect(vaultKey).toBeInstanceOf(Uint8Array);
    expect(typeof authKey).toBe('string');
    expect(authKey.length).toBe(64); // 256-bit key in hex is 64 chars
  });

  it('should encrypt and decrypt plaintext correctly', async () => {
    const password = 'MySecretPassword';
    const salt = generateSalt();
    const plaintext = 'This is a super secret message.';

    const vaultKey = await deriveVaultKeyBytes(password, salt);
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

    const vaultKey = await deriveVaultKeyBytes(password, salt);
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
    const vaultKey = await deriveVaultKeyBytes(masterPassword, salt);

    // 2. Generate encrypted recovery key blob
    const recoveryBlob = await createRecoveryKeyBlob(vaultKey, email, masterPassword);

    expect(recoveryBlob.encryptedRecoveryKey).toBeDefined();
    expect(recoveryBlob.recoveryIv).toBeDefined();
    expect(recoveryBlob.recoverySalt).toBeDefined();

    // 3. User recovers their vault key using email and master password
    const recoveredVaultKey = await recoverVaultKeyBytes(
      recoveryBlob.encryptedRecoveryKey,
      recoveryBlob.recoveryIv,
      recoveryBlob.recoverySalt,
      email,
      masterPassword
    );

    expect(recoveredVaultKey).toBeInstanceOf(Uint8Array);

    // 4. Verify recovered key works on encrypted data
    const message = 'Recovery testing message';
    const encrypted = await encrypt(message, vaultKey);
    const decryptedWithRecoveredKey = await decrypt(encrypted, recoveredVaultKey);

    expect(decryptedWithRecoveredKey).toBe(message);
  });
});
