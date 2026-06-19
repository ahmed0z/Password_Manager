import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, useColorScheme, ActivityIndicator, Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  getVaultItems, type VaultItem, type DecryptedVaultItem,
  base64ToUint8Array, estimateStrength
} from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';
import { Shield, Sliders, RefreshCw, AlertTriangle, Key } from 'lucide-react-native';

import {
  colors,
  CircularIconButton,
  GaugeChart,
  ListCard,
} from '../_components/SharedComponents';

type VaultItemWithDecrypted = VaultItem & { decrypted: DecryptedVaultItem };

export default function SecurityScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<VaultItemWithDecrypted[]>([]);

  const getVaultKey = useCallback(async (): Promise<Uint8Array | null> => {
    const keyBase64 = await SecureStore.getItemAsync('vaultsync-vault-key');
    if (!keyBase64) return null;
    return base64ToUint8Array(keyBase64);
  }, []);

  const loadData = useCallback(async () => {
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
  }, [getVaultKey, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived metrics
  const totalPasswords = items.length;
  const weakItems = items.filter((i) => estimateStrength(i.decrypted.password).score <= 1);
  const strongItemsCount = items.filter((i) => estimateStrength(i.decrypted.password).score === 4).length;
  const mediumItemsCount = items.filter((i) => {
    const score = estimateStrength(i.decrypted.password).score;
    return score === 2 || score === 3;
  }).length;

  const securityScore = totalPasswords > 0
    ? Math.round(((strongItemsCount + mediumItemsCount * 0.5) / totalPasswords) * 100)
    : 100;

  const riskLabel = securityScore >= 75 ? 'Low Risk' : (securityScore >= 45 ? 'Medium Risk' : 'High Risk');

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bgPrimary }]}>
        <ActivityIndicator size="large" color={colors.accentPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={styles.header}>
        <CircularIconButton onPress={() => {}}>
          <Sliders size={18} color="#1F2228" />
        </CircularIconButton>
        <Text style={styles.headerTitle}>Security</Text>
        <CircularIconButton onPress={loadData}>
          <RefreshCw size={18} color="#1F2228" />
        </CircularIconButton>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Security Gauge Card */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Security status</Text>
          <GaugeChart value={securityScore} subLabel={riskLabel} />
        </View>

        {/* Vulnerable Passwords Alert History */}
        <Text style={styles.sectionLabel}>Session History & Alerts</Text>

        {weakItems.length === 0 ? (
          <View style={styles.noAlertsCard}>
            <Text style={styles.noAlertsText}>✓ No security threats detected. All credentials have adequate strength scores.</Text>
          </View>
        ) : (
          weakItems.map((item) => {
            const score = estimateStrength(item.decrypted.password).score;
            return (
              <ListCard
                key={item.id}
                title={item.decrypted.title}
                subtitle={item.decrypted.username}
                favicon={item.domain ? `https://www.google.com/s2/favicons?domain=${item.domain}&sz=64` : undefined}
                statusLabel="Weak"
                metaColumns={[
                  { label: 'Threat Level', value: 'Vulnerable' },
                  { label: 'Risk Detail', value: 'Entropy too low' }
                ]}
                onPress={() => {
                  Alert.alert(
                    'Security Warning',
                    `The password for ${item.decrypted.title} is too weak and vulnerable to dictionary attacks. Propose updating to a generated password.`,
                    [{ text: 'Dismiss' }, { text: 'Open Vault', onPress: () => router.push('/(tabs)/vault') }]
                  );
                }}
              />
            );
          })
        )}

        {/* Bottom offset */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
  content: { padding: 20 },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#3D434D',
    padding: 24,
    marginBottom: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#C7CBD1',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#C7CBD1',
    marginBottom: 12,
  },
  noAlertsCard: {
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#3D434D',
    alignItems: 'center',
  },
  noAlertsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22C55E',
    textAlign: 'center',
    lineHeight: 20,
  },
});
