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
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { signUp, estimateStrength, uint8ArrayToBase64 } from '@vaultsync/core';
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
  const strengthColors = ['#ef4444', '#f97316', '#F4E11A', '#84cc16', '#22c55e'];

  const handleSignUp = async () => {
    setError('');
    if (masterPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (strength.score < 2) {
      setError('Please use a stronger master password.');
      return;
    }

    setLoading(true);
    try {
      const { vaultKey } = await signUp({ email, masterPassword });
      const keyBase64 = uint8ArrayToBase64(vaultKey.key);
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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={{ flex: 1, width: '100%', justifyContent: 'center' }}>
            {/* Frame Card */}
            <View style={[styles.signupCard, { backgroundColor: colors.cardBg }]}>
              <View style={styles.logoContainer}>
                <View style={[styles.logoIcon, { backgroundColor: colors.accent }]}>
                  <Text style={styles.logoEmoji}>🛡️</Text>
                </View>
                <Text style={[styles.logoTitle, { color: colors.text }]}>Create Vault</Text>
                <Text style={[styles.logoSubtitle, { color: colors.textSecondary }]}>
                  Zero-Knowledge On-Device Encryption
                </Text>
              </View>

              {/* Info Banner */}
              <View style={[styles.infoBanner, { backgroundColor: colors.infoBg }]}>
                <Text style={[styles.infoText, { color: colors.infoText }]}>
                  ℹ️ Your master password derives your local encryption keys. Your password never leaves your device.
                </Text>
              </View>

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
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Master Password</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    placeholder="Choose a strong password"
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
                        {strength.label} · {strength.entropy} bits entropy
                      </Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Confirm Password</Text>
                  <TextInput
                    style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                    placeholder="Confirm your master password"
                    placeholderTextColor={colors.placeholder}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                  />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <TouchableOpacity
                  style={[styles.primaryButton, { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 }]}
                  onPress={handleSignUp}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#1F2228" />
                  ) : (
                    <Text style={[styles.primaryButtonText, { color: colors.btnText }]}>Create Secure Vault</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.linkContainer}>
                  <Text style={[styles.linkText, { color: colors.textSecondary }]}>
                    Already have an account? <Text style={{ color: colors.accent, fontWeight: '700' }}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const darkColors = {
  bg: '#4A515C',
  cardBg: '#3D434D',
  text: '#FFFFFF',
  textSecondary: '#C7CBD1',
  accent: '#F4E11A',
  inputBg: 'rgba(23, 24, 25, 0.2)',
  border: 'rgba(255,255,255,0.08)',
  placeholder: 'rgba(255,255,255,0.3)',
  infoBg: 'rgba(244, 225, 26, 0.08)',
  infoText: '#F4E11A',
  btnText: '#1F2228',
};

const lightColors = {
  bg: '#E9EAEC',
  cardBg: '#FFFFFF',
  text: '#1F2228',
  textSecondary: '#5C6470',
  accent: '#F4E11A',
  inputBg: 'rgba(0,0,0,0.03)',
  border: 'rgba(0,0,0,0.08)',
  placeholder: 'rgba(0,0,0,0.4)',
  infoBg: 'rgba(0, 0, 0, 0.03)',
  infoText: '#1F2228',
  btnText: '#1F2228',
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  signupCard: {
    width: '100%',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  logoContainer: { alignItems: 'center', marginBottom: 24 },
  logoIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  logoEmoji: { fontSize: 28 },
  logoTitle: { fontSize: 32, fontWeight: '600', letterSpacing: -0.5 },
  logoSubtitle: { fontSize: 13, marginTop: 4, textAlign: 'center' },
  infoBanner: { padding: 16, borderRadius: 20, marginBottom: 24 },
  infoText: { fontSize: 13, lineHeight: 20 },
  form: { width: '100%' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 8 },
  input: { height: 52, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, fontSize: 15 },
  strengthContainer: { marginTop: 8 },
  strengthBar: { flexDirection: 'row', gap: 4, height: 4, marginBottom: 4 },
  strengthSegment: { flex: 1, borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '600' },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 12 },
  primaryButton: { height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryButtonText: { fontSize: 16, fontWeight: '700' },
  linkContainer: { marginTop: 24, alignItems: 'center' },
  linkText: { fontSize: 14 },
});
