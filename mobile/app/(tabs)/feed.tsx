import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { useVideoFeeds, useMarkVideoWatched } from '@/hooks/useFeed';
import { usePolls, useVotePoll, useSurveys, useGiveaways } from '@/hooks/useEngage';
import { DataState } from '@/components/DataState';
import { ArticlesTab } from '@/components/ArticlesTab';
import { StoriesRail } from '@/components/StoriesRail';
import { colors, spacing, radius, typography } from '@/constants/theme';
import type { FeedVideo, Poll } from '@/lib/api/types';

const { width: SW } = Dimensions.get('window');

function VideoCard({ item, isVisible }: { item: FeedVideo; isVisible: boolean }) {
  const videoRef = useRef<Video>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [playing, setPlaying] = useState(false);

  React.useEffect(() => {
    if (isVisible && !showPlayer) {
      setShowPlayer(true);
      setPlaying(true);
    } else if (isVisible && showPlayer) {
      videoRef.current?.playAsync().then(() => setPlaying(true)).catch(() => {});
    } else if (!isVisible && showPlayer) {
      videoRef.current?.pauseAsync().then(() => setPlaying(false)).catch(() => {});
    }
  }, [isVisible]);

  const handlePlay = useCallback(async () => {
    if (!showPlayer) { setShowPlayer(true); setPlaying(true); return; }
    if (playing) {
      await videoRef.current?.pauseAsync();
      setPlaying(false);
    } else {
      await videoRef.current?.playAsync();
      setPlaying(true);
    }
  }, [showPlayer, playing]);

  return (
    <View style={[styles.videoCard, { borderColor: item.accentColor + '50' }]}>
      <View style={[styles.videoThumb, { backgroundColor: item.accentColor + '18' }]}>
        {showPlayer ? (
          <Video
            ref={videoRef}
            source={{ uri: item.videoUrl }}
            style={StyleSheet.absoluteFill}
            resizeMode={ResizeMode.COVER}
            isLooping
            isMuted
            shouldPlay={playing}
          />
        ) : (
          <View style={styles.thumbCenter}>
            <View style={[styles.playCircle, { backgroundColor: item.accentColor + '30' }]}>
              <Ionicons name="play" size={28} color={item.accentColor} />
            </View>
          </View>
        )}
        {item.live && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}
        <LinearGradient colors={['transparent', 'rgba(7,7,15,0.88)']} style={styles.videoOverlay} />
        <View style={styles.videoMetaRow}>
          <Text style={styles.videoDuration}>{item.duration}</Text>
          <Text style={styles.videoViews}>{item.views} views</Text>
        </View>
      </View>

      <View style={styles.videoBody}>
        <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.videoSpeaker}>{item.speaker} · {item.company}</Text>
        <View style={styles.videoActions}>
          <TouchableOpacity onPress={handlePlay} style={[styles.playBtn, { backgroundColor: item.accentColor }]}>
            <Ionicons name={playing ? 'pause' : 'play'} size={13} color="#fff" />
            <Text style={styles.playBtnText}>{playing ? 'Pause' : showPlayer ? 'Resume' : 'Watch'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="bookmark-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="share-outline" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

interface PollCardProps {
  item: Poll;
  votedOptionId: string | null;
  onVote: (optionId: string) => void;
  currentIndex: number;
  total: number;
  hasMore: boolean;
  onNext: () => void;
}

function PollCard({ item, votedOptionId, onVote, currentIndex, total, hasMore, onNext }: PollCardProps) {
  const voteTotal = item.options.reduce((s, o) => s + o.votes, 0);
  const hasVoted = !!votedOptionId;

  return (
    <View style={styles.pollCard}>
      <View style={styles.pollHeader}>
        <View style={styles.pollBadge}>
          <Ionicons name="bar-chart" size={11} color={colors.accent} />
          <Text style={styles.pollBadgeText}>LIVE POLL</Text>
        </View>
        <View style={styles.pollMeta}>
          {item.session ? <Text style={styles.pollSession}>{item.session}</Text> : null}
          {total > 1 && (
            <Text style={styles.pollCounter}>{currentIndex + 1}/{total}</Text>
          )}
        </View>
      </View>

      <Text style={styles.pollQuestion}>{item.question}</Text>

      <View style={styles.pollOptions}>
        {item.options.map((opt) => {
          const pct = voteTotal > 0 ? Math.round((opt.votes / voteTotal) * 100) : 0;
          const selected = votedOptionId === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.pollOpt, selected && styles.pollOptSelected]}
              onPress={() => !hasVoted && onVote(opt.id)}
              activeOpacity={hasVoted ? 1 : 0.7}
            >
              <View style={styles.pollOptRow}>
                <Text style={[styles.pollOptText, selected && { color: colors.accent }]}>
                  {opt.text}
                </Text>
                {hasVoted && <Text style={styles.pollPct}>{pct}%</Text>}
              </View>
              {hasVoted && (
                <View style={styles.pollBar}>
                  <View
                    style={[
                      styles.pollBarFill,
                      {
                        width: `${pct}%` as `${number}%`,
                        backgroundColor: selected ? colors.accent : 'rgba(255,255,255,0.12)',
                      },
                    ]}
                  />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {!hasVoted && (
        <Text style={styles.pollHint}>Tap to vote · {voteTotal} total votes</Text>
      )}

      {hasVoted && hasMore && (
        <TouchableOpacity style={styles.nextPollBtn} onPress={onNext} activeOpacity={0.8}>
          <Text style={styles.nextPollText}>Next Poll</Text>
          <Ionicons name="arrow-forward" size={14} color={colors.accent} />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { markPollVoted, markEventCheckedIn } = useAuth();
  const { currentEventId } = useEvent();
  const [feedTab, setFeedTab] = useState<'videos' | 'articles'>('videos');
  const [pollVotes, setPollVotes] = useState<Record<string, string>>({});
  const [currentPollIdx, setCurrentPollIdx] = useState(0);
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const watchedVideoIds = useRef<Set<string>>(new Set());

  const {
    data: videos = [],
    isLoading: videosLoading,
    isError: videosError,
    isRefetching: videosRefetching,
    refetch: refetchVideos,
    fetchNextPage: fetchMoreVideos,
    hasNextPage: hasMoreVideos,
    isFetchingNextPage: isFetchingMoreVideos,
  } = useVideoFeeds();

  const {
    data: allPolls = [],
    isLoading: pollsLoading,
    isRefetching: pollsRefetching,
    refetch: refetchPolls,
  } = usePolls();

  const { data: surveysData = [] } = useSurveys();
  const { data: giveawaysData = [] } = useGiveaways();

  const { mutate: votePoll } = useVotePoll();
  const { mutate: markVideoWatched } = useMarkVideoWatched();

  const isLoading = videosLoading || pollsLoading;
  const isRefetching = (videosRefetching || pollsRefetching) && !isLoading;

  // Show every poll the backend returns — it is the source of truth for
  // which polls are visible to attendees. The previous `isLive` heuristic
  // silently dropped polls when the backend didn't carry an `is_live` /
  // `is_active` flag (or set a status the heuristic considered closed),
  // which is exactly why polls weren't surfacing on the home screen even
  // though the API call succeeded. If a poll shouldn't be visible the
  // backend should not include it in the list response.
  const livePolls = allPolls;

  useEffect(() => {
    setCurrentPollIdx(0);
  }, [livePolls.length]);

  const activePoll = livePolls[currentPollIdx] ?? null;
  const hasMorePolls = currentPollIdx < livePolls.length - 1;

  // Award check-in points once per event, the first time the user lands on the feed.
  useEffect(() => {
    if (currentEventId) {
      markEventCheckedIn(currentEventId);
    }
  }, [currentEventId, markEventCheckedIn]);

  const onRefresh = useCallback(async () => {
    await Promise.all([refetchVideos(), refetchPolls()]);
  }, [refetchVideos, refetchPolls]);

  const handleVote = useCallback((pollId: string, optId: string) => {
    if (pollVotes[pollId]) return;
    setPollVotes((prev) => ({ ...prev, [pollId]: optId }));
    markPollVoted(pollId);
    votePoll({ pollId, optionId: optId });
  }, [pollVotes, markPollVoted, votePoll]);

  const handleNextPoll = useCallback(() => {
    setCurrentPollIdx((i) => Math.min(i + 1, livePolls.length - 1));
  }, [livePolls.length]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    const ids = viewableItems.map((i: any) => i.item.id) as string[];
    setVisibleIds(ids);
    ids.forEach((id) => {
      if (!watchedVideoIds.current.has(id)) {
        watchedVideoIds.current.add(id);
        markVideoWatched(id);
      }
    });
  }, [markVideoWatched]);

  const renderVideo = useCallback(({ item }: { item: FeedVideo }) => (
    <VideoCard item={item} isVisible={visibleIds.includes(item.id)} />
  ), [visibleIds]);

  const shortcutSection = (
    <View style={styles.shortcutRow}>
      {/* Surveys */}
      <TouchableOpacity
        style={styles.shortcutCard}
        onPress={() => router.push('/(tabs)/engage?tab=polls' as any)}
        activeOpacity={0.78}
      >
        <LinearGradient colors={['rgba(124,58,237,0.22)', 'rgba(79,70,229,0.10)']} style={styles.shortcutGrad}>
          <View style={[styles.shortcutIcon, { backgroundColor: 'rgba(124,58,237,0.22)' }]}>
            <Ionicons name="document-text-outline" size={20} color={colors.primary} />
          </View>
          <Text style={styles.shortcutLabel}>Surveys</Text>
          {surveysData.length > 0 && (
            <View style={styles.shortcutBadge}>
              <Text style={styles.shortcutBadgeText}>{surveysData.length}</Text>
            </View>
          )}
          <View style={styles.shortcutArrow}>
            <Ionicons name="arrow-forward" size={12} color={colors.primary} />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Polls */}
      <TouchableOpacity
        style={styles.shortcutCard}
        onPress={() => router.push('/(tabs)/engage?tab=polls' as any)}
        activeOpacity={0.78}
      >
        <LinearGradient colors={['rgba(6,182,212,0.20)', 'rgba(79,70,229,0.10)']} style={styles.shortcutGrad}>
          <View style={[styles.shortcutIcon, { backgroundColor: 'rgba(6,182,212,0.20)' }]}>
            <Ionicons name="bar-chart-outline" size={20} color={colors.accent} />
          </View>
          <Text style={[styles.shortcutLabel, { color: colors.accent }]}>Polls</Text>
          {allPolls.length > 0 && (
            <View style={[styles.shortcutBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.shortcutBadgeText}>{allPolls.length}</Text>
            </View>
          )}
          <View style={styles.shortcutArrow}>
            <Ionicons name="arrow-forward" size={12} color={colors.accent} />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Giveaways & Draws */}
      <TouchableOpacity
        style={styles.shortcutCard}
        onPress={() => router.push('/(tabs)/engage?tab=giveaways' as any)}
        activeOpacity={0.78}
      >
        <LinearGradient colors={['rgba(245,158,11,0.18)', 'rgba(234,88,12,0.08)']} style={styles.shortcutGrad}>
          <View style={[styles.shortcutIcon, { backgroundColor: 'rgba(245,158,11,0.20)' }]}>
            <Ionicons name="gift" size={20} color="#f59e0b" />
          </View>
          <Text style={[styles.shortcutLabel, { color: '#f59e0b' }]}>Giveaways</Text>
          {giveawaysData.length > 0 && (
            <View style={[styles.shortcutBadge, { backgroundColor: '#f59e0b' }]}>
              <Text style={styles.shortcutBadgeText}>{giveawaysData.length}</Text>
            </View>
          )}
          <View style={styles.shortcutArrow}>
            <Ionicons name="arrow-forward" size={12} color="#f59e0b" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  // Poll + video-feed divider shown inside the FlatList header (shortcuts
  // are rendered unconditionally ABOVE the loading gate so they are always
  // visible even while videos/polls are still fetching).
  const feedListHeader = (
    <View style={styles.headerSection}>
      {activePoll && (
        <View style={styles.pollSection}>
          <View style={styles.sectionDivider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerLabel}>Live Poll</Text>
            <View style={styles.dividerLine} />
          </View>
          <PollCard
            key={activePoll.id}
            item={activePoll}
            votedOptionId={pollVotes[activePoll.id] ?? null}
            onVote={(oid) => handleVote(activePoll.id, oid)}
            currentIndex={currentPollIdx}
            total={livePolls.length}
            hasMore={hasMorePolls}
            onNext={handleNextPoll}
          />
        </View>
      )}

      {videos.length > 0 && (
        <View style={styles.sectionDivider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerLabel}>Video Feed · Watch to earn Points</Text>
          <View style={styles.dividerLine} />
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Home</Text>
        <View style={styles.feedTabToggle}>
          <TouchableOpacity
            style={[styles.feedTabBtn, feedTab === 'videos' && styles.feedTabBtnActive]}
            onPress={() => setFeedTab('videos')}
            activeOpacity={0.8}
          >
            <Ionicons name="videocam" size={12} color={feedTab === 'videos' ? '#fff' : colors.textMuted} />
            <Text style={[styles.feedTabText, feedTab === 'videos' && styles.feedTabTextActive]}>Videos</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.feedTabBtn, feedTab === 'articles' && styles.feedTabBtnActive]}
            onPress={() => setFeedTab('articles')}
            activeOpacity={0.8}
          >
            <Ionicons name="book" size={12} color={feedTab === 'articles' ? '#fff' : colors.textMuted} />
            <Text style={[styles.feedTabText, feedTab === 'articles' && styles.feedTabTextActive]}>Articles</Text>
          </TouchableOpacity>
        </View>
        {feedTab === 'videos' ? (
          <View style={styles.liveChip}>
            <View style={styles.livePulse} />
            <Text style={styles.liveChipText}>LIVE</Text>
          </View>
        ) : (
          <View style={styles.liveChipSpacer} />
        )}
      </View>

      {feedTab === 'articles' ? (
        <ArticlesTab />
      ) : (
        <>
          {/* Story-style rail — always visible at the top of the feed. */}
          <StoriesRail />

          {/* Shortcut cards are ALWAYS visible — not gated on video/poll loading */}
          <View style={styles.shortcutsOuter}>
            {shortcutSection}
          </View>

          <DataState
            loading={isLoading}
            error={videosError ? 'Failed to load feed. Pull down to retry.' : null}
            onRetry={refetchVideos}
          />

          {!isLoading && (
            <FlatList
              data={videos}
              keyExtractor={(i) => i.id}
              renderItem={renderVideo}
              ListHeaderComponent={feedListHeader}
              contentContainerStyle={styles.list}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={isRefetching}
                  onRefresh={onRefresh}
                  tintColor={colors.primary}
                  colors={[colors.primary]}
                />
              }
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
              onEndReached={() => {
                if (hasMoreVideos && !isFetchingMoreVideos) {
                  void fetchMoreVideos();
                }
              }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isFetchingMoreVideos ? (
                  <View style={styles.footerLoader}>
                    <Text style={styles.footerLoaderText}>Loading more…</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyEmoji}>📡</Text>
                  <Text style={styles.emptyTitle}>No videos yet</Text>
                  <Text style={styles.emptySub}>
                    {activePoll
                      ? 'Videos will appear here once the event streams begin.'
                      : 'Once you join an event, live videos and polls will appear here.'}
                  </Text>
                </View>
              }
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { color: colors.textPrimary, ...typography.h2 },

  feedTabToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.full,
    padding: 3,
  },
  feedTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  feedTabBtnActive: {
    backgroundColor: colors.primary,
  },
  feedTabText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  feedTabTextActive: {
    color: '#fff',
  },

  liveChipSpacer: { width: 62 },
  liveChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveChipText: { color: '#ef4444', fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  list: { padding: spacing.xl, paddingBottom: 100, gap: spacing.lg },

  headerSection: { gap: spacing.md, marginBottom: spacing.sm },

  shortcutsOuter: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  shortcutCard: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  shortcutGrad: {
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  shortcutIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutLabel: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
    flex: 1,
  },
  shortcutBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  shortcutArrow: {
    alignSelf: 'flex-end',
  },

  pollSection: { gap: spacing.sm },

  sectionDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  videoCard: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, overflow: 'hidden' },
  videoThumb: { height: 190, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  thumbCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  liveBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  videoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  videoMetaRow: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  videoDuration: { color: '#fff', fontSize: 11, fontWeight: '600' },
  videoViews: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  videoBody: { padding: spacing.lg },
  videoTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 22, marginBottom: spacing.sm },
  videoSpeaker: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md },
  videoActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  playBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  pollCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    padding: spacing.lg,
  },
  pollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  pollBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: colors.accent + '15',
    borderWidth: 1,
    borderColor: colors.accent + '40',
  },
  pollBadgeText: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  pollMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pollSession: { color: colors.textMuted, fontSize: 11 },
  pollCounter: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    backgroundColor: colors.accent + '15',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  pollQuestion: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  pollOptions: { gap: spacing.sm },
  pollOpt: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    overflow: 'hidden',
  },
  pollOptSelected: { borderColor: colors.accent + '80', backgroundColor: colors.accent + '10' },
  pollOptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pollOptText: { color: colors.textPrimary, fontSize: 13, fontWeight: '500', flex: 1 },
  pollPct: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  pollBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  pollBarFill: { height: 3, borderRadius: 2 },
  pollHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
  nextPollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '50',
    backgroundColor: colors.accent + '10',
  },
  nextPollText: { color: colors.accent, fontSize: 13, fontWeight: '700' },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: 80,
  },
  emptyEmoji: { fontSize: 48, marginBottom: spacing.lg },
  emptyTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', textAlign: 'center', marginBottom: spacing.sm },
  emptySub: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 21 },
  footerLoader: { paddingVertical: spacing.xl, alignItems: 'center' },
  footerLoaderText: { color: colors.textMuted, fontSize: 13 },
});
