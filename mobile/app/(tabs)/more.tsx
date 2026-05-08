import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

type IoniconsName = React.ComponentProps<typeof Ionicons>['name'];

interface MenuItem {
  label: string;
  icon: IoniconsName;
  color: string;
  bg: string;
  onPress: () => void;
  badge?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();

  const sections: MenuSection[] = [
    {
      title: 'Event',
      items: [
        {
          label: 'Scan Badge',
          icon: 'qr-code-outline',
          color: '#7c3aed',
          bg: 'rgba(124,58,237,0.12)',
          onPress: () => router.push('/(tabs)/engage' as any),
        },
        {
          label: 'Partners',
          icon: 'briefcase-outline',
          color: '#06b6d4',
          bg: 'rgba(6,182,212,0.12)',
          onPress: () => router.push('/(tabs)/partners' as any),
        },
        {
          label: 'Manage Giveaways',
          icon: 'gift-outline',
          color: '#f59e0b',
          bg: 'rgba(245,158,11,0.12)',
          onPress: () => router.push('/(tabs)/engage' as any),
        },
        {
          label: 'Agenda',
          icon: 'calendar-outline',
          color: '#10b981',
          bg: 'rgba(16,185,129,0.12)',
          onPress: () => router.push('/(tabs)/agenda' as any),
        },
        {
          label: 'Speakers',
          icon: 'mic-outline',
          color: '#a78bfa',
          bg: 'rgba(167,139,250,0.12)',
          onPress: () => router.push('/(tabs)/audience' as any),
        },
      ],
    },
    {
      title: 'My Account',
      items: [
        {
          label: 'My Badge',
          icon: 'qr-code-outline',
          color: colors.primary,
          bg: 'rgba(124,58,237,0.12)',
          onPress: () => router.push('/qr-badge'),
        },
        {
          label: 'Leaderboard',
          icon: 'trophy-outline',
          color: '#ffd700',
          bg: 'rgba(255,215,0,0.10)',
          onPress: () => router.push('/event-dashboard' as any),
        },
        {
          label: 'Settings',
          icon: 'settings-outline',
          color: '#94a3b8',
          bg: 'rgba(148,163,184,0.12)',
          onPress: () => router.push('/profile'),
        },
      ],
    },
    {
      title: 'Events',
      items: [
        {
          label: 'Switch Events',
          icon: 'swap-horizontal-outline',
          color: '#7c3aed',
          bg: 'rgba(124,58,237,0.12)',
          onPress: () => router.push('/events'),
        },
      ],
    },
  ];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>More</Text>
      </View>

      {/* Profile card */}
      <TouchableOpacity
        style={styles.profileCard}
        onPress={() => router.push('/profile')}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={['rgba(124,58,237,0.18)', 'rgba(79,70,229,0.08)']}
          style={styles.profileGrad}
        >
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>
              {user?.name ? user.name[0].toUpperCase() : 'S'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name ?? 'Sponsor Rep'}</Text>
            <Text style={styles.profileRole}>Sponsor Representative</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </LinearGradient>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title.toUpperCase()}</Text>
            <View style={styles.sectionCard}>
              {section.items.map((item, idx) => (
                <React.Fragment key={item.label}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={item.onPress}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.iconBox, { backgroundColor: item.bg }]}>
                      <Ionicons name={item.icon} size={20} color={item.color} />
                    </View>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    {item.badge ? (
                      <View style={styles.badgePill}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                  {idx < section.items.length - 1 && (
                    <View style={styles.divider} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={styles.signOutBtn}
          onPress={() => logout()}
          activeOpacity={0.75}
        >
          <Ionicons name="log-out-outline" size={18} color="#ef4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  header: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },

  profileCard: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
  },
  profileGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(124,58,237,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarText: { color: colors.primary, fontSize: 20, fontWeight: '800' },
  profileInfo: { flex: 1 },
  profileName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  profileRole: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  scroll: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg },

  section: { marginBottom: spacing.lg },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: spacing.sm,
    marginLeft: 4,
  },
  sectionCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '500' },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginLeft: 56 },

  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    marginBottom: spacing.lg,
  },
  signOutText: { color: '#ef4444', fontSize: 15, fontWeight: '600' },
});
