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
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents, useJoinEvent } from '@/hooks/useEvents';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';
import type { Event } from '@/lib/api/types';

const { height: SCREEN_H } = Dimensions.get('window');
const HINT_CODES = ['TECH26', 'DEVCON', 'SUMMIT', 'HEALTH'];

type EventMeta = {
  category: string;
  categoryColor: string;
  bannerColors: [string, string, ...string[]];
  attendees: string;
  sessions: number;
};

const EVENT_META: Record<string, EventMeta> = {
  'evt-1': { category: 'CONFERENCE', categoryColor: '#7c3aed', bannerColors: ['#2d1060', '#1a0a3a', '#0a0a20'], attendees: '2,400', sessions: 36 },
  'evt-2': { category: 'CONFERENCE', categoryColor: '#4f46e5', bannerColors: ['#1a1060', '#0d0a30', '#07070f'], attendees: '1,200', sessions: 28 },
  'evt-3': { category: 'WORKSHOP',   categoryColor: '#06b6d4', bannerColors: ['#0a2840', '#0a1a30', '#050f1a'], attendees: '1,800', sessions: 24 },
};
const FALLBACK_META: EventMeta = { category: 'EVENT', categoryColor: '#4f46e5', bannerColors: ['#0d0d2e', '#1a0a3a', '#07070f'], attendees: '—', sessions: 0 };

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
      </LinearGradient>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.name}</Text>
        <View style={styles.cardMeta}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <Text style={styles.cardMetaText}>{formatDateRange(event.startDate, event.endDate)}</Text>
          <Text style={styles.dot}>·</Text>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.cardMetaText} numberOfLines={1}>{event.location}</Text>
        </View>
        <View style={styles.cardStats}>
          <View style={styles.cardStat}><Ionicons name="people-outline" size={13} color={colors.textMuted} /><Text style={styles.cardStatText}>{meta.attendees}</Text></View>
          <View style={styles.cardStat}><Ionicons name="mic-outline" size={13} color={colors.textMuted} /><Text style={styles.cardStatText}>{meta.sessions}</Text></View>
          <View style={styles.cardArrow}><Ionicons name="arrow-forward" size={13} color={colors.primary} /></View>
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

  const [globalCode, setGlobalCode] = useState((params.code ?? '').toUpperCase());
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [popupCode, setPopupCode] = useState('');

  const { data: events = [], isLoading } = useEvents();
  const { mutate: joinEvent, isPending: joining } = useJoinEvent();

  const upcomingEvents = events.filter((e) => e.status === 'live' || e.status === 'upcoming');
  const pastEvents = events.filter((e) => e.status === 'past');
  const tabEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  const handleGlobalJoin = () => {
    const c = globalCode.trim();
    if (!c) { Alert.alert('Enter a code', 'Type an event code first.'); return; }
    doJoin(c);
  };

  const handlePopupJoin = () => {
    const c = popupCode.trim() || selectedEvent?.code || '';
    if (!c) return;
    doJoin(c);
  };

  const doJoin = (c: string) => {
    joinEvent(c, {
      onSuccess: (res) => {
        setSelectedEvent(null);
        Alert.alert('Joined!', `You have joined "${res.data?.name}".`, [
          { text: 'Go to Event', onPress: () => router.back() },
        ]);
      },
      onError: () => {
        Alert.alert('Not Found', `No event found for code "${c.toUpperCase()}".`);
      },
    });
  };

  const openEventPopup = (event: Event) => {
    setSelectedEvent(event);
    setPopupCode(event.code);
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerLabel}>JOIN EVENT</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Purple hero gradient ── */}
      <LinearGradient colors={['rgba(124,58,237,0.22)', 'transparent']} style={styles.hero}>
        <Text style={styles.heroTitle}>Welcome, {firstName}!</Text>
        <Text style={styles.heroSub}>Enter your event code to join, or browse events below.</Text>
      </LinearGradient>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Code entry card ── */}
          <View style={styles.codeCard}>
            <View style={styles.codeCardTop}>
              <View style={styles.codeIcon}><Text style={styles.codeIconText}>#</Text></View>
              <View style={styles.flex}>
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
                value={globalCode}
                onChangeText={(t) => setGlobalCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleGlobalJoin}
              />
              <TouchableOpacity style={[styles.joinBtn, joining && { opacity: 0.6 }]} onPress={handleGlobalJoin} disabled={joining}>
                {joining ? <ActivityIndicator size="small" color="#fff" /> : <><Text style={styles.joinBtnText}>Join</Text><Ionicons name="arrow-forward" size={13} color="#fff" /></>}
              </TouchableOpacity>
            </View>
            <View style={styles.hintRow}>
              <Text style={styles.hintLabel}>Try: </Text>
              {HINT_CODES.map((h, i) => (
                <React.Fragment key={h}>
                  <TouchableOpacity onPress={() => setGlobalCode(h)}><Text style={styles.hintCode}>{h}</Text></TouchableOpacity>
                  {i < HINT_CODES.length - 1 && <Text style={styles.dot}> • </Text>}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* ── Tabs ── */}
          <View style={styles.tabRow}>
            {(['upcoming', 'past'] as const).map((tab) => {
              const count = tab === 'upcoming' ? upcomingEvents.length : pastEvents.length;
              const active = activeTab === tab;
              return (
                <TouchableOpacity key={tab} style={[styles.tab, active && styles.tabActive]} onPress={() => setActiveTab(tab)}>
                  <Ionicons name={tab === 'upcoming' ? 'time-outline' : 'checkmark-circle-outline'} size={13} color={active ? colors.textPrimary : colors.textMuted} />
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>{tab === 'upcoming' ? 'Upcoming' : 'Past'} Events</Text>
                  {count > 0 && (
                    <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                      <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Events list ── */}
          {isLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
          ) : tabEvents.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name={activeTab === 'upcoming' ? 'calendar-outline' : 'archive-outline'} size={40} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No {activeTab} events</Text>
              <Text style={styles.emptySub}>{activeTab === 'upcoming' ? 'Use an invite code above to join.' : 'Attended events appear here.'}</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {tabEvents.map((event) => (
                <EventCard key={event.id} event={event} onPress={() => openEventPopup(event)} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Event popup modal ── */}
      <Modal visible={!!selectedEvent} transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            {selectedEvent && (() => {
              const meta = EVENT_META[selectedEvent.id] ?? FALLBACK_META;
              return (
                <>
                  <LinearGradient colors={meta.bannerColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.sheetBanner}>
                    <View style={styles.cardBadgeRow}>
                      <StatusBadge status={selectedEvent.status} />
                      <View style={[styles.badge, { backgroundColor: meta.categoryColor + '30', borderColor: meta.categoryColor + '60' }]}>
                        <Text style={[styles.badgeText, { color: meta.categoryColor }]}>{meta.category}</Text>
                      </View>
                    </View>
                  </LinearGradient>

                  <View style={styles.sheetBody}>
                    <Text style={styles.sheetTitle}>{selectedEvent.name}</Text>
                    <View style={styles.sheetMeta}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.sheetMetaText}>{formatDateRange(selectedEvent.startDate, selectedEvent.endDate)}</Text>
                    </View>
                    <View style={styles.sheetMeta}>
                      <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.sheetMetaText}>{selectedEvent.location}</Text>
                    </View>
                    <View style={styles.sheetStats}>
                      <View style={styles.sheetStat}>
                        <Text style={styles.sheetStatVal}>{meta.attendees}</Text>
                        <Text style={styles.sheetStatLabel}>Attendees</Text>
                      </View>
                      <View style={styles.sheetStatDiv} />
                      <View style={styles.sheetStat}>
                        <Text style={styles.sheetStatVal}>{meta.sessions}</Text>
                        <Text style={styles.sheetStatLabel}>Sessions</Text>
                      </View>
                    </View>

                    <Text style={styles.sheetCodeLabel}>ENTER EVENT CODE</Text>
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

  hero: { paddingHorizontal: spacing.xl, paddingTop: 4, paddingBottom: spacing.xl },
  heroTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 5 },
  heroSub: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },

  content: { paddingHorizontal: spacing.xl, paddingTop: 4 },

  codeCard: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.xl, marginBottom: spacing.lg },
  codeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, marginBottom: spacing.lg },
  codeIcon: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.35)', alignItems: 'center', justifyContent: 'center' },
  codeIconText: { color: colors.primary, fontSize: 20, fontWeight: '900' },
  codeCardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  codeCardSub: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },

  codeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  codeInput: { flex: 1, height: 48, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, color: colors.textPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 1.5 },
  joinBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 18, height: 48, borderRadius: radius.lg, backgroundColor: colors.primary },
  joinBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  hintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 2 },
  hintLabel: { color: colors.textMuted, fontSize: 11 },
  hintCode: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  dot: { color: colors.textMuted, fontSize: 11 },

  tabRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.lg },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'transparent' },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.15)', borderColor: 'rgba(124,58,237,0.35)' },
  tabText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.textPrimary },
  tabBadge: { minWidth: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  tabBadgeActive: { backgroundColor: colors.primary },
  tabBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  tabBadgeTextActive: { color: '#fff' },

  center: { paddingVertical: 48, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: spacing.md },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19, paddingHorizontal: spacing.xl },

  cardList: { gap: spacing.lg },
  card: { backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  cardBanner: { height: 110, padding: spacing.md, justifyContent: 'flex-start' },
  cardBadgeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardBody: { padding: spacing.lg },
  cardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8, flexWrap: 'wrap' },
  cardMetaText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  cardStats: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  cardArrow: { marginLeft: 'auto' as any, width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(124,58,237,0.15)', alignItems: 'center', justifyContent: 'center' },

  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bgElevated, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 10, marginBottom: 4 },
  sheetBanner: { height: 100, padding: spacing.md },
  sheetBody: { padding: spacing.xl },
  sheetTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  sheetMetaText: { color: colors.textSecondary, fontSize: 13 },
  sheetStats: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.xl, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg, padding: spacing.lg },
  sheetStat: { flex: 1, alignItems: 'center' },
  sheetStatVal: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  sheetStatLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  sheetStatDiv: { width: 1, height: 36, backgroundColor: colors.border },
  sheetCodeLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: spacing.sm },
});
