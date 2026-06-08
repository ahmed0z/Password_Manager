import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  useColorScheme, Linking, ActivityIndicator,
} from 'react-native';
import { getBookmarks, type Bookmark, type DecryptedBookmark } from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';

type BookmarkWithDecrypted = Bookmark & { decrypted: DecryptedBookmark };

export default function BookmarksScreen() {
  const isDark = useColorScheme() === 'dark';
  const c = isDark ? dark : light;
  const [bookmarks, setBookmarks] = useState<BookmarkWithDecrypted[]>([]);
  const [loading, setLoading] = useState(true);

  const getVaultKey = useCallback(async (): Promise<CryptoKey | null> => {
    const keyBase64 = await SecureStore.getItemAsync('vaultsync-vault-key');
    if (!keyBase64) return null;
    const keyBytes = Uint8Array.from(atob(keyBase64), (c) => c.charCodeAt(0));
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const key = await getVaultKey();
        if (!key) return;
        const data = await getBookmarks(key);
        setBookmarks(data);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [getVaultKey]);

  const openUrl = (url: string) => {
    Linking.openURL(url.startsWith('http') ? url : `https://${url}`);
  };

  if (loading) {
    return <View style={[styles.center, { backgroundColor: c.bg }]}><ActivityIndicator size="large" color={c.accent} /></View>;
  }

  return (
    <View style={[styles.container, { backgroundColor: c.bg }]}>
      <FlatList
        data={bookmarks}
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
    </View>
  );
}

const dark = {
  bg: '#0a0f1e', card: '#141928', text: '#f2f2f2', textSec: '#8a8f9e',
  accent: '#5ce0d6', border: 'rgba(255,255,255,0.06)', iconBg: '#1e2438',
  badgeBg: 'rgba(92,224,214,0.08)',
};
const light = {
  bg: '#f5f5f7', card: '#ffffff', text: '#151b33', textSec: '#6b7280',
  accent: '#2563eb', border: 'rgba(0,0,0,0.08)', iconBg: '#f0f0f2',
  badgeBg: 'rgba(37,99,235,0.06)',
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
});
