import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Platform, AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { setSupabaseStorageAdapter, signOut } from '@vaultsync/core';
import { useEffect, useRef } from 'react';

import * as Crypto from 'expo-crypto';

if (Platform.OS !== 'web') {
  // Polyfill global.crypto for native mobile environment
  if (typeof global.crypto === 'undefined') {
    (global as any).crypto = {
      getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
        if (array) {
          return Crypto.getRandomValues(array as any) as any;
        }
        return array;
      },
    };
  }

  setSupabaseStorageAdapter({
    getItem: (key) => SecureStore.getItemAsync(key),
    setItem: (key, value) => SecureStore.setItemAsync(key, value),
    removeItem: (key) => SecureStore.deleteItemAsync(key),
  });
}

const darkColors = {
  bgPrimary: '#0a0f1e',
  textPrimary: '#f2f2f2',
  accentPrimary: '#5ce0d6',
};

const lightColors = {
  bgPrimary: '#f5f5f7',
  textPrimary: '#151b33',
  accentPrimary: '#2563eb',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;
  const router = useRouter();
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground
        const lastActivityStr = await SecureStore.getItemAsync('vaultsync-last-activity');
        const sessionTimeoutStr = await SecureStore.getItemAsync('vaultsync-session-timeout') || 'always';
        
        if (lastActivityStr && sessionTimeoutStr !== 'always') {
          const lastActivity = parseInt(lastActivityStr, 10);
          
          const TIMEOUT_DURATIONS: Record<string, number> = {
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '12h': 12 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '2d': 2 * 24 * 60 * 60 * 1000,
          };
          const durationMs = TIMEOUT_DURATIONS[sessionTimeoutStr] || 0;
          
          if (durationMs > 0 && Date.now() - lastActivity > durationMs) {
            console.log('[VaultSync] Session expired in background. Signing out.');
            await SecureStore.deleteItemAsync('vaultsync-vault-key');
            await SecureStore.deleteItemAsync('vaultsync-vault-salt');
            await signOut();
            router.replace('/(auth)/login');
          }
        }
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        // App has gone to the background
        await SecureStore.setItemAsync('vaultsync-last-activity', Date.now().toString());
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [router]);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bgPrimary },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bgPrimary },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="vault/[id]"
          options={{
            title: 'Password Details',
            presentation: 'card',
          }}
        />
      </Stack>
    </>
  );
}
