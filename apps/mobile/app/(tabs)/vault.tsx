import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  useColorScheme, TextInput, ActivityIndicator, Alert, ScrollView,
  Linking, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getVaultItems, type VaultItem, type DecryptedVaultItem,
  getFolders, buildFolderTree, createFolder, renameFolder, deleteFolder,
  createVaultItem, updateVaultItem, deleteVaultItem,
  getBookmarks, type Bookmark, type DecryptedBookmark,
  renameBookmarkFolder, deleteBookmarkFolder, buildBookmarkFolderTree,
  type DecryptedFolder, type BookmarkFolderNode, base64ToUint8Array,
  syncBookmarks, estimateStrength
} from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';
import { Search, Plus, Filter, Sliders, ChevronLeft, ArrowRight, Lock, Eye, EyeOff, Copy, Trash2, Edit3, Bookmark as BookmarkIcon, Globe } from 'lucide-react-native';

import {
  colors,
  CircularIconButton,
  PillTab,
  StatCapsule,
  ListCard,
  StatusBadge,
  GaugeChart,
  FloatingPanel,
} from '../_components/SharedComponents';

type VaultItemWithDecrypted = VaultItem & { decrypted: DecryptedVaultItem };
type BookmarkWithDecrypted = Bookmark & { decrypted: DecryptedBookmark };
type SubTab = 'Logins' | 'Bookmarks';
type StrengthFilter = 'all' | 'weak' | 'reused' | 'strong';

