import { Tabs, Redirect } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ToastNotification } from '@/components/ToastNotification';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: IoniconsName;
  iconFocused: IoniconsName;
}

const ATTENDEE_TABS: TabConfig[] = [
  { name: 'feed',     title: 'Feed',     icon: 'play-circle-outline', iconFocused: 'play-circle' },
  { name: 'audience', title: 'Audience', icon: 'people-outline',      iconFocused: 'people' },
  { name: 'engage',   title: 'Engage',   icon: 'flash-outline',        iconFocused: 'flash' },
  { name: 'agenda',   title: 'Agenda',   icon: 'calendar-outline',     iconFocused: 'calendar' },
  { name: 'partners', title: 'Partners', icon: 'briefcase-outline',    iconFocused: 'briefcase' },
];

const SPONSOR_TABS: TabConfig[] = [
  { name: 'feed',     title: 'Home',        icon: 'home-outline',         iconFocused: 'home' },
  { name: 'audience', title: 'Audience',    icon: 'people-outline',       iconFocused: 'people' },
  { name: 'engage',   title: 'Scan Badge',  icon: 'qr-code-outline',      iconFocused: 'qr-code' },
  { name: 'connects', title: 'My Connects', icon: 'git-network-outline',  iconFocused: 'git-network' },
  { name: 'more',     title: 'More',        icon: 'grid-outline',         iconFocused: 'grid' },
];

// Every file that lives in (tabs)/ — must be listed here so Expo Router
// can properly show/hide each one based on the active role.
const ALL_TAB_NAMES = ['feed', 'audience', 'engage', 'agenda', 'partners', 'connects', 'more'] as const;

export default function TabsLayout() {
  const { user, toast } = useAuth();
  const { colors, spacing } = useTheme();

  if (!user) return <Redirect href="/(auth)/welcome" />;

  const tabs = user.role === 'sponsor' ? SPONSOR_TABS : ATTENDEE_TABS;
  const activeNames = new Set(tabs.map((t) => t.name));

  const tabBarHeight = Platform.OS === 'ios' ? 84 : 64;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 28 : 8;

  return (
    <View style={styles.root}>
      {toast && <ToastNotification message={toast.message} points={toast.points} />}
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            position: 'absolute',
            backgroundColor: Platform.OS === 'web'
              ? 'rgba(7,7,15,0.97)'
              : 'transparent',
            borderTopColor: 'rgba(255,255,255,0.08)',
            borderTopWidth: 0.5,
            height: tabBarHeight,
            paddingBottom: tabBarPaddingBottom,
            paddingTop: 8,
          },
          tabBarBackground: () =>
            Platform.OS !== 'web' ? (
              <BlurView
                intensity={90}
                tint="dark"
                style={StyleSheet.absoluteFill}
              />
            ) : null,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: 'rgba(255,255,255,0.35)',
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: 2,
          },
          tabBarHideOnKeyboard: true,
        }}
      >
        {ALL_TAB_NAMES.map((name) => {
          const cfg = activeNames.has(name)
            ? tabs.find((t) => t.name === name)!
            : null;

          return (
            <Tabs.Screen
              key={name}
              name={name}
              options={
                cfg
                  ? {
                      title: cfg.title,
                      tabBarIcon: ({ focused, color }) => (
                        <Ionicons
                          name={focused ? cfg.iconFocused : cfg.icon}
                          size={22}
                          color={color}
                        />
                      ),
                    }
                  : { href: null, tabBarButton: () => null, tabBarItemStyle: { display: 'none', width: 0, minWidth: 0, overflow: 'hidden' } }
              }
            />
          );
        })}
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070F' },
});
