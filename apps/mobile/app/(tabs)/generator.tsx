import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useColorScheme, Switch, ScrollView, Platform
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as SecureStore from 'expo-secure-store';
import { generatePassword, estimateStrength, type PasswordGeneratorOptions } from '@vaultsync/core';
import { Sliders, RefreshCw, Copy, Check } from 'lucide-react-native';

import {
  colors,
  CircularIconButton,
} from '../_components/SharedComponents';

export default function GeneratorScreen() {
  const isDark = useColorScheme() === 'dark';

  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 20, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: false,
  });
  const [password, setPassword] = useState(() => generatePassword(options));
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('vaultsync-generator-opts').then(val => {
      if (val) {
        try {
          const parsed = JSON.parse(val);
          setOptions(parsed);
          setPassword(generatePassword(parsed));
        } catch {}
      }
    });
  }, []);

  const updateOptions = (newOpts: PasswordGeneratorOptions) => {
    setOptions(newOpts);
    setPassword(generatePassword(newOpts));
    SecureStore.setItemAsync('vaultsync-generator-opts', JSON.stringify(newOpts));
  };

  const strength = estimateStrength(password);
  const strengthColors = ['#EF4444', '#f97316', '#F4E11A', '#84cc16', '#22C55E'];

  const regenerate = useCallback(() => {
    const p = generatePassword(options);
    setPassword(p);
    setCopied(false);
  }, [options]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggle = (key: keyof PasswordGeneratorOptions) => {
    updateOptions({ ...options, [key]: !options[key] });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bgPrimary }]}>
      {/* Header */}
      <View style={styles.header}>
        <CircularIconButton onPress={() => {}}>
          <Sliders size={18} color="#1F2228" />
        </CircularIconButton>
        <Text style={styles.headerTitle}>Generator</Text>
        <CircularIconButton onPress={regenerate}>
          <RefreshCw size={18} color="#1F2228" />
        </CircularIconButton>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Password Display Card */}
        <View style={styles.displayCard}>
          <Text style={styles.passwordText} selectable>
            {password}
          </Text>

          {/* Segmented Strength Bar */}
          <View style={styles.strengthBar}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View
                key={i}
                style={[
                  styles.strengthSeg,
                  { backgroundColor: i <= strength.score ? strengthColors[strength.score] : 'rgba(255,255,255,0.06)' },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: strengthColors[strength.score] }]}>
            {strength.label} · {strength.entropy} bits entropy · {strength.crackTime}
          </Text>

          <View style={styles.buttonRow}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleCopy} activeOpacity={0.75}>
              <Copy size={16} color="#1F2228" style={{ marginRight: 6 }} />
              <Text style={styles.actionBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.secondaryBtn]} onPress={regenerate} activeOpacity={0.75}>
              <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={[styles.actionBtnText, { color: '#FFFFFF' }]}>Regenerate</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Length Card */}
        <View style={styles.optionCard}>
          <View style={styles.optionHeader}>
            <Text style={styles.optionLabel}>Length</Text>
            <Text style={styles.optionValue}>{options.length}</Text>
          </View>
          <View style={styles.lengthRow}>
            <TouchableOpacity 
              onPress={() => updateOptions({ ...options, length: Math.max(4, options.length - 1) })}
              style={styles.adjustBtn}
            >
              <Text style={styles.adjustText}>−</Text>
            </TouchableOpacity>
            <View style={styles.lengthTrack}>
              <View style={[styles.lengthFill, { width: `${((options.length - 4) / 60) * 100}%` }]} />
            </View>
            <TouchableOpacity 
              onPress={() => updateOptions({ ...options, length: Math.min(64, options.length + 1) })}
              style={styles.adjustBtn}
            >
              <Text style={styles.adjustText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Toggles Options Card */}
        <View style={styles.optionCard}>
          {[
            { key: 'uppercase' as const, label: 'Uppercase (A-Z)' },
            { key: 'lowercase' as const, label: 'Lowercase (a-z)' },
            { key: 'digits' as const, label: 'Digits (0-9)' },
            { key: 'symbols' as const, label: 'Symbols (!@#$)' },
            { key: 'excludeAmbiguous' as const, label: 'Exclude ambiguous (1/l/I, 0/O)' },
          ].map(({ key, label }, i, arr) => (
            <View key={key} style={[styles.toggleRow, i < arr.length - 1 && styles.borderBottom]}>
              <Text style={styles.toggleLabel}>{label}</Text>
              <Switch
                value={!!options[key]}
                onValueChange={() => toggle(key)}
                trackColor={{ false: 'rgba(255,255,255,0.08)', true: colors.accentPrimary }}
                thumbColor="#FFFFFF"
              />
            </View>
          ))}
        </View>

        {/* Padding offset */}
        <View style={{ height: 100 }} />
      </ScrollView>
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
  displayCard: {
    padding: 24,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#3D434D',
    marginBottom: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  passwordText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    color: '#FFFFFF',
    letterSpacing: 0.8,
    marginBottom: 20,
    paddingHorizontal: 10,
  },
  strengthBar: { flexDirection: 'row', gap: 6, height: 6, width: '100%', marginBottom: 12, borderRadius: 3, overflow: 'hidden' },
  strengthSeg: { flex: 1 },
  strengthLabel: { fontSize: 13, fontWeight: '600', marginBottom: 20 },
  buttonRow: { flexDirection: 'row', gap: 12, width: '100%' },
  actionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#F4E11A',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#1F2228' },
  optionCard: {
    padding: 20,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#3D434D',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  optionLabel: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  optionValue: { fontSize: 20, fontWeight: '800', color: '#F4E11A', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  lengthRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  adjustBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustText: { fontSize: 20, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginTop: Platform.OS === 'ios' ? -2 : 0 },
  lengthTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  lengthFill: { height: '100%', borderRadius: 3, backgroundColor: '#F4E11A' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  toggleLabel: { fontSize: 15, fontWeight: '500', color: '#C7CBD1' },
});
