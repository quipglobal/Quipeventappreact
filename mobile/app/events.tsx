import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  TextInput,
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
import { useEvents, useJoinEvent } from '@/hooks/useEvents';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { colors, radius } from '@/constants/theme';
import type { Event } from '@/lib/api/types';

type Tab = 'upcoming' | 'past';

type EventMeta = {
  bannerColors: [string, string];
  category: string;
  photoUri?: string;
};

const EVENT_META: Record<string, EventMeta> = {
  'evt-1': {
    bannerColors: ['#1e1060', '#4a1d96'],
    category: 'CONFERENCE',
    photoUri: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=700&h=320&fit=crop',
  },
  'evt-2': {
    bannerColors: ['#172554', '#1d4ed8'],
    category: 'SUMMIT',
    photoUri: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=700&h=320&fit=crop',
  },
  'evt-3': {
    bannerColors: ['#064e3b', '#065f46'],
    category: 'WORKSHOP',
    photoUri: 'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=700&h=320&fit=crop',
  },
};

const FALLBACK_META: EventMeta = {
  bannerColors: ['#1e1060', '#0f0f2a'],
  category: 'EVENT',
};

function formatDateRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
      return `${months[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
    }
    return `${months[s.getMonth()]} ${s.getDate()} – ${months[e.getMonth()]} ${e.getDate()}, ${e.getFullYear()}`;
  } catch {
    return start ? start : 'TBD';
  }
}

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { currentEventId, setCurrentEventId } = useEvent();

  const [activeTab, setActiveTab] = useState<Tab>('upcoming');
  const [joinModalEvent, setJoinModalEvent] = useState<Event | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState('');

  const { data: events = [], isLoading, refetch, isRefetching } = useEvents();
  const { mutate: joinEvent } = useJoinEvent();

  const upcomingEvents = events.filter((e) => e.status !== 'past');
  const pastEvents = events.filter((e) => e.status === 'past');
  const displayEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  const handleEnterEvent = useCallback((event: Event) => {
    setCurrentEventId(event.id);
    router.replace('/(tabs)/feed');
  }, [setCurrentEventId]);

  const handleOpenJoinModal = useCallback((event: Event) => {
    setJoinModalEvent(event);
    setJoinCode(event.code ?? '');
    setJoinError('');
  }, []);

  const handleJoin = useCallback(() => {
    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setJoinError('Please enter the event code');
      return;
    }
    if (!joinModalEvent) return;
    setJoinLoading(true);
    setJoinError('');
    joinEvent(code, {
      onSuccess: (res) => {
        setJoinLoading(false);
        if (res.data?.id) {
          setCurrentEventId(res.data.id);
          setJoinModalEvent(null);
          router.replace('/(tabs)/feed');
        }
      },
      onError: () => {
        setJoinLoading(false);
        setJoinError('Invalid event code. Please check and try again.');
      },
    });
  }, [joinCode, joinModalEvent, joinEvent, setCurrentEventId]);

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  return (
    <View style={[styles.root]}>
      <LinearGradient
        colors={['#1a0a3e', '#0a0a1a', '#07070F']}
        locations={[0, 0.3, 1]}
        style={styles.gradientBg}
      />

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Image
          source={require('@/assets/cxo-logo.png')}
          style={styles.headerLogo}
          resizeMode="contain"
        />
        <View style={styles.headerRight}>
          <View style={styles.userChip}>
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {(user?.name ?? 'U')[0].toUpperCase()}
              </Text>
            </View>
            <Text style={styles.userName} numberOfLines={1}>{firstName}</Text>
          </View>
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={() => Alert.alert('Sign out', 'Are you sure you want to sign out?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: logout },
            ])}
          >
            <Ionicons name="log-out-outline" size={18} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.pageTitle}>
        <Text style={styles.pageTitleText}>Events</Text>
        <Text style={styles.pageTitleSub}>
          {upcomingEvents.length > 0
            ? `${upcomingEvents.length} upcoming event${upcomingEvents.length > 1 ? 's' : ''}`
            : 'No upcoming events'}
        </Text>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
          {upcomingEvents.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'upcoming' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'upcoming' && styles.tabBadgeTextActive]}>
                {upcomingEvents.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past
          </Text>
          {pastEvents.length > 0 && (
            <View style={[styles.tabBadge, activeTab === 'past' && styles.tabBadgeActive]}>
              <Text style={[styles.tabBadgeText, activeTab === 'past' && styles.tabBadgeTextActive]}>
                {pastEvents.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading events…</Text>
          </View>
        ) : displayEvents.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name={activeTab === 'upcoming' ? 'calendar-outline' : 'archive-outline'}
              size={44}
              color="rgba(255,255,255,0.15)"
            />
            <Text style={styles.emptyTitle}>
              {activeTab === 'upcoming' ? 'No upcoming events' : 'No past events'}
            </Text>
            <Text style={styles.emptySub}>
              {activeTab === 'upcoming'
                ? 'Check back later for new events'
                : 'Events you have attended will appear here'}
            </Text>
          </View>
        ) : (
          displayEvents.map((event) => {
            const meta = EVENT_META[event.id] ?? FALLBACK_META;
            const isActive = currentEventId === event.id;
            const canEnter = event.isEnrolled || isActive;
            const isLive = event.status === 'live';

            return (
              <View key={event.id} style={[styles.card, isActive && styles.cardActive]}>
                {event.bannerUrl ? (
                  <ImageBackground
                    source={{ uri: event.bannerUrl }}
                    style={styles.cardBanner}
                    imageStyle={styles.cardBannerImage}
                  >
                    <LinearGradient
                      colors={['transparent', 'rgba(7,7,15,0.8)']}
                      style={StyleSheet.absoluteFill}
                    />
                    <View style={styles.bannerBadges}>
                      {isLive && (
                        <View style={styles.liveBadge}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveBadgeText}>LIVE</Text>
                        </View>
                      )}
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#34d399" />
                          <Text style={styles.activeBadgeText}>Current</Text>
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                ) : (
                  <LinearGradient
                    colors={meta.bannerColors}
                    style={styles.cardBanner}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.bannerPlaceholder}>
                      <Ionicons name="calendar" size={32} color="rgba(255,255,255,0.2)" />
                    </View>
                    <View style={styles.bannerBadges}>
                      {isLive && (
                        <View style={styles.liveBadge}>
                          <View style={styles.liveDot} />
                          <Text style={styles.liveBadgeText}>LIVE</Text>
                        </View>
                      )}
                      {isActive && (
                        <View style={styles.activeBadge}>
                          <Ionicons name="checkmark-circle" size={12} color="#34d399" />
                          <Text style={styles.activeBadgeText}>Current</Text>
                        </View>
                      )}
                    </View>
                  </LinearGradient>
                )}

                <View style={styles.cardBody}>
                  <View style={styles.categoryRow}>
                    <Text style={styles.categoryText}>
                      {event.category?.toUpperCase() ?? meta.category}
                    </Text>
                    <View style={[
                      styles.statusBadge,
                      event.status === 'live' && styles.statusLive,
                      event.status === 'past' && styles.statusPast,
                    ]}>
                      <Text style={[
                        styles.statusText,
                        event.status === 'live' && styles.statusTextLive,
                        event.status === 'past' && styles.statusTextPast,
                      ]}>
                        {event.status === 'live' ? 'Live' : event.status === 'upcoming' ? 'Upcoming' : 'Past'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.cardName} numberOfLines={2}>{event.name}</Text>

                  <View style={styles.metaRow}>
                    <Ionicons name="calendar-outline" size={13} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.metaText}>{formatDateRange(event.startDate, event.endDate)}</Text>
                  </View>

                  {!!event.location && (
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={13} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.metaText} numberOfLines={1}>{event.location}</Text>
                    </View>
                  )}

                  {!!event.attendeeCount && (
                    <View style={styles.metaRow}>
                      <Ionicons name="people-outline" size={13} color="rgba(255,255,255,0.4)" />
                      <Text style={styles.metaText}>{event.attendeeCount.toLocaleString()} attendees</Text>
                    </View>
                  )}

                  <View style={styles.cardFooter}>
                    {canEnter ? (
                      <TouchableOpacity
                        style={styles.enterBtn}
                        onPress={() => handleEnterEvent(event)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={isActive ? ['#059669', '#047857'] : ['#7c3aed', '#4f46e5']}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                        <Ionicons
                          name={isActive ? 'enter-outline' : 'arrow-forward'}
                          size={15}
                          color="#fff"
                        />
                        <Text style={styles.enterBtnText}>
                          {isActive ? 'Continue' : 'Enter Event'}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={styles.joinBtn}
                        onPress={() => handleOpenJoinModal(event)}
                        activeOpacity={0.85}
                      >
                        <LinearGradient
                          colors={['rgba(124,58,237,0.25)', 'rgba(79,70,229,0.25)']}
                          style={StyleSheet.absoluteFill}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                        />
                        <Ionicons name="add-circle-outline" size={15} color={colors.primary} />
                        <Text style={styles.joinBtnText}>Join Event</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal
        visible={!!joinModalEvent}
        transparent
        animationType="slide"
        onRequestClose={() => setJoinModalEvent(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setJoinModalEvent(null)}>
          <Pressable
            style={[styles.modalSheet, { paddingBottom: insets.bottom + 24 }]}
            onPress={() => {}}
          >
            <View style={styles.sheetHandle} />

            <Text style={styles.sheetTitle}>Join Event</Text>
            <Text style={styles.sheetSubtitle} numberOfLines={2}>
              {joinModalEvent?.name}
            </Text>

            <View style={styles.codeSection}>
              <Text style={styles.codeLabel}>Event Code</Text>
              <View style={[styles.codeInput, !!joinError && styles.codeInputError]}>
                <Ionicons name="key-outline" size={16} color="rgba(255,255,255,0.35)" />
                <TextInput
                  style={styles.codeTextInput}
                  value={joinCode}
                  onChangeText={(t) => { setJoinCode(t.toUpperCase()); setJoinError(''); }}
                  placeholder="e.g. TFS25"
                  placeholderTextColor="rgba(255,255,255,0.2)"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleJoin}
                  autoFocus
                />
              </View>
              {!!joinError && (
                <View style={styles.errorRow}>
                  <Ionicons name="alert-circle-outline" size={13} color="#f87171" />
                  <Text style={styles.errorText}>{joinError}</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[styles.sheetJoinBtn, joinLoading && styles.btnDisabled]}
              onPress={handleJoin}
              disabled={joinLoading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#7c3aed', '#4f46e5']}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
              {joinLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.sheetJoinBtnText}>Join</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setJoinModalEvent(null)}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070F' },
  gradientBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerLogo: { width: 100, height: 40 },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingLeft: 4,
    paddingRight: 10,
    paddingVertical: 4,
  },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  userName: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600', maxWidth: 80 },
  logoutBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  pageTitle: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  pageTitleText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.5,
  },
  pageTitleSub: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    marginTop: 3,
  },

  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tabActive: {
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderColor: 'rgba(124,58,237,0.5)',
  },
  tabText: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTextActive: { color: '#a78bfa' },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeActive: { backgroundColor: 'rgba(124,58,237,0.5)' },
  tabBadgeText: { fontSize: 10, fontWeight: '700', color: 'rgba(255,255,255,0.4)' },
  tabBadgeTextActive: { color: '#c4b5fd' },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 20, gap: 16 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.35)', fontSize: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  emptySub: { fontSize: 14, color: 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 260 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardActive: {
    borderColor: 'rgba(124,58,237,0.4)',
  },
  cardBanner: {
    height: 140,
    justifyContent: 'flex-end',
  },
  cardBannerImage: { borderRadius: 0 },
  bannerPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBadges: {
    flexDirection: 'row',
    gap: 6,
    padding: 10,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(5,150,105,0.9)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6ee7b7',
  },
  liveBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5,150,105,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadgeText: { color: '#34d399', fontSize: 10, fontWeight: '700' },

  cardBody: { padding: 16, gap: 8 },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.primary,
    letterSpacing: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
  },
  statusLive: {
    backgroundColor: 'rgba(5,150,105,0.15)',
    borderColor: 'rgba(5,150,105,0.3)',
  },
  statusPast: {
    backgroundColor: 'rgba(100,100,120,0.15)',
    borderColor: 'rgba(100,100,120,0.2)',
  },
  statusText: { fontSize: 11, fontWeight: '600', color: '#a78bfa' },
  statusTextLive: { color: '#34d399' },
  statusTextPast: { color: 'rgba(255,255,255,0.35)' },

  cardName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    flex: 1,
  },
  cardFooter: {
    marginTop: 6,
  },
  enterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: 10,
    overflow: 'hidden',
  },
  enterBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  joinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    overflow: 'hidden',
  },
  joinBtnText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#111121',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignSelf: 'center',
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  sheetSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginTop: -8,
  },
  codeSection: { gap: 8 },
  codeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.4,
  },
  codeInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  codeInputError: { borderColor: 'rgba(248,113,113,0.5)' },
  codeTextInput: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 3,
    paddingVertical: 14,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    flex: 1,
  },
  sheetJoinBtn: {
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetJoinBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnDisabled: { opacity: 0.5 },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelBtnText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 15,
  },
});
