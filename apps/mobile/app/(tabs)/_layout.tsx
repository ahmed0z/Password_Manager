import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { Key, Wand2, Shield, Settings } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface CustomTabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

function CustomTabBar({ state, descriptors, navigation }: CustomTabBarProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const bottomInset = insets.bottom > 0 ? insets.bottom + 8 : 16;

  return (
    <View style={[styles.container, { bottom: bottomInset }]}>
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          // Render lucide icon
          const renderIcon = (color: string, size: number) => {
            switch (route.name) {
              case 'vault':
                return <Key color={color} size={size} />;
              case 'generator':
                return <Wand2 color={color} size={size} />;
              case 'security':
                return <Shield color={color} size={size} />;
              case 'settings':
                return <Settings color={color} size={size} />;
              default:
                return <Key color={color} size={size} />;
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[
                styles.tabItem,
                isFocused ? styles.tabItemActive : styles.tabItemInactive
              ]}
              activeOpacity={0.8}
            >
              {renderIcon(isFocused ? '#1F2228' : '#9CA1AA', 20)}
              {isFocused && (
                <Text style={styles.tabLabel} numberOfLines={1}>
                  {label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="vault"
        options={{
          title: 'Vault',
        }}
      />
      <Tabs.Screen
        name="generator"
        options={{
          title: 'Generator',
        }}
      />
      <Tabs.Screen
        name="security"
        options={{
          title: 'Security',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
    height: 68,
    backgroundColor: 'transparent',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#3D434D',
    borderRadius: 34,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    paddingHorizontal: 12,
    gap: 6,
  },
  tabItemInactive: {
    flex: 1,
  },
  tabItemActive: {
    backgroundColor: '#F4E11A',
    flex: 1.8,
    maxWidth: 120,
  },
  tabLabel: {
    color: '#1F2228',
    fontSize: 12,
    fontWeight: '700',
  },
});
