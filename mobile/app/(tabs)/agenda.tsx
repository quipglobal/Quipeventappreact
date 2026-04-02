import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useAgenda, useBookmarkSession } from '@/hooks/useAgenda';
import { DataState } from '@/components/DataState';
import { colors, spacing, radius, typography } from '@/constants/theme';

const { height: SH } = Dimensions.get('window');

type Session = {
  id: string; day: number; time: string; duration: string;
  title: string; speaker: string; company: string;
  track: string; color: string; room: string;
  description: string; tags: string[];
};

const DAYS = ['Jan 16', 'Jan 17', 'Jan 18'];
const TRACK_FILTERS = ['All', 'Main Stage', 'Engineering', 'AI/ML', 'Design', 'Startups', 'Workshops'];

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const { bookmarkedSessions, toggleBookmark, showToast } = useAuth();
  const [activeDay, setActiveDay] = useState(0);
  const [trackFilter, setTrackFilter] = useState('All');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { data: allSessions = [], isLoading, isError, refetch } = useAgenda();
  const { mutate: bookmarkSession } = useBookmarkSession();

  const sessions = useMemo(() => allSessions.map((s) => ({
    id: s.id,
    day: (s.day ?? 1) - 1,
    time: s.startTime,
    duration: '',
    title: s.title,
    speaker: s.speaker,
    company: s.speakerCompany ?? '',
    track: s.track,
    color: s.accentColor ?? '#7c3aed',
    room: s.room,
    description: s.description ?? '',
    tags: s.tags ?? [],
  })).filter((s) => s.day === activeDay && (trackFilter === 'All' || s.track === trackFilter)), [allSessions, activeDay, trackFilter]);

  const openSession = useCallback((s: Session) => {
    setSelectedSession(s);
    setSheetVisible(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => setSelectedSession(null), 300);
  }, []);

  const handleBookmark = useCallback((id: string) => {
    const isBookmarked = bookmarkedSessions.includes(id);
    toggleBookmark(id);
    bookmarkSession({ sessionId: id, bookmarked: !isBookmarked });
    showToast(isBookmarked ? 'Removed from bookmarks' : 'Session bookmarked!');
  }, [bookmarkedSessions, toggleBookmark, showToast, bookmarkSession]);

  const renderSession = useCallback(({ item }: { item: Session }) => {
    const bookmarked = bookmarkedSessions.includes(item.id);
    return (
      <TouchableOpacity style={styles.sessionCard} onPress={() => openSession(item)} activeOpacity={0.78}>
        <View style={[styles.trackBar, { backgroundColor: item.color }]} />
        <View style={styles.sessionBody}>
          <View style={styles.sessionMeta}>
            <Text style={styles.sessionTime}>{item.time}</Text>
            <Text style={styles.sessionDur}>{item.duration}</Text>
            <View style={[styles.trackBadge, { backgroundColor: item.color + '18', borderColor: item.color + '40' }]}>
              <Text style={[styles.trackBadgeText, { color: item.color }]}>{item.track}</Text>
            </View>
          </View>
          <Text style={styles.sessionTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.sessionFooter}>
            <View style={styles.speakerRow}>
              <View style={[styles.speakerAvatar, { backgroundColor: item.color + '25' }]}>
                <Text style={[styles.speakerAvatarText, { color: item.color }]}>{item.speaker[0]}</Text>
              </View>
              <Text style={styles.sessionSpeaker}>{item.speaker}</Text>
            </View>
            <TouchableOpacity
              style={styles.bookmarkBtn}
              onPress={() => handleBookmark(item.id)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={bookmarked ? 'bookmark' : 'bookmark-outline'}
                size={18}
                color={bookmarked ? '#f59e0b' : colors.textMuted}
              />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [bookmarkedSessions, handleBookmark, openSession]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Agenda</Text>

        <View style={styles.dayTabs}>
          {DAYS.map((day, i) => (
            <TouchableOpacity
              key={day}
              style={[styles.dayTab, activeDay === i && styles.dayTabActive]}
              onPress={() => setActiveDay(i)}
            >
              <Text style={[styles.dayTabText, activeDay === i && styles.dayTabTextActive]}>{day}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trackFilters}>
          {TRACK_FILTERS.map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.trackChip, trackFilter === t && styles.trackChipActive]}
              onPress={() => setTrackFilter(t)}
            >
              <Text style={[styles.trackChipText, trackFilter === t && styles.trackChipTextActive]}>{t}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <DataState
        loading={isLoading}
        error={isError ? 'Failed to load sessions. Check your connection.' : null}
        onRetry={refetch}
      />
      {!isLoading && !isError && (<>
      <FlatList
        data={sessions}
        keyExtractor={(s) => s.id}
        renderItem={renderSession}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No sessions for this track</Text>
          </View>
        }
      />

      <Modal visible={sheetVisible} animationType="slide" transparent onRequestClose={closeSheet}>
        <>
        <TouchableOpacity style={styles.backdrop} onPress={closeSheet} activeOpacity={1} />
        {selectedSession && (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />
            <LinearGradient colors={[selectedSession.color + '30', '#0e0e1a']} style={styles.sheetHero}>
              <View style={styles.sheetTopRow}>
                <View style={[styles.sheetTrackBadge, { backgroundColor: selectedSession.color + '20', borderColor: selectedSession.color + '50' }]}>
                  <Text style={[styles.sheetTrackText, { color: selectedSession.color }]}>{selectedSession.track}</Text>
                </View>
                <TouchableOpacity onPress={() => handleBookmark(selectedSession.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons
                    name={bookmarkedSessions.includes(selectedSession.id) ? 'bookmark' : 'bookmark-outline'}
                    size={22}
                    color={bookmarkedSessions.includes(selectedSession.id) ? '#f59e0b' : colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
              <Text style={styles.sheetTitle}>{selectedSession.title}</Text>
              <View style={styles.sheetMetaRow}>
                <Ionicons name="time-outline" size={14} color={colors.textMuted} />
                <Text style={styles.sheetMeta}>{selectedSession.time} · {selectedSession.duration}</Text>
                <Ionicons name="location-outline" size={14} color={colors.textMuted} />
                <Text style={styles.sheetMeta}>{selectedSession.room}</Text>
              </View>
            </LinearGradient>

            <ScrollView style={styles.sheetBody}>
              <View style={styles.sheetSpeakerRow}>
                <View style={[styles.sheetSpeakerAvatar, { backgroundColor: selectedSession.color + '25' }]}>
                  <Text style={[styles.sheetSpeakerInitial, { color: selectedSession.color }]}>{selectedSession.speaker[0]}</Text>
                </View>
                <View>
                  <Text style={styles.sheetSpeakerName}>{selectedSession.speaker}</Text>
                  <Text style={styles.sheetSpeakerCompany}>{selectedSession.company}</Text>
                </View>
              </View>

              <Text style={styles.sheetDesc}>{selectedSession.description}</Text>

              <View style={styles.sheetTags}>
                {selectedSession.tags.map((tag) => (
                  <View key={tag} style={styles.sheetTag}>
                    <Text style={styles.sheetTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>
        )}
        </>
      </Modal>
      </>)}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  pageTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: spacing.lg },

  dayTabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  dayTab: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  dayTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  dayTabTextActive: { color: '#fff' },

  trackFilters: { gap: spacing.sm, paddingBottom: spacing.md },
  trackChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  trackChipActive: { backgroundColor: 'rgba(124,58,237,0.18)', borderColor: colors.primary },
  trackChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  trackChipTextActive: { color: colors.primary },

  list: { paddingHorizontal: spacing.xl, paddingBottom: 100, gap: spacing.md },
  sessionCard: { flexDirection: 'row', borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  trackBar: { width: 4 },
  sessionBody: { flex: 1, padding: spacing.lg },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sessionTime: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  sessionDur: { color: colors.textMuted, fontSize: 11 },
  trackBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1 },
  trackBadgeText: { fontSize: 10, fontWeight: '700' },
  sessionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: spacing.md },
  sessionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speakerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  speakerAvatar: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  speakerAvatarText: { fontSize: 10, fontWeight: '700' },
  sessionSpeaker: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  bookmarkBtn: { padding: 4 },

  empty: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 14 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: { backgroundColor: '#0e0e1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SH * 0.8 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginTop: 12 },
  sheetHero: { padding: spacing.xl },
  sheetTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sheetTrackBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  sheetTrackText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sheetTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', lineHeight: 26, marginBottom: spacing.md },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sheetMeta: { color: colors.textMuted, fontSize: 12 },
  sheetBody: { padding: spacing.xl },
  sheetSpeakerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.lg },
  sheetSpeakerAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sheetSpeakerInitial: { fontSize: 16, fontWeight: '700' },
  sheetSpeakerName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  sheetSpeakerCompany: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  sheetDesc: { color: colors.textSecondary, fontSize: 14, lineHeight: 22, marginBottom: spacing.lg },
  sheetTags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  sheetTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: colors.border },
  sheetTagText: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
});
