import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { useLeaderboard, useAudience } from '@/hooks/useAudience';
import { useEvents, useJoinEvent } from '@/hooks/useEvents';
import { usePolls, useGiveaways } from '@/hooks/useEngage';
import { useAgenda } from '@/hooks/useAgenda';
import { usePartners } from '@/hooks/usePartners';
import { colors, spacing, radius } from '@/constants/theme';
import type { Event } from '@/lib/api/types';

const { width: SW } = Dimensions.get('window');
const COL = (SW - spacing.xl * 2 - spacing.md) / 2;

type EventMeta = { category: string; categoryColor: string; bannerColors: [string, string, ...string[]] };
const EVENT_META: Record<string, EventMeta> = {
  'evt-1': { category: 'CONFERENCE', categoryColor: '#7c3aed', bannerColors: ['#2d1060', '#1a0a3a', '#0a0a20'] },
  'evt-2': { category: 'CONFERENCE', categoryColor: '#4f46e5', bannerColors: ['#1a1060', '#0d0a30', '#07070f'] },
  'evt-3': { category: 'WORKSHOP',   categoryColor: '#06b6d4', bannerColors: ['#0a2840', '#0a1a30', '#050f1a'] },
};
const FALLBACK_META: EventMeta = { category: 'EVENT', categoryColor: '#4f46e5', bannerColors: ['#0d0d2e', '#1a0a3a', '#07070f'] };

const SESSION_COLORS = ['#7c3aed', '#06b6d4', '#ec4899', '#10b981', '#f59e0b', '#4f46e5'];

function minutesUntil(iso: string): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((t - Date.now()) / 60000));
}

function formatDateRange(start: string, end: string) {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  } catch { return `${start} – ${end}`; }
}

function StatusBadge({ status }: { status: Event['status'] }) {
  if (status === 'live') return (
    <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.25)', borderColor: 'rgba(16,185,129,0.5)' }]}>
      <View style={styles.liveDot} /><Text style={[styles.badgeText, { color: '#10b981' }]}>HAPPENING NOW</Text>
    </View>
  );
  if (status === 'upcoming') return (
    <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.45)' }]}>
      <Text style={[styles.badgeText, { color: '#f59e0b' }]}>UPCOMING</Text>
    </View>
  );
  return (
    <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.18)' }]}>
      <Text style={[styles.badgeText, { color: colors.textSecondary }]}>PAST</Text>
    </View>
  );
}

