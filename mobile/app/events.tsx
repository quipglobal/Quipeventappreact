import React, { useState, useRef, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { listEventsByTenant, joinEventByCode } from '@/lib/api/events';
import { colors, spacing, radius } from '@/constants/theme';
import type { Event } from '@/lib/api/types';

const GLOBEX_TENANT_ID = '3';

type Tab = 'upcoming' | 'past';

function formatDateRange(start: string, end: string) {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
      return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  } catch {
    return `${start} – ${end}`;
  }
}

function isEventPast(event: Event): boolean {
  if (event.status === 'past') return true;
  if (event.status === 'live' || event.status === 'upcoming') return false;
  try {
    return new Date(event.endDate) < new Date();
  } catch {
    return false;
  }
}

function StatusBadge({ status }: { status: Event['status'] }) {
  if (status === 'live') {
    return (
      <View style={[s.photoBadge, { backgroundColor: 'rgba(5,150,105,0.9)' }]}>
        <View style={s.statusDot} />
        <Text style={s.photoBadgeText}>LIVE NOW</Text>
      </View>
    );
  }
  if (status === 'upcoming') {
    return (
      <View style={[s.photoBadge, { backgroundColor: 'rgba(217,119,6,0.85)' }]}>
        <View style={[s.statusDot, { backgroundColor: '#fef3c7' }]} />
        <Text style={s.photoBadgeText}>UPCOMING</Text>
      </View>
    );
  }
  return (
    <View style={[s.photoBadge, { backgroundColor: 'rgba(80,80,100,0.85)' }]}>
      <Text style={s.photoBadgeText}>PAST</Text>
    </View>
  );
}

function CategoryBadge({ category }: { category?: string }) {
  if (!category) return null;
  return (
    <View style={[s.photoBadge, { backgroundColor: '#4f46e5' }]}>
      <Text style={s.photoBadgeText}>{category.toUpperCase()}</Text>
    </View>
  );
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=700&h=320&fit=crop',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=700&h=320&fit=crop',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=700&h=320&fit=crop',
  'https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=700&h=320&fit=crop',
];

function getEventImage(event: Event, index: number) {
  return event.bannerUrl ?? FALLBACK_IMAGES[index % FALLBACK_IMAGES.length];
}

