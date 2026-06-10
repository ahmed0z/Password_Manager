import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  useColorScheme, Linking, ActivityIndicator, Alert, Modal, TextInput,
} from 'react-native';
import {
  getBookmarks, type Bookmark, type DecryptedBookmark,
  renameBookmarkFolder, deleteBookmarkFolder, buildBookmarkFolderTree,
  type BookmarkFolderNode
} from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';

type BookmarkWithDecrypted = Bookmark & { decrypted: DecryptedBookmark };

export default function BookmarksScreen() {
  const isDark = useColorScheme() === 'dark';
  const c = isDark ? dark : light;
  const [bookmarks, setBookmarks] = useState<BookmarkWithDecrypted[]>([]);
  const [loading, setLoading] = useState(true);

  // Folder State
  const [folderTree, setFolderTree] = useState<BookmarkFolderNode[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
  };

  // Modals state
  const [isBookmarkFolderModalVisible, setIsBookmarkFolderModalVisible] = useState<'add' | 'rename' | null>(null);
  const [bookmarkOldPath, setBookmarkOldPath] = useState('');
  const [bookmarkNewPath, setBookmarkNewPath] = useState('');

  const getVaultKey = useCallback(async (): Promise<CryptoKey | null> => {
    const keyBase64 = await SecureStore.getItemAsync('vaultsync-vault-key');
    if (!keyBase64) return null;
    const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const key = await getVaultKey();
      if (!key) return;
      const data = await getBookmarks(key);
      setBookmarks(data);

      // Extract bookmark folders
      const paths = new Set<string>();
      data.forEach((b) => {
        if (b.decrypted.folderPath) {
          paths.add(b.decrypted.folderPath);
        }
      });
      const storedEmpty = await SecureStore.getItemAsync('vaultsync-empty-bookmark-folders');
      if (storedEmpty) {
        try {
          const emptyList: string[] = JSON.parse(storedEmpty);
          emptyList.forEach((p) => paths.add(p));
        } catch {}
      }
      setBookmarkFolderTree(buildBookmarkFolderTree(Array.from(paths)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [getVaultKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -- Bookmark Folder CRUD Handlers --
  const handleCreateBookmarkFolder = async () => {
    if (!bookmarkNewPath.trim()) return;
    const path = bookmarkNewPath.trim();
    try {
      const storedEmpty = await SecureStore.getItemAsync('vaultsync-empty-bookmark-folders');
      let emptyList: string[] = [];
      if (storedEmpty) {
        try { emptyList = JSON.parse(storedEmpty); } catch {}
      }
      if (!emptyList.includes(path)) {
        emptyList.push(path);
        await SecureStore.setItemAsync('vaultsync-empty-bookmark-folders', JSON.stringify(emptyList));
      }
      setIsBookmarkFolderModalVisible(null);
      await loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to create folder');
    }
  };

  const handleRenameBookmarkFolder = async () => {
    if (!bookmarkNewPath.trim() || !bookmarkOldPath) return;
    try {
      const key = await getVaultKey();
      if (!key) return;
      setLoading(true);
      const newPath = bookmarkNewPath.trim();
      await renameBookmarkFolder(bookmarkOldPath, newPath, key);

      const storedEmpty = await SecureStore.getItemAsync('vaultsync-empty-bookmark-folders');
      if (storedEmpty) {
        try {
          let emptyList: string[] = JSON.parse(storedEmpty);
          emptyList = emptyList.map(p => {
            if (p === bookmarkOldPath) return newPath;
            if (p.startsWith(bookmarkOldPath + '/')) {
              return newPath + p.substring(bookmarkOldPath.length);
            }
            return p;
          });
          await SecureStore.setItemAsync('vaultsync-empty-bookmark-folders', JSON.stringify(emptyList));
        } catch {}
      }
      setIsBookmarkFolderModalVisible(null);
      if (selectedFolderPath === bookmarkOldPath) setSelectedFolderPath(newPath);
      await loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to rename folder');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBookmarkFolder = async (path: string) => {
    Alert.alert(
      'Delete Folder',
      `Are you sure you want to delete folder "${path}"? Bookmarks will move to root.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const key = await getVaultKey();
              if (!key) return;
              setLoading(true);
              await deleteBookmarkFolder(path, key);

              const storedEmpty = await SecureStore.getItemAsync('vaultsync-empty-bookmark-folders');
              if (storedEmpty) {
                try {
                  let emptyList: string[] = JSON.parse(storedEmpty);
                  emptyList = emptyList.filter(p => p !== path && !p.startsWith(path + '/'));
                  await SecureStore.setItemAsync('vaultsync-empty-bookmark-folders', JSON.stringify(emptyList));
                } catch {}
              }
              if (selectedFolderPath === path) setSelectedFolderPath(null);
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

  const openUrl = (url: string) => {
    Linking.openURL(url.startsWith('http') ? url : `https://${url}`);
  };

  const filtered = bookmarks.filter((b) => {
    if (selectedFolderPath) {
      const path = b.decrypted.folderPath || '';
      if (path !== selectedFolderPath && !path.startsWith(selectedFolderPath + '/')) return false;
    }
    return true;
  });

  const renderBookmarkFolderNode = (node: BookmarkFolderNode, level = 0) => {
    const isActive = selectedFolderPath === node.path;
    const isExpanded = expandedFolders[node.path];
    const hasChildren = node.children && node.children.length > 0;

    return (
      <View key={node.path}>
        <TouchableOpacity
          style={[
            styles.folderRow,
            { paddingLeft: level * 16 + 12 },
            isActive && { backgroundColor: c.badgeBg }
          ]}
          onPress={() => setSelectedFolderPath(isActive ? null : node.path)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {hasChildren ? (
              <TouchableOpacity
                onPress={() => toggleFolder(node.path)}
                style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: c.textSec, fontSize: 10 }}>{isExpanded ? '▼' : '▶'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.folderNodeText, { color: isActive ? c.accent : c.text }]}>
              📁 {node.name}
            </Text>
          </View>
          <View style={styles.folderRowActions}>
            <TouchableOpacity
              onPress={() => {
                setBookmarkOldPath(node.path);
                setBookmarkNewPath(node.path);
                setIsBookmarkFolderModalVisible('rename');
              }}
              style={styles.folderActionIcon}
            >
              <Text style={{ color: c.accent, fontSize: 13, fontWeight: '700' }}>✏️</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteBookmarkFolder(node.path)}
              style={styles.folderActionIcon}
            >
              <Text style={{ color: '#ef4444', fontSize: 13, fontWeight: '700' }}>🗑️</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        {hasChildren && isExpanded && node.children!.map(child => renderBookmarkFolderNode(child, level + 1))}
      </View>
    );
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator size="large" color={c.accent} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
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
            {selectedFolderPath && (
              <View style={[styles.activeFolderBadge, { backgroundColor: c.badgeBg }]}>
                <Text style={{ color: c.accent, fontSize: 10, fontWeight: '600' }}>
                  {selectedFolderPath}
                </Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                setBookmarkNewPath('');
                setIsBookmarkFolderModalVisible('add');
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
            {bookmarkFolderTree.length === 0 ? (
              <Text style={{ color: c.textSec, fontSize: 12, padding: 12, textAlign: 'center' }}>
                No folders created yet.
              </Text>
            ) : (
              bookmarkFolderTree.map((node) => renderBookmarkFolderNode(node, 0))
            )}
          </View>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.bookmarkCard, { backgroundColor: c.card, borderColor: c.border }]}
            onPress={() => openUrl(item.decrypted.url)}
            activeOpacity={0.7}
          >
            <View style={[styles.bookmarkIcon, { backgroundColor: c.iconBg }]}>
              <Text style={{ fontSize: 20 }}>🔗</Text>
            </View>
            <Text style={[styles.bookmarkTitle, { color: c.text }]} numberOfLines={2}>
              {item.decrypted.title}
            </Text>
            <Text style={[styles.bookmarkUrl, { color: c.textSec }]} numberOfLines={1}>
              {item.decrypted.url}
            </Text>
            {item.decrypted.folderPath && (
              <View style={[styles.folderBadge, { backgroundColor: c.badgeBg }]}>
                <Text style={[styles.folderText, { color: c.textSec }]}>
                  📁 {item.decrypted.folderPath}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={{ fontSize: 48, marginBottom: 16 }}>📚</Text>
            <Text style={[styles.emptyTitle, { color: c.text }]}>No bookmarks</Text>
            <Text style={[styles.emptySubtitle, { color: c.textSec }]}>
              Sync bookmarks from the Chrome extension
            </Text>
          </View>
        }
      />

      {/* Bookmark Folder Modal */}
      <Modal
        visible={isBookmarkFolderModalVisible !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setIsBookmarkFolderModalVisible(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: c.card }]}>
            <Text style={[styles.modalTitle, { color: c.text }]}>
              {isBookmarkFolderModalVisible === 'add' ? 'Create Bookmark Folder' : 'Rename Bookmark Folder'}
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
              placeholder="Folder Path (e.g. Work/Finance)"
              placeholderTextColor={c.placeholder}
              value={bookmarkNewPath}
              onChangeText={setBookmarkNewPath}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                onPress={() => setIsBookmarkFolderModalVisible(null)}
              >
                <Text style={{ color: c.textSec, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.accent }]}
                onPress={
                  isBookmarkFolderModalVisible === 'add'
                    ? handleCreateBookmarkFolder
                    : handleRenameBookmarkFolder
                }
              >
                <Text style={{ color: '#0a0f1e', fontWeight: '700' }}>
                  {isBookmarkFolderModalVisible === 'add' ? 'Create' : 'Rename'}
                </Text>
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
  accent: '#5ce0d6', border: 'rgba(255,255,255,0.06)', iconBg: '#1e2438',
  badgeBg: 'rgba(92,224,214,0.08)', placeholder: 'rgba(255,255,255,0.3)',
};
const light = {
  bg: '#f5f5f7', card: '#ffffff', text: '#151b33', textSec: '#6b7280',
  accent: '#2563eb', border: 'rgba(0,0,0,0.08)', iconBg: '#f0f0f2',
  badgeBg: 'rgba(37,99,235,0.06)', placeholder: 'rgba(0,0,0,0.3)',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 100 },
  gridRow: { gap: 10 },
  bookmarkCard: {
    flex: 1, padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 10,
  },
  bookmarkIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  bookmarkTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  bookmarkUrl: { fontSize: 11, marginBottom: 8 },
  folderBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start' },
  folderText: { fontSize: 10, fontWeight: '500' },
  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', paddingHorizontal: 40 },

  // Folders UI
  folderCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
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
