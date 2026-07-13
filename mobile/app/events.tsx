import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ImageBackground,
  Image,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { listEventsByTenant, findEventByCode, joinByCode } from '@/lib/api/events';
import {
  fetchGlobalVideoFeeds,
  fetchGlobalArticles,
  fetchVideoCategories,
  fetchArticleCategories,
  GlobalVideoFeed,
  GlobalArticle,
  Category,
} from '@/lib/api/globalFeeds';
import { colors, spacing, radius } from '@/constants/theme';
import type { Event } from '@/lib/api/types';

const TENANT_ID = '3';

// ─── helpers ─────────────────────────────────────────────────────────────────
function formatDate(start: string, end: string) {
  try {
    const s = new Date(start);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[s.getMonth()]} ${s.getDate()}, ${s.getFullYear()}`;
  } catch { return start; }
}

const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=700&h=320&fit=crop',
  'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?w=700&h=320&fit=crop',
  'https://images.unsplash.com/photo-1475721027785-f74eccf877e2?w=700&h=320&fit=crop',
  'https://images.unsplash.com/photo-1591115765373-5207764f72e7?w=700&h=320&fit=crop',
];
const getEventImage = (ev: Event, idx: number) =>
  ev.bannerUrl ?? FALLBACK_IMAGES[idx % FALLBACK_IMAGES.length];

// ─── Event card ───────────────────────────────────────────────────────────────
function EventCard({ event, index, onPress }: { event: Event; index: number; onPress: () => void }) {
  const photo = getEventImage(event, index);
  const isUpcoming = event.status === 'upcoming' || event.status === 'live';
  return (
    <TouchableOpacity style={es.card} onPress={onPress} activeOpacity={0.88}>
      <ImageBackground source={{ uri: photo }} style={es.cardPhoto} imageStyle={es.cardPhotoImg}>
        <LinearGradient colors={['transparent', 'rgba(5,5,12,0.6)']} style={StyleSheet.absoluteFill} />
        <View style={es.badgeRow}>
          {isUpcoming && (
            <View style={es.upcomingBadge}>
              <View style={es.upcomingDot} />
              <Text style={es.upcomingBadgeText}>UPCOMING</Text>
            </View>
          )}
          {!isUpcoming && (
            <View style={es.pastBadge}>
              <Text style={es.upcomingBadgeText}>PAST</Text>
            </View>
          )}
          {!!event.category && (
            <View style={es.categoryBadge}>
              <Text style={es.categoryBadgeText}>{event.category.toUpperCase()}</Text>
            </View>
          )}
        </View>
      </ImageBackground>
      <View style={es.cardBody}>
        <Text style={es.cardTitle} numberOfLines={2}>{event.name}</Text>
        <View style={es.cardMeta}>
          <View style={es.cardMetaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
            <Text style={es.cardMetaText}>{formatDate(event.startDate, event.endDate)}</Text>
          </View>
          {!!event.location && (
            <View style={es.cardMetaItem}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={es.cardMetaText} numberOfLines={1}>{event.location}</Text>
            </View>
          )}
        </View>
        <View style={es.cardFooter}>
          {!!event.code && (
            <View style={es.codePill}>
              <Text style={es.codePillText}>{event.code}</Text>
            </View>
          )}
          <View style={{ flex: 1 }} />
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Video card ───────────────────────────────────────────────────────────────
function VideoCard({ item }: { item: GlobalVideoFeed }) {
  const tags = (item.category ?? '').split(',').map((t) => t.trim()).filter(Boolean);
  return (
    <View style={fs.videoCard}>
      <View style={fs.thumbWrap}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={fs.thumb} />
        ) : (
          <View style={[fs.thumb, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.2)" />
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(5,5,12,0.5)']} style={StyleSheet.absoluteFill} />
        {/* YouTube badge */}
        <View style={fs.ytBadge}>
          <Ionicons name="logo-youtube" size={12} color="#fff" />
          <Text style={fs.ytBadgeText}>YouTube</Text>
        </View>
        {/* Play overlay */}
        <View style={fs.playOverlay}>
          <View style={fs.playBtn}>
            <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 3 }} />
          </View>
        </View>
      </View>
      <View style={fs.videoBody}>
        <Text style={fs.videoTitle} numberOfLines={2}>{item.title}</Text>
        {!!item.duration && (
          <Text style={fs.videoDuration}>{item.duration}</Text>
        )}
        {tags.length > 0 && (
          <View style={fs.tagRow}>
            {tags.slice(0, 3).map((tag) => (
              <View key={tag} style={fs.tag}>
                <Text style={fs.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Article card ─────────────────────────────────────────────────────────────
function ArticleCard({ item }: { item: GlobalArticle }) {
  return (
    <View style={fs.articleCard}>
      {item.thumbnail ? (
        <Image source={{ uri: item.thumbnail }} style={fs.articleThumb} />
      ) : (
        <View style={[fs.articleThumb, { backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name="document-text" size={32} color="rgba(255,255,255,0.15)" />
        </View>
      )}
      <View style={fs.articleBody}>
        <View style={fs.articleCatRow}>
          <Text style={fs.articleCat}>{item.category}</Text>
          {!!item.read_time && <Text style={fs.articleReadTime}>{item.read_time}</Text>}
        </View>
        <Text style={fs.articleTitle} numberOfLines={2}>{item.title}</Text>
        {!!item.excerpt && (
          <Text style={fs.articleExcerpt} numberOfLines={2}>{item.excerpt}</Text>
        )}
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
type TopTab = 'feeds' | 'events';
type FeedSubTab = 'videos' | 'articles';

export default function EventsScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout, refreshEventRole } = useAuth();
  const { setCurrentEventId } = useEvent();

  const [topTab, setTopTab] = useState<TopTab>('feeds');
  const [feedSubTab, setFeedSubTab] = useState<FeedSubTab>('videos');

  const [selectedVideoCat, setSelectedVideoCat] = useState<string | null>(null);
  const [selectedArticleCat, setSelectedArticleCat] = useState<string | null>(null);
  const [videoCats, setVideoCats] = useState<Category[]>([]);
  const [articleCats, setArticleCats] = useState<Category[]>([]);
  const [feedsLoading, setFeedsLoading] = useState(false);
  const [videos, setVideos] = useState<GlobalVideoFeed[]>([]);
  const [articles, setArticles] = useState<GlobalArticle[]>([]);
  const [videoTotal, setVideoTotal] = useState<number>(0);
  const [articleTotal, setArticleTotal] = useState<number>(0);

  const [codeInput, setCodeInput] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [popupCode, setPopupCode] = useState('');
  const [eventsTab, setEventsTab] = useState<'upcoming' | 'past'>('upcoming');

  const firstName = user?.name?.split(' ')[0] ?? 'there';

  // ── Events query ──
  const {
    data: allEvents = [],
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
    isRefetching,
  } = useQuery({
    queryKey: ['events-tenant', TENANT_ID],
    queryFn: async () => {
      const res = await listEventsByTenant(TENANT_ID);
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load events.');
      return res.data ?? [];
    },
    staleTime: 1000 * 60 * 5,
  });

  const upcomingEvents = allEvents.filter((e) => e.status !== 'past');
  const pastEvents = allEvents.filter((e) => e.status === 'past');
  const displayedEvents = eventsTab === 'upcoming' ? upcomingEvents : pastEvents;

  // ── Feeds loading ──
  useEffect(() => {
    if (topTab === 'feeds') loadFeeds();
  }, [topTab, feedSubTab, selectedVideoCat, selectedArticleCat]);

  const loadFeeds = async () => {
    setFeedsLoading(true);
    try {
      if (feedSubTab === 'videos') {
        const [vRes, cRes] = await Promise.all([
          fetchGlobalVideoFeeds({ category: selectedVideoCat ?? undefined }),
          videoCats.length ? Promise.resolve(null) : fetchVideoCategories(),
        ]);
        if (vRes.success && vRes.data) {
          setVideos(vRes.data.data);
          setVideoTotal(vRes.data.meta?.total ?? vRes.data.data.length);
        }
        if (cRes?.success && cRes.data) setVideoCats(cRes.data);
      } else {
        const [aRes, cRes] = await Promise.all([
          fetchGlobalArticles({ category: selectedArticleCat ?? undefined }),
          articleCats.length ? Promise.resolve(null) : fetchArticleCategories(),
        ]);
        if (aRes.success && aRes.data) {
          setArticles(aRes.data.data);
          setArticleTotal(aRes.data.meta?.total ?? aRes.data.data.length);
        }
        if (cRes?.success && cRes.data) setArticleCats(cRes.data);
      }
    } catch { /* silent */ } finally {
      setFeedsLoading(false);
    }
  };

  // ── Join ──
  const { mutate: findAndJoin, isPending: joining } = useMutation({
    mutationFn: async (code: string) => {
      // Call the real join-by-code endpoint. The backend auto-creates a
      // checkin record (auto_checked_in) so no separate check-in step is needed.
      const res = await joinByCode(code);
      if (!res.success) throw new Error(res.error?.message ?? `No event found for "${code}".`);
      return res.data!;
    },
  });

  const goToFeed = useCallback(() => router.replace('/(tabs)/feed'), []);

  const handleJoin = useCallback(async (code: string) => {
    const c = code.trim().toUpperCase();
    if (!c) { Alert.alert('Enter a code', 'Please type an event code first.'); return; }
    const local = allEvents.find((e) => (e.code ?? '').toUpperCase() === c || String(e.id) === c);
    if (local) {
      setSelectedEvent(null);
      setCurrentEventId(local.id);
      await refreshEventRole(local.id);
      Alert.alert('Joined!', `You've joined "${local.name}".`, [{ text: 'Enter Event', onPress: goToFeed }]);
      return;
    }
    findAndJoin(c, {
      onSuccess: async (ev) => {
        setSelectedEvent(null);
        if (ev.id) { setCurrentEventId(ev.id); await refreshEventRole(ev.id); }
        Alert.alert('Joined!', `You've joined "${ev.name}".`, [{ text: 'Enter Event', onPress: goToFeed }]);
      },
      onError: (err) => Alert.alert('Not Found', err instanceof Error ? err.message : `No event found for "${c}".`),
    });
  }, [allEvents, findAndJoin, setCurrentEventId, goToFeed, refreshEventRole]);

  const activeCats = feedSubTab === 'videos' ? videoCats : articleCats;
  const activeCat = feedSubTab === 'videos' ? selectedVideoCat : selectedArticleCat;
  const setActiveCat = feedSubTab === 'videos' ? setSelectedVideoCat : setSelectedArticleCat;
  const activeCount = feedSubTab === 'videos' ? videoTotal : articleTotal;
  const activeLabel = feedSubTab === 'videos' ? 'VIDEOS' : 'ARTICLES';

  return (
    <View style={s.root}>
      {/* ── Gradient header ── */}
      <LinearGradient
        colors={['#4a1d96', '#3b1278', '#1e0a4a', '#07070f']}
        locations={[0, 0.4, 0.75, 1]}
        style={[s.header, { paddingTop: insets.top }]}
      >
        {/* Nav row */}
        <View style={s.navRow}>
          <View style={s.logoRow}>
            <Ionicons name="grid" size={14} color="rgba(255,255,255,0.7)" />
            <Text style={s.logoText}>CXO INC</Text>
          </View>
          <TouchableOpacity
            style={s.logoffBtn}
            onPress={() => {
              Alert.alert('Log off', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Log off', style: 'destructive', onPress: () => logout?.() },
              ]);
            }}
          >
            <Ionicons name="log-out-outline" size={14} color="rgba(255,255,255,0.75)" />
            <Text style={s.logoffText}>Log off</Text>
          </TouchableOpacity>
        </View>

        {/* Welcome */}
        <Text style={s.welcomeTitle}>Welcome, {firstName}!</Text>
        <Text style={s.welcomeSub}>Explore feeds or join an event below.</Text>

        {/* Top tabs */}
        <View style={s.topTabBar}>
          <TouchableOpacity
            style={[s.topTab, topTab === 'feeds' && s.topTabActive]}
            onPress={() => setTopTab('feeds')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="desktop-outline"
              size={14}
              color={topTab === 'feeds' ? '#fff' : 'rgba(255,255,255,0.5)'}
              style={{ marginRight: 6 }}
            />
            <Text style={[s.topTabText, topTab === 'feeds' && s.topTabTextActive]}>CXO Feeds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.topTab, topTab === 'events' && s.topTabActive]}
            onPress={() => setTopTab('events')}
            activeOpacity={0.85}
          >
            <Ionicons
              name="grid-outline"
              size={14}
              color={topTab === 'events' ? '#fff' : 'rgba(255,255,255,0.5)'}
              style={{ marginRight: 6 }}
            />
            <Text style={[s.topTabText, topTab === 'events' && s.topTabTextActive]}>Events</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* ── CXO Feeds tab ── */}
      {topTab === 'feeds' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
          <FlatList
            data={feedSubTab === 'videos' ? videos as any[] : articles as any[]}
            keyExtractor={(item) => String(item.id)}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.feedList, { paddingBottom: insets.bottom + 32 }]}
            ListHeaderComponent={
              <View>
                {/* Videos / Articles sub-tabs */}
                <View style={fs.subTabRow}>
                  <TouchableOpacity
                    style={[fs.subTab, feedSubTab === 'videos' && fs.subTabActive]}
                    onPress={() => setFeedSubTab('videos')}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="desktop-outline"
                      size={13}
                      color={feedSubTab === 'videos' ? '#fff' : 'rgba(255,255,255,0.55)'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[fs.subTabText, feedSubTab === 'videos' && fs.subTabTextActive]}>Videos</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[fs.subTab, feedSubTab === 'articles' && fs.subTabActive]}
                    onPress={() => setFeedSubTab('articles')}
                    activeOpacity={0.85}
                  >
                    <Ionicons
                      name="book-outline"
                      size={13}
                      color={feedSubTab === 'articles' ? '#fff' : 'rgba(255,255,255,0.55)'}
                      style={{ marginRight: 5 }}
                    />
                    <Text style={[fs.subTabText, feedSubTab === 'articles' && fs.subTabTextActive]}>Articles</Text>
                  </TouchableOpacity>
                </View>

                {/* Category chips */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={fs.chipScroll}
                >
                  <TouchableOpacity
                    style={[fs.chip, !activeCat && fs.chipActive]}
                    onPress={() => setActiveCat(null)}
                  >
                    <Text style={[fs.chipText, !activeCat && fs.chipTextActive]}>All</Text>
                  </TouchableOpacity>
                  {activeCats.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[fs.chip, activeCat === cat.slug && fs.chipActive]}
                      onPress={() => setActiveCat(cat.slug)}
                    >
                      <Text style={[fs.chipText, activeCat === cat.slug && fs.chipTextActive]}>
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Count label */}
                {activeCount > 0 && (
                  <Text style={fs.countLabel}>
                    {activeCat ? activeCat.toUpperCase() : 'ALL'} · {activeCount} {activeLabel}
                  </Text>
                )}

                {feedsLoading && (
                  <View style={s.center}>
                    <ActivityIndicator color={colors.primary} size="large" />
                  </View>
                )}
              </View>
            }
            renderItem={({ item }) =>
              feedSubTab === 'videos'
                ? <VideoCard item={item as GlobalVideoFeed} />
                : <ArticleCard item={item as GlobalArticle} />
            }
            ListEmptyComponent={
              !feedsLoading ? (
                <View style={s.center}>
                  <Ionicons name="albums-outline" size={40} color={colors.textMuted} />
                  <Text style={s.emptyTitle}>No content yet</Text>
                  <Text style={s.emptySub}>Check back soon for new {feedSubTab}.</Text>
                </View>
              ) : null
            }
          />
        </KeyboardAvoidingView>
      )}

      {/* ── Events tab ── */}
      {topTab === 'events' && (
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.flex}>
          <ScrollView
            style={s.flex}
            contentContainerStyle={[s.scrollPad, { paddingBottom: insets.bottom + 48 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetchEvents} tintColor={colors.primary} />
            }
          >
            {/* ── Enter Event Code card ── */}
            <View style={es.codeCard}>
              <View style={es.codeCardHeader}>
                <View style={es.hashIcon}>
                  <Text style={es.hashText}>#</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={es.codeCardTitle}>Enter Event Code</Text>
                  <Text style={es.codeCardSub}>Got an invite? Enter the code to join instantly.</Text>
                </View>
              </View>
              <View style={es.codeRow}>
                <TextInput
                  style={es.codeInput}
                  placeholder="e.g. TECH26"
                  placeholderTextColor="rgba(255,255,255,0.22)"
                  value={codeInput}
                  onChangeText={(t) => setCodeInput(t.toUpperCase())}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={() => handleJoin(codeInput)}
                />
                <TouchableOpacity
                  style={[es.joinBtn, joining && { opacity: 0.55 }]}
                  onPress={() => handleJoin(codeInput)}
                  disabled={joining}
                >
                  {joining
                    ? <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
                    : <Text style={es.joinBtnText}>Join →</Text>}
                </TouchableOpacity>
              </View>
            </View>

            {/* ── Upcoming Events ── */}
            <View style={es.sectionHeader}>
              <View style={es.sectionTitleRow}>
                <Ionicons name="time-outline" size={15} color={colors.primary} />
                <Text style={es.sectionTitle}>Upcoming Events</Text>
              </View>
              {upcomingEvents.length > 0 && (
                <View style={es.countBadge}>
                  <Text style={es.countBadgeText}>{upcomingEvents.length}</Text>
                </View>
              )}
            </View>

            {eventsLoading ? (
              <View style={s.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={s.emptyTitle}>Loading events…</Text>
              </View>
            ) : eventsError ? (
              <View style={s.center}>
                <Ionicons name="cloud-offline-outline" size={40} color={colors.error} />
                <Text style={s.emptyTitle}>Couldn't load events</Text>
                <TouchableOpacity style={es.retryBtn} onPress={() => refetchEvents()}>
                  <Text style={es.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            ) : upcomingEvents.length === 0 ? (
              <View style={s.center}>
                <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
                <Text style={s.emptyTitle}>No upcoming events</Text>
                <Text style={s.emptySub}>Check back later or use an invite code.</Text>
              </View>
            ) : (
              <View style={es.cardList}>
                {upcomingEvents.map((ev, idx) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    index={idx}
                    onPress={() => { setSelectedEvent(ev); setPopupCode(ev.code ?? ''); }}
                  />
                ))}
              </View>
            )}

            {/* ── Past Events ── */}
            {pastEvents.length > 0 && (
              <>
                <View style={[es.sectionHeader, { marginTop: 28 }]}>
                  <View style={es.sectionTitleRow}>
                    <Ionicons name="checkmark-circle-outline" size={15} color={colors.textMuted} />
                    <Text style={[es.sectionTitle, { color: colors.textSecondary }]}>Past Events</Text>
                  </View>
                  <View style={[es.countBadge, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                    <Text style={[es.countBadgeText, { color: colors.textMuted }]}>{pastEvents.length}</Text>
                  </View>
                </View>
                <View style={es.cardList}>
                  {pastEvents.map((ev, idx) => (
                    <EventCard
                      key={ev.id}
                      event={ev}
                      index={idx}
                      onPress={() => { setSelectedEvent(ev); setPopupCode(ev.code ?? ''); }}
                    />
                  ))}
                </View>
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ── Join event bottom sheet ── */}
      <Modal visible={!!selectedEvent} transparent animationType="slide" onRequestClose={() => setSelectedEvent(null)}>
        <Pressable style={s.overlay} onPress={() => setSelectedEvent(null)}>
          <Pressable style={[s.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={s.sheetHandle} />
            {selectedEvent && (() => {
              const photo = getEventImage(selectedEvent, 0);
              return (
                <>
                  <ImageBackground source={{ uri: photo }} style={s.sheetPhoto} imageStyle={{ borderRadius: 0 }}>
                    <LinearGradient colors={['transparent', 'rgba(5,5,12,0.85)']} style={StyleSheet.absoluteFill} />
                    <View style={es.badgeRow}>
                      {selectedEvent.status === 'upcoming' && (
                        <View style={es.upcomingBadge}>
                          <View style={es.upcomingDot} />
                          <Text style={es.upcomingBadgeText}>UPCOMING</Text>
                        </View>
                      )}
                      {!!selectedEvent.category && (
                        <View style={es.categoryBadge}>
                          <Text style={es.categoryBadgeText}>{selectedEvent.category.toUpperCase()}</Text>
                        </View>
                      )}
                    </View>
                  </ImageBackground>
                  <View style={s.sheetBody}>
                    <Text style={s.sheetTitle}>{selectedEvent.name}</Text>
                    <View style={s.sheetMeta}>
                      <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                      <Text style={s.sheetMetaText}>{formatDate(selectedEvent.startDate, selectedEvent.endDate)}</Text>
                      {!!selectedEvent.location && (
                        <>
                          <Text style={s.dot}>  ·  </Text>
                          <Ionicons name="location-outline" size={13} color={colors.textMuted} />
                          <Text style={s.sheetMetaText} numberOfLines={1}>{selectedEvent.location}</Text>
                        </>
                      )}
                    </View>
                    <Text style={es.sheetCodeLabel}>EVENT CODE</Text>
                    <View style={es.codeRow}>
                      <TextInput
                        style={es.codeInput}
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
                        style={[es.joinBtn, es.joinBtnPrimary, joining && { opacity: 0.55 }]}
                        onPress={() => handleJoin(popupCode)}
                        disabled={joining}
                      >
                        {joining
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={[es.joinBtnText, { color: '#fff' }]}>Join</Text>}
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

// ─── Shared ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  feedList: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 32 },
  scrollPad: { paddingHorizontal: 16, paddingTop: 20 },

  // Header
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginBottom: 16 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  logoText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  logoffBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  logoffText: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600' },
  welcomeTitle: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5, marginBottom: 4 },
  welcomeSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, marginBottom: 20 },
  topTabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  topTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 999 },
  topTabActive: { backgroundColor: '#7c3aed' },
  topTabText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '700' },
  topTabTextActive: { color: '#fff' },

  // Modals / overlays
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0d0d1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 10, marginBottom: 2 },
  sheetPhoto: { height: 180 },
  sheetBody: { padding: 20 },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 8 },
  sheetMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginBottom: 16 },
  sheetMetaText: { color: colors.textMuted, fontSize: 12 },
  dot: { color: colors.textMuted, fontSize: 12 },

  // Empty / loading
  center: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
  emptyTitle: { color: colors.textSecondary, fontSize: 15, fontWeight: '600', marginTop: 4 },
  emptySub: { color: colors.textMuted, fontSize: 13, textAlign: 'center' },
});

// ─── Events tab styles ────────────────────────────────────────────────────────
const es = StyleSheet.create({
  // Code card
  codeCard: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    padding: 18,
    marginBottom: 24,
  },
  codeCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  hashIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashText: { color: '#fff', fontSize: 22, fontWeight: '900' },
  codeCardTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 3 },
  codeCardSub: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17 },
  codeRow: { flexDirection: 'row', gap: 10 },
  codeInput: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 16,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 2,
  },
  joinBtn: {
    height: 50,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  joinBtnPrimary: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  joinBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '700' },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  sectionTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  countBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  sheetCodeLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10 },

  // Event cards
  cardList: { gap: 14, marginBottom: 8 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardPhoto: { height: 160 },
  cardPhotoImg: { borderRadius: 0 },
  badgeRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upcomingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(30,20,60,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  upcomingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' },
  upcomingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  pastBadge: {
    backgroundColor: 'rgba(80,80,100,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  categoryBadge: {
    backgroundColor: '#7c3aed',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  categoryBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  cardBody: { padding: 14 },
  cardTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 8, lineHeight: 21 },
  cardMeta: { gap: 5, marginBottom: 10 },
  cardMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardMetaText: { color: colors.textMuted, fontSize: 12 },
  cardFooter: { flexDirection: 'row', alignItems: 'center' },
  codePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
  },
  codePillText: { color: '#a78bfa', fontSize: 11, fontWeight: '700', letterSpacing: 0.8 },

  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.5)',
  },
  retryText: { color: '#a78bfa', fontSize: 13, fontWeight: '600' },
});

