import React, { useMemo } from 'react';
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
import { useLeaderboard } from '@/hooks/useAudience';
import { DataState } from '@/components/DataState';
import { colors, spacing, radius, typography } from '@/constants/theme';
import type { LeaderboardEntry } from '@/lib/api/types';

interface Row extends LeaderboardEntry {
  isCurrentUser: boolean;
}

const rankGradient = (rank: number): readonly [string, string] =>
  rank === 1 ? ['#f59e0b', '#d97706']
  : rank === 2 ? ['#94a3b8', '#64748b']
  : rank === 3 ? ['#f97316', '#ea580c']
  : ['#4f46e5', '#7c3aed'];

const tierColorFor = (tier: string, fallback?: string): string => {
  if (fallback && fallback.trim() !== '') return fallback;
  return colors.tiers[tier as keyof typeof colors.tiers] ?? colors.tiers.Bronze;
};

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data: leaderboardData = [], isLoading, isError, refetch } = useLeaderboard();

  const rows: Row[] = useMemo(
    () =>
      leaderboardData.map((entry) => ({
        ...entry,
        isCurrentUser: !!user?.id && entry.userId === user.id,
      })),
    [leaderboardData, user?.id],
  );

  const userRow = rows.find((r) => r.isCurrentUser);
  const top3 = rows.slice(0, 3);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <LinearGradient
        colors={['#4f46e5', '#7c3aed', '#9333ea']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + spacing.md }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Ionicons name="trophy" size={26} color="#fff" />
          <View style={styles.headerTitleText}>
            <Text style={styles.headerTitle}>Leaderboard</Text>
            <Text style={styles.headerSubtitle}>Top performers at the event</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Your Ranking */}
      {userRow && (
        <View style={styles.yourRankWrap}>
          <View style={styles.yourRankCard}>
            <Text style={styles.yourRankLabel}>Your Ranking</Text>
            <View style={styles.yourRankRow}>
              <View style={styles.yourRankLeft}>
                <LinearGradient colors={rankGradient(userRow.rank)} style={styles.yourRankBadge}>
                  <Text style={styles.yourRankBadgeText}>#{userRow.rank}</Text>
                </LinearGradient>
                <View>
                  <Text style={styles.yourRankPoints}>
                    {userRow.points} <Text style={styles.yourRankPointsUnit}>pts</Text>
                  </Text>
                  <Text style={styles.yourRankTier}>{userRow.tier} Tier</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      )}

      <DataState
        loading={isLoading && rows.length === 0}
        error={isError ? 'Failed to load leaderboard.' : null}
        onRetry={refetch}
      />

      {/* Empty state */}
      {!isLoading && !isError && rows.length === 0 && (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={44} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No rankings yet</Text>
          <Text style={styles.emptySub}>
            Earn points by joining sessions, scanning sponsors, and completing challenges.
          </Text>
        </View>
      )}

      {/* Podium — top 3 */}
      {top3.length === 3 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top 3 Leaders</Text>
          <View style={styles.podiumCard}>
            <View style={styles.podiumRow}>
              {/* 2nd */}
              <View style={styles.podiumCol}>
                <View style={[styles.podiumAvatar, { borderColor: '#94a3b8' }]}>
                  <Text style={styles.podiumAvatarText}>{top3[1].name[0]}</Text>
                  <View style={[styles.podiumMedal, { backgroundColor: '#64748b' }]}>
                    <Ionicons name="medal" size={12} color="#fff" />
                  </View>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>{top3[1].name.split(' ')[0]}</Text>
                <Text style={styles.podiumPts}>{top3[1].points} pts</Text>
                <View style={[styles.podiumBar, styles.podiumBarSecond]} />
              </View>
              {/* 1st */}
              <View style={styles.podiumCol}>
                <Ionicons name="ribbon" size={22} color="#f59e0b" style={{ marginBottom: 2 }} />
                <View style={[styles.podiumAvatar, styles.podiumAvatarFirst, { borderColor: '#f59e0b' }]}>
                  <Text style={styles.podiumAvatarText}>{top3[0].name[0]}</Text>
                  <View style={[styles.podiumMedal, { backgroundColor: '#f59e0b' }]}>
                    <Ionicons name="trophy" size={12} color="#fff" />
                  </View>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>{top3[0].name.split(' ')[0]}</Text>
                <Text style={styles.podiumPtsFirst}>{top3[0].points} pts</Text>
                <View style={[styles.podiumBar, styles.podiumBarFirst]} />
              </View>
              {/* 3rd */}
              <View style={styles.podiumCol}>
                <View style={[styles.podiumAvatar, { borderColor: '#f97316' }]}>
                  <Text style={styles.podiumAvatarText}>{top3[2].name[0]}</Text>
                  <View style={[styles.podiumMedal, { backgroundColor: '#ea580c' }]}>
                    <Ionicons name="medal" size={12} color="#fff" />
                  </View>
                </View>
                <Text style={styles.podiumName} numberOfLines={1}>{top3[2].name.split(' ')[0]}</Text>
                <Text style={styles.podiumPts}>{top3[2].points} pts</Text>
                <View style={[styles.podiumBar, styles.podiumBarThird]} />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Full ranked list */}
      {rows.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Rankings</Text>
          {rows.map((person) => (
            <View
              key={person.userId || `rank-${person.rank}`}
              style={[styles.rankRow, person.isCurrentUser && styles.rankRowMe]}
            >
              <LinearGradient colors={rankGradient(person.rank)} style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>#{person.rank}</Text>
              </LinearGradient>
              <View
                style={[
                  styles.rankAvatar,
                  { borderColor: tierColorFor(person.tier, person.tierColor) + '66' },
                ]}
              >
                <Text style={styles.rankAvatarText}>{person.name[0]}</Text>
              </View>
              <View style={styles.rankInfo}>
                <View style={styles.rankNameRow}>
                  <Text
                    style={[styles.rankName, person.isCurrentUser && styles.rankNameMe]}
                    numberOfLines={1}
                  >
                    {person.name}{person.isCurrentUser ? ' (You)' : ''}
                  </Text>
                  <View
                    style={[
                      styles.tierPill,
                      { backgroundColor: tierColorFor(person.tier, person.tierColor) + '22' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.tierPillText,
                        { color: tierColorFor(person.tier, person.tierColor) },
                      ]}
                    >
                      {person.tier}
                    </Text>
                  </View>
                </View>
                {!!person.company && (
                  <Text style={styles.rankCompany} numberOfLines={1}>{person.company}</Text>
                )}
              </View>
              <Text style={styles.rankPoints}>{person.points}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: insets.bottom + spacing.xxl }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xxl,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerTitleText: {
    flex: 1,
  },
  headerTitle: {
    ...typography.h1,
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  yourRankWrap: {
    paddingHorizontal: spacing.xl,
    marginTop: -spacing.lg,
    marginBottom: spacing.lg,
  },
  yourRankCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  yourRankLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  yourRankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  yourRankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  yourRankBadge: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yourRankBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
  yourRankPoints: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  yourRankPointsUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  yourRankTier: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  section: {
    paddingHorizontal: spacing.xl,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  podiumCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.md,
  },
  podiumCol: {
    flex: 1,
    alignItems: 'center',
  },
  podiumAvatar: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    borderWidth: 3,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  podiumAvatarFirst: {
    width: 72,
    height: 72,
    borderWidth: 4,
  },
  podiumAvatarText: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 20,
  },
  podiumMedal: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgCard,
  },
  podiumName: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  podiumPts: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  podiumPtsFirst: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: radius.md,
    borderTopRightRadius: radius.md,
    marginTop: spacing.md,
  },
  podiumBarFirst: {
    height: 56,
    backgroundColor: 'rgba(245,158,11,0.14)',
  },
  podiumBarSecond: {
    height: 40,
    backgroundColor: colors.bgElevated,
  },
  podiumBarThird: {
    height: 32,
    backgroundColor: 'rgba(249,115,22,0.14)',
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankRowMe: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  rankAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: 2,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankAvatarText: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  rankInfo: {
    flex: 1,
    minWidth: 0,
  },
  rankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rankName: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    flexShrink: 1,
  },
  rankNameMe: {
    color: colors.primaryLight,
  },
  tierPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  tierPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  rankCompany: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  rankPoints: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySub: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
