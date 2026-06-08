import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

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
