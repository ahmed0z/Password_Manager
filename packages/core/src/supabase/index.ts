// ============================================================================
// VaultSync — Supabase Module Barrel Export
// ============================================================================

export { getSupabaseClient, resetSupabaseClient, setSupabaseStorageAdapter, coreStorage } from './client';

export {
  signUp,
  signIn,
  signOut,
  getSession,
  onAuthStateChange,
  recoverUserVaultKey,
  sendRecoveryEmail,
} from './auth';

export {
  createVaultItem,
  getVaultItems,
  getVaultItemsByFolder,
  getVaultItemsByDomain,
  updateVaultItem,
  deleteVaultItem,
  toggleFavorite,
  subscribeToVaultItems,
} from './vault-items';

export {
  createFolder,
  getFolders,
  buildFolderTree,
  renameFolder,
  deleteFolder,
  subscribeToFolders,
} from './folders';

export {
  syncBookmarks,
  getBookmarks,
  deleteBookmark,
  updateBookmark,
  clearAllBookmarks,
  subscribeToBookmarks,
  renameBookmarkFolder,
  deleteBookmarkFolder,
} from './bookmarks';
