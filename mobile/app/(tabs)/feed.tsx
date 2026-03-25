import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

const { width: SW } = Dimensions.get('window');

const MOCK_VIDEOS = [
  {
    id: 'v1',
    title: 'Opening Keynote: The Future of AI',
    speaker: 'Dr. Sarah Chen',
    company: 'TechCorp Solutions',
    duration: '58:22',
    views: '1.2K',
    thumbnail: null,
    accentColor: '#7c3aed',
    live: true,
  },
  {
    id: 'v2',
    title: 'Scaling Engineering Teams in a Remote World',
    speaker: 'Marcus Johnson',
    company: 'InnovateLab',
    duration: '42:10',
    views: '847',
    thumbnail: null,
    accentColor: '#06b6d4',
    live: false,
  },
  {
    id: 'v3',
    title: 'UX Research That Actually Influences Product',
    speaker: 'Priya Patel',
    company: 'DesignFlow',
    duration: '29:45',
    views: '532',
    thumbnail: null,
    accentColor: '#ec4899',
    live: false,
  },
];

const MOCK_POLLS = [
  {
    id: 'p1',
    question: 'What is your biggest challenge in 2026?',
    options: [
      { id: 'o1', text: 'Talent acquisition', votes: 142 },
      { id: 'o2', text: 'AI adoption', votes: 218 },
      { id: 'o3', text: 'Market uncertainty', votes: 89 },
      { id: 'o4', text: 'Budget constraints', votes: 77 },
    ],
    totalVotes: 526,
    sponsored: false,
  },
  {
    id: 'p2',
    question: 'How would you rate AI tools in your workflow?',
    options: [
      { id: 'o5', text: 'Essential — use daily', votes: 198 },
      { id: 'o6', text: 'Sometimes helpful', votes: 134 },
      { id: 'o7', text: 'Not yet relevant', votes: 43 },
    ],
    totalVotes: 375,
    sponsored: true,
    sponsor: 'QuantumLeap AI',
  },
];

interface VideoCardProps {
  video: typeof MOCK_VIDEOS[0];
}