function EventCard({ event, index, onPress }: { event: Event; index: number; onPress: () => void }) {
  const photoUri = getEventImage(event, index);
  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.88}>
      <ImageBackground
        source={{ uri: photoUri }}
        style={s.cardPhoto}
        imageStyle={s.cardPhotoImage}
      >
        <LinearGradient
          colors={['transparent', 'rgba(7,7,15,0.65)']}
          style={StyleSheet.absoluteFill}
        />
        <View style={s.badgeRow}>
          <StatusBadge status={event.status} />
          <CategoryBadge category={event.category} />
        </View>
      </ImageBackground>
      <View style={s.cardBody}>
        <Text style={s.cardTitle} numberOfLines={2}>{event.name}</Text>
        <View style={s.cardMeta}>
          <View style={s.cardMetaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={s.cardMetaText}>
              {formatDateRange(event.startDate, event.endDate)}
            </Text>
          </View>
          {!!event.location && (
            <View style={s.cardMetaItem}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={s.cardMetaText} numberOfLines={1}>{event.location}</Text>
            </View>
          )}
        </View>
        <View style={s.cardArrow}>
          <Text style={s.cardArrowHint}>Tap to join</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <View style={s.empty}>
      <Ionicons
        name={tab === 'upcoming' ? 'calendar-outline' : 'time-outline'}
        size={42}
        color={colors.textMuted}
      />
      <Text style={s.emptyTitle}>
        {tab === 'upcoming' ? 'No upcoming events' : 'No past events'}
      </Text>
      <Text style={s.emptySub}>
        {tab === 'upcoming'
          ? 'Check back later or use an invite code.'
          : 'Completed events will appear here.'}
      </Text>
    </View>
  );
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { setCurrentEventId } = useEvent();

  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [codeInput, setCodeInput] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [popupCode, setPopupCode] = useState('');

  const {
    data: allEvents = [],
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['events-tenant', GLOBEX_TENANT_ID],
    queryFn: () => listEventsByTenant(GLOBEX_TENANT_ID),
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 5,
  });

  const { mutate: joinEvent, isPending: joining } = useMutation({
    mutationFn: (code: string) => joinEventByCode(code),
  });

  const upcomingEvents = allEvents.filter((e) => !isEventPast(e));
  const pastEvents = allEvents.filter((e) => isEventPast(e));
  const displayedEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  const handleJoin = useCallback((code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) { Alert.alert('Enter a code', 'Please type an event code first.'); return; }
    joinEvent(c, {
      onSuccess: (res) => {
        setSelectedEvent(null);
        if (res.data?.id) setCurrentEventId(res.data.id);
        Alert.alert(
          'Joined!',
          `You've joined "${res.data?.name}".`,
          [{ text: 'Go to Event', onPress: () => router.back() }],
        );
      },
      onError: () => {
        Alert.alert('Not Found', `No event found for code "${c}". Check the code and try again.`);
      },
    });
  }, [joinEvent, setCurrentEventId]);

  const openEventPopup = (event: Event) => {
    setSelectedEvent(event);
    setPopupCode(event.code ?? '');
  };

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={s.root}>
      {/* ─── Gradient header ─── */}
      <LinearGradient
        colors={['#4a1d96', '#3b0f7a', '#1e0a4a', '#07070F']}
        locations={[0, 0.35, 0.7, 1]}
        style={[s.header, { paddingTop: insets.top }]}
      >
        <View style={s.navRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={s.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
          <View style={s.navCenter}>
            <Ionicons name="calendar" size={13} color="rgba(255,255,255,0.6)" />
            <Text style={s.navLabel}>EVENTS</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
        <View style={s.heroBlock}>
          <Text style={s.heroTitle}>Welcome, {firstName}!</Text>
          <View style={s.heroPill}>
            <Text style={s.heroSub}>Enter your event code to join, or browse events below.</Text>
          </View>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={s.flex}
      >
        <ScrollView
          style={s.flex}
          contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
        >
          {/* ─── Code entry card ─── */}
          <View style={s.codeCard}>
            <View style={s.codeCardTop}>
              <View style={s.hashIcon}>
                <Text style={s.hashText}>#</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.codeCardTitle}>Enter Event Code</Text>
                <Text style={s.codeCardSub}>Got an invite? Enter the code to join instantly.</Text>
              </View>
            </View>
            <View style={s.codeRow}>
              <TextInput
                style={s.codeInput}
                placeholder="e.g. TECH26"
                placeholderTextColor="rgba(255,255,255,0.25)"
                value={codeInput}
                onChangeText={(t) => setCodeInput(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={() => handleJoin(codeInput)}
              />
              <TouchableOpacity
                style={[s.joinBtn, joining && { opacity: 0.55 }]}
                onPress={() => handleJoin(codeInput)}
                disabled={joining}
              >
                {joining ? (
                  <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                ) : (
                  <Text style={s.joinBtnText}>Join →</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* ─── Tab bar ─── */}
          <View style={s.tabBar}>
            <TouchableOpacity
              style={[s.tabBtn, activeTab === 'upcoming' && s.tabBtnActive]}
              onPress={() => setActiveTab('upcoming')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="time-outline"
                size={14}
                color={activeTab === 'upcoming' ? colors.primary : colors.textMuted}
              />
              <Text style={[s.tabLabel, activeTab === 'upcoming' && s.tabLabelActive]}>
                Upcoming
              </Text>
              {upcomingEvents.length > 0 && (
                <View style={[s.tabBadge, activeTab === 'upcoming' && s.tabBadgeActive]}>
                  <Text style={[s.tabBadgeText, activeTab === 'upcoming' && s.tabBadgeTextActive]}>
                    {upcomingEvents.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.tabBtn, activeTab === 'past' && s.tabBtnActive]}
              onPress={() => setActiveTab('past')}
              activeOpacity={0.75}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color={activeTab === 'past' ? colors.primary : colors.textMuted}
              />
              <Text style={[s.tabLabel, activeTab === 'past' && s.tabLabelActive]}>
                Past
              </Text>
              {pastEvents.length > 0 && (
                <View style={[s.tabBadge, activeTab === 'past' && s.tabBadgeActive]}>
                  <Text style={[s.tabBadgeText, activeTab === 'past' && s.tabBadgeTextActive]}>
                    {pastEvents.length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Event list ─── */}
          {isLoading ? (
            <View style={s.center}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={s.loadingText}>Loading events…</Text>
            </View>
          ) : isError ? (
            <View style={s.center}>
              <Ionicons name="cloud-offline-outline" size={40} color={colors.error} />
              <Text style={s.errorText}>Couldn't load events</Text>
              <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : displayedEvents.length === 0 ? (
            <EmptyState tab={activeTab} />
          ) : (
            <View style={s.cardList}>
              {displayedEvents.map((event, idx) => (
                <EventCard
                  key={event.id}
                  event={event}
                  index={idx}
                  onPress={() => openEventPopup(event)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Join event bottom sheet ─── */}
      <Modal
        visible={!!selectedEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedEvent(null)}
      >
        <Pressable style={s.overlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={s.sheetHandle} />
            {selectedEvent && (() => {
              const photoUri = getEventImage(selectedEvent, 0);
              return (
                <>
                  <ImageBackground
                    source={{ uri: photoUri }}
                    style={s.sheetPhoto}
                    imageStyle={{ borderRadius: 0 }}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(7,7,15,0.82)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={s.badgeRow}>
                      <StatusBadge status={selectedEvent.status} />
                      <CategoryBadge category={selectedEvent.category} />
                    </View>
                  </ImageBackground>

                  <View style={s.sheetBody}>
                    <Text style={s.sheetTitle}>{selectedEvent.name}</Text>
                    <View style={s.sheetMeta}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                      <Text style={s.sheetMetaText}>
                        {formatDateRange(selectedEvent.startDate, selectedEvent.endDate)}
                      </Text>
                      {!!selectedEvent.location && (
                        <>
                          <Text style={s.dot}>  ·  </Text>
                          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                          <Text style={s.sheetMetaText} numberOfLines={1}>
                            {selectedEvent.location}
                          </Text>
                        </>
                      )}
                    </View>
                    {!!selectedEvent.description && (
                      <Text style={s.sheetDesc} numberOfLines={3}>
                        {selectedEvent.description}
                      </Text>
                    )}
                    <Text style={s.sheetCodeLabel}>EVENT CODE</Text>
                    <View style={s.codeRow}>
                      <TextInput
                        style={s.codeInput}
                        placeholder={selectedEvent.code || 'Enter code'}
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        value={popupCode}
                        onChangeText={(t) => setPopupCode(t.toUpperCase())}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        returnKeyType="done"
                        onSubmitEditing={() => handleJoin(popupCode)}
                        autoFocus
                      />
                      <TouchableOpacity
                        style={[s.joinBtn, s.joinBtnPrimary, joining && { opacity: 0.55 }]}
                        onPress={() => handleJoin(popupCode)}
                        disabled={joining}
                      >
                        {joining ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={[s.joinBtnText, { color: '#fff' }]}>Join</Text>
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

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },

  /* Header */
  header: { paddingHorizontal: spacing.xl, paddingBottom: 28 },
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
  navCenter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  navLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  heroBlock: { paddingBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 30, fontWeight: '800', marginBottom: 10 },
  heroPill: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.md,
  },
  heroSub: { color: 'rgba(255,255,255,0.75)', fontSize: 13, lineHeight: 18 },

  /* Scroll */
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },

  /* Code card */
  codeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: 20,
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
  codeRow: { flexDirection: 'row', gap: spacing.sm },
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
  joinBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  joinBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },

  /* Tab bar */
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    marginBottom: 16,
    gap: 4,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radius.lg,
  },
  tabBtnActive: { backgroundColor: 'rgba(124,58,237,0.18)' },
  tabLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  tabLabelActive: { color: colors.primary },
  tabBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  tabBadgeActive: { backgroundColor: 'rgba(124,58,237,0.35)' },
  tabBadgeText: { color: colors.textMuted, fontSize: 11, fontWeight: '700' },
  tabBadgeTextActive: { color: colors.primary },

  /* Event cards */
  cardList: { gap: 14 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardPhoto: { height: 170, justifyContent: 'flex-end' },
  cardPhotoImage: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  badgeRow: { flexDirection: 'row', gap: 6, padding: 12, alignSelf: 'flex-start', flexWrap: 'wrap' },
  photoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  photoBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  cardBody: { padding: 14 },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: 8, lineHeight: 22 },
  cardMeta: { gap: 4, marginBottom: 10 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  cardMetaText: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  cardArrow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  cardArrowHint: { color: colors.textMuted, fontSize: 11 },

  /* Loading / Error / Empty */
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: colors.textMuted, fontSize: 13 },
  errorText: { color: colors.textSecondary, fontSize: 14, textAlign: 'center' },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 10 },
  emptyTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 19 },

  /* Bottom sheet */
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetPhoto: { height: 160, justifyContent: 'flex-end' },
  sheetBody: { padding: spacing.xl },
  sheetTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 10 },
  sheetMetaText: { color: colors.textSecondary, fontSize: 12, flexShrink: 1 },
  dot: { color: colors.textMuted, fontSize: 12 },
  sheetDesc: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  sheetCodeLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: 4,
  },
});
