// ============================================================================
// VaultSync — Crypto Module Barrel Export
// ============================================================================

export {
  generateSalt,
  deriveVaultKey,
  deriveAuthKey,
  exportKey,
  importKey,
  createRecoveryKey,
  recoverVaultKey,
  uint8ArrayToBase64,
  base64ToUint8Array,
  uint8ArrayToHex,
} from './vault-key';

export {
  encrypt,
  decrypt,
  encryptObject,
  decryptObject,
} from './encrypt';