function VideoCard({ video }: VideoCardProps) {
  const [liked, setLiked] = useState(false);

  return (
    <View style={vStyles.card}>
      <LinearGradient
        colors={[video.accentColor + '33', colors.bgCard]}
        style={vStyles.thumbnail}
      >
        <View style={vStyles.thumbInner}>
          <View style={[vStyles.playBtn, { backgroundColor: video.accentColor }]}>
            <Ionicons name="play" size={18} color="#fff" />
          </View>
          <Text style={vStyles.duration}>{video.duration}</Text>
        </View>
        {video.live && (
          <View style={vStyles.liveBadge}>
            <View style={vStyles.liveDot} />
            <Text style={vStyles.liveText}>LIVE</Text>
          </View>
        )}
      </LinearGradient>

      <View style={vStyles.meta}>
        <View style={[vStyles.trackDot, { backgroundColor: video.accentColor }]} />
        <View style={vStyles.info}>
          <Text style={vStyles.title} numberOfLines={2}>{video.title}</Text>
          <Text style={vStyles.speaker}>{video.speaker} · {video.company}</Text>
          <View style={vStyles.actions}>
            <View style={vStyles.views}>
              <Ionicons name="eye-outline" size={12} color={colors.textMuted} />
              <Text style={vStyles.viewsText}>{video.views} views</Text>
            </View>
            <TouchableOpacity
              style={vStyles.likeBtn}
              onPress={() => setLiked(!liked)}
            >
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={14}
                color={liked ? '#f43f5e' : colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity style={vStyles.shareBtn}>
              <Ionicons name="share-outline" size={14} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

interface PollCardProps {
  poll: typeof MOCK_POLLS[0];
}

function PollCard({ poll }: PollCardProps) {
  const { votedPolls, markPollVoted } = useAuth();
  const hasVoted = votedPolls.includes(poll.id);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleVote = (optId: string) => {
    if (hasVoted) return;
    setSelectedOption(optId);
    markPollVoted(poll.id);
  };

  return (
    <View style={pStyles.card}>
      {poll.sponsored && (
        <View style={pStyles.sponsoredRow}>
          <Ionicons name="star" size={10} color={colors.warning} />
          <Text style={pStyles.sponsoredText}>Sponsored by {poll.sponsor}</Text>
        </View>
      )}
      <Text style={pStyles.question}>{poll.question}</Text>
      <View style={pStyles.options}>
        {poll.options.map((opt) => {
          const pct = Math.round((opt.votes / poll.totalVotes) * 100);
          const isSelected = selectedOption === opt.id;
          const showResults = hasVoted;
          return (
            <TouchableOpacity
              key={opt.id}
              style={[pStyles.option, isSelected && pStyles.optionSelected]}
              onPress={() => handleVote(opt.id)}
              disabled={hasVoted}
              activeOpacity={0.7}
            >
              <View style={[pStyles.optionFill, { width: showResults ? `${pct}%` : '0%' }]} />
              <View style={pStyles.optionContent}>
                <Text style={[pStyles.optionText, isSelected && pStyles.optionTextSelected]}>
                  {opt.text}
                </Text>
                {showResults && (
                  <Text style={pStyles.optionPct}>{pct}%</Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={pStyles.totalVotes}>{poll.totalVotes.toLocaleString()} votes</Text>
    </View>
  );
}

export default function FeedScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState<'all' | 'videos' | 'polls'>('all');

  const filters: { key: typeof activeFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'videos', label: 'Sessions' },
    { key: 'polls', label: 'Polls' },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name?.split(' ')[0]} 👋</Text>
          <Text style={styles.subtitle}>Tech Summit 2026 · Day 1</Text>
        </View>
        <View style={styles.headerRight}>
          <View style={styles.pointsChip}>
            <Ionicons name="flash" size={12} color={colors.warning} />
            <Text style={styles.pointsText}>{user?.points ?? 0} pts</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn} onPress={() => router.push('/profile')}>
            <Text style={styles.profileBtnText}>{user?.name?.[0] ?? '?'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.filterRow}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterBtn, activeFilter === f.key && styles.filterBtnActive]}
            onPress={() => setActiveFilter(f.key)}
          >
            <Text style={[styles.filterText, activeFilter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {(activeFilter === 'all' || activeFilter === 'videos') && (
        <>
          <Text style={styles.sectionTitle}>Sessions</Text>
          {MOCK_VIDEOS.map((v) => <VideoCard key={v.id} video={v} />)}
        </>
      )}

      {(activeFilter === 'all' || activeFilter === 'polls') && (
        <>
          <Text style={styles.sectionTitle}>Live Polls</Text>
          {MOCK_POLLS.map((p) => <PollCard key={p.id} poll={p} />)}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.xl },
  greeting: { color: colors.textPrimary, fontSize: 22, fontWeight: '700' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  profileBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(124,58,237,0.3)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)', alignItems: 'center', justifyContent: 'center' },
  profileBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  pointsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  pointsText: { color: colors.warning, fontSize: 12, fontWeight: '700' },
  filterRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  filterBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
});

const vStyles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  thumbnail: {
    height: 160,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbInner: {
    alignItems: 'center',
    gap: spacing.md,
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  duration: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },
  liveBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: '#ef4444',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  meta: { flexDirection: 'row', padding: spacing.lg, gap: spacing.md },
  trackDot: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  info: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: 4 },
  speaker: { color: colors.textSecondary, fontSize: 12, marginBottom: spacing.md },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  views: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  viewsText: { color: colors.textMuted, fontSize: 11 },
  likeBtn: { padding: 4 },
  shareBtn: { padding: 4 },
});

const pStyles = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  sponsoredRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  sponsoredText: { color: colors.warning, fontSize: 10, fontWeight: '600' },
  question: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', lineHeight: 21, marginBottom: spacing.lg },
  options: { gap: spacing.sm },
  option: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    position: 'relative',
    minHeight: 44,
    justifyContent: 'center',
  },
  optionSelected: { borderColor: colors.primary },
  optionFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: 'rgba(124,58,237,0.15)',
  },
  optionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  optionText: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  optionTextSelected: { color: colors.textPrimary, fontWeight: '600' },
  optionPct: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  totalVotes: { color: colors.textMuted, fontSize: 11, marginTop: spacing.md },
});
