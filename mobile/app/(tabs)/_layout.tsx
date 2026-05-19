import { Tabs, Redirect } from 'expo-router';
import { Platform, View, StyleSheet, ActivityIndicator } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { useEvent } from '@/context/EventContext';
import { getMyEventRole } from '@/lib/apiClient';
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

// Every file that lives in (tabs)/ must be listed here so Expo Router can
// properly show/hide each one based on the active role.
const ALL_TAB_NAMES = ['feed', 'audience', 'engage', 'scan', 'agenda', 'partners', 'connects', 'leads', 'more'] as const;

export default function TabsLayout() {
  const { user, toast, setUser } = useAuth();
  const { colors } = useTheme();
  const { currentEventId } = useEvent();

  // resolvedRole is managed LOCALLY so it is never subject to auth-context
  // timing issues. It starts as the cached context role (best we have before
  // the network round-trip) and is updated once getMyEventRole() resolves.
  const [resolvedRole, setResolvedRole] = useState<'sponsor' | 'attendee'>(
    user?.role ?? 'attendee',
  );
  // roleReady blocks the tab bar from rendering until we have confirmed the
  // role for the current event. This prevents a flash of the wrong tab set.
  const [roleReady, setRoleReady] = useState(false);

  // Track the event+user combo so we don't double-fetch on re-renders that
  // aren't caused by an event/user change.
  const lastFetchKey = useRef('');

  useEffect(() => {
    if (!user?.id) {
      // No user — auth guard below will redirect
      setRoleReady(true);
      return;
    }

    const fetchKey = `${currentEventId ?? 'none'}:${user.id}`;
    if (fetchKey === lastFetchKey.current) return;
    lastFetchKey.current = fetchKey;

    if (!currentEventId) {
      // No event selected yet — use whatever the context says and don't block
      setResolvedRole(user.role ?? 'attendee');
      setRoleReady(true);
      return;
    }

    // Fetch the definitive event-scoped role from the backend.
    // Pass badgeCode as the primary lookup key (single-record, fast).
    setRoleReady(false);
    let cancelled = false;

    getMyEventRole(currentEventId, user.id, user.badgeCode)
      .then((role) => {
        if (cancelled) return;
        console.log(`[TabsLayout] getMyEventRole resolved → ${role} (context was ${user.role})`);
        setResolvedRole(role);
        setRoleReady(true);
        // Keep auth context in sync so other screens see the correct role
        if (role !== user.role) {
          setUser({ ...user, role });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        console.log(`[TabsLayout] getMyEventRole error, falling back to context role:`, err);
        setResolvedRole(user.role ?? 'attendee');
        setRoleReady(true);
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEventId, user?.id]);

  if (!user) return <Redirect href="/(auth)/welcome" />;

  // While confirming the role, show a minimal spinner so the user doesn't
  // see the wrong tab set flash for even a frame.
  if (!roleReady) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator size="large" color="#7c3aed" />
      </View>
    );
  }

  const tabs = resolvedRole === 'sponsor' ? SPONSOR_TABS : ATTENDEE_TABS;
  const activeNames = new Set(tabs.map((t) => t.name));

  const tabBarHeight = Platform.OS === 'ios' ? 84 : 64;
  const tabBarPaddingBottom = Platform.OS === 'ios' ? 28 : 8;

  return (
    <View style={styles.root}>
      {toast && <ToastNotification message={toast.message} points={toast.points} />}
      <Tabs
        key={resolvedRole}
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
  center: { justifyContent: 'center', alignItems: 'center' },
});
