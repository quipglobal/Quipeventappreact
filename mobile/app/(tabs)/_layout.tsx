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
  { name: 'feed', title: 'Feed', icon: 'play-circle-outline', iconFocused: 'play-circle' },
  { name: 'audience', title: 'Audience', icon: 'people-outline', iconFocused: 'people' },
  { name: 'engage', title: 'Engage', icon: 'flash-outline', iconFocused: 'flash' },
  { name: 'agenda', title: 'Agenda', icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'partners', title: 'Partners', icon: 'briefcase-outline', iconFocused: 'briefcase' },
];

const SPONSOR_TABS: TabConfig[] = [
  { name: 'feed', title: 'Feed', icon: 'play-circle-outline', iconFocused: 'play-circle' },
  { name: 'audience', title: 'Audience', icon: 'people-outline', iconFocused: 'people' },
  { name: 'engage', title: 'Scan Badge', icon: 'qr-code-outline', iconFocused: 'qr-code' },
  { name: 'agenda', title: 'Agenda', icon: 'calendar-outline', iconFocused: 'calendar' },
  { name: 'partners', title: 'Leads', icon: 'list-outline', iconFocused: 'list' },
];

export default function TabsLayout() {
  const { user, toast } = useAuth();
  const { colors, spacing } = useTheme();

  if (!user) return <Redirect href="/(auth)/welcome" />;

  const tabs = user.role === 'sponsor' ? SPONSOR_TABS : ATTENDEE_TABS;

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
        {tabs.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              tabBarIcon: ({ focused, color }) => (
                <Ionicons
                  name={focused ? tab.iconFocused : tab.icon}
                  size={22}
                  color={color}
                />
              ),
            }}
          />
        ))}
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070F' },
});
