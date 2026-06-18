import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  useColorScheme, TextInput, ActivityIndicator, Alert, Modal, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getVaultItems, type VaultItem, type DecryptedVaultItem,
  getFolders, buildFolderTree, createFolder, renameFolder, deleteFolder,
  createVaultItem, updateVaultItem, deleteVaultItem,
  type DecryptedFolder, base64ToUint8Array
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

  useEffect(() => {
    SecureStore.getItemAsync('vaultsync-vault-search').then(val => { if (val) setSearch(val); });
    SecureStore.getItemAsync('vaultsync-vault-folder').then(val => { if (val) setSelectedFolderId(val); });
  }, []);

  const updateSearch = (val: string) => {
    setSearch(val);
    SecureStore.setItemAsync('vaultsync-vault-search', val);
  };

  const updateFolder = (val: string | null) => {
    setSelectedFolderId(val);
    if (val) SecureStore.setItemAsync('vaultsync-vault-folder', val);
    else SecureStore.deleteItemAsync('vaultsync-vault-folder');
  };
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

  // Password Details / Edit State
  const [selectedItem, setSelectedItem] = useState<VaultItemWithDecrypted | null>(null);
  const [isDetailEditing, setIsDetailEditing] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailUrl, setDetailUrl] = useState('');
  const [detailUsername, setDetailUsername] = useState('');
  const [detailPassword, setDetailPassword] = useState('');
  const [detailFolderId, setDetailFolderId] = useState('');
  const [detailNotes, setDetailNotes] = useState('');
  const [showDetailFolderSelect, setShowDetailFolderSelect] = useState(false);
  const [isDetailPasswordVisible, setIsDetailPasswordVisible] = useState(false);

  // Add Password State
  const [isAddPasswordVisible, setIsAddPasswordVisible] = useState(false);
  const [addTitle, setAddTitle] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addUsername, setAddUsername] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addFolderId, setAddFolderId] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [showAddFolderSelect, setShowAddFolderSelect] = useState(false);

  const getVaultKey = useCallback(async (): Promise<Uint8Array | null> => {
    const keyBase64 = await SecureStore.getItemAsync('vaultsync-vault-key');
    if (!keyBase64) return null;
    await SecureStore.setItemAsync('vaultsync-last-activity', Date.now().toString());
    return base64ToUint8Array(keyBase64);
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
      if (e instanceof Error && e.message === 'Not authenticated') {
        router.replace('/(auth)/login');
      }
    } finally {
      setLoading(false);
    }
  }, [getVaultKey, router]);

  useEffect(() => {
    loadData();

    let vaultItemsSub: any = null;
    let foldersSub: any = null;

    const setupRealtime = async () => {
      try {
        const { getSession, subscribeToVaultItems, subscribeToFolders } = await import('@vaultsync/core');
        const session = await getSession();
        if (!session || !session.user) return;
        const userId = session.user.id;

        vaultItemsSub = subscribeToVaultItems(userId, () => {
          console.log('[Mobile Realtime] Vault items updated');
          loadData();
        });

        foldersSub = subscribeToFolders(userId, () => {
          console.log('[Mobile Realtime] Folders updated');
          loadData();
        });
      } catch (e) {
        console.warn('[Mobile Realtime] Realtime subscription failed:', e);
      }
    };

    setupRealtime();

    return () => {
      if (vaultItemsSub) vaultItemsSub.unsubscribe();
      if (foldersSub) foldersSub.unsubscribe();
    };
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
              if (selectedFolderId === id) updateFolder(null);
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

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  const handleStartDetailEdit = () => {
    if (!selectedItem) return;
    setDetailTitle(selectedItem.decrypted.title || '');
    setDetailUrl(selectedItem.decrypted.url || '');
    setDetailUsername(selectedItem.decrypted.username || '');
    setDetailPassword(selectedItem.decrypted.password || '');
    setDetailFolderId(selectedItem.folder_id || '');
    setDetailNotes(selectedItem.decrypted.notes || '');
    setIsDetailEditing(true);
  };

  const handleSaveDetailEdit = async () => {
    if (!selectedItem) return;
    try {
      const key = await getVaultKey();
      if (!key) return;
      setLoading(true);

      await updateVaultItem(
        selectedItem.id,
        {
          title: detailTitle,
          username: detailUsername,
          password: detailPassword,
          url: detailUrl,
          notes: detailNotes,
          folderId: detailFolderId || undefined,
        },
        selectedItem.decrypted,
        key
      );

      setIsDetailEditing(false);
      setSelectedItem(null);
      await loadData();
      Alert.alert('Success', 'Credentials updated successfully');
    } catch (e) {
      Alert.alert('Error', 'Failed to update credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDetailItem = async () => {
    if (!selectedItem) return;
    Alert.alert(
      'Delete Credentials',
      'Are you sure you want to delete this credentials? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await deleteVaultItem(selectedItem.id);
              setSelectedItem(null);
              await loadData();
              Alert.alert('Success', 'Credentials deleted');
            } catch (e) {
              Alert.alert('Error', 'Failed to delete credentials');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleAddPassword = async () => {
    if (!addTitle.trim() || !addUsername.trim() || !addPassword.trim()) {
      Alert.alert('Error', 'Please fill in Title, Username, and Password');
      return;
    }
    try {
      const key = await getVaultKey();
      if (!key) return;
      setLoading(true);

      await createVaultItem(
        {
          title: addTitle.trim(),
          username: addUsername.trim(),
          password: addPassword.trim(),
          url: addUrl.trim(),
          notes: addNotes.trim(),
          folderId: addFolderId || undefined,
        },
        key
      );

      setIsAddPasswordVisible(false);
      setAddTitle('');
      setAddUrl('');
      setAddUsername('');
      setAddPassword('');
      setAddFolderId('');
      setAddNotes('');
      await loadData();
      Alert.alert('Success', 'Password saved to vault');
    } catch (e) {
      Alert.alert('Error', 'Failed to save password');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: VaultItemWithDecrypted }) => (
    <TouchableOpacity
      style={[styles.itemRow, { backgroundColor: c.card, borderColor: c.border }]}
      activeOpacity={0.7}
      onPress={() => {
        setIsDetailPasswordVisible(false);
        setSelectedItem(item);
      }}
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
          onPress={() => updateFolder(isActive ? null : folder.id)}
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
      {/* Search & Add */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, gap: 10 }}>
        <TextInput
          style={[styles.searchInput, { flex: 1, backgroundColor: c.card, color: c.text, borderColor: c.border }]}
          placeholder="Search vault..."
          placeholderTextColor={c.placeholder}
          value={search}
          onChangeText={updateSearch}
        />
        <TouchableOpacity
          style={{
            height: 44,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: c.accent,
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onPress={() => setIsAddPasswordVisible(true)}
        >
          <Text style={{ color: '#0a0f1e', fontWeight: '700', fontSize: 14 }}>+ Add</Text>
        </TouchableOpacity>
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

      {/* Add Password Modal */}
      <Modal
        visible={isAddPasswordVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsAddPasswordVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.floatingCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.floatingCardHeader}>
              <Text style={[styles.floatingCardTitle, { color: c.text }]}>Add New Password</Text>
              <TouchableOpacity
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setIsAddPasswordVisible(false)}
              >
                <Text style={{ color: c.textSec, fontSize: 14, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={[styles.inputLabel, { color: c.textSec }]}>Title</Text>
                  <TextInput
                    style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
                    placeholder="e.g. Gmail, Netflix"
                    placeholderTextColor={c.placeholder}
                    value={addTitle}
                    onChangeText={setAddTitle}
                  />
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: c.textSec }]}>Website URL</Text>
                  <TextInput
                    style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
                    placeholder="https://example.com"
                    placeholderTextColor={c.placeholder}
                    value={addUrl}
                    onChangeText={setAddUrl}
                    keyboardType="url"
                    autoCapitalize="none"
                  />
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: c.textSec }]}>Username / Email</Text>
                  <TextInput
                    style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
                    placeholder="your@email.com"
                    placeholderTextColor={c.placeholder}
                    value={addUsername}
                    onChangeText={setAddUsername}
                    autoCapitalize="none"
                  />
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: c.textSec }]}>Password</Text>
                  <TextInput
                    style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
                    placeholder="Enter password"
                    placeholderTextColor={c.placeholder}
                    value={addPassword}
                    onChangeText={setAddPassword}
                    secureTextEntry
                  />
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: c.textSec }]}>Folder</Text>
                  <TouchableOpacity
                    style={[styles.modalInput, { borderColor: c.border, justifyContent: 'center' }]}
                    onPress={() => setShowAddFolderSelect(!showAddFolderSelect)}
                  >
                    <Text style={{ color: addFolderId ? c.text : c.placeholder }}>
                      {addFolderId ? folders.find(f => f.id === addFolderId)?.name : 'Select Folder (Optional)'}
                    </Text>
                  </TouchableOpacity>
                  {showAddFolderSelect && (
                    <View style={{ maxHeight: 100, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 8, marginBottom: 12 }}>
                      <ScrollView nestedScrollEnabled>
                        <TouchableOpacity onPress={() => { setAddFolderId(''); setShowAddFolderSelect(false); }} style={{ paddingVertical: 6 }}>
                          <Text style={{ color: c.textSec }}>No Folder</Text>
                        </TouchableOpacity>
                        {folders.map(f => (
                          <TouchableOpacity key={f.id} onPress={() => { setAddFolderId(f.id); setShowAddFolderSelect(false); }} style={{ paddingVertical: 6 }}>
                            <Text style={{ color: c.text }}>{f.name}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
                <View>
                  <Text style={[styles.inputLabel, { color: c.textSec }]}>Notes</Text>
                  <TextInput
                    style={[styles.modalInput, { borderColor: c.border, color: c.text, height: 80, textAlignVertical: 'top', paddingTop: 8 }]}
                    placeholder="Any additional notes..."
                    placeholderTextColor={c.placeholder}
                    value={addNotes}
                    onChangeText={setAddNotes}
                    multiline
                  />
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                onPress={() => setIsAddPasswordVisible(false)}
              >
                <Text style={{ color: c.textSec, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: c.accent }]}
                onPress={handleAddPassword}
              >
                <Text style={{ color: '#0a0f1e', fontWeight: '700' }}>Add to Vault</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Details Modal (Floating Card) */}
      <Modal
        visible={selectedItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.floatingCard, { backgroundColor: c.card, borderColor: c.border }]}>
            <View style={styles.floatingCardHeader}>
              <Text style={[styles.floatingCardTitle, { color: c.text }]}>
                {isDetailEditing ? 'Edit Credentials' : 'Password Details'}
              </Text>
              <TouchableOpacity
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => { setSelectedItem(null); setIsDetailEditing(false); }}
              >
                <Text style={{ color: c.textSec, fontSize: 14, fontWeight: '700' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {isDetailEditing ? (
                <View style={{ gap: 12 }}>
                  <View>
                    <Text style={[styles.inputLabel, { color: c.textSec }]}>Title</Text>
                    <TextInput
                      style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
                      value={detailTitle}
                      onChangeText={setDetailTitle}
                      placeholder="Title"
                      placeholderTextColor={c.placeholder}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: c.textSec }]}>Website / Domain</Text>
                    <TextInput
                      style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
                      value={detailUrl}
                      onChangeText={setDetailUrl}
                      placeholder="Website URL"
                      placeholderTextColor={c.placeholder}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: c.textSec }]}>Username / Email</Text>
                    <TextInput
                      style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
                      value={detailUsername}
                      onChangeText={setDetailUsername}
                      placeholder="Username"
                      placeholderTextColor={c.placeholder}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: c.textSec }]}>Password</Text>
                    <TextInput
                      style={[styles.modalInput, { borderColor: c.border, color: c.text }]}
                      value={detailPassword}
                      onChangeText={setDetailPassword}
                      placeholder="Password"
                      placeholderTextColor={c.placeholder}
                    />
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: c.textSec }]}>Folder</Text>
                    <TouchableOpacity
                      style={[styles.modalInput, { borderColor: c.border, justifyContent: 'center' }]}
                      onPress={() => setShowDetailFolderSelect(!showDetailFolderSelect)}
                    >
                      <Text style={{ color: detailFolderId ? c.text : c.placeholder }}>
                        {detailFolderId ? folders.find(f => f.id === detailFolderId)?.name : 'No Folder'}
                      </Text>
                    </TouchableOpacity>
                    {showDetailFolderSelect && (
                      <View style={{ maxHeight: 100, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 8, marginBottom: 12 }}>
                        <ScrollView nestedScrollEnabled>
                          <TouchableOpacity onPress={() => { setDetailFolderId(''); setShowDetailFolderSelect(false); }} style={{ paddingVertical: 6 }}>
                            <Text style={{ color: c.textSec }}>No Folder</Text>
                          </TouchableOpacity>
                          {folders.map(f => (
                            <TouchableOpacity key={f.id} onPress={() => { setDetailFolderId(f.id); setShowDetailFolderSelect(false); }} style={{ paddingVertical: 6 }}>
                              <Text style={{ color: c.text }}>{f.name}</Text>
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                  <View>
                    <Text style={[styles.inputLabel, { color: c.textSec }]}>Notes</Text>
                    <TextInput
                      style={[styles.modalInput, { borderColor: c.border, color: c.text, height: 80, textAlignVertical: 'top', paddingTop: 8 }]}
                      value={detailNotes}
                      onChangeText={setDetailNotes}
                      placeholder="Notes"
                      placeholderTextColor={c.placeholder}
                      multiline
                    />
                  </View>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  <View style={[styles.detailCardField, { backgroundColor: c.faviconBg, borderColor: c.border }]}>
                    <Text style={[styles.detailLabel, { color: c.textSec }]}>Title</Text>
                    <Text style={[styles.detailValue, { color: c.text, fontWeight: '700', fontSize: 15 }]}>{selectedItem?.decrypted.title}</Text>
                  </View>

                  <View style={[styles.detailCardField, { backgroundColor: c.faviconBg, borderColor: c.border }]}>
                    <Text style={[styles.detailLabel, { color: c.textSec }]}>Website / Domain</Text>
                    <Text style={[styles.detailValue, { color: c.text }]}>{selectedItem?.domain || selectedItem?.decrypted.url || '—'}</Text>
                  </View>

                  <View style={[styles.detailCardField, { backgroundColor: c.faviconBg, borderColor: c.border }]}>
                    <Text style={[styles.detailLabel, { color: c.textSec }]}>Username / Email</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={[styles.detailValue, { color: c.text, flex: 1 }]} numberOfLines={1}>{selectedItem?.decrypted.username}</Text>
                      <TouchableOpacity onPress={() => copyToClipboard(selectedItem?.decrypted.username || '', 'Username')} style={styles.copyBtnPill}>
                        <Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={[styles.detailCardField, { backgroundColor: c.faviconBg, borderColor: c.border }]}>
                    <Text style={[styles.detailLabel, { color: c.textSec }]}>Password</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <Text style={[styles.detailValue, { color: c.text, flex: 1, fontFamily: isDetailPasswordVisible ? 'System' : 'monospace', letterSpacing: isDetailPasswordVisible ? 0 : 2 }]} numberOfLines={1}>
                        {isDetailPasswordVisible ? selectedItem?.decrypted.password : '••••••••••••••••'}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setIsDetailPasswordVisible(!isDetailPasswordVisible)} style={[styles.copyBtnPill, { backgroundColor: 'rgba(255,255,255,0.04)' }]}>
                          <Text style={{ color: c.textSec, fontSize: 12, fontWeight: '700' }}>{isDetailPasswordVisible ? 'Hide' : 'Show'}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => copyToClipboard(selectedItem?.decrypted.password || '', 'Password')} style={styles.copyBtnPill}>
                          <Text style={{ color: c.accent, fontSize: 12, fontWeight: '700' }}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={[styles.detailCardField, { backgroundColor: c.faviconBg, borderColor: c.border }]}>
                    <Text style={[styles.detailLabel, { color: c.textSec }]}>Folder</Text>
                    <Text style={[styles.detailValue, { color: c.text }]}>
                      {folders.find(f => f.id === selectedItem?.folder_id)?.name || 'No Folder'}
                    </Text>
                  </View>

                  <View style={[styles.detailCardField, { backgroundColor: c.faviconBg, borderColor: c.border, minHeight: 80 }]}>
                    <Text style={[styles.detailLabel, { color: c.textSec }]}>Notes</Text>
                    <Text style={[styles.detailValue, { color: c.text, fontStyle: selectedItem?.decrypted.notes ? 'normal' : 'italic', marginTop: 4 }]}>
                      {selectedItem?.decrypted.notes || 'No notes added'}
                    </Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalButtons}>
              {isDetailEditing ? (
                <>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                    onPress={() => setIsDetailEditing(false)}
                  >
                    <Text style={{ color: c.textSec, fontWeight: '600' }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: c.accent }]}
                    onPress={handleSaveDetailEdit}
                  >
                    <Text style={{ color: '#0a0f1e', fontWeight: '700' }}>Save Changes</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: '#ef4444', marginRight: 'auto' }]}
                    onPress={handleDeleteDetailItem}
                  >
                    <Text style={{ color: '#ffffff', fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]}
                    onPress={() => setSelectedItem(null)}
                  >
                    <Text style={{ color: c.textSec, fontWeight: '600' }}>Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, { backgroundColor: c.accent }]}
                    onPress={handleStartDetailEdit}
                  >
                    <Text style={{ color: '#0a0f1e', fontWeight: '700' }}>Edit</Text>
                  </TouchableOpacity>
                </>
              )}
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
    textAlignVertical: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 10,
  },
  modalBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    maxHeight: '80%',
  },
  floatingCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
    paddingBottom: 12,
  },
  floatingCardTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  copyBtnPill: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  detailCardField: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
});