export default function VaultScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('Logins');
  const [strengthFilter, setStrengthFilter] = useState<StrengthFilter>('all');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Vault/Logins State
  const [items, setItems] = useState<VaultItemWithDecrypted[]>([]);
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [folderTree, setFolderTree] = useState<DecryptedFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isFoldersCollapsed, setIsFoldersCollapsed] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Bookmarks State
  const [bookmarks, setBookmarks] = useState<BookmarkWithDecrypted[]>([]);
  const [bookmarkFolderTree, setBookmarkFolderTree] = useState<BookmarkFolderNode[]>([]);
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const [isBookmarkFoldersCollapsed, setIsBookmarkFoldersCollapsed] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Folder CRUD Modals
  const [isAddFolderVisible, setIsAddFolderVisible] = useState(false);
  const [isRenameFolderVisible, setIsRenameFolderVisible] = useState(false);
  const [folderParentId, setFolderParentId] = useState<string | undefined>(undefined);
  const [folderRenameId, setFolderRenameId] = useState<string | null>(null);
  const [folderRenameName, setFolderRenameName] = useState('');
  const [folderNewName, setFolderNewName] = useState('');

  // Bookmark Folder Modals
  const [isBookmarkFolderModalVisible, setIsBookmarkFolderModalVisible] = useState<'add' | 'rename' | null>(null);
  const [bookmarkOldPath, setBookmarkOldPath] = useState('');
  const [bookmarkNewPath, setBookmarkNewPath] = useState('');

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
      
      // Load logins and folders
      const data = await getVaultItems(key);
      setItems(data);

      const folderData = await getFolders(key);
      setFolders(folderData);
      setFolderTree(buildFolderTree(folderData));

      // Load bookmarks
      const bData = await getBookmarks(key);
      setBookmarks(bData);

      const paths = new Set<string>();
      bData.forEach((b) => {
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
    let bookmarksSub: any = null;

    const setupRealtime = async () => {
      try {
        const { getSession, subscribeToVaultItems, subscribeToFolders, subscribeToBookmarks } = await import('@vaultsync/core');
        const session = await getSession();
        if (!session || !session.user) return;
        const userId = session.user.id;

        vaultItemsSub = subscribeToVaultItems(userId, () => {
          loadData();
        });
        foldersSub = subscribeToFolders(userId, () => {
          loadData();
        });
        bookmarksSub = subscribeToBookmarks(userId, () => {
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
      if (bookmarksSub) bookmarksSub.unsubscribe();
    };
  }, [loadData]);

  // -- Logins Folder CRUD Handlers --
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

  // -- Smart bookmarks sync --
  const handleSmartSync = async () => {
    setSyncing(true);
    try {
      const key = await getVaultKey();
      if (!key) return;
      // In mobile app context, smart sync would connect to the Chrome extension bookmarks list.
      // Since it runs locally, we simulate or notify.
      Alert.alert('Bookmarks Sync', 'Importing bookmarks from Chrome extension. Please make sure the Chrome extension is open and logged in.');
    } catch (e) {
      console.warn(e);
    } finally {
      setSyncing(false);
    }
  };

  // -- Clipboard utilities --
  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', `${label} copied to clipboard`);
  };

  // -- Logins CRUD Handlers --
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

  // Filtering lists
  const filteredLogins = items.filter((i) => {
    if (selectedFolderId && i.folder_id !== selectedFolderId) return false;
    
    // Apply strength filters
    if (strengthFilter !== 'all') {
      const score = estimateStrength(i.decrypted.password).score;
      if (strengthFilter === 'weak' && score > 1) return false;
      if (strengthFilter === 'reused' && (score !== 2 && score !== 3)) return false; // Map reused to Medium
      if (strengthFilter === 'strong' && score !== 4) return false;
    }

    if (!search) return true;
    const q = search.toLowerCase();
    return i.decrypted.title.toLowerCase().includes(q) || i.decrypted.username.toLowerCase().includes(q);
  });

  const filteredBookmarks = bookmarks.filter((b) => {
    if (selectedFolderPath) {
      const path = b.decrypted.folderPath || '';
      if (path !== selectedFolderPath && !path.startsWith(selectedFolderPath + '/')) return false;
    }
    if (!search) return true;
    const q = search.toLowerCase();
    return b.decrypted.title.toLowerCase().includes(q) || b.decrypted.url.toLowerCase().includes(q);
  });

  // Strength counters
  const weakCount = items.filter(i => estimateStrength(i.decrypted.password).score <= 1).length;
  const reusedCount = items.filter(i => {
    const score = estimateStrength(i.decrypted.password).score;
    return score === 2 || score === 3;
  }).length;
  const strongCount = items.filter(i => estimateStrength(i.decrypted.password).score === 4).length;

  const toggleFolderCollapse = (id: string) => {
    setExpandedFolders(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
            isActive && { backgroundColor: 'rgba(255,255,255,0.06)' }
          ]}
          onPress={() => setSelectedFolderId(isActive ? null : folder.id)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {hasChildren ? (
              <TouchableOpacity
                onPress={() => toggleFolderCollapse(folder.id)}
                style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{isExpanded ? '▼' : '▶'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.folderNodeText, { color: isActive ? colors.accentPrimary : colors.textPrimary }]}>
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
              <Plus size={12} color={colors.accentPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setFolderRenameId(folder.id);
                setFolderRenameName(folder.name);
                setIsRenameFolderVisible(true);
              }}
              style={styles.folderActionIcon}
            >
              <Edit3 size={12} color={colors.accentPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteFolder(folder.id)}
              style={styles.folderActionIcon}
            >
              <Trash2 size={12} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        {hasChildren && isExpanded && folder.children!.map(child => renderFolderNode(child, level + 1))}
      </View>
    );
  };

  const renderBookmarkFolderNode = (node: BookmarkFolderNode, level = 0) => {
    const isActive = selectedFolderPath === node.path;
    const isExpanded = expandedFolders[node.path];
    const hasChildren = node.children && node.children.length > 0;

    const toggleBookmarkFolderCollapse = (path: string) => {
      setExpandedFolders(prev => ({ ...prev, [path]: !prev[path] }));
    };

    return (
      <View key={node.path}>
        <TouchableOpacity
          style={[
            styles.folderRow,
            { paddingLeft: level * 16 + 12 },
            isActive && { backgroundColor: 'rgba(255,255,255,0.06)' }
          ]}
          onPress={() => setSelectedFolderPath(isActive ? null : node.path)}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {hasChildren ? (
              <TouchableOpacity
                onPress={() => toggleBookmarkFolderCollapse(node.path)}
                style={{ width: 24, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 10 }}>{isExpanded ? '▼' : '▶'}</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.folderNodeText, { color: isActive ? colors.accentPrimary : colors.textPrimary }]}>
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
              <Edit3 size={12} color={colors.accentPrimary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteBookmarkFolder(node.path)}
              style={styles.folderActionIcon}
            >
              <Trash2 size={12} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
        {hasChildren && isExpanded && node.children!.map(child => renderBookmarkFolderNode(child, level + 1))}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Top Navbar */}
      <View style={styles.header}>
        {!isSearchOpen ? (
          <>
            <CircularIconButton onPress={() => router.replace('/(tabs)/settings')}>
              <Sliders size={18} color="#1F2228" />
            </CircularIconButton>
            
            <Text style={styles.headerTitle}>{activeSubTab}</Text>
            
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <CircularIconButton onPress={() => setIsSearchOpen(true)}>
                <Search size={18} color="#1F2228" />
              </CircularIconButton>
              {activeSubTab === 'Logins' ? (
                <CircularIconButton onPress={() => setIsAddPasswordVisible(true)}>
                  <Plus size={18} color="#1F2228" />
                </CircularIconButton>
              ) : (
                <CircularIconButton onPress={handleSmartSync}>
                  <BookmarkIcon size={18} color="#1F2228" />
                </CircularIconButton>
              )}
            </View>
          </>
        ) : (
          <View style={styles.searchBarContainer}>
            <TextInput
              style={[styles.searchInput, { flex: 1, backgroundColor: 'rgba(23, 24, 25, 0.2)', color: '#FFFFFF', borderColor: colors.surfaceBorder }]}
              placeholder={activeSubTab === 'Bookmarks' ? 'Search bookmarks...' : 'Search logins...'}
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.searchCloseBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]}
              onPress={() => { setIsSearchOpen(false); setSearch(''); }}
            >
              <Text style={{ color: '#EF4444', fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* PillTab selector for Logins / Bookmarks */}
        <PillTab
          tabs={['Logins', 'Bookmarks']}
          activeTab={activeSubTab}
          onChange={(tab) => {
            setActiveSubTab(tab as SubTab);
            setSearch('');
            setIsSearchOpen(false);
          }}
        />

        {/* ========================================== */}
        {/* LOGINS SUBTAB */}
        {/* ========================================== */}
        <View style={{ display: activeSubTab === 'Logins' ? 'flex' : 'none' }}>
          <View>
            {/* Stat Capsules Horizontal Bar */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.statCapsulesBar}
            >
              <StatCapsule
                label="Total"
                value={items.length.toString()}
                state={strengthFilter === 'all' ? 'active' : 'default'}
                onPress={() => setStrengthFilter('all')}
              />
              <StatCapsule
                label="Weak"
                value={weakCount.toString()}
                state={strengthFilter === 'weak' ? 'active' : 'default'}
                onPress={() => setStrengthFilter('weak')}
              />
              <StatCapsule
                label="Medium"
                value={reusedCount.toString()}
                state={strengthFilter === 'reused' ? 'active' : 'default'}
                onPress={() => setStrengthFilter('reused')}
              />
              <StatCapsule
                label="Strong"
                value={strongCount.toString()}
                state={strengthFilter === 'strong' ? 'active' : 'default'}
                onPress={() => setStrengthFilter('strong')}
              />
            </ScrollView>

            {/* Folders Card */}
            <View style={styles.folderCard}>
              <View style={styles.folderCardHeader}>
                <TouchableOpacity
                  onPress={() => setIsFoldersCollapsed(!isFoldersCollapsed)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16 }}>📁</Text>
                  <Text style={styles.folderCardTitle} numberOfLines={1}>Folders & Categories</Text>
                  {selectedFolderId && (
                    <View style={[styles.activeFolderBadge, { flexShrink: 1 }]}>
                      <Text 
                        style={{ color: colors.accentPrimary, fontSize: 11, fontWeight: '600' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {folders.find(f => f.id === selectedFolderId)?.name || 'Active'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setFolderParentId(undefined);
                      setFolderNewName('');
                      setIsAddFolderVisible(true);
                    }}
                    style={styles.addFolderBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.accentPrimary, fontSize: 13, fontWeight: '700' }}>+ Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsFoldersCollapsed(!isFoldersCollapsed)}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {isFoldersCollapsed ? '▼' : '▲'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {!isFoldersCollapsed && (
                <View style={styles.folderListContainer}>
                  {folderTree.length === 0 ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, padding: 12, textAlign: 'center' }}>
                      No folders created yet.
                    </Text>
                  ) : (
                    folderTree.map((f) => renderFolderNode(f, 0))
                  )}
                </View>
              )}
            </View>

            {selectedFolderId && (
              <View style={styles.activeFilterPill}>
                <Text style={{ color: colors.accentPrimary, fontSize: 13, fontWeight: '600' }}>
                  Filter: {folders.find(f => f.id === selectedFolderId)?.name}
                </Text>
                <TouchableOpacity onPress={() => setSelectedFolderId(null)}>
                  <Text style={{ color: '#EF4444', fontWeight: '700', marginLeft: 8 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Logins Cards list */}
            {filteredLogins.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🔐</Text>
                <Text style={styles.emptyTitle}>No passwords yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add passwords from the header button or sync from the extension.
                </Text>
              </View>
            ) : (
              filteredLogins.map((item) => {
                const score = estimateStrength(item.decrypted.password).score;
                const isWeak = score <= 1;
                const isMedium = score === 2 || score === 3;
                const statusStr = isWeak ? 'Weak' : (isMedium ? 'Medium' : 'Strong');

                const folderName = folders.find(f => f.id === item.folder_id)?.name || 'Root';

                return (
                  <ListCard
                    key={item.id}
                    title={item.decrypted.title}
                    subtitle={item.decrypted.username}
                    favicon={item.domain ? getFaviconUrl(item.domain) : undefined}
                    statusLabel={statusStr}
                    selected={selectedItem?.id === item.id}
                    metaColumns={[
                      { label: 'Category', value: folderName },
                      { label: 'Last Used', value: 'Recent' },
                      { label: 'Strength', value: statusStr }
                    ]}
                    checked={item.is_favorite}
                    onToggleCheck={async () => {
                      // Favorite toggle logic
                      try {
                        const key = await getVaultKey();
                        if (!key) return;
                        await updateVaultItem(item.id, {
                          title: item.decrypted.title,
                          username: item.decrypted.username,
                          password: item.decrypted.password,
                          url: item.decrypted.url,
                          notes: item.decrypted.notes,
                          folderId: item.folder_id || undefined,
                          isFavorite: !item.is_favorite
                        }, item.decrypted, key);
                        await loadData();
                      } catch (e) {
                        console.warn(e);
                      }
                    }}
                    onPress={() => {
                      setIsDetailPasswordVisible(false);
                      setSelectedItem(item);
                    }}
                  />
                );
              })
            )}
          </View>
        </View>

        {/* ========================================== */}
        {/* BOOKMARKS SUBTAB */}
        {/* ========================================== */}
        <View style={{ display: activeSubTab === 'Bookmarks' ? 'flex' : 'none' }}>
          <View>
            {/* Folders Card for Bookmarks */}
            <View style={styles.folderCard}>
              <View style={styles.folderCardHeader}>
                <TouchableOpacity
                  onPress={() => setIsBookmarkFoldersCollapsed(!isBookmarkFoldersCollapsed)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1, marginRight: 8 }}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16 }}>📁</Text>
                  <Text style={styles.folderCardTitle} numberOfLines={1}>Bookmark Folders</Text>
                  {selectedFolderPath && (
                    <View style={[styles.activeFolderBadge, { flexShrink: 1 }]}>
                      <Text 
                        style={{ color: colors.accentPrimary, fontSize: 11, fontWeight: '600' }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {selectedFolderPath}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => {
                      setBookmarkNewPath('');
                      setIsBookmarkFolderModalVisible('add');
                    }}
                    style={styles.addFolderBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.accentPrimary, fontSize: 13, fontWeight: '700' }}>+ Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setIsBookmarkFoldersCollapsed(!isBookmarkFoldersCollapsed)}
                    style={{ padding: 4 }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                      {isBookmarkFoldersCollapsed ? '▼' : '▲'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {!isBookmarkFoldersCollapsed && (
                <View style={styles.folderListContainer}>
                  {bookmarkFolderTree.length === 0 ? (
                    <Text style={{ color: colors.textSecondary, fontSize: 12, padding: 12, textAlign: 'center' }}>
                      No folders created yet.
                    </Text>
                  ) : (
                    bookmarkFolderTree.map((node: BookmarkFolderNode) => renderBookmarkFolderNode(node, 0))
                  )}
                </View>
              )}
            </View>

            {selectedFolderPath && (
              <View style={styles.activeFilterPill}>
                <Text style={{ color: colors.accentPrimary, fontSize: 13, fontWeight: '600' }}>
                  Filter: {selectedFolderPath}
                </Text>
                <TouchableOpacity onPress={() => setSelectedFolderPath(null)}>
                  <Text style={{ color: '#EF4444', fontWeight: '700', marginLeft: 8 }}>✕</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bookmarks Grid / List */}
            {filteredBookmarks.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>📚</Text>
                <Text style={styles.emptyTitle}>No bookmarks</Text>
                <Text style={styles.emptySubtitle}>
                  Smart Sync browser bookmarks from Chrome extension.
                </Text>
              </View>
            ) : (
              filteredBookmarks.map((b) => {
              let domain = b.decrypted.url || '';
              const protoIdx = domain.indexOf('://');
              if (protoIdx !== -1) {
                domain = domain.substring(protoIdx + 3);
              }
              const slashIdx = domain.indexOf('/');
              if (slashIdx !== -1) {
                domain = domain.substring(0, slashIdx);
              }
              if (domain.startsWith('www.')) {
                domain = domain.substring(4);
              }
              
              return (
                <ListCard
                  key={b.id}
                  title={b.decrypted.title}
                  subtitle={domain}
                  favicon={b.decrypted.favicon}
                  metaColumns={[
                      { label: 'Folder Path', value: b.decrypted.folderPath || 'Root' },
                      { label: 'URL Address', value: b.decrypted.url }
                    ]}
                    onPress={() => {
                      Linking.openURL(b.decrypted.url.startsWith('http') ? b.decrypted.url : `https://${b.decrypted.url}`);
                    }}
                  />
                );
              })
            )}
          </View>
        </View>

        {/* Padding offset at the bottom to avoid overlapping with bottom bar navigation */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ========================================== */}
      {/* ADD PASSWORD FLOATING PANEL */}
      {/* ========================================== */}
      <FloatingPanel
        visible={isAddPasswordVisible}
        onClose={() => setIsAddPasswordVisible(false)}
        title="Add New Password"
      >
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Title</Text>
          <TextInput
            style={styles.formInput}
            placeholder="e.g. Google Account, GitHub"
            placeholderTextColor="#8C909C"
            value={addTitle}
            onChangeText={setAddTitle}
          />

          <Text style={styles.inputLabel}>Website URL</Text>
          <TextInput
            style={styles.formInput}
            placeholder="https://example.com"
            placeholderTextColor="#8C909C"
            value={addUrl}
            onChangeText={setAddUrl}
            keyboardType="url"
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Username / Email</Text>
          <TextInput
            style={styles.formInput}
            placeholder="your@email.com"
            placeholderTextColor="#8C909C"
            value={addUsername}
            onChangeText={setAddUsername}
            autoCapitalize="none"
          />

          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.formInput}
            placeholder="Enter password"
            placeholderTextColor="#8C909C"
            value={addPassword}
            onChangeText={setAddPassword}
            secureTextEntry
          />

          <Text style={styles.inputLabel}>Folder</Text>
          <TouchableOpacity
            style={[styles.formInput, { justifyContent: 'center' }]}
            onPress={() => setShowAddFolderSelect(!showAddFolderSelect)}
          >
            <Text style={{ color: addFolderId ? '#1F2228' : '#8C909C' }}>
              {addFolderId ? folders.find(f => f.id === addFolderId)?.name : 'Select Folder (Optional)'}
            </Text>
          </TouchableOpacity>
          {showAddFolderSelect && (
            <View style={styles.folderSelectDropdown}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: 120 }}>
                <TouchableOpacity onPress={() => { setAddFolderId(''); setShowAddFolderSelect(false); }} style={styles.folderSelectOption}>
                  <Text style={{ color: '#6B7280' }}>No Folder</Text>
                </TouchableOpacity>
                {folders.map(f => (
                  <TouchableOpacity key={f.id} onPress={() => { setAddFolderId(f.id); setShowAddFolderSelect(false); }} style={styles.folderSelectOption}>
                    <Text style={{ color: '#1F2228', fontWeight: '500' }}>{f.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <Text style={styles.inputLabel}>Notes</Text>
          <TextInput
            style={[styles.formInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
            placeholder="Add comments or answers to security questions..."
            placeholderTextColor="#8C909C"
            value={addNotes}
            onChangeText={setAddNotes}
            multiline
          />

          <View style={styles.panelActionRow}>
            <TouchableOpacity
              style={styles.panelCancelBtn}
              onPress={() => setIsAddPasswordVisible(false)}
            >
              <Text style={styles.panelCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.panelSaveBtn}
              onPress={handleAddPassword}
            >
              <Text style={styles.panelSaveText}>Add Credentials</Text>
            </TouchableOpacity>
          </View>
        </View>
      </FloatingPanel>

      {/* ========================================== */}
      {/* DETAILS / EDIT PASSWORD FLOATING PANEL */}
      {/* ========================================== */}
      <FloatingPanel
        visible={selectedItem !== null}
        onClose={() => { setSelectedItem(null); setIsDetailEditing(false); }}
        title={isDetailEditing ? 'Edit Item' : 'Credentials'}
      >
        {selectedItem && (
          <View style={styles.formContainer}>
            {isDetailEditing ? (
              <View>
                <Text style={styles.inputLabel}>Title</Text>
                <TextInput
                  style={styles.formInput}
                  value={detailTitle}
                  onChangeText={setDetailTitle}
                />

                <Text style={styles.inputLabel}>Website URL</Text>
                <TextInput
                  style={styles.formInput}
                  value={detailUrl}
                  onChangeText={setDetailUrl}
                />

                <Text style={styles.inputLabel}>Username</Text>
                <TextInput
                  style={styles.formInput}
                  value={detailUsername}
                  onChangeText={setDetailUsername}
                  autoCapitalize="none"
                />

                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  style={styles.formInput}
                  value={detailPassword}
                  onChangeText={setDetailPassword}
                  secureTextEntry
                />

                <Text style={styles.inputLabel}>Folder</Text>
                <TouchableOpacity
                  style={[styles.formInput, { justifyContent: 'center' }]}
                  onPress={() => setShowDetailFolderSelect(!showDetailFolderSelect)}
                >
                  <Text style={{ color: '#1F2228' }}>
                    {detailFolderId ? folders.find(f => f.id === detailFolderId)?.name : 'No Folder'}
                  </Text>
                </TouchableOpacity>
                {showDetailFolderSelect && (
                  <View style={styles.folderSelectDropdown}>
                    <ScrollView nestedScrollEnabled style={{ maxHeight: 120 }}>
                      <TouchableOpacity onPress={() => { setDetailFolderId(''); setShowDetailFolderSelect(false); }} style={styles.folderSelectOption}>
                        <Text style={{ color: '#6B7280' }}>No Folder</Text>
                      </TouchableOpacity>
                      {folders.map(f => (
                        <TouchableOpacity key={f.id} onPress={() => { setDetailFolderId(f.id); setShowDetailFolderSelect(false); }} style={styles.folderSelectOption}>
                          <Text style={{ color: '#1F2228', fontWeight: '500' }}>{f.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.formInput, { height: 80, textAlignVertical: 'top', paddingTop: 10 }]}
                  value={detailNotes}
                  onChangeText={setDetailNotes}
                  multiline
                />

                <View style={styles.panelActionRow}>
                  <TouchableOpacity
                    style={styles.panelCancelBtn}
                    onPress={() => setIsDetailEditing(false)}
                  >
                    <Text style={styles.panelCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.panelSaveBtn}
                    onPress={handleSaveDetailEdit}
                  >
                    <Text style={styles.panelSaveText}>Save Changes</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={{ gap: 16 }}>
                {/* View Mode Fields */}
                <View style={styles.viewField}>
                  <Text style={styles.viewFieldLabel}>Title</Text>
                  <Text style={styles.viewFieldValue}>{selectedItem.decrypted.title}</Text>
                </View>

                <View style={styles.viewField}>
                  <Text style={styles.viewFieldLabel}>Username</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.viewFieldValue}>{selectedItem.decrypted.username}</Text>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(selectedItem.decrypted.username, 'Username')}
                      style={styles.copyBtn}
                    >
                      <Copy size={12} color="#1F2228" />
                      <Text style={styles.copyBtnText}>Copy</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.viewField}>
                  <Text style={styles.viewFieldLabel}>Password</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={[styles.viewFieldValue, !isDetailPasswordVisible && { fontFamily: 'monospace' }]}>
                      {isDetailPasswordVisible ? selectedItem.decrypted.password : '••••••••••••'}
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setIsDetailPasswordVisible(!isDetailPasswordVisible)}
                        style={styles.copyBtn}
                      >
                        <Text style={styles.copyBtnText}>{isDetailPasswordVisible ? 'Hide' : 'Show'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(selectedItem.decrypted.password, 'Password')}
                        style={styles.copyBtn}
                      >
                        <Copy size={12} color="#1F2228" />
                        <Text style={styles.copyBtnText}>Copy</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {selectedItem.domain ? (
                  <View style={styles.viewField}>
                    <Text style={styles.viewFieldLabel}>Website Domain</Text>
                    <Text style={styles.viewFieldValue}>{selectedItem.domain}</Text>
                  </View>
                ) : null}

                <View style={styles.viewField}>
                  <Text style={styles.viewFieldLabel}>Folder Category</Text>
                  <Text style={styles.viewFieldValue}>
                    {folders.find(f => f.id === selectedItem.folder_id)?.name || 'Root'}
                  </Text>
                </View>

                {selectedItem.decrypted.notes ? (
                  <View style={styles.viewField}>
                    <Text style={styles.viewFieldLabel}>Notes</Text>
                    <Text style={styles.viewFieldValue}>{selectedItem.decrypted.notes}</Text>
                  </View>
                ) : null}

                <View style={[styles.panelActionRow, { marginTop: 12 }]}>
                  <TouchableOpacity
                    style={[styles.panelCancelBtn, { borderColor: '#EF4444' }]}
                    onPress={handleDeleteDetailItem}
                  >
                    <Text style={{ color: '#EF4444', fontWeight: '700' }}>Delete</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.panelSaveBtn}
                    onPress={handleStartDetailEdit}
                  >
                    <Text style={styles.panelSaveText}>Edit Credentials</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </FloatingPanel>

      {/* 1. Add Logins Folder Modal */}
      <FloatingPanel
        visible={isAddFolderVisible}
        onClose={() => setIsAddFolderVisible(false)}
        title="Create New Folder"
      >
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Folder Name</Text>
          <TextInput
            style={styles.formInput}
            value={folderNewName}
            onChangeText={setFolderNewName}
            placeholder="e.g. Work, Personal, Social..."
            placeholderTextColor="#8C909C"
            autoCapitalize="none"
          />
          <View style={styles.panelActionRow}>
            <TouchableOpacity
              style={styles.panelCancelBtn}
              onPress={() => setIsAddFolderVisible(false)}
            >
              <Text style={styles.panelCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.panelSaveBtn}
              onPress={handleCreateFolder}
            >
              <Text style={styles.panelSaveText}>Create Folder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </FloatingPanel>

      {/* 2. Rename Logins Folder Modal */}
      <FloatingPanel
        visible={isRenameFolderVisible}
        onClose={() => setIsRenameFolderVisible(false)}
        title="Rename Folder"
      >
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>New Folder Name</Text>
          <TextInput
            style={styles.formInput}
            value={folderRenameName}
            onChangeText={setFolderRenameName}
            placeholder="Enter new folder name..."
            placeholderTextColor="#8C909C"
            autoCapitalize="none"
          />
          <View style={styles.panelActionRow}>
            <TouchableOpacity
              style={styles.panelCancelBtn}
              onPress={() => setIsRenameFolderVisible(false)}
            >
              <Text style={styles.panelCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.panelSaveBtn}
              onPress={handleRenameFolder}
            >
              <Text style={styles.panelSaveText}>Rename Folder</Text>
            </TouchableOpacity>
          </View>
        </View>
      </FloatingPanel>

      {/* 3. Bookmark Folder Modal */}
      <FloatingPanel
        visible={isBookmarkFolderModalVisible !== null}
        onClose={() => setIsBookmarkFolderModalVisible(null)}
        title={isBookmarkFolderModalVisible === 'add' ? 'Create Bookmark Folder' : 'Rename Bookmark Folder'}
      >
        <View style={styles.formContainer}>
          <Text style={styles.inputLabel}>Folder Path / Name</Text>
          <TextInput
            style={styles.formInput}
            value={bookmarkNewPath}
            onChangeText={setBookmarkNewPath}
            placeholder={isBookmarkFolderModalVisible === 'add' ? "e.g. Shopping, Tech/Blogs..." : "Enter new path..."}
            placeholderTextColor="#8C909C"
            autoCapitalize="none"
          />
          <View style={styles.panelActionRow}>
            <TouchableOpacity
              style={styles.panelCancelBtn}
              onPress={() => setIsBookmarkFolderModalVisible(null)}
            >
              <Text style={styles.panelCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.panelSaveBtn}
              onPress={isBookmarkFolderModalVisible === 'add' ? handleCreateBookmarkFolder : handleRenameBookmarkFolder}
            >
              <Text style={styles.panelSaveText}>
                {isBookmarkFolderModalVisible === 'add' ? 'Create' : 'Save'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </FloatingPanel>
    </View>
  );
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16 },
  
  // Custom Top bar style
  header: {
    height: 90,
    paddingTop: 40,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  
  // Search bar
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 8,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  searchCloseBtn: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statCapsulesBar: {
    gap: 8,
    marginBottom: 16,
    paddingRight: 40,
  },

  // Folders layout
  folderCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#3D434D',
    padding: 16,
    marginBottom: 16,
  },
  folderCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  folderCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  activeFolderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(244, 225, 26, 0.15)',
  },
  addFolderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
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
    paddingVertical: 10,
    borderRadius: 8,
    marginVertical: 1,
  },
  folderNodeText: {
    fontSize: 14,
    fontWeight: '500',
  },
  folderRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingRight: 8,
  },
  folderActionIcon: {
    padding: 6,
  },

  // Active filter badge
  activeFilterPill: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(244, 225, 26, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F4E11A',
  },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 60, paddingBottom: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  emptySubtitle: { fontSize: 13, color: '#C7CBD1', textAlign: 'center', paddingHorizontal: 40 },

  // Floating Panel form styling
  formContainer: {
    gap: 12,
    width: '100%',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
  },
  formInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: 'rgba(0,0,0,0.1)',
    backgroundColor: 'rgba(0,0,0,0.02)',
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#1F2228',
  },
  folderSelectOption: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.04)',
  },
  folderSelectDropdown: {
    borderWidth: 1.2,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 14,
    marginTop: -8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  panelActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  panelCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2228',
  },
  panelSaveBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 999,
    backgroundColor: '#F4E11A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2228',
  },

  // View fields
  viewField: {
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  viewFieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  viewFieldValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2228',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  copyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1F2228',
  },
});
