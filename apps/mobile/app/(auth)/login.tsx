import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signIn } from '@vaultsync/core';
import * as SecureStore from 'expo-secure-store';

export default function LoginScreen() {
  const router = useRouter();
  const isDark = useColorScheme() === 'dark';
  const colors = isDark ? darkColors : lightColors;

  const [email, setEmail] = useState('');
  const [masterPassword, setMasterPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      const { vaultKey } = await signIn({ email, masterPassword });

      // Store vault key securely on device
      const exportedKey = await crypto.subtle.exportKey('raw', vaultKey.key);
      const keyBase64 = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
      await SecureStore.setItemAsync('vaultsync-vault-key', keyBase64);
      await SecureStore.setItemAsync('vaultsync-vault-salt', vaultKey.salt);

      router.replace('/(tabs)/vault');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
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
        {/* Logo */}
        <View style={styles.logoContainer}>
          <View style={[styles.logoIcon, { backgroundColor: colors.accent }]}>
            <Text style={styles.logoEmoji}>🔐</Text>
          </View>
          <Text style={[styles.logoTitle, { color: colors.text }]}>VaultSync</Text>
          <Text style={[styles.logoSubtitle, { color: colors.textSecondary }]}>
            Sign in to your vault
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Email Address</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="you@example.com"
              placeholderTextColor={colors.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Master Password</Text>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, styles.passwordInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="Enter your master password"
                placeholderTextColor={colors.placeholder}
                value={masterPassword}
                onChangeText={setMasterPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 16 }}>
                  {showPassword ? '👁️‍🗨️' : '👁️'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, { opacity: loading ? 0.7 : 1 }]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.primaryButtonText}>Unlock Vault</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/(auth)/signup')} style={styles.linkContainer}>
            <Text style={[styles.linkText, { color: colors.textSecondary }]}>
              Don't have an account?{' '}
              <Text style={{ color: colors.accent, fontWeight: '600' }}>Create one</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const darkColors = {
  bg: '#0a0f1e',
  text: '#f2f2f2',
  textSecondary: '#8a8f9e',
  accent: '#5ce0d6',
  inputBg: '#141928',
  border: 'rgba(255,255,255,0.08)',
  placeholder: 'rgba(255,255,255,0.3)',
};

const lightColors = {
  bg: '#f5f5f7',
  text: '#151b33',
  textSecondary: '#6b7280',
  accent: '#2563eb',
  inputBg: '#ffffff',
  border: 'rgba(0,0,0,0.12)',
  placeholder: 'rgba(0,0,0,0.3)',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logoContainer: { alignItems: 'center', marginBottom: 48 },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  logoEmoji: { fontSize: 28 },
  logoTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  logoSubtitle: { fontSize: 14, marginTop: 4 },
  form: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  input: {
    height: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  passwordContainer: { position: 'relative' },
  passwordInput: { paddingRight: 52 },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  primaryButton: {
    height: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#5ce0d6',
  },
  primaryButtonText: { color: '#0a0f1e', fontSize: 16, fontWeight: '700' },
  linkContainer: { marginTop: 24, alignItems: 'center' },
  linkText: { fontSize: 14 },
});
