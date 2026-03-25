import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Animated,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius, typography } from '@/constants/theme';

const { width: SW } = Dimensions.get('window');
const SAMPLE_VIDEO = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

const MOCK_FEED: FeedItem[] = [
  {
    id: 'v1', type: 'video',
    title: 'Opening Keynote: The Future of AI',
    speaker: 'Dr. Sarah Chen', company: 'TechCorp Solutions',
    duration: '58:22', views: '1.2K', accentColor: '#7c3aed', live: true,
    videoUrl: SAMPLE_VIDEO,
  },
  {
    id: 'poll1', type: 'poll',
    question: 'Which topic are you most excited about today?',
    session: 'Opening Keynote',
    options: [
      { id: 'o1', text: 'AI & Machine Learning', votes: 48 },
      { id: 'o2', text: 'Startup Ecosystem', votes: 31 },
      { id: 'o3', text: 'Sustainable Tech', votes: 22 },
      { id: 'o4', text: 'Leadership & Culture', votes: 19 },
    ],
  },
  {
    id: 'v2', type: 'video',
    title: 'Scaling Engineering Teams in a Remote World',
    speaker: 'Marcus Johnson', company: 'InnovateLab',
    duration: '42:10', views: '847', accentColor: '#06b6d4', live: false,
    videoUrl: SAMPLE_VIDEO,
  },
  {
    id: 'poll2', type: 'poll',
    question: 'How productive is your remote team vs. in-office?',
    session: 'Engineering Workshop',
    options: [
      { id: 'o1', text: 'More productive', votes: 62 },
      { id: 'o2', text: 'About the same', votes: 28 },
      { id: 'o3', text: 'Slightly less', votes: 18 },
      { id: 'o4', text: 'Much less', votes: 9 },
    ],
  },
  {
    id: 'v3', type: 'video',
    title: 'UX Research That Actually Influences Product',
    speaker: 'Priya Patel', company: 'DesignFlow',
    duration: '29:45', views: '532', accentColor: '#ec4899', live: false,
    videoUrl: SAMPLE_VIDEO,
  },
  {
    id: 'v4', type: 'video',
    title: 'ML Applications in Enterprise Products',
    speaker: 'Elena Rodriguez', company: 'QuantumLeap AI',
    duration: '35:00', views: '412', accentColor: '#10b981', live: false,
    videoUrl: SAMPLE_VIDEO,
  },
];

type VideoItem = { id: string; type: 'video'; title: string; speaker: string; company: string; duration: string; views: string; accentColor: string; live: boolean; videoUrl: string };
type PollItem = { id: string; type: 'poll'; question: string; session: string; options: { id: string; text: string; votes: number }[] };
type FeedItem = VideoItem | PollItem;

function VideoCard({ item, isVisible }: { item: VideoItem; isVisible: boolean }) {
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

function PollCard({ item, votedOptionId, onVote }: { item: PollItem; votedOptionId: string | null; onVote: (id: string) => void }) {
  const total = item.options.reduce((s, o) => s + o.votes, 0);
  const hasVoted = !!votedOptionId;

  return (
    <View style={styles.pollCard}>
      <View style={styles.pollHeader}>
        <View style={styles.pollBadge}>
          <Ionicons name="bar-chart" size={11} color={colors.accent} />
          <Text style={styles.pollBadgeText}>LIVE POLL</Text>
        </View>
        <Text style={styles.pollSession}>{item.session}</Text>
      </View>
      <Text style={styles.pollQuestion}>{item.question}</Text>
      <View style={styles.pollOptions}>
        {item.options.map((opt) => {
          const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
          const selected = votedOptionId === opt.id;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[styles.pollOpt, selected && styles.pollOptSelected]}
              onPress={() => !hasVoted && onVote(opt.id)}
              activeOpacity={hasVoted ? 1 : 0.7}
            >
              <View style={styles.pollOptRow}>
                <Text style={[styles.pollOptText, selected && { color: colors.accent }]}>{opt.text}</Text>
                {hasVoted && <Text style={styles.pollPct}>{pct}%</Text>}
              </View>
              {hasVoted && (
                <View style={styles.pollBar}>
                  <View style={[styles.pollBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: selected ? colors.accent : 'rgba(255,255,255,0.12)' }]} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
      {!hasVoted && <Text style={styles.pollHint}>Tap to vote · {total} total votes</Text>}
    </View>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { markPollVoted } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [pollVotes, setPollVotes] = useState<Record<string, string>>({});
  const [visibleIds, setVisibleIds] = useState<string[]>([]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await new Promise<void>((r) => setTimeout(r, 1000));
    setRefreshing(false);
  }, []);

  const handleVote = useCallback((pollId: string, optId: string) => {
    if (pollVotes[pollId]) return;
    setPollVotes((p) => ({ ...p, [pollId]: optId }));
    markPollVoted(pollId);
  }, [pollVotes, markPollVoted]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    setVisibleIds(viewableItems.map((i: any) => i.item.id));
  }, []);

  const renderItem = useCallback(({ item }: { item: FeedItem }) => {
    if (item.type === 'video') {
      return <VideoCard item={item} isVisible={visibleIds.includes(item.id)} />;
    }
    return (
      <PollCard
        item={item}
        votedOptionId={pollVotes[item.id] ?? null}
        onVote={(oid) => handleVote(item.id, oid)}
      />
    );
  }, [visibleIds, pollVotes, handleVote]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Text style={styles.topTitle}>Live Feed</Text>
        <View style={styles.liveChip}>
          <View style={styles.livePulse} />
          <Text style={styles.liveChipText}>LIVE</Text>
        </View>
      </View>
      <FlatList
        data={MOCK_FEED}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  topTitle: { color: colors.textPrimary, ...typography.h2 },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveChipText: { color: '#ef4444', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  list: { padding: spacing.xl, paddingBottom: 100, gap: spacing.lg },

  videoCard: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, overflow: 'hidden' },
  videoThumb: { height: 190, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  thumbCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  playCircle: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  liveBadge: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#ef4444', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  liveDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  videoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  videoMetaRow: { position: 'absolute', bottom: 10, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between' },
  videoDuration: { color: '#fff', fontSize: 11, fontWeight: '600' },
  videoViews: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  videoBody: { padding: spacing.lg },
  videoTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 22, marginBottom: spacing.sm },
  videoSpeaker: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md },
  videoActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.full },
  playBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' },

  pollCard: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.accent + '40', padding: spacing.lg },
  pollHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  pollBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, backgroundColor: colors.accent + '15', borderWidth: 1, borderColor: colors.accent + '40' },
  pollBadgeText: { color: colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  pollSession: { color: colors.textMuted, fontSize: 11 },
  pollQuestion: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 22, marginBottom: spacing.lg },
  pollOptions: { gap: spacing.sm },
  pollOpt: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, overflow: 'hidden' },
  pollOptSelected: { borderColor: colors.accent + '80', backgroundColor: colors.accent + '10' },
  pollOptRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pollOptText: { color: colors.textPrimary, fontSize: 13, fontWeight: '500', flex: 1 },
  pollPct: { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
  pollBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: spacing.sm, overflow: 'hidden' },
  pollBarFill: { height: 3, borderRadius: 2 },
  pollHint: { color: colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: spacing.md },
});
