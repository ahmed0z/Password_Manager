import { View, Text, StyleSheet, useColorScheme, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect } from 'react';
import { Sliders, RefreshCw, LogOut, ArrowRight, Shield, Check } from 'lucide-react-native';

import {
  colors,
  CircularIconButton,
  FloatingPanel,
} from '../_components/SharedComponents';

export default function SettingsScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';

  const handleSignOut = async () => {
    await signOut();
    await SecureStore.deleteItemAsync('vaultsync-vault-key');
    await SecureStore.deleteItemAsync('vaultsync-vault-salt');
    router.replace('/(auth)/login');
  };

  const [sessionTimeout, setSessionTimeout] = useState('always');
  const [isModalVisible, setIsModalVisible] = useState(false);

  const TIMEOUT_OPTIONS = [
    { label: '5 Minutes', value: '5m' },
    { label: '15 Minutes', value: '15m' },
    { label: '1 Hour', value: '1h' },
    { label: '12 Hours', value: '12h' },
    { label: '24 Hours', value: '24h' },
    { label: '2 Days', value: '2d' },
    { label: 'Never', value: 'always' },
  ];

  useEffect(() => {
    SecureStore.getItemAsync('vaultsync-session-timeout').then(val => {
      if (val) setSessionTimeout(val);
    });
  }, []);

  const triggerSmartSync = () => {
    Alert.alert('Smart Bookmarks Sync', 'Checking local browser bookmarks synced from the extension...');
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
        { label: 'Encryption Standard', value: 'AES-256-GCM', badge: 'Active', badgeColor: '#22c55e' },
        { label: 'Key Derivation Protocol', value: 'PBKDF2 · 600K iterations', badge: 'Strong', badgeColor: '#22c55e' },
        { label: 'Architecture Model', value: 'Zero-Knowledge', badge: 'Enforced', badgeColor: colors.accentPrimary },
      ],
    },
    {
      title: 'Data & Sync',
      items: [
        { label: 'Smart Bookmarks Sync', value: 'Sync browser bookmarks from extension', action: true, onPress: triggerSmartSync },
        { label: 'Cloud Provider', value: 'Real-time via Supabase', badge: 'Live', badgeColor: '#22c55e' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { label: 'Auto-Lock Timeout', value: TIMEOUT_OPTIONS.find(o => o.value === sessionTimeout)?.label || sessionTimeout, action: true, onPress: () => setIsModalVisible(true) },
      ],
    },
    {
      title: 'About Info',
      items: [
        { label: 'Version Number', value: '1.0.8' },
        { label: 'Platform SDK', value: 'Expo SDK 54' },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={styles.header}>
        <CircularIconButton onPress={() => {}}>
          <Sliders size={18} color="#1F2228" />
        </CircularIconButton>
        <Text style={styles.headerTitle}>Settings</Text>
        <CircularIconButton onPress={() => {}}>
          <RefreshCw size={18} color="#1F2228" />
        </CircularIconButton>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {sections.map((section) => (
          <View key={section.title} style={{ marginBottom: 20 }}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, i) => {
                const RowComponent = item.onPress ? TouchableOpacity : View;
                return (
                  <RowComponent
                    key={item.label}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                    style={[
                      styles.settingRow,
                      i < section.items.length - 1 && styles.borderBottom,
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.settingLabel}>{item.label}</Text>
                      <Text style={styles.settingValue}>{item.value}</Text>
                    </View>
                    {item.badge && (
                      <View style={[styles.badge, { backgroundColor: `${item.badgeColor}18` }]}>
                        <Text style={[styles.badgeText, { color: item.badgeColor }]}>{item.badge}</Text>
                      </View>
                    )}
                    {item.action && (
                      <ArrowRight size={16} color={colors.accentPrimary} />
                    )}
                  </RowComponent>
                );
              })}
            </View>
          </View>
        ))}

        {/* Lock & Sign Out */}
        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={handleSignOut}
          activeOpacity={0.75}
        >
          <LogOut size={18} color="#EF4444" style={{ marginRight: 8 }} />
          <Text style={styles.signOutText}>Lock & Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          VaultSync — Your data, encrypted, everywhere.
        </Text>
        
        {/* Padding offset */}
        <View style={{ height: 100 }} />
      </ScrollView>

      <FloatingPanel
        visible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        title="Auto-Lock Timeout"
      >
        <View style={styles.modalContent}>
          {TIMEOUT_OPTIONS.map((opt) => {
            const isSelected = sessionTimeout === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.optionItem,
                  isSelected && styles.optionItemActive
                ]}
                onPress={async () => {
                  setSessionTimeout(opt.value);
                  await SecureStore.setItemAsync('vaultsync-session-timeout', opt.value);
                  setIsModalVisible(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.optionText,
                  isSelected && styles.optionTextActive
                ]}>
                  {opt.label}
                </Text>
                {isSelected && (
                  <Check size={18} color="#F4E11A" />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </FloatingPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#C7CBD1',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#3D434D',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  settingLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  settingValue: { fontSize: 13, color: '#C7CBD1', marginTop: 3 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  signOutBtn: {
    flexDirection: 'row',
    borderWidth: 1.5,
    borderColor: '#EF4444',
    borderRadius: 999,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  signOutText: { color: '#EF4444', fontSize: 15, fontWeight: '700' },
  footerText: { textAlign: 'center', fontSize: 12, marginTop: 24, color: '#9CA1AA' },
  modalContent: {
    paddingVertical: 8,
    gap: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.02)',
  },
  optionItemActive: {
    backgroundColor: 'rgba(244, 225, 26, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 225, 26, 0.6)',
  },
  optionText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2228',
  },
  optionTextActive: {
    fontWeight: '700',
    color: '#1F2228',
  },
});
