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
  ImageBackground,
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
  categoryBg: string;
  photoUri: string;
  attendees: string;
  sessions: number;
};

const EVENT_META: Record<string, EventMeta> = {
  'evt-1': {
    category: 'CONFERENCE',
    categoryColor: '#fff',
    categoryBg: '#7c3aed',
    photoUri: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=300&fit=crop',
    attendees: '2,400',
    sessions: 36,
  },
  'evt-2': {
    category: 'CONFERENCE',
    categoryColor: '#fff',
    categoryBg: '#4f46e5',
    photoUri: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=600&h=300&fit=crop',
    attendees: '1,200',
    sessions: 28,
  },
  'evt-3': {
    category: 'WORKSHOP',
    categoryColor: '#fff',
    categoryBg: '#059669',
    photoUri: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=600&h=300&fit=crop',
    attendees: '1,800',
    sessions: 24,
  },
};

const FALLBACK_META: EventMeta = {
  category: 'EVENT',
  categoryColor: '#fff',
  categoryBg: '#4f46e5',
  photoUri: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&h=300&fit=crop',
  attendees: '—',
  sessions: 0,
};

function formatDateRange(start: string, end: string) {
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
      <View style={[styles.photoBadge, { backgroundColor: 'rgba(5,150,105,0.9)' }]}>
        <View style={styles.greenDot} />
        <Text style={styles.photoBadgeText}>HAPPENING NOW</Text>
      </View>
    );
  }
  if (status === 'upcoming') {
    return (
      <View style={[styles.photoBadge, { backgroundColor: 'rgba(217,119,6,0.85)' }]}>
        <View style={[styles.greenDot, { backgroundColor: '#fef3c7' }]} />
        <Text style={styles.photoBadgeText}>UPCOMING</Text>
      </View>
    );
  }
  return (
    <View style={[styles.photoBadge, { backgroundColor: 'rgba(100,100,120,0.85)' }]}>
      <Text style={styles.photoBadgeText}>PAST</Text>
    </View>
  );
}

