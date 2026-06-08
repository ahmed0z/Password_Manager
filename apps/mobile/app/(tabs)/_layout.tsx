import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Key, Bookmark, Wand2, Settings } from 'lucide-react-native';

export default function TabsLayout() {
  const isDark = useColorScheme() === 'dark';

  const colors = isDark
    ? { bg: '#0a0f1e', active: '#5ce0d6', inactive: '#4a5068', border: 'rgba(255,255,255,0.06)' }
    : { bg: '#ffffff', active: '#2563eb', inactive: '#9ca3af', border: 'rgba(0,0,0,0.08)' };

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.active,
        tabBarInactiveTintColor: colors.inactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: isDark ? '#f2f2f2' : '#151b33',
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
          tabBarIcon: ({ color, size }) => <Key size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="bookmarks"
        options={{
          title: 'Bookmarks',
          tabBarIcon: ({ color, size }) => <Bookmark size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="generator"
        options={{
          title: 'Generator',
          tabBarIcon: ({ color, size }) => <Wand2 size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => <Settings size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
