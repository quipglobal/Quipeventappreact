import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Switch,
  Platform,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useUserPoints } from '@/hooks/useEvents';
import { colors, spacing, radius } from '@/constants/theme';

const TIER_COLORS: Record<string, string> = {
  Bronze: '#cd7f32',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Platinum: '#e5e4e2',
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, bookmarkedSessions, completedChallenges, votedPolls } = useAuth();
  const [notifications, setNotifications] = useState(true);
  const [sessionReminders, setSessionReminders] = useState(true);

  const { data: pointsData } = useUserPoints();
  const livePoints = pointsData?.points ?? user?.points ?? 0;
  const liveTier = pointsData?.tier ?? user?.tier ?? 'Bronze';
  const tierColor = TIER_COLORS[liveTier] ?? colors.primary;
  const qrData = JSON.stringify({ id: user?.id, name: user?.name, event: 'cxo-summit-2026' });

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/welcome'); } },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.push('/events')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="swap-horizontal-outline" size={18} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <LinearGradient colors={['#1a0d2e', '#0d1a2e']} style={styles.profileCard}>
        <View style={[styles.avatarRing, { borderColor: tierColor }]}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0] ?? '?'}</Text>
          </View>
        </View>
        <Text style={styles.profileName}>{user?.name ?? 'Guest'}</Text>
        {user?.title && user?.company && (
          <Text style={styles.profileRole}>{user.title} · {user.company}</Text>
        )}
        <Text style={styles.profilePhone}>{user?.phone ?? ''}</Text>

        <View style={styles.roleBadge}>
          <Ionicons name={user?.role === 'sponsor' ? 'briefcase' : 'people'} size={12} color={colors.primary} />
          <Text style={styles.roleText}>{user?.role === 'sponsor' ? 'Sponsor' : 'Attendee'}</Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{livePoints}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedChallenges.length}</Text>
            <Text style={styles.statLabel}>Challenges</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{bookmarkedSessions.length}</Text>
            <Text style={styles.statLabel}>Bookmarks</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{votedPolls.length}</Text>
            <Text style={styles.statLabel}>Polls</Text>
          </View>
        </View>

        <View style={[styles.tierPill, { borderColor: tierColor + '44', backgroundColor: tierColor + '15' }]}>
          <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
          <Text style={[styles.tierText, { color: tierColor }]}>{liveTier} Tier</Text>
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>My Badge</Text>
      <TouchableOpacity style={styles.qrCard} onPress={() => router.push('/qr-badge')} activeOpacity={0.8}>
        <View style={styles.qrWrap}>
          <QRCode
            value={qrData}
            size={100}
            color="#fff"
            backgroundColor="transparent"
          />
        </View>
        <View style={styles.qrInfo}>
          <Text style={styles.qrName}>{user?.name ?? 'Your Badge'}</Text>
          <Text style={styles.qrSub}>Tap to view full-screen</Text>
          <View style={styles.qrBadge}>
            <Ionicons name="qr-code-outline" size={12} color={colors.primary} />
            <Text style={styles.qrBadgeText}>ATTENDEE BADGE</Text>
          </View>
        </View>
        <Ionicons name="expand-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Quick Links</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/event-dashboard')}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
            <Ionicons name="stats-chart-outline" size={16} color={colors.accent} />
          </View>
          <Text style={styles.menuText}>Event Dashboard</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Preferences</Text>
      <View style={styles.section}>
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
              <Ionicons name="notifications-outline" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.settingTitle}>Push Notifications</Text>
              <Text style={styles.settingSubtitle}>Session alerts & updates</Text>
            </View>
          </View>
          <Switch value={notifications} onValueChange={setNotifications} trackColor={{ false: 'rgba(255,255,255,0.1)', true: colors.primary }} thumbColor="#fff" />
        </View>
        <View style={styles.divider} />
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <View style={[styles.settingIcon, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
              <Ionicons name="alarm-outline" size={16} color="#06b6d4" />
            </View>
            <View>
              <Text style={styles.settingTitle}>Session Reminders</Text>
              <Text style={styles.settingSubtitle}>15 min before sessions</Text>
            </View>
          </View>
          <Switch value={sessionReminders} onValueChange={setSessionReminders} trackColor={{ false: 'rgba(255,255,255,0.1)', true: '#06b6d4' }} thumbColor="#fff" />
        </View>
      </View>

      <Text style={styles.sectionTitle}>Event Info</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuRow} onPress={() => Alert.alert('Venue', 'Convention Center, Hall A-B\n123 Main St, San Francisco, CA 94105')}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
            <Ionicons name="location-outline" size={16} color="#10b981" />
          </View>
          <Text style={styles.menuText}>Venue Info</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.menuRow} onPress={() => Alert.alert('WiFi', 'Network: CXO-Events-2026\nPassword: Summit2026!')}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
            <Ionicons name="wifi-outline" size={16} color="#f59e0b" />
          </View>
          <Text style={styles.menuText}>WiFi Details</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.menuRow} onPress={() => router.push('/events')}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
            <Ionicons name="swap-horizontal-outline" size={16} color={colors.primary} />
          </View>
          <Text style={styles.menuText}>Switch Event</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        <View style={styles.divider} />
        <TouchableOpacity style={styles.menuRow} onPress={() => Alert.alert('Help', 'Event support: support@cxoinc.com\nEmergency: +1 (555) 000-9999')}>
          <View style={[styles.settingIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Ionicons name="help-circle-outline" size={16} color="#ef4444" />
          </View>
          <Text style={styles.menuText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={18} color="#ef4444" />
        <Text style={styles.logoutText}>Log Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>CXO Events v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  profileCard: { borderRadius: radius.xxl, padding: spacing.xl, alignItems: 'center', marginBottom: spacing.xl },
  avatarRing: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '800' },
  profileName: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  profileRole: { color: colors.textSecondary, fontSize: 13, marginBottom: 4 },
  profilePhone: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.md },
  roleBadge: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', marginBottom: spacing.xl },
  roleText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  statsRow: { flexDirection: 'row', width: '100%', marginBottom: spacing.lg },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.1)' },
  tierPill: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, borderWidth: 1 },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { fontSize: 12, fontWeight: '700' },

  sectionTitle: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.lg },

  qrCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  qrWrap: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1a1a2e', borderRadius: radius.lg, padding: 8 },
  qrInfo: { flex: 1 },
  qrName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  qrSub: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm },
  qrBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: 'rgba(124,58,237,0.12)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', alignSelf: 'flex-start' },
  qrBadgeText: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },

  section: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  settingIcon: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  settingTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  settingSubtitle: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.border, marginHorizontal: spacing.lg },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  menuText: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.08)', marginTop: spacing.xl },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  version: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.xl },
});
