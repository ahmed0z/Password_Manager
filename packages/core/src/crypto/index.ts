// ============================================================================
// VaultSync — Crypto Module Barrel Export
// ============================================================================

export {
  generateSalt,
  deriveVaultKeyBytes,
  deriveAuthKeyHex,
  createRecoveryKeyBlob,
  recoverVaultKeyBytes,
  uint8ArrayToBase64,
  base64ToUint8Array,
  uint8ArrayToHex,
} from './vault-key';

export {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
  encryptRaw,
  decryptRaw,
} from './encrypt';