export default function EventDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { currentEventId } = useEvent();
  const { data: leaderboardData = [] } = useLeaderboard();
  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { mutate: joinEvent, isPending: joining } = useJoinEvent();
  // All event-stat KPIs and the "Happening Now" list now come from the
  // backend per current event. Previously these were hardcoded
  // (842 attendees, 3 live sessions, 24 sponsors, 2 giveaways, fixed
  // session list) and bled across event switches.
  const { data: pollsData = [], isLoading: pollsLoading } = usePolls();
  const { data: attendeesData = [], isLoading: attendeesLoading } = useAudience();
  const { data: sessionsData = [], isLoading: sessionsLoading } = useAgenda();
  const { data: sponsorsData = [], isLoading: sponsorsLoading } = usePartners();
  const { data: giveawaysData = [], isLoading: giveawaysLoading } = useGiveaways();

  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [popupCode, setPopupCode] = useState('');

  const leaderboard = leaderboardData.slice(0, 3);

  // Derive live leaderboard stats from the API response
  const leader = leaderboardData[0] ?? null;
  const topPointsStat = {
    icon: 'trophy' as const,
    label: 'Top Points',
    value: leader ? String(leader.points) : '—',
    sub: leader ? leader.name.split(' ')[0] : 'Loading…',
    color: '#ffd700',
  };
  // Compute the live polls KPI from the backend response. Sums the
  // total votes across every poll for the sub-line so the user sees
  // real engagement, not a baked-in number.
  const totalPollVotes = pollsData.reduce(
    (sum, p) => sum + p.options.reduce((s, o) => s + o.votes, 0),
    0,
  );

  // Derive "live now" sessions from real start/end times so the count
  // and the list under "Happening Now" stay in sync with the backend.
  const now = Date.now();
  const liveSessions = sessionsData.filter((s) => {
    const start = s.startTime ? new Date(s.startTime).getTime() : NaN;
    const end = s.endTime ? new Date(s.endTime).getTime() : NaN;
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return start <= now && now <= end;
  });
  const upcomingSessions = sessionsData.filter((s) => {
    const start = s.startTime ? new Date(s.startTime).getTime() : NaN;
    return !Number.isNaN(start) && start > now;
  });

  const livePollsStat = {
    icon: 'flash' as const,
    label: 'Active Polls',
    value: pollsLoading ? '—' : String(pollsData.length),
    sub: pollsLoading
      ? 'Loading…'
      : pollsData.length === 0
        ? 'None active'
        : `${totalPollVotes} vote${totalPollVotes === 1 ? '' : 's'}`,
    color: '#f59e0b',
  };

  const attendeesStat = {
    icon: 'people' as const,
    label: 'Attendees',
    value: attendeesLoading ? '—' : String(attendeesData.length),
    sub: attendeesLoading ? 'Loading…' : attendeesData.length === 1 ? 'registered' : 'registered',
    color: '#7c3aed',
  };
  const sessionsStat = {
    icon: 'play-circle' as const,
    label: 'Sessions Live',
    value: sessionsLoading ? '—' : String(liveSessions.length),
    sub: sessionsLoading
      ? 'Loading…'
      : `${upcomingSessions.length} upcoming`,
    color: '#06b6d4',
  };
  const sponsorsStat = {
    icon: 'briefcase' as const,
    label: 'Sponsors',
    value: sponsorsLoading ? '—' : String(sponsorsData.length),
    sub: sponsorsLoading
      ? 'Loading…'
      : sponsorsData.length === 0
        ? 'None yet'
        : `${new Set(sponsorsData.map((s) => s.tier).filter(Boolean)).size} tier${new Set(sponsorsData.map((s) => s.tier).filter(Boolean)).size === 1 ? '' : 's'}`,
    color: '#10b981',
  };
  const giveawaysStat = {
    icon: 'gift' as const,
    label: 'Giveaways',
    value: giveawaysLoading ? '—' : String(giveawaysData.length),
    sub: giveawaysLoading
      ? 'Loading…'
      : giveawaysData.length === 0
        ? 'None active'
        : 'Enter to win',
    color: '#ec4899',
  };

  const eventStats = [attendeesStat, sessionsStat, livePollsStat, topPointsStat, sponsorsStat, giveawaysStat];

  // Derive "Day X of N" from the current event's actual date range so the
  // hero pill reflects the real schedule instead of the previous "Day 1 of 3".
  const currentEventForHero = events.find((e) => e.id === currentEventId) ?? null;
  const dayInfo: { label: string; total: number } | null = (() => {
    if (!currentEventForHero) return null;
    const start = currentEventForHero.startDate ? new Date(currentEventForHero.startDate) : null;
    const end = currentEventForHero.endDate ? new Date(currentEventForHero.endDate) : null;
    if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    const dayMs = 24 * 60 * 60 * 1000;
    const total = Math.max(1, Math.round((end.getTime() - start.getTime()) / dayMs) + 1);
    const today = new Date();
    if (today < start) return { label: 'Day 1', total };
    if (today > end) return { label: `Day ${total}`, total };
    const dayNum = Math.min(total, Math.floor((today.getTime() - start.getTime()) / dayMs) + 1);
    return { label: `Day ${dayNum}`, total };
  })();

  // Find the current user's rank in the full leaderboard list. Match by name
  // (the leaderboard endpoint doesn't always return a userId field).
  const myRank = leaderboardData.findIndex(
    (l) => l.name === user?.name,
  );
  const myRankDisplay = myRank >= 0 ? `#${myRank + 1}` : '—';

  const upcomingEvents = events.filter((e) => e.status === 'live' || e.status === 'upcoming');
  const pastEvents = events.filter((e) => e.status === 'past');
  const tabEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;
  const currentEvent = events.find((e) => e.id === currentEventId) ?? events[0] ?? null;

  const openEventPopup = (event: Event) => {
    setSelectedEvent(event);
    setPopupCode(event.code);
  };

  const handlePopupJoin = () => {
    const c = popupCode.trim() || selectedEvent?.code || '';
    if (!c) return;
    joinEvent(c, {
      onSuccess: (event) => {
        setSelectedEvent(null);
        Alert.alert('Joined!', `You have joined "${event.name}".`, [
          { text: 'OK', onPress: () => router.replace('/(tabs)/feed') },
        ]);
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : `No event found for "${c.toUpperCase()}".`;
        Alert.alert('Not Found', msg);
      },
    });
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>EVENT DASHBOARD</Text>
        <View style={[styles.liveChip]}>
          <View style={styles.liveDotRed} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero gradient welcome */}
        <LinearGradient colors={['rgba(124,58,237,0.22)', 'transparent']} style={styles.hero}>
          <Text style={styles.heroTitle}>Welcome, {firstName}!</Text>
          <Text style={styles.heroSub} numberOfLines={1}>
            {currentEvent
              ? `${currentEvent.name} · ${formatDateRange(currentEvent.startDate, currentEvent.endDate)}`
              : 'CXO Event Companion'}
          </Text>
          <View style={styles.heroRow}>
            {dayInfo && (
              <View style={styles.heroStat}>
                <Text style={styles.heroStatVal}>{dayInfo.label}</Text>
                <Text style={styles.heroStatLbl}>of {dayInfo.total}</Text>
              </View>
            )}
            <View style={styles.heroStat}><Text style={styles.heroStatVal}>{user?.points ?? 0}</Text><Text style={styles.heroStatLbl}>Your Pts</Text></View>
          </View>
        </LinearGradient>

        {/* Event stats grid */}
        <Text style={styles.sectionLabel}>EVENT STATS</Text>
        <View style={styles.statsGrid}>
          {eventStats.map((s) => (
            <View key={s.label} style={[styles.statCard, { width: COL }]}>
              <View style={[styles.statIcon, { backgroundColor: s.color + '20' }]}>
                <Ionicons name={s.icon} size={20} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
              <Text style={styles.statSub}>{s.sub}</Text>
            </View>
          ))}
        </View>

        {/* Happening now — pulled from /api/v1/events/:id/sessions, filtered to
            sessions that are live right now. Falls back to the next 3 upcoming
            sessions so the section isn't blank between live blocks. */}
        <Text style={styles.sectionLabel}>HAPPENING NOW</Text>
        {sessionsLoading ? (
          <View style={[styles.sessionList, styles.center, { paddingVertical: spacing.lg }]}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (() => {
          const showing = liveSessions.length > 0 ? liveSessions : upcomingSessions.slice(0, 3);
          if (showing.length === 0) {
            return (
              <View style={[styles.sessionList, styles.empty]}>
                <Ionicons name="calendar-outline" size={28} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No sessions scheduled</Text>
              </View>
            );
          }
          return (
            <View style={styles.sessionList}>
              {showing.slice(0, 3).map((s, idx) => {
                const color = s.accentColor || SESSION_COLORS[idx % SESSION_COLORS.length];
                const isLive = liveSessions.includes(s);
                const endMins = minutesUntil(s.endTime);
                const startMins = minutesUntil(s.startTime);
                const remaining = isLive
                  ? endMins != null ? `${endMins} min left` : ''
                  : startMins != null ? `in ${startMins} min` : '';
                return (
                  <View key={s.id} style={styles.sessionCard}>
                    <View style={[styles.sessionBar, { backgroundColor: color }]} />
                    <View style={styles.sessionBody}>
                      <Text style={styles.sessionTitle} numberOfLines={1}>{s.title}</Text>
                      <View style={styles.sessionMeta}>
                        {!!s.room && (
                          <>
                            <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                            <Text style={styles.sessionMetaTxt}>{s.room}</Text>
                          </>
                        )}
                        {!!remaining && (
                          <>
                            <Ionicons name="time-outline" size={11} color={colors.textMuted} />
                            <Text style={styles.sessionMetaTxt}>{remaining}</Text>
                          </>
                        )}
                        {(s.assignedAudience?.length ?? 0) > 0 && (
                          <>
                            <Ionicons name="people-outline" size={11} color={colors.textMuted} />
                            <Text style={styles.sessionMetaTxt}>{s.assignedAudience!.length}</Text>
                          </>
                        )}
                      </View>
                    </View>
                    {isLive && (
                      <View style={[styles.livePip, { backgroundColor: color + '25', borderColor: color + '55' }]}>
                        <Text style={[styles.livePipTxt, { color }]}>LIVE</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* Leaderboard preview */}
        {leaderboard.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>TOP PERFORMERS</Text>
            <View style={styles.leaderList}>
              {leaderboard.map((l) => (
                <View key={l.rank} style={styles.leaderRow}>
                  <View style={[styles.rankBadge, { backgroundColor: l.tierColor + '18', borderColor: l.tierColor + '55' }]}>
                    <Text style={[styles.rankText, { color: l.tierColor }]}>#{l.rank}</Text>
                  </View>
                  <Text style={styles.leaderName}>{l.name}</Text>
                  <View style={[styles.tierPill, { backgroundColor: l.tierColor + '15', borderColor: l.tierColor + '40' }]}>
                    <Text style={[styles.tierText, { color: l.tierColor }]}>{l.tier}</Text>
                  </View>
                  <Text style={styles.leaderPts}>{l.points} pts</Text>
                </View>
              ))}
              <View style={[styles.leaderRow, styles.leaderYou]}>
                <View style={[styles.rankBadge, { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.4)' }]}>
                  <Text style={[styles.rankText, { color: colors.primary }]}>{myRankDisplay}</Text>
                </View>
                <Text style={[styles.leaderName, { color: colors.primary }]}>You</Text>
                <Text style={[styles.leaderPts, { color: colors.primary }]}>{user?.points ?? 0} pts</Text>
              </View>
            </View>
          </>
        )}

        {/* Browse events */}
        <Text style={styles.sectionLabel}>BROWSE EVENTS</Text>
        <View style={styles.tabRow}>
          {(['upcoming', 'past'] as const).map((tab) => {
            const count = tab === 'upcoming' ? upcomingEvents.length : pastEvents.length;
            const active = activeTab === tab;
            return (
              <TouchableOpacity key={tab} style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                <Ionicons name={tab === 'upcoming' ? 'time-outline' : 'checkmark-circle-outline'} size={13} color={active ? colors.textPrimary : colors.textMuted} />
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab === 'upcoming' ? 'Upcoming' : 'Past'}</Text>
                {count > 0 && (
                  <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                    <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {eventsLoading ? (
          <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
        ) : tabEvents.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No {activeTab} events</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {tabEvents.map((event) => {
              const meta = EVENT_META[event.id] ?? FALLBACK_META;
              const categoryLabel = event.category?.toUpperCase() ?? meta.category;
              const categoryColor = '#4f46e5';
              return (
                <TouchableOpacity key={event.id} style={styles.card} onPress={() => openEventPopup(event)} activeOpacity={0.82}>
                  {event.bannerUrl ? (
                    <ImageBackground source={{ uri: event.bannerUrl }} style={styles.cardBanner} imageStyle={{ borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl }}>
                      <LinearGradient colors={['transparent', 'rgba(7,7,15,0.6)']} style={StyleSheet.absoluteFill} />
                      <View style={styles.badgeRow}>
                        <StatusBadge status={event.status} />
                        <View style={[styles.badge, { backgroundColor: categoryColor + '30', borderColor: categoryColor + '60' }]}>
                          <Text style={[styles.badgeText, { color: '#a78bfa' }]}>{categoryLabel}</Text>
                        </View>
                      </View>
                    </ImageBackground>
                  ) : (
                    <LinearGradient colors={meta.bannerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardBanner}>
                      <View style={styles.badgeRow}>
                        <StatusBadge status={event.status} />
                        <View style={[styles.badge, { backgroundColor: meta.categoryColor + '30', borderColor: meta.categoryColor + '60' }]}>
                          <Text style={[styles.badgeText, { color: meta.categoryColor }]}>{categoryLabel}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  )}
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle} numberOfLines={1}>{event.name}</Text>
                    <View style={styles.cardMeta}>
                      <Ionicons name="calendar-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.cardMetaTxt}>{formatDateRange(event.startDate, event.endDate)}</Text>
                      <Text style={styles.dot}>·</Text>
                      <Ionicons name="location-outline" size={11} color={colors.textMuted} />
                      <Text style={styles.cardMetaTxt} numberOfLines={1}>{event.location}</Text>
                    </View>
                    <View style={styles.cardStats}>
                      <View style={styles.cardArrow}><Ionicons name="arrow-forward" size={12} color={colors.primary} /></View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Event join popup */}
      <Modal visible={!!selectedEvent} transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            {selectedEvent && (() => {
              const meta = EVENT_META[selectedEvent.id] ?? FALLBACK_META;
              const categoryLabel = selectedEvent.category?.toUpperCase() ?? meta.category;
              return (
                <>
                  {selectedEvent.bannerUrl ? (
                    <ImageBackground source={{ uri: selectedEvent.bannerUrl }} style={styles.sheetBanner}>
                      <LinearGradient colors={['transparent', 'rgba(7,7,15,0.7)']} style={StyleSheet.absoluteFill} />
                      <View style={styles.badgeRow}>
                        <StatusBadge status={selectedEvent.status} />
                        <View style={[styles.badge, { backgroundColor: 'rgba(79,70,229,0.35)', borderColor: 'rgba(79,70,229,0.6)' }]}>
                          <Text style={[styles.badgeText, { color: '#a78bfa' }]}>{categoryLabel}</Text>
                        </View>
                      </View>
                    </ImageBackground>
                  ) : (
                    <LinearGradient colors={meta.bannerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetBanner}>
                      <View style={styles.badgeRow}>
                        <StatusBadge status={selectedEvent.status} />
                        <View style={[styles.badge, { backgroundColor: meta.categoryColor + '30', borderColor: meta.categoryColor + '60' }]}>
                          <Text style={[styles.badgeText, { color: meta.categoryColor }]}>{categoryLabel}</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  )}
                  <View style={styles.sheetBody}>
                    <Text style={styles.sheetTitle}>{selectedEvent.name}</Text>
                    <View style={styles.sheetMeta}><Ionicons name="calendar-outline" size={13} color={colors.textMuted} /><Text style={styles.sheetMetaTxt}>{formatDateRange(selectedEvent.startDate, selectedEvent.endDate)}</Text></View>
                    <View style={styles.sheetMeta}><Ionicons name="location-outline" size={13} color={colors.textMuted} /><Text style={styles.sheetMetaTxt}>{selectedEvent.location}</Text></View>
                    <View style={styles.sheetStats}>
                    </View>
                    <Text style={styles.sheetCodeLbl}>ENTER EVENT CODE</Text>
                    <View style={styles.codeRow}>
                      <TextInput
                        style={styles.codeInput}
                        placeholder={selectedEvent.code}
                        placeholderTextColor={colors.textMuted}
                        value={popupCode}
                        onChangeText={(t) => setPopupCode(t.toUpperCase())}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={handlePopupJoin}
                        autoFocus
                      />
                      <TouchableOpacity style={[styles.joinBtn, joining && { opacity: 0.6 }]} onPress={handlePopupJoin} disabled={joining}>
                        {joining ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.joinBtnText}>Join</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  headerLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  liveDotRed: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText: { color: '#ef4444', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  hero: { paddingHorizontal: spacing.xl, paddingTop: 4, paddingBottom: spacing.xl },
  heroTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  heroSub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.lg },
  heroRow: { flexDirection: 'row', gap: spacing.xl },
  heroStat: { alignItems: 'center' },
  heroStatVal: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
  heroStatLbl: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  content: { paddingHorizontal: spacing.xl },
  sectionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: spacing.md, marginTop: spacing.lg },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginBottom: 4 },
  statCard: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  statIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  statValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: '600', marginTop: 2 },
  statSub: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  sessionList: { gap: spacing.sm, marginBottom: 4 },
  sessionCard: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  sessionBar: { width: 4, alignSelf: 'stretch' },
  sessionBody: { flex: 1, padding: spacing.md },
  sessionTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sessionMetaTxt: { color: colors.textMuted, fontSize: 10, marginRight: 4 },
  livePip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, marginRight: spacing.md },
  livePipTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },

  leaderList: { gap: spacing.sm, marginBottom: 4 },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  leaderYou: { borderColor: colors.primary + '50', backgroundColor: 'rgba(124,58,237,0.06)' },
  rankBadge: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rankText: { fontSize: 11, fontWeight: '800' },
  leaderName: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  tierPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  tierText: { fontSize: 10, fontWeight: '700' },
  leaderPts: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },

  tabRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'transparent' },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.35)' },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.textPrimary },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: colors.primary },
  tabBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  tabBadgeTextActive: { color: '#fff' },

  center: { paddingVertical: 32, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 32, gap: spacing.sm },
  emptyTitle: { color: colors.textSecondary, fontSize: 14 },

  cardList: { gap: spacing.lg },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardBanner: { height: 100, padding: spacing.md },
  badgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardBody: { padding: spacing.lg },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 5 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 7, flexWrap: 'wrap' },
  cardMetaTxt: { color: colors.textMuted, fontSize: 11, flex: 1 },
  dot: { color: colors.textMuted, fontSize: 11 },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatTxt: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  cardArrow: { marginLeft: 'auto' as any, width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },

  codeRow: { flexDirection: 'row', gap: spacing.sm },
  codeInput: { flex: 1, height: 48, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, color: colors.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 1.5 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, height: 48, borderRadius: radius.lg, backgroundColor: colors.primary },
  joinBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetBanner: { height: 90, padding: spacing.md },
  sheetBody: { padding: spacing.xl },
  sheetTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sheetMetaTxt: { color: colors.textSecondary, fontSize: 13 },
  sheetStats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg, padding: spacing.lg },
  sheetStat: { flex: 1, alignItems: 'center' },
  sheetStatVal: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  sheetStatLbl: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  sheetStatDiv: { width: 1, height: 36, backgroundColor: colors.border },
  sheetCodeLbl: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: spacing.sm },
});
