import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents, useJoinEvent } from '@/hooks/useEvents';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';
import type { Event } from '@/lib/api/types';

const HINT_CODES = ['TECH26', 'DEVCON', 'SUMMIT', 'HEALTH'];

type EventMeta = {
  category: string;
  categoryColor: string;
  bannerColors: [string, string, ...string[]];
  attendees: string;
  sessions: number;
};

const EVENT_META: Record<string, EventMeta> = {
  'evt-1': {
    category: 'CONFERENCE',
    categoryColor: '#7c3aed',
    bannerColors: ['#1a0a3a', '#0d0d2e', '#0a1a35'],
    attendees: '2,400',
    sessions: 36,
  },
  'evt-2': {
    category: 'CONFERENCE',
    categoryColor: '#4f46e5',
    bannerColors: ['#0d0a30', '#1a0d2e', '#07070f'],
    attendees: '1,200',
    sessions: 28,
  },
  'evt-3': {
    category: 'WORKSHOP',
    categoryColor: '#06b6d4',
    bannerColors: ['#0a2030', '#0d1a2e', '#071520'],
    attendees: '1,800',
    sessions: 24,
  },
};

const FALLBACK_META: EventMeta = {
  category: 'EVENT',
  categoryColor: '#4f46e5',
  bannerColors: ['#0d0d2e', '#1a0a3a', '#07070f'],
  attendees: '—',
  sessions: 0,
};

function formatDateRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function StatusBadge({ status }: { status: Event['status'] }) {
  if (status === 'live') {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(16,185,129,0.25)', borderColor: 'rgba(16,185,129,0.5)' }]}>
        <View style={styles.liveDot} />
        <Text style={[styles.badgeText, { color: '#10b981' }]}>HAPPENING NOW</Text>
      </View>
    );
  }
  if (status === 'upcoming') {
    return (
      <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.45)' }]}>
        <Text style={[styles.badgeText, { color: '#f59e0b' }]}>UPCOMING</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)' }]}>
      <Text style={[styles.badgeText, { color: colors.textSecondary }]}>PAST</Text>
    </View>
  );
}

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const meta = EVENT_META[event.id] ?? FALLBACK_META;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.82}>
      <LinearGradient colors={meta.bannerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.cardBanner}>
        <View style={styles.cardBadgeRow}>
          <StatusBadge status={event.status} />
          <View style={[styles.badge, { backgroundColor: meta.categoryColor + '30', borderColor: meta.categoryColor + '60' }]}>
            <Text style={[styles.badgeText, { color: meta.categoryColor }]}>{meta.category}</Text>
          </View>
        </View>
        <View style={styles.bannerGrid}>
          {[...Array(4)].map((_, i) => (
            <View key={i} style={[styles.bannerDot, { opacity: 0.05 + i * 0.03 }]} />
          ))}
        </View>
      </LinearGradient>

      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.name}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <Text style={styles.cardMetaText}>{formatDateRange(event.startDate, event.endDate)}</Text>
          <Text style={styles.cardMetaDot}>·</Text>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.cardMetaText} numberOfLines={1}>{event.location}</Text>
        </View>
        <View style={styles.cardStats}>
          <View style={styles.cardStat}>
            <Ionicons name="people-outline" size={13} color={colors.textMuted} />
            <Text style={styles.cardStatText}>{meta.attendees}</Text>
          </View>
          <View style={styles.cardStat}>
            <Ionicons name="mic-outline" size={13} color={colors.textMuted} />
            <Text style={styles.cardStatText}>{meta.sessions}</Text>
          </View>
          <View style={styles.cardArrow}>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function SwitchEventScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ code?: string }>();
  const { user } = useAuth();
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const [code, setCode] = useState((params.code ?? '').toUpperCase());
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const { data: events = [], isLoading: eventsLoading } = useEvents();
  const { mutate: joinEvent, isPending: joining } = useJoinEvent();

  const upcomingEvents = events.filter((e) => e.status === 'live' || e.status === 'upcoming');
  const pastEvents = events.filter((e) => e.status === 'past');
  const tabEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  const handleJoin = () => {
    if (!code.trim()) {
      Alert.alert('Event Code Required', 'Please enter an event code to join.');
      inputRef.current?.focus();
      return;
    }
    joinEvent(code.trim(), {
      onSuccess: (res) => {
        Alert.alert('Event Joined!', `You have joined "${res.data?.name}".`, [
          { text: 'Go to Event', onPress: () => router.back() },
        ]);
      },
      onError: () => {
        Alert.alert('Not Found', `No event found for code "${code.toUpperCase()}".`);
      },
    });
  };

  const handleEventPress = (event: Event) => {
    setCode(event.code);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setTimeout(() => inputRef.current?.focus(), 380);
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>JOIN EVENT</Text>
        <View style={{ width: 40 }} />
      </View>

      <LinearGradient colors={['rgba(124,58,237,0.18)', 'transparent']} style={styles.heroGradient}>
        <Text style={styles.heroTitle}>Welcome, {firstName}!</Text>
        <Text style={styles.heroSub}>Enter your event code to join, or browse events below.</Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.codeCard}>
            <View style={styles.codeCardTop}>
              <View style={styles.codeIcon}>
                <Text style={styles.codeIconText}>#</Text>
              </View>
              <View style={styles.codeCardMeta}>
                <Text style={styles.codeCardTitle}>Enter Event Code</Text>
                <Text style={styles.codeCardSub}>Got an invite? Enter the code to join instantly.</Text>
              </View>
            </View>
            <View style={styles.codeRow}>
              <TextInput
                ref={inputRef}
                style={styles.codeInput}
                placeholder="e.g. TECH26"
                placeholderTextColor={colors.textMuted}
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleJoin}
              />
              <TouchableOpacity style={[styles.joinBtn, joining && { opacity: 0.6 }]} onPress={handleJoin} disabled={joining}>
                {joining
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <><Text style={styles.joinBtnText}>Join</Text><Ionicons name="arrow-forward" size={14} color="#fff" /></>
                }
              </TouchableOpacity>
            </View>
            <View style={styles.hintRow}>
              <Text style={styles.hintLabel}>Try: </Text>
              {HINT_CODES.map((h, i) => (
                <React.Fragment key={h}>
                  <TouchableOpacity onPress={() => setCode(h)}>
                    <Text style={styles.hintCode}>{h}</Text>
                  </TouchableOpacity>
                  {i < HINT_CODES.length - 1 && <Text style={styles.hintDot}> • </Text>}
                </React.Fragment>
              ))}
            </View>
          </View>

          <View style={styles.tabRow}>
            {(['upcoming', 'past'] as const).map((tab) => {
              const count = tab === 'upcoming' ? upcomingEvents.length : pastEvents.length;
              const active = activeTab === tab;
              return (
                <TouchableOpacity key={tab} style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                  <Ionicons
                    name={tab === 'upcoming' ? 'time-outline' : 'checkmark-circle-outline'}
                    size={13}
                    color={active ? colors.textPrimary : colors.textMuted}
                  />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {tab === 'upcoming' ? 'Upcoming' : 'Past'} Events
                  </Text>
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
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading events…</Text>
            </View>
          ) : tabEvents.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name={activeTab === 'upcoming' ? 'calendar-outline' : 'archive-outline'} size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No {activeTab} events</Text>
              <Text style={styles.emptySub}>
                {activeTab === 'upcoming'
                  ? 'Use an invite code above to join an event.'
                  : 'Events you have attended will appear here.'}
              </Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {tabEvents.map((event) => (
                <EventCard key={event.id} event={event} onPress={() => handleEventPress(event)} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },

  heroGradient: { paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  heroTitle: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 6 },
  heroSub: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },

  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.md },

  codeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.xxl,
  },
  codeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  codeIcon: {
    width: 44, height: 44, borderRadius: radius.lg,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  codeIconText: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  codeCardMeta: { flex: 1 },
  codeCardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  codeCardSub: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },

  codeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  codeInput: {
    flex: 1, height: 50, borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 1.5,
  },
  joinBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 18, height: 50, borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  joinBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  hintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  hintLabel: { color: colors.textMuted, fontSize: 12 },
  hintCode: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  hintDot: { color: colors.textMuted, fontSize: 12 },

  tabRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'transparent',
  },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.35)' },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.textPrimary },
  tabBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5,
  },
  tabBadgeActive: { backgroundColor: colors.primary },
  tabBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  tabBadgeTextActive: { color: '#fff' },

  loadingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingVertical: 48 },
  loadingText: { color: colors.textSecondary, fontSize: 14 },

  emptyState: { alignItems: 'center', paddingVertical: 52, gap: spacing.md },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing.xl },

  cardList: { gap: spacing.lg },

  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardBanner: { height: 128, justifyContent: 'space-between', padding: spacing.md },
  cardBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  bannerGrid: { flexDirection: 'row', justifyContent: 'flex-end', gap: 6, alignItems: 'flex-end' },
  bannerDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
  },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },

  cardBody: { padding: spacing.lg },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 7 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, flexWrap: 'wrap' },
  cardMetaText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  cardMetaDot: { color: colors.textMuted, fontSize: 12 },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  cardArrow: {
    marginLeft: 'auto' as any,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(124,58,237,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
});
