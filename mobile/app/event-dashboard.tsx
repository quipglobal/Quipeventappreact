import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

const { width: SW } = Dimensions.get('window');
const COL = (SW - spacing.xl * 2 - spacing.md) / 2;

type StatCard = { icon: string; label: string; value: string; sub: string; color: string };

const EVENT_STATS: StatCard[] = [
  { icon: 'people', label: 'Total Attendees', value: '842', sub: '+12 today', color: '#7c3aed' },
  { icon: 'play-circle', label: 'Sessions Live', value: '3', sub: '5 upcoming', color: '#06b6d4' },
  { icon: 'flash', label: 'Active Polls', value: '7', sub: '342 votes cast', color: '#f59e0b' },
  { icon: 'trophy', label: 'Top Points', value: '680', sub: 'Aisha Kamara', color: '#ffd700' },
  { icon: 'briefcase', label: 'Sponsors', value: '24', sub: '4 tiers', color: '#10b981' },
  { icon: 'gift', label: 'Giveaways', value: '2', sub: 'Draw at 5 PM', color: '#ec4899' },
];

const SESSIONS_NOW = [
  { id: 's1', title: 'Opening Keynote: The Future of AI', room: 'Main Hall', remaining: '32 min', color: '#7c3aed', attendees: 412 },
  { id: 's2', title: 'Scaling Engineering Teams', room: 'Room A', remaining: '18 min', color: '#06b6d4', attendees: 87 },
  { id: 's3', title: 'UX Research Workshop', room: 'Room B', remaining: '51 min', color: '#ec4899', attendees: 64 },
];

const LEADERBOARD_PREVIEW = [
  { rank: 1, name: 'Aisha Kamara', points: 680, tier: 'Platinum', color: '#e5e4e2' },
  { rank: 2, name: 'Dev Sharma', points: 540, tier: 'Gold', color: '#ffd700' },
  { rank: 3, name: 'Lena Fischer', points: 420, tier: 'Gold', color: '#ffd700' },
];

export default function EventDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [myRank] = useState(14);

  return (
    <ScrollView
      style={[styles.root]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Event Dashboard</Text>
        <View style={styles.liveChip}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <LinearGradient colors={['#1a0d2e', '#0d1a2e']} style={styles.heroCard}>
        <Text style={styles.heroEvent}>CXO Tech Summit 2026</Text>
        <Text style={styles.heroDate}>January 16–18 · San Francisco, CA</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>Day 1</Text>
            <Text style={styles.heroStatLabel}>of 3</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>9:42</Text>
            <Text style={styles.heroStatLabel}>AM PST</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{myRank}</Text>
            <Text style={styles.heroStatLabel}>Your Rank</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatValue}>{user?.points ?? 0}</Text>
            <Text style={styles.heroStatLabel}>Your Pts</Text>
          </View>
        </View>
      </LinearGradient>

      <Text style={styles.sectionTitle}>EVENT STATS</Text>
      <View style={styles.statsGrid}>
        {EVENT_STATS.map((stat) => (
          <View key={stat.label} style={[styles.statCard, { width: COL }]}>
            <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
              <Ionicons name={stat.icon as any} size={22} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
            <Text style={styles.statSub}>{stat.sub}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>HAPPENING NOW</Text>
      <View style={styles.sessionsList}>
        {SESSIONS_NOW.map((s) => (
          <View key={s.id} style={styles.sessionCard}>
            <View style={[styles.sessionBar, { backgroundColor: s.color }]} />
            <View style={styles.sessionBody}>
              <Text style={styles.sessionTitle} numberOfLines={1}>{s.title}</Text>
              <View style={styles.sessionMeta}>
                <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                <Text style={styles.sessionMetaText}>{s.room}</Text>
                <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                <Text style={styles.sessionMetaText}>{s.remaining} left</Text>
                <Ionicons name="people-outline" size={11} color={colors.textMuted} />
                <Text style={styles.sessionMetaText}>{s.attendees}</Text>
              </View>
            </View>
            <View style={[styles.livePip, { backgroundColor: s.color + '30', borderColor: s.color + '60' }]}>
              <Text style={[styles.livePipText, { color: s.color }]}>LIVE</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>TOP PERFORMERS</Text>
      <View style={styles.leaderList}>
        {LEADERBOARD_PREVIEW.map((l) => (
          <View key={l.rank} style={styles.leaderRow}>
            <View style={[styles.rankBadge, l.rank <= 3 && { backgroundColor: l.color + '20', borderColor: l.color + '60' }]}>
              <Text style={[styles.rankText, l.rank <= 3 && { color: l.color }]}>#{l.rank}</Text>
            </View>
            <Text style={styles.leaderName}>{l.name}</Text>
            <View style={[styles.tierPill, { backgroundColor: l.color + '15', borderColor: l.color + '40' }]}>
              <Text style={[styles.tierText, { color: l.color }]}>{l.tier}</Text>
            </View>
            <Text style={styles.leaderPoints}>{l.points} pts</Text>
          </View>
        ))}
        <View style={[styles.leaderRow, styles.leaderYou]}>
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{myRank}</Text>
          </View>
          <Text style={[styles.leaderName, { color: colors.primary }]}>You</Text>
          <View style={[styles.tierPill, { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.4)' }]}>
            <Text style={[styles.tierText, { color: colors.primary }]}>{user?.tier ?? 'Bronze'}</Text>
          </View>
          <Text style={[styles.leaderPoints, { color: colors.primary }]}>{user?.points ?? 0} pts</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.xl },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText: { color: '#ef4444', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  heroCard: { borderRadius: radius.xxl, padding: spacing.xl, marginBottom: spacing.xl },
  heroEvent: { color: colors.textPrimary, fontSize: 17, fontWeight: '800', marginBottom: 4 },
  heroDate: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.lg },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroStat: { alignItems: 'center' },
  heroStatValue: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  heroStatLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  sectionTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: spacing.md, marginTop: spacing.lg },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: spacing.md },
  statCard: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { color: colors.textPrimary, fontSize: 24, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  statSub: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  sessionsList: { gap: spacing.sm, marginBottom: spacing.md },
  sessionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sessionBar: { width: 4, alignSelf: 'stretch' },
  sessionBody: { flex: 1, padding: spacing.md },
  sessionTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionMetaText: { color: colors.textMuted, fontSize: 10, marginRight: 6 },
  livePip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, marginRight: spacing.md },
  livePipText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  leaderList: { gap: spacing.sm },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  leaderYou: { borderColor: colors.primary + '50', backgroundColor: 'rgba(124,58,237,0.06)' },
  rankBadge: { width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rankText: { color: colors.textMuted, fontSize: 11, fontWeight: '800' },
  leaderName: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  tierPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  tierText: { fontSize: 10, fontWeight: '700' },
  leaderPoints: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
});