function EventCard({ event, onPress }: { event: Event; onPress: () => void }) {
  const meta = EVENT_META[event.id] ?? FALLBACK_META;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Photo banner with overlay badges */}
      <ImageBackground
        source={{ uri: meta.photoUri }}
        style={styles.cardPhoto}
        imageStyle={styles.cardPhotoImage}
      >
        <LinearGradient
          colors={['transparent', 'rgba(7,7,15,0.55)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.photoBadgeRow}>
          <StatusBadge status={event.status} />
          <View style={[styles.photoBadge, { backgroundColor: meta.categoryBg }]}>
            <Text style={styles.photoBadgeText}>{meta.category}</Text>
          </View>
        </View>
      </ImageBackground>

      {/* Card body */}
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{event.name}</Text>
        <View style={styles.cardMetaRow}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <Text style={styles.cardMetaText}>{formatDateRange(event.startDate, event.endDate)}</Text>
          <Text style={styles.metaDot}>  •  </Text>
          <Ionicons name="location-outline" size={12} color={colors.textMuted} />
          <Text style={styles.cardMetaText} numberOfLines={1}>{event.location}</Text>
        </View>
        <View style={styles.cardStatsRow}>
          <View style={styles.cardStat}>
            <Ionicons name="people-outline" size={13} color={colors.textMuted} />
            <Text style={styles.cardStatText}>{meta.attendees}</Text>
          </View>
          <View style={styles.cardStat}>
            <Ionicons name="mic-outline" size={13} color={colors.textMuted} />
            <Text style={styles.cardStatText}>{meta.sessions}</Text>
          </View>
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
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
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [popupCode, setPopupCode] = useState('');

  const { data: events = [], isLoading } = useEvents();
  const { mutate: joinEvent, isPending: joining } = useJoinEvent();

  const upcomingEvents = events.filter((e) => e.status === 'live' || e.status === 'upcoming');

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
    <View style={styles.root}>
      {/* ── Purple gradient header background ── */}
      <LinearGradient
        colors={['#4a1d96', '#3b0f7a', '#1e0a4a', '#07070F']}
        locations={[0, 0.35, 0.7, 1]}
        style={[styles.headerGradient, { paddingTop: insets.top }]}
      >
        {/* Top nav row */}
        <View style={styles.navRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={styles.navLabelRow}>
            <Ionicons name="calendar" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={styles.navLabel}>JOIN EVENT</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* Welcome headline */}
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>Welcome, {firstName}!</Text>
          <View style={styles.heroSubPill}>
            <Text style={styles.heroSub}>Enter your event code to join, or browse events below.</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Scrollable content ── */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Code entry card */}
          <View style={styles.codeCard}>
            <View style={styles.codeCardTop}>
              <View style={styles.hashIcon}>
                <Text style={styles.hashText}>#</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.codeCardTitle}>Enter Event Code</Text>
                <Text style={styles.codeCardSub}>Got an invite? Enter the code to join instantly.</Text>
              </View>
            </View>
            <View style={styles.codeInputRow}>
              <TextInput
                ref={inputRef}
                style={styles.codeInput}
                placeholder="e.g. TECH26"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={globalCode}
                onChangeText={(t) => setGlobalCode(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleGlobalJoin}
              />
              <TouchableOpacity
                style={[styles.joinBtn, joining && { opacity: 0.55 }]}
                onPress={handleGlobalJoin}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                ) : (
                  <Text style={styles.joinBtnText}>Join  →</Text>
                )}
              </TouchableOpacity>
            </View>
            <View style={styles.hintRow}>
              <Text style={styles.hintLabel}>Try: </Text>
              {HINT_CODES.map((h, i) => (
                <React.Fragment key={h}>
                  <TouchableOpacity onPress={() => setGlobalCode(h)}>
                    <Text style={styles.hintCode}>{h}</Text>
                  </TouchableOpacity>
                  {i < HINT_CODES.length - 1 && <Text style={styles.hintSep}> • </Text>}
                </React.Fragment>
              ))}
            </View>
          </View>

          {/* Section header: Upcoming Events */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionLeft}>
              <Ionicons name="time-outline" size={17} color={colors.textPrimary} />
              <Text style={styles.sectionTitle}>Upcoming Events</Text>
            </View>
            {upcomingEvents.length > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{upcomingEvents.length}</Text>
              </View>
            )}
          </View>

          {/* Event list */}
          {isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : upcomingEvents.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={38} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No upcoming events</Text>
              <Text style={styles.emptySub}>Use an invite code above to join an event.</Text>
            </View>
          ) : (
            <View style={styles.cardList}>
              {upcomingEvents.map((event) => (
                <EventCard key={event.id} event={event} onPress={() => openEventPopup(event)} />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Event code popup ── */}
      <Modal
        visible={!!selectedEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={styles.sheetHandle} />

            {selectedEvent && (() => {
              const meta = EVENT_META[selectedEvent.id] ?? FALLBACK_META;
              return (
                <>
                  <ImageBackground
                    source={{ uri: meta.photoUri }}
                    style={styles.sheetPhoto}
                    imageStyle={styles.sheetPhotoImage}
                  >
                    <LinearGradient colors={['transparent', 'rgba(7,7,15,0.75)']} style={StyleSheet.absoluteFill} />
                    <View style={styles.photoBadgeRow}>
                      <StatusBadge status={selectedEvent.status} />
                      <View style={[styles.photoBadge, { backgroundColor: meta.categoryBg }]}>
                        <Text style={styles.photoBadgeText}>{meta.category}</Text>
                      </View>
                    </View>
                  </ImageBackground>

                  <View style={styles.sheetBody}>
                    <Text style={styles.sheetTitle}>{selectedEvent.name}</Text>
                    <View style={styles.sheetMetaRow}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.sheetMetaText}>{formatDateRange(selectedEvent.startDate, selectedEvent.endDate)}</Text>
                      <Text style={styles.metaDot}>  •  </Text>
                      <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                      <Text style={styles.sheetMetaText}>{selectedEvent.location}</Text>
                    </View>

                    <View style={styles.sheetStatsRow}>
                      <View style={styles.sheetStat}>
                        <Text style={styles.sheetStatVal}>{meta.attendees}</Text>
                        <Text style={styles.sheetStatLbl}>Attendees</Text>
                      </View>
                      <View style={styles.sheetStatDivider} />
                      <View style={styles.sheetStat}>
                        <Text style={styles.sheetStatVal}>{meta.sessions}</Text>
                        <Text style={styles.sheetStatLbl}>Sessions</Text>
                      </View>
                    </View>

                    <Text style={styles.sheetCodeLabel}>ENTER EVENT CODE</Text>
                    <View style={styles.codeInputRow}>
                      <TextInput
                        style={styles.codeInput}
                        placeholder={selectedEvent.code}
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        value={popupCode}
                        onChangeText={(t) => setPopupCode(t.toUpperCase())}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={handlePopupJoin}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={[styles.joinBtn, styles.joinBtnPrimary, joining && { opacity: 0.55 }]}
                        onPress={handlePopupJoin}
                        disabled={joining}
                      >
                        {joining ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={[styles.joinBtnText, { color: '#fff' }]}>Join</Text>
                        )}
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

  /* ── Purple gradient header ── */
  headerGradient: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 28,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  navLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroContent: { paddingBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 10 },
  heroSubPill: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 },

  /* ── Scroll content ── */
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },

  /* ── Code entry card ── */
  codeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: 24,
  },
  codeCardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  hashIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashText: { color: '#a78bfa', fontSize: 22, fontWeight: '900' },
  codeCardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 3 },
  codeCardSub: { color: colors.textSecondary, fontSize: 12, lineHeight: 17 },

  codeInputRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: 10 },
  codeInput: {
    flex: 1,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.8,
  },
  joinBtn: {
    height: 48,
    paddingHorizontal: 18,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  joinBtnText: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '700' },

  hintRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  hintLabel: { color: colors.textMuted, fontSize: 11 },
  hintCode: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  hintSep: { color: colors.textMuted, fontSize: 11 },

  /* ── Section header ── */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  /* ── Event cards ── */
  center: { paddingVertical: 48, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  cardList: { gap: 16 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPhoto: { height: 160, justifyContent: 'flex-start', padding: spacing.md },
  cardPhotoImage: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },

  photoBadgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  photoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#a7f3d0' },

  cardBody: { padding: spacing.lg },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 10, flexWrap: 'wrap' },
  cardMetaText: { color: colors.textMuted, fontSize: 12 },
  metaDot: { color: colors.textMuted, fontSize: 12 },
  cardStatsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardStatText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  /* ── Modal / sheet ── */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 2,
  },
  sheetPhoto: { height: 110, justifyContent: 'flex-start', padding: spacing.md },
  sheetPhotoImage: {},
  sheetBody: { padding: spacing.xl },
  sheetTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 7 },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 16, flexWrap: 'wrap' },
  sheetMetaText: { color: colors.textSecondary, fontSize: 12 },
  sheetStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  sheetStat: { flex: 1, alignItems: 'center' },
  sheetStatVal: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  sheetStatLbl: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  sheetStatDivider: { width: 1, height: 36, backgroundColor: colors.border },
  sheetCodeLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: spacing.sm },
});
