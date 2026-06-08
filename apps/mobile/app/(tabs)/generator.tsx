import { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, useColorScheme, Switch, ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { generatePassword, estimateStrength, type PasswordGeneratorOptions } from '@vaultsync/core';

export default function GeneratorScreen() {
  const isDark = useColorScheme() === 'dark';
  const c = isDark ? dark : light;

  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 20, uppercase: true, lowercase: true, digits: true, symbols: true, excludeAmbiguous: false,
  });
  const [password, setPassword] = useState(() => generatePassword(options));
  const [copied, setCopied] = useState(false);

  const strength = estimateStrength(password);
  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

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
    const newOpts = { ...options, [key]: !options[key] };
    setOptions(newOpts);
    setPassword(generatePassword(newOpts));
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: c.bg }]} contentContainerStyle={styles.content}>
      {/* Password Display */}
      <View style={[styles.displayCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <Text style={[styles.passwordText, { color: c.text }]} selectable>
          {password}
        </Text>

        <View style={styles.strengthBar}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[
                styles.strengthSeg,
                { backgroundColor: i <= strength.score ? strengthColors[strength.score] : c.border },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.strengthLabel, { color: strengthColors[strength.score] }]}>
          {strength.label} · {strength.entropy} bits · {strength.crackTime}
        </Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.accent }]} onPress={handleCopy}>
            <Text style={styles.actionBtnText}>{copied ? '✓ Copied' : '📋 Copy'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: c.secondaryBtn }]} onPress={regenerate}>
            <Text style={[styles.actionBtnText, { color: c.text }]}>🔄 Regenerate</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Length */}
      <View style={[styles.optionCard, { backgroundColor: c.card, borderColor: c.border }]}>
        <View style={styles.optionHeader}>
          <Text style={[styles.optionLabel, { color: c.text }]}>Length</Text>
          <Text style={[styles.optionValue, { color: c.accent }]}>{options.length}</Text>
        </View>
        <View style={styles.lengthRow}>
          <TouchableOpacity onPress={() => { const v = Math.max(4, options.length - 1); setOptions({ ...options, length: v }); setPassword(generatePassword({ ...options, length: v })); }}>
            <Text style={[styles.lengthBtn, { color: c.accent }]}>−</Text>
          </TouchableOpacity>
          <View style={[styles.lengthTrack, { backgroundColor: c.border }]}>
            <View style={[styles.lengthFill, { width: `${((options.length - 4) / 60) * 100}%`, backgroundColor: c.accent }]} />
          </View>
          <TouchableOpacity onPress={() => { const v = Math.min(64, options.length + 1); setOptions({ ...options, length: v }); setPassword(generatePassword({ ...options, length: v })); }}>
            <Text style={[styles.lengthBtn, { color: c.accent }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Toggles */}
      <View style={[styles.optionCard, { backgroundColor: c.card, borderColor: c.border }]}>
        {[
          { key: 'uppercase' as const, label: 'Uppercase (A-Z)' },
          { key: 'lowercase' as const, label: 'Lowercase (a-z)' },
          { key: 'digits' as const, label: 'Digits (0-9)' },
          { key: 'symbols' as const, label: 'Symbols (!@#$)' },
          { key: 'excludeAmbiguous' as const, label: 'Exclude ambiguous' },
        ].map(({ key, label }, i, arr) => (
          <View key={key} style={[styles.toggleRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: c.border }]}>
            <Text style={[styles.toggleLabel, { color: c.text }]}>{label}</Text>
            <Switch
              value={!!options[key]}
              onValueChange={() => toggle(key)}
              trackColor={{ false: c.border, true: c.accent }}
              thumbColor="#ffffff"
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const dark = {
  bg: '#0a0f1e', card: '#141928', text: '#f2f2f2', textSec: '#8a8f9e',
  accent: '#5ce0d6', border: 'rgba(255,255,255,0.06)', secondaryBtn: '#1e2438',
};
const light = {
  bg: '#f5f5f7', card: '#ffffff', text: '#151b33', textSec: '#6b7280',
  accent: '#2563eb', border: 'rgba(0,0,0,0.08)', secondaryBtn: '#f0f0f2',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  displayCard: { padding: 24, borderRadius: 16, borderWidth: 1, marginBottom: 16, alignItems: 'center' },
  passwordText: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 18, fontWeight: '500', textAlign: 'center', letterSpacing: 1, marginBottom: 16 },
  strengthBar: { flexDirection: 'row', gap: 4, height: 4, width: '100%', marginBottom: 8 },
  strengthSeg: { flex: 1, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', marginBottom: 20 },
  buttonRow: { flexDirection: 'row', gap: 12 },
  actionBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  actionBtnText: { fontSize: 14, fontWeight: '700', color: '#0a0f1e' },
  optionCard: { padding: 20, borderRadius: 16, borderWidth: 1, marginBottom: 16 },
  optionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  optionLabel: { fontSize: 15, fontWeight: '600' },
  optionValue: { fontSize: 20, fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  lengthRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  lengthBtn: { fontSize: 24, fontWeight: '700', width: 36, textAlign: 'center' },
  lengthTrack: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  lengthFill: { height: '100%', borderRadius: 3 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14 },
  toggleLabel: { fontSize: 15, fontWeight: '500' },
});

import { Platform } from 'react-native';
