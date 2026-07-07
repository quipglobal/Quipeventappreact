import { Tabs, Redirect } from 'expo-router';
import { Platform, View, StyleSheet } from 'react-native';
import { useEffect } from 'react';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useEvent } from '@/context/EventContext';
import { ToastNotification } from '@/components/ToastNotification';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface TabConfig {
  name: string;
  title: string;
  icon: IoniconsName;
  iconFocused: IoniconsName;
}

const ATTENDEE_TABS: TabConfig[] = [
  { name: 'feed',     title: 'Home',     icon: 'home-outline',        iconFocused: 'home' },
  { name: 'audience', title: 'Audience', icon: 'people-outline',      iconFocused: 'people' },
  { name: 'engage',   title: 'Engage',   icon: 'flash-outline',       iconFocused: 'flash' },
  { name: 'partners', title: 'Partners', icon: 'briefcase-outline',   iconFocused: 'briefcase' },
  { name: 'more',     title: 'More',     icon: 'grid-outline',        iconFocused: 'grid' },
];

const SPONSOR_TABS: TabConfig[] = [
  { name: 'feed',     title: 'Home',       icon: 'home-outline',          iconFocused: 'home' },
  { name: 'audience', title: 'Audience',   icon: 'people-outline',        iconFocused: 'people' },
  { name: 'scan',     title: 'Scan Badge', icon: 'scan-outline',          iconFocused: 'scan' },
  { name: 'leads',    title: 'My Leads',   icon: 'people-circle-outline', iconFocused: 'people-circle' },
  { name: 'more',     title: 'More',       icon: 'grid-outline',          iconFocused: 'grid' },
];

// Every file that lives in (tabs)/ — must be listed here so Expo Router
// can properly show/hide each one based on the active role.
const ALL_TAB_NAMES = ['feed', 'audience', 'engage', 'scan', 'agenda', 'partners', 'connects', 'leads', 'more'] as const;

export default function TabsLayout() {
  const { user, toast, refreshEventRole } = useAuth();
  const { colors, spacing } = useTheme();
  const { currentEventId } = useEvent();

  // Refresh the event-scoped role on mount so sponsor tabs appear correctly
  // regardless of which path was used to enter (code-join, Skip, session restore).
  // The global /me endpoint always returns 'attendee'; the real role lives in
  // the event_members pivot and is fetched here as a safety net.
  useEffect(() => {
    if (currentEventId) {
      refreshEventRole(currentEventId);
    }
  }, [currentEventId, refreshEventRole]);

  if (!user) return <Redirect href="/(auth)/welcome" />;

  const tabs = user.role === 'sponsor' ? SPONSOR_TABS : ATTENDEE_TABS;
  const activeNames = new Set(tabs.map((t) => t.name));

  const tabBarHeight = Platform.OS === 'ios' ? 84 : 64;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 28 : 8;

  return (
    <View style={styles.root}>
      {toast && <ToastNotification message={toast.message} points={toast.points} />}
      <Tabs
        key={user.role}
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
                      tabBarLabel: cfg.title,
                      tabBarIcon: ({ focused, color }) => (
                        <Ionicons
                          name={focused ? cfg.iconFocused : cfg.icon}
                          size={22}
                          color={color}
                        />
                      ),
                    }
                  : { href: null }
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
