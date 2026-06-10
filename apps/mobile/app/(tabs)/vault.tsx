import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  useColorScheme, TextInput, ActivityIndicator, Alert, Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getVaultItems, type VaultItem, type DecryptedVaultItem,
  getFolders, buildFolderTree, createFolder, renameFolder, deleteFolder,
  type DecryptedFolder
} from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';

type VaultItemWithDecrypted = VaultItem & { decrypted: DecryptedVaultItem };

export default function VaultScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const c = isDark ? dark : light;

  const [items, setItems] = useState<VaultItemWithDecrypted[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Folders State
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [folderTree, setFolderTree] = useState<DecryptedFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Modals state
  const [isAddFolderVisible, setIsAddFolderVisible] = useState(false);
  const [isRenameFolderVisible, setIsRenameFolderVisible] = useState(false);
  const [folderParentId, setFolderParentId] = useState<string | undefined>(undefined);
  const [folderRenameId, setFolderRenameId] = useState<string | null>(null);
  const [folderRenameName, setFolderRenameName] = useState('');
  const [folderNewName, setFolderNewName] = useState('');

  const getVaultKey = useCallback(async (): Promise<CryptoKey | null> => {
    const keyBase64 = await SecureStore.getItemAsync('vaultsync-vault-key');
    if (!keyBase64) return null;
    const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const key = await getVaultKey();
      if (!key) { router.replace('/(auth)/login'); return; }
      const data = await getVaultItems(key);
      setItems(data);

      const folderData = await getFolders(key);
      setFolders(folderData);
      setFolderTree(buildFolderTree(folderData));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getVaultKey, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -- Folder CRUD Handlers --
  const handleCreateFolder = async () => {
    if (!folderNewName.trim()) return;
    try {
      const key = await getVaultKey();
      if (!key) return;
      setLoading(true);
      await createFolder(folderNewName.trim(), key, folderParentId);
      setIsAddFolderVisible(false);
      await loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to create folder');
    } finally {
      setLoading(false);
    }
  };

  const handleRenameFolder = async () => {
    if (!folderRenameId || !folderRenameName.trim()) return;
    try {
      const key = await getVaultKey();
      if (!key) return;
      setLoading(true);
      await renameFolder(folderRenameId, folderRenameName.trim(), key);
      setIsRenameFolderVisible(false);
      await loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to rename folder');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteFolder = async (id: string) => {
    Alert.alert(
      'Delete Folder',
      'Are you sure you want to delete this folder? Passwords will be moved to root.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteFolder(id);
              if (selectedFolderId === id) setSelectedFolderId(null);
              await loadData();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete folder');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const filtered = items.filter((i) => {
    if (selectedFolderId && i.folder_id !== selectedFolderId) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return i.decrypted.title.toLowerCase().includes(q) || i.decrypted.username.toLowerCase().includes(q);
  });

  const copyPassword = async (password: string) => {
    await Clipboard.setStringAsync(password);
    Alert.alert('Copied', 'Password copied to clipboard');
  };

  const renderItem = ({ item }: { item: VaultItemWithDecrypted }) => (
    <TouchableOpacity
      style={[styles.itemRow, { backgroundColor: c.card, borderColor: c.border }]}
      activeOpacity={0.7}
      onPress={() => copyPassword(item.decrypted.password)}
      onLongPress={() => {/* navigate to detail */}}
    >
      <View style={[styles.favicon, { backgroundColor: c.faviconBg }]}>
        <Text style={{ fontSize: 18 }}>🔑</Text>
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.itemTitle, { color: c.text }]} numberOfLines={1}>
          {item.decrypted.title}
        </Text>
        <Text style={[styles.itemSubtitle, { color: c.textSec }]} numberOfLines={1}>
          {item.decrypted.username}
        </Text>
      </View>
      <View style={[styles.domainBadge, { backgroundColor: c.badgeBg }]}>
        <Text style={[styles.domainText, { color: c.textSec }]} numberOfLines={1}>
          {item.domain || '—'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderFolderNode = (folder: DecryptedFolder, level = 0) => {
    const isActive = selectedFolderId === folder.id;
    const isExpanded = expandedFolders[folder.id];
    const hasChildren = folder.children && folder.children.length > 0;

    return (
      <View key={folder.id}>
        <TouchableOpacity
          style={[
            styles.folderRow,
            { paddingLeft: level * 16 + 12 },
            isActive && { backgroundColor: c.badgeBg }
          ]}
          onPress={() => setSelectedFolderId(isActive ? null : folder.id)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {hasChildren ? (
              <TouchableOpacity
                onPress={() => toggleFolder(folder.id)}
                style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: c.textSec, fontSize: 10 }}>{isExpanded ? '▼' : '▶'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.folderNodeText, { color: isActive ? c.accent : c.text }]}>
              📁 {folder.name}
            </Text>
          </View>
          <View style={styles.folderRowActions}>
            <TouchableOpacity
              onPress={() => {
                setFolderParentId(folder.id);
                setFolderNewName('');
                setIsAddFolderVisible(true);
              }}
              style={styles.folderActionIcon}
            >
              <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>➕</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setFolderRenameId(folder.id);
                setFolderRenameName(folder.name);
                setIsRenameFolderVisible(true);
              }}
              style={styles.folderActionIcon}
            >
              <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteFolder(folder.id)}
              style={styles.folderActionIcon}
            >
              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700' }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        {hasChildren && isExpanded && folder.children!.map(child => renderFolderNode(child, level + 1))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: c.bg }]}>
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: c.card, color: c.text, borderColor: c.border }]}
          placeholder="Search vault..."
          placeholderTextColor={c.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statNumber, { color: c.accent }]}>{items.length}</Text>
          <Text style={[styles.statLabel, { color: c.textSec }]}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statNumber, { color: '#eab308' }]}>
            {items.filter((i) => i.is_favorite).length}
          </Text>
          <Text style={[styles.statLabel, { color: c.textSec }]}>Favorites</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: c.card, borderColor: c.border }]}>
          <Text style={[styles.statNumber, { color: '#22c55e' }]}>256</Text>
          <Text style={[styles.statLabel, { color: c.textSec }]}>AES Bits</Text>
        </View>
      </View>

      {/* Folders Card */}
      <View style={[styles.folderCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <TouchableOpacity
          style={styles.folderCardHeader}
          onPress={() => setIsFoldersCollapsed(!isFoldersCollapsed)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 16 }}>📁</Text>
            <Text style={[styles.folderCardTitle, { color: c.text }]}>Folders</Text>
            {selectedFolderId && (
              <View style={[styles.activeFolderBadge, { backgroundColor: c.badgeBg }]}>
                <Text style={{ color: c.accent, fontSize: 10, fontWeight: '600' }}>
                  {folders.find(f => f.id === selectedFolderId)?.name || 'Filtered'}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                setFolderParentId(undefined);
                setFolderNewName('');
                setIsAddFolderVisible(true);
              }}
              style={styles.addFolderBtn}
            >
              <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>+ Add</Text>
            </TouchableOpacity>
            <Text style={{ color: c.textSec, fontSize: 12 }}>
              {isFoldersCollapsed ? '▼' : '▲'}
            </Text>
          </View>
        </TouchableOpacity>

        {!isFoldersCollapsed && (
          <View style={styles.folderListContainer}>
            {folderTree.length === 0 ? (
              <Text style={{ color: c.textSec, fontSize: 12, padding: 12, textAlign: 'center' }}>
                No folders created yet.
              </Text>
            ) : (
              folderTree.map((f) => renderFolderNode(f, 0))
            )}
          </View>
        )}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No passwords yet</Text>
            <Text style={[styles.emptySubtitle, { color: c.textSec }]}>
              Add passwords via the web app or Chrome extension
            </Text>
          </View>
        }
      />

      {/* Add Folder Modal */}
      <Modal
        visible={isAddFolderVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddFolderVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.card }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {folderParentId ? 'Add Subfolder' : 'Create Folder'}
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
              placeholder="Folder Name"
              placeholderTextColor={c.placeholder}
              value={folderNewName}
              onChangeText={setFolderNewName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                onPress={() => setIsAddFolderVisible(false)}
              >
                <Text style={{ color: c.textSec, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.accent }]}
                onPress={handleCreateFolder}
              >
                <Text style={{ color: '#0a0f1e', fontWeight: '700' }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Rename Folder Modal */}
      <Modal
        visible={isRenameFolderVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenameFolderVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.card }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>Rename Folder</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
              placeholder="Folder Name"
              placeholderTextColor={c.placeholder}
              value={folderRenameName}
              onChangeText={setFolderRenameName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                onPress={() => setIsRenameFolderVisible(false)}
              >
                <Text style={{ color: c.textSec, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.accent }]}
                onPress={handleRenameFolder}
              >
                <Text style={{ color: '#0a0f1e', fontWeight: '700' }}>Rename</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const dark = {
  bg: '#0a0f1e', card: '#141928', text: '#f2f2f2', textSec: '#8a8f9e',
  accent: '#5ce0d6', border: 'rgba(255,255,255,0.06)', placeholder: 'rgba(255,255,255,0.3)',
  faviconBg: '#1e2438', badgeBg: 'rgba(92,224,214,0.1)',
};
const light = {
  bg: '#f5f5f7', card: '#ffffff', text: '#151b33', textSec: '#6b7280',
  accent: '#2563eb', border: 'rgba(0,0,0,0.08)', placeholder: 'rgba(0,0,0,0.3)',
  faviconBg: '#f0f0f2', badgeBg: 'rgba(37,99,235,0.08)',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchContainer: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 },
  searchInput: { height: 44, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
  statNumber: { fontSize: 24, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '600', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  itemRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12,
    borderWidth: 1, marginBottom: 8, gap: 12,
  },
  favicon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  itemSubtitle: { fontSize: 13, marginTop: 2 },
  domainBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, maxWidth: 80 },
  domainText: { fontSize: 10, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },

  // Folders UI
  folderCard: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },
  folderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderCardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  activeFolderBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  addFolderBtn: {
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  folderListContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 8,
  },
  folderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderRadius: 6,
    marginVertical: 1,
  },
  folderNodeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  folderRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  folderActionIcon: {
    padding: 4,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
