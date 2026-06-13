import { View, Text, StyleSheet, useColorScheme, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect } from 'react';

export default function SettingsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const c = isDark ? dark : light;

  const handleSignOut = async () => {
    await signOut();
    await SecureStore.deleteItemAsync('vaultsync-vault-key');
    await SecureStore.deleteItemAsync('vaultsync-vault-salt');
    router.replace('/(auth)/login');
  };

  const [sessionTimeout, setSessionTimeout] = useState('always');

  useEffect(() => {
    SecureStore.getItemAsync('vaultsync-session-timeout').then(val => {
      if (val) setSessionTimeout(val);
    });
  }, []);

  const toggleTimeout = async () => {
    const options = ['5m', '15m', '1h', '12h', '24h', '2d', 'always'];
    const nextIdx = (options.indexOf(sessionTimeout) + 1) % options.length;
    const nextVal = options[nextIdx];
    setSessionTimeout(nextVal);
    await SecureStore.setItemAsync('vaultsync-session-timeout', nextVal);
  };

  interface SettingItem {
    label: string;
    value: string;
    badge?: string;
    badgeColor?: string;
    action?: boolean;
    onPress?: () => void;
  }

  const sections: { title: string; items: SettingItem[] }[] = [
    {
      title: 'Security',
      items: [
        { label: 'Encryption', value: 'AES-256-GCM', badge: '✓ Active', badgeColor: '#22c55e' },
        { label: 'Key Derivation', value: 'PBKDF2 · 600K iterations', badge: '✓ Strong', badgeColor: '#22c55e' },
        { label: 'Architecture', value: 'Zero-Knowledge', badge: '✓ Enforced', badgeColor: '#3b82f6' },
        { label: 'Recovery', value: 'Email-based', badge: 'Set Up', badgeColor: '#3b82f6' },
      ],
    },
    {
      title: 'Data',
      items: [
        { label: 'Export Vault', value: 'Encrypted JSON', action: true },
        { label: 'Sync Status', value: 'Real-time via Supabase', badge: '● Live', badgeColor: '#22c55e' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { label: 'Auto-Logout Timeout', value: sessionTimeout, action: true, onPress: toggleTimeout },
      ],
    },
    {
      title: 'About',
      items: [
        { label: 'Version', value: '1.0.0' },
        { label: 'Platform', value: 'Expo SDK 56' },
      ],
    },
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      {sections.map((section) => (
        <View key={section.title} style={{ marginBottom: 24 }}>
          <Text style={[styles.sectionTitle, { color: c.textSec }]}>{section.title}</Text>
          <View style={[styles.sectionCard, { backgroundColor: c.card, borderColor: c.border }]}>
            {section.items.map((item, i) => {
              const RowComponent = item.onPress ? TouchableOpacity : View;
              return (
                <RowComponent
                  key={item.label}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                  style={[
                    styles.settingRow,
                    i < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.settingLabel, { color: c.text }]}>{item.label}</Text>
                    <Text style={[styles.settingValue, { color: c.textSec }]}>{item.value}</Text>
                  </View>
                  {item.badge && (
                    <View style={[styles.badge, { backgroundColor: `${item.badgeColor}18` }]}>
                      <Text style={[styles.badgeText, { color: item.badgeColor }]}>{item.badge}</Text>
                    </View>
                  )}
                  {item.action && <Text style={{ color: c.accent, fontSize: 16 }}>→</Text>}
                </RowComponent>
              );
            })}
          </View>
        </View>
      ))}

      {/* Sign Out */}
      <TouchableOpacity
        style={[styles.signOutBtn, { borderColor: '#ef4444' }]}
        onPress={handleSignOut}
        activeOpacity={0.7}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={[styles.footerText, { color: c.textSec }]}>
        VaultSync — Your data, encrypted, everywhere.
      </Text>
    </ScrollView>
  );
}

const dark = {
  bg: '#0a0f1e', card: '#141928', text: '#f2f2f2', textSec: '#8a8f9e',
  accent: '#5ce0d6', border: 'rgba(255,255,255,0.06)',
};
const light = {
  bg: '#f5f5f7', card: '#ffffff', text: '#151b33', textSec: '#6b7280',
  accent: '#2563eb', border: 'rgba(0,0,0,0.08)',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  sectionTitle: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  sectionCard: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  settingLabel: { fontSize: 15, fontWeight: '600' },
  settingValue: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  signOutBtn: { borderWidth: 1.5, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  signOutText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  footerText: { textAlign: 'center', fontSize: 12, marginTop: 24 },
});
