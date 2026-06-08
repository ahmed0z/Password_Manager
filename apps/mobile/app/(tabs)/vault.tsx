import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  useColorScheme, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getVaultItems, type VaultItem, type DecryptedVaultItem } from '@vaultsync/core';
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
        if (!key) { router.replace('/(auth)/login'); return; }
        const data = await getVaultItems(key);
        setItems(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [getVaultKey, router]);

  const filtered = items.filter((i) => {
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
});
