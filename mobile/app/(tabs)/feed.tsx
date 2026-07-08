import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { useAgenda } from '@/hooks/useAgenda';
import { useSpeakers, useAudience, useLeaderboard } from '@/hooks/useAudience';
import { useGiveaways } from '@/hooks/useEngage';
import { useEvents } from '@/hooks/useEvents';
import { colors, spacing, radius, typography } from '@/constants/theme';
import type { Session, LeaderboardEntry } from '@/lib/api/types';
import type { Speaker } from '@/lib/api/users';

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#7c3aed', '#f43f5e'];
function avatarColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h += id.charCodeAt(i);
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase() : (parts[0]?.[0] ?? '?').toUpperCase();
}

function parseTime(t: string): Date | null {
  if (!t) return null;
  const now = new Date();
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
}

function isCurrentSession(s: Session): boolean {
  const start = parseTime(s.startTime);
  const end = parseTime(s.endTime);
  if (!start || !end) return false;
  const now = new Date();
  return now >= start && now <= end;
}

function isUpcomingSession(s: Session): boolean {
  const start = parseTime(s.startTime);
  if (!start) return false;
  const now = new Date();
  return start > now;
}

function formatTime(t: string): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (isNaN(h)) return t;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function SpeakerCard({ speaker }: { speaker: Speaker }) {
  const color = avatarColor(speaker.id);
  return (
    <View style={styles.speakerCard}>
      {speaker.avatar ? (
        <Image source={{ uri: speaker.avatar }} style={[styles.speakerAvatar, { borderColor: color + '55' }]} />
      ) : (
        <View style={[styles.speakerAvatarFallback, { backgroundColor: color }]}>
          <Text style={styles.speakerAvatarText}>{initials(speaker.name)}</Text>
        </View>
      )}
      <Text style={styles.speakerName} numberOfLines={1}>{speaker.name}</Text>
      <Text style={styles.speakerTitle} numberOfLines={2}>{speaker.title}</Text>
      <Text style={styles.speakerCompany} numberOfLines={1}>{speaker.company}</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, markEventCheckedIn } = useAuth();
  const { currentEventId } = useEvent();

  const { data: events = [] } = useEvents();
  const currentEvent = events.find((e) => String(e.id) === String(currentEventId)) ?? null;

  const { data: sessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useAgenda();
  const { data: speakers = [], isLoading: speakersLoading, refetch: refetchSpeakers } = useSpeakers();
  const { data: giveaways = [], isLoading: giveawaysLoading, refetch: refetchGiveaways } = useGiveaways();
  const { data: leaderboard = [], isLoading: leaderboardLoading, refetch: refetchLeaderboard } = useLeaderboard();
  const { data: attendees = [], isLoading: attendeesLoading, refetch: refetchAttendees } = useAudience();

  useEffect(() => {
    if (currentEventId) markEventCheckedIn(currentEventId);
  }, [currentEventId, markEventCheckedIn]);

  const isRefreshing = sessionsLoading || speakersLoading || giveawaysLoading || leaderboardLoading || attendeesLoading;

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchSessions(), refetchSpeakers(), refetchGiveaways(), refetchLeaderboard(), refetchAttendees()]);
  }, [refetchSessions, refetchSpeakers, refetchGiveaways, refetchLeaderboard, refetchAttendees]);

  const liveSessions = sessions.filter(isCurrentSession);
  const upcomingSessions = sessions.filter(isUpcomingSession).slice(0, 3);
  const upNextSession = liveSessions[0] ?? upcomingSessions[0] ?? null;

  const firstName = user?.name?.split(' ')[0] ?? 'there';
  const tierColor: Record<string, string> = { Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700', Platinum: '#e5e4e2' };
  const userTierColor = tierColor[user?.tier ?? 'Bronze'] ?? '#cd7f32';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
      }
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{initials(user?.name ?? 'U')}</Text>
          </View>
          <View>
            <Text style={styles.greeting}>Hi, {firstName}</Text>
            <View style={styles.tierRow}>
              <Text style={styles.points}>{user?.points ?? 0} pts</Text>
              <View style={[styles.tierDot, { backgroundColor: userTierColor }]} />
              <Text style={[styles.tierLabel, { color: userTierColor }]}>{user?.tier ?? 'Bronze'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/qr-badge')}>
            <Ionicons name="grid-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="notifications-outline" size={22} color={colors.textPrimary} />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>
      </View>

      {/* My Badge + Scan Badge buttons */}
      <View style={styles.badgeRow}>
        <TouchableOpacity style={styles.badgeBtn} onPress={() => router.push('/qr-badge')} activeOpacity={0.85}>
          <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.badgeBtnGrad}>
            <Ionicons name="qr-code-outline" size={16} color="#fff" />
            <Text style={styles.badgeBtnText}>My Badge</Text>
          </LinearGradient>
        </TouchableOpacity>
        <TouchableOpacity style={styles.badgeBtn} onPress={() => router.push('/(tabs)/engage')} activeOpacity={0.85}>
          <LinearGradient colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']} style={[styles.badgeBtnGrad, styles.badgeBtnOutline]}>
            <Ionicons name="scan-outline" size={16} color={colors.textPrimary} />
            <Text style={[styles.badgeBtnText, { color: colors.textPrimary }]}>Scan Badge</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Event Banner */}
      {currentEvent && (
        <View style={styles.bannerContainer}>
          <ImageBackground
            source={currentEvent.bannerUrl ? { uri: currentEvent.bannerUrl } : require('../../assets/splash.png')}
            style={styles.banner}
            imageStyle={styles.bannerImage}
          >
            <LinearGradient colors={['rgba(7,7,15,0.1)', 'rgba(7,7,15,0.75)']} style={styles.bannerGrad}>
              <View style={styles.attendingBadge}>
                <View style={styles.attendingDot} />
                <Text style={styles.attendingText}>YOU'RE ATTENDING</Text>
              </View>
              <Text style={styles.bannerTitle}>{currentEvent.name}</Text>
              <View style={styles.bannerMeta}>
                {currentEvent.startDate ? (
                  <View style={styles.bannerMetaItem}>
                    <Ionicons name="calendar-outline" size={12} color="rgba(255,255,255,0.75)" />
                    <Text style={styles.bannerMetaText}>
                      {new Date(currentEvent.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {currentEvent.endDate ? ` – ${new Date(currentEvent.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                    </Text>
                  </View>
                ) : null}
                {currentEvent.location ? (
                  <View style={styles.bannerMetaItem}>
                    <Ionicons name="location-outline" size={12} color="rgba(255,255,255,0.75)" />
                    <Text style={styles.bannerMetaText}>{currentEvent.location}</Text>
                  </View>
                ) : null}
              </View>
            </LinearGradient>
          </ImageBackground>
        </View>
      )}

      {/* Up Next */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Up Next</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/agenda')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>View agenda <Ionicons name="chevron-forward" size={12} color={colors.primary} /></Text>
          </TouchableOpacity>
        </View>

        {upNextSession ? (
          <View style={styles.agendaCard}>
            {liveSessions.length > 0 && (
              <View style={styles.liveNowBadge}>
                <View style={styles.livePulse} />
                <Text style={styles.liveNowText}>Live now</Text>
              </View>
            )}
            <Text style={styles.agendaTitle}>{upNextSession.title}</Text>
            <View style={styles.agendaMeta}>
              <View style={styles.agendaMetaItem}>
                <Ionicons name="time-outline" size={13} color={colors.primary} />
                <Text style={styles.agendaMetaText}>
                  {formatTime(upNextSession.startTime)} – {formatTime(upNextSession.endTime)}
                </Text>
              </View>
              {upNextSession.room ? (
                <View style={styles.agendaMetaItem}>
                  <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.agendaMetaText, { color: colors.textMuted }]}>{upNextSession.room}</Text>
                </View>
              ) : null}
            </View>
            {upNextSession.assignedAudience && upNextSession.assignedAudience.length > 0 && (
              <View style={styles.speakersRow}>
                {upNextSession.assignedAudience.slice(0, 3).map((sp, i) => (
                  <View key={sp.id} style={[styles.speakerChip, { marginLeft: i === 0 ? 0 : -8, zIndex: 10 - i, backgroundColor: avatarColor(sp.id) }]}>
                    <Text style={styles.speakerChipText}>{initials(sp.name)}</Text>
                  </View>
                ))}
                <Text style={styles.speakerNames} numberOfLines={1}>
                  {upNextSession.assignedAudience.slice(0, 2).map(s => s.name).join(', ')}
                  {upNextSession.assignedAudience.length > 2 ? ` +${upNextSession.assignedAudience.length - 2}` : ''}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>No sessions right now</Text>
          </View>
        )}
      </View>

      {/* Speaker Spotlight */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="mic-outline" size={16} color={colors.textPrimary} />
            <Text style={styles.sectionTitle}>Speaker Spotlight</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/audience')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all <Ionicons name="chevron-forward" size={12} color={colors.primary} /></Text>
          </TouchableOpacity>
        </View>

        {speakersLoading ? (
          <Text style={styles.loadingText}>Loading speakers…</Text>
        ) : speakers.length === 0 ? (
          <Text style={styles.emptySubText}>Speaker lineup coming soon</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.speakersScroll}>
            {speakers.slice(0, 10).map((sp) => (
              <SpeakerCard key={sp.id} speaker={sp} />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Giveaways & Draws */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Text style={styles.giftEmoji}>🎁</Text>
            <Text style={styles.sectionTitle}>Giveaways & Draws</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/(tabs)/engage')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>View all <Ionicons name="chevron-forward" size={12} color={colors.primary} /></Text>
          </TouchableOpacity>
        </View>

        {giveawaysLoading ? (
          <Text style={styles.loadingText}>Loading giveaways…</Text>
        ) : giveaways.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="gift-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>No active giveaways</Text>
          </View>
        ) : (
          giveaways.slice(0, 3).map((g) => (
            <TouchableOpacity key={g.id} style={styles.giveawayCard} onPress={() => router.push('/(tabs)/engage')} activeOpacity={0.8}>
              <View style={[styles.giveawayIcon, { backgroundColor: (g.color ?? colors.primary) + '22' }]}>
                <Ionicons name="gift" size={22} color={g.color ?? colors.primary} />
              </View>
              <View style={styles.giveawayInfo}>
                <Text style={styles.giveawayTitle} numberOfLines={1}>{g.title}</Text>
                <Text style={styles.giveawaySub}>{g.entries ?? 0} prizes from {g.sponsor}</Text>
              </View>
              <View style={styles.livePill}>
                <View style={styles.livePillDot} />
                <Text style={styles.livePillText}>Live</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Leaderboard */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Leaderboard</Text>
          <TouchableOpacity onPress={() => router.push('/leaderboard')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all <Ionicons name="chevron-forward" size={12} color={colors.primary} /></Text>
          </TouchableOpacity>
        </View>

        {leaderboardLoading ? (
          <Text style={styles.loadingText}>Loading leaderboard…</Text>
        ) : leaderboard.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="trophy-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>No rankings yet</Text>
          </View>
        ) : (
          <View style={styles.leaderboardCard}>
            {(leaderboard as LeaderboardEntry[]).slice(0, 5).map((entry, i) => {
              const rankColor = i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : colors.textMuted;
              const isMe = entry.name === user?.name;
              return (
                <View key={entry.userId} style={[styles.leaderRow, isMe && styles.leaderRowMe]}>
                  <Text style={[styles.leaderRank, { color: rankColor }]}>#{entry.rank}</Text>
                  <View style={[styles.leaderAvatar, { backgroundColor: avatarColor(entry.userId) }]}>
                    <Text style={styles.leaderAvatarText}>{initials(entry.name)}</Text>
                  </View>
                  <View style={styles.leaderInfo}>
                    <Text style={[styles.leaderName, isMe && { color: colors.primary }]} numberOfLines={1}>
                      {isMe ? 'You' : entry.name}
                    </Text>
                    {entry.company ? <Text style={styles.leaderCompany} numberOfLines={1}>{entry.company}</Text> : null}
                  </View>
                  <Text style={[styles.leaderPoints, { color: rankColor }]}>{entry.points} pts</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* Attendees */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Attendees</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/audience')} activeOpacity={0.7}>
            <Text style={styles.seeAll}>See all <Ionicons name="chevron-forward" size={12} color={colors.primary} /></Text>
          </TouchableOpacity>
        </View>

        {attendeesLoading ? (
          <Text style={styles.loadingText}>Loading attendees…</Text>
        ) : attendees.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyText}>No attendees yet</Text>
          </View>
        ) : (
          <View style={styles.attendeeList}>
            {attendees.slice(0, 4).map((a) => (
              <TouchableOpacity key={a.id} style={styles.attendeeRow} onPress={() => router.push('/(tabs)/audience')} activeOpacity={0.75}>
                <View style={[styles.attendeeAvatar, { backgroundColor: avatarColor(a.id) }]}>
                  <Text style={styles.attendeeAvatarText}>{initials(a.name)}</Text>
                </View>
                <View style={styles.attendeeInfo}>
                  <Text style={styles.attendeeName} numberOfLines={1}>{a.name}</Text>
                  <Text style={styles.attendeeRole} numberOfLines={1}>{a.title}{a.company ? ` · ${a.company}` : ''}</Text>
                </View>
                {a.role === 'sponsor' && (
                  <View style={styles.sponsorBadge}><Text style={styles.sponsorBadgeText}>SPONSOR</Text></View>
                )}
                <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { gap: 0 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerRight: { flexDirection: 'row', gap: spacing.sm },
  headerBtn: { padding: 6, position: 'relative' },
  notifDot: { position: 'absolute', top: 6, right: 6, width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  avatarCircle: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  greeting: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  points: { color: colors.textMuted, fontSize: 12 },
  tierDot: { width: 5, height: 5, borderRadius: 3 },
  tierLabel: { fontSize: 12, fontWeight: '600' },

  badgeRow: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  badgeBtn: { flex: 1, borderRadius: radius.full, overflow: 'hidden' },
  badgeBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11 },
  badgeBtnOutline: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  badgeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  bannerContainer: { marginHorizontal: spacing.xl, marginBottom: spacing.xl, borderRadius: radius.xl, overflow: 'hidden' },
  banner: { height: 165 },
  bannerImage: { borderRadius: radius.xl },
  bannerGrad: { flex: 1, justifyContent: 'flex-end', padding: spacing.lg },
  attendingBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  attendingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#10b981' },
  attendingText: { color: '#10b981', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  bannerTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 6 },
  bannerMeta: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap' },
  bannerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bannerMetaText: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },

  section: { paddingHorizontal: spacing.xl, marginBottom: spacing.xl },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  giftEmoji: { fontSize: 16 },
  seeAll: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  emptySubText: { color: colors.textMuted, fontSize: 13, marginTop: 4 },

  agendaCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  liveNowBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(124,58,237,0.12)', borderColor: 'rgba(124,58,237,0.3)', borderWidth: 1, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start', marginBottom: spacing.sm },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  liveNowText: { color: colors.primary, fontSize: 11, fontWeight: '700' },
  agendaTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700', marginBottom: spacing.sm },
  agendaMeta: { flexDirection: 'row', gap: spacing.lg, marginBottom: spacing.sm, flexWrap: 'wrap' },
  agendaMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  agendaMetaText: { color: colors.primary, fontSize: 13, fontWeight: '500' },
  speakersRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  speakerChip: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bgCard },
  speakerChipText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  speakerNames: { color: colors.textMuted, fontSize: 13, marginLeft: 8, flex: 1 },

  speakersScroll: { gap: spacing.md, paddingRight: spacing.md },
  speakerCard: { width: 120, alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  speakerAvatar: { width: 60, height: 60, borderRadius: 30, borderWidth: 2, marginBottom: spacing.sm },
  speakerAvatarFallback: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  speakerAvatarText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  speakerName: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  speakerTitle: { color: colors.textMuted, fontSize: 10, textAlign: 'center', lineHeight: 14, marginBottom: 2 },
  speakerCompany: { color: colors.textMuted, fontSize: 10, textAlign: 'center', fontStyle: 'italic' },

  giveawayCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', marginBottom: spacing.sm, gap: spacing.md },
  giveawayIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  giveawayInfo: { flex: 1 },
  giveawayTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  giveawaySub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.12)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  livePillDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#10b981' },
  livePillText: { color: '#10b981', fontSize: 11, fontWeight: '700' },

  leaderboardCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  leaderRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  leaderRowMe: { backgroundColor: 'rgba(124,58,237,0.08)' },
  leaderRank: { width: 28, fontSize: 14, fontWeight: '800', textAlign: 'center' },
  leaderAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  leaderAvatarText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  leaderInfo: { flex: 1 },
  leaderName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  leaderCompany: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  leaderPoints: { fontSize: 14, fontWeight: '800' },

  attendeeList: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  attendeeRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  attendeeAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  attendeeAvatarText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  attendeeInfo: { flex: 1 },
  attendeeName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  attendeeRole: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  sponsorBadge: { backgroundColor: 'rgba(6,182,212,0.15)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  sponsorBadgeText: { color: colors.accent, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  emptyCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
  emptyText: { color: colors.textMuted, fontSize: 13 },
});