// ─── Feed tab styles ──────────────────────────────────────────────────────────
const fs = StyleSheet.create({
  // Sub-tab row
  subTabRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 4,
  },
  subTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  subTabActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  subTabText: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '700' },
  subTabTextActive: { color: '#fff' },

  // Category chips
  chipScroll: { gap: 8, paddingVertical: 14 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
  chipText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  // Count label
  countLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 14,
  },

  // Video card
  videoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  thumbWrap: { position: 'relative', height: 200 },
  thumb: { width: '100%', height: '100%' },
  ytBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ff0000',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  ytBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  playOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(124,58,237,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  videoBody: { padding: 14 },
  videoTitle: { color: '#fff', fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
  videoDuration: { color: colors.textMuted, fontSize: 12, marginBottom: 8 },
  tagRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(20,180,160,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(20,180,160,0.3)',
  },
  tagText: { color: '#2dd4bf', fontSize: 11, fontWeight: '600' },

  // Article card
  articleCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    flexDirection: 'row',
    height: 110,
  },
  articleThumb: { width: 110, height: '100%' },
  articleBody: { flex: 1, padding: 14, justifyContent: 'center' },
  articleCatRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  articleCat: { color: '#a78bfa', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  articleReadTime: { color: colors.textMuted, fontSize: 10 },
  articleTitle: { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 19, marginBottom: 4 },
  articleExcerpt: { color: colors.textMuted, fontSize: 12, lineHeight: 16 },
});
