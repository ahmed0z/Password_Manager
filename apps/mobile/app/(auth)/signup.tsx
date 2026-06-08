import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  useColorScheme, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, estimateStrength } from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';

export default function SignUpScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const strength = estimateStrength(masterPassword);
  const strengthColors = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

  const handleSignUp = async () => {
    setError('');
    if (masterPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (strength.score < 2) {
      setError('Please use a stronger password.');
      return;
    }

    setLoading(true);
    try {
      const { vaultKey } = await signUp({ email, masterPassword });
      const exportedKey = await crypto.subtle.exportKey('raw', vaultKey.key);
      const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
      await SecureStore.setItemAsync('vaultsync-vault-key', keyBase64);
      await SecureStore.setItemAsync('vaultsync-vault-salt', vaultKey.salt);
      router.replace('/(tabs)/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.logoContainer}>
          <View style={[styles.logoIcon, { backgroundColor: colors.accent }]}>
            <Text style={styles.logoEmoji}>🛡️</Text>
          </View>
          <Text style={[styles.logoTitle, { color: colors.text }]}>Create Vault</Text>
          <Text style={[styles.logoSubtitle, { color: colors.textSecondary }]}>
            Set up your encrypted password vault
          </Text>
        </View>

        {/* Info banner */}
        <View style={[styles.infoBanner, { backgroundColor: colors.infoBg }]}>
          <Text style={[styles.infoText, { color: colors.infoText }]}>
            ℹ️ Your master password creates a local encryption key. All data is encrypted on-device. Recovery is available via email.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Master Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Create a strong password"
              placeholderTextColor={colors.placeholder}
              value={masterPassword}
              onChangeText={setMasterPassword}
              secureTextEntry
            />
            {masterPassword ? (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <View
                      key={i}
                      style={[
                        styles.strengthSegment,
                        {
                          backgroundColor: i <= strength.score ? strengthColors[strength.score] : colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text style={[styles.strengthLabel, { color: strengthColors[strength.score] }]}>
                  {strength.label} · {strength.entropy} bits
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm Password</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Confirm your password"
              placeholderTextColor={colors.placeholder}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleSignUp}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>Create Secure Vault</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.linkContainer}>
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
              Already have an account? <Text style={{ color: colors.accent, fontWeight: '600' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const darkColors = {
  bg: '#0a0f1e', text: '#f2f2f2', textSecondary: '#8a8f9e', accent: '#5ce0d6',
  inputBg: '#141928', border: 'rgba(255,255,255,0.08)', placeholder: 'rgba(255,255,255,0.3)',
  infoBg: 'rgba(59,130,246,0.1)', infoText: '#60a5fa',
};
const lightColors = {
  bg: '#f5f5f7', text: '#151b33', textSecondary: '#6b7280', accent: '#2563eb',
  inputBg: '#ffffff', border: 'rgba(0,0,0,0.12)', placeholder: 'rgba(0,0,0,0.3)',
  infoBg: 'rgba(59,130,246,0.08)', infoText: '#2563eb',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoIcon: { width: 64, height: 64, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoEmoji: { fontSize: 28 },
  logoTitle: { fontSize: 28, fontWeight: '800' },
  logoSubtitle: { fontSize: 14, marginTop: 4, textAlign: 'center' },
  infoBanner: { padding: 16, borderRadius: 12, marginBottom: 24 },
  infoText: { fontSize: 13, lineHeight: 20 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  input: { height: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  strengthContainer: { marginTop: 8 },
  strengthBar: { flexDirection: 'row', gap: 4, height: 4 },
  strengthSegment: { flex: 1, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '600', marginTop: 4 },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  primaryButton: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 8, backgroundColor: '#5ce0d6' },
  primaryButtonText: { color: '#0a0f1e', fontSize: 16, fontWeight: '700' },
  linkContainer: { marginTop: 24, alignItems: 'center' },
  linkText: { fontSize: 14 },
});
