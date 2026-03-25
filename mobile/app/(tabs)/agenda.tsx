import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius, typography } from '@/constants/theme';

const MOCK_SESSIONS = [
  { id: 's1', time: '9:00 AM', duration: '60 min', title: 'Opening Keynote: The Future of AI', speaker: 'Dr. Sarah Chen', company: 'TechCorp Solutions', track: 'Main Stage', color: colors.primary },
  { id: 's2', time: '10:30 AM', duration: '45 min', title: 'Scaling Engineering Teams in a Remote World', speaker: 'Marcus Johnson', company: 'InnovateLab', track: 'Engineering', color: '#06b6d4' },
  { id: 's3', time: '11:30 AM', duration: '30 min', title: 'UX Research That Actually Influences Product', speaker: 'Priya Patel', company: 'DesignFlow', track: 'Design', color: '#ec4899' },
  { id: 's4', time: '2:00 PM', duration: '60 min', title: 'ML Applications in Enterprise Products', speaker: 'Elena Rodriguez', company: 'QuantumLeap AI', track: 'AI/ML', color: '#10b981' },
  { id: 's5', time: '3:30 PM', duration: '45 min', title: 'Cloud Infrastructure for Startups', speaker: 'James Wilson', company: 'CloudNine Systems', track: 'Engineering', color: '#f59e0b' },
];

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const { bookmarkedSessions, toggleBookmark } = useAuth();
  const [activeDay, setActiveDay] = useState(0);

  const days = ['Jan 16', 'Jan 17', 'Jan 18'];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Agenda</Text>

      <View style={styles.dayTabs}>
        {days.map((day, i) => (
          <TouchableOpacity
            key={day}
            style={[styles.dayTab, activeDay === i && styles.dayTabActive]}
            onPress={() => setActiveDay(i)}
          >
            <Text style={[styles.dayTabText, activeDay === i && styles.dayTabTextActive]}>{day}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {MOCK_SESSIONS.map((session) => {
        const bookmarked = bookmarkedSessions.includes(session.id);
        return (
          <View key={session.id} style={styles.sessionCard}>
            <View style={[styles.trackBar, { backgroundColor: session.color }]} />
            <View style={styles.sessionBody}>
              <View style={styles.sessionMeta}>
                <Text style={styles.sessionTime}>{session.time}</Text>
                <Text style={styles.sessionDuration}>{session.duration}</Text>
                <View style={styles.trackBadge}>
                  <Text style={styles.trackBadgeText}>{session.track}</Text>
                </View>
              </View>
              <Text style={styles.sessionTitle}>{session.title}</Text>
              <View style={styles.sessionFooter}>
                <Text style={styles.sessionSpeaker}>{session.speaker} · {session.company}</Text>
                <TouchableOpacity onPress={() => toggleBookmark(session.id)} style={styles.bookmarkBtn}>
                  <Text style={[styles.bookmarkIcon, bookmarked && { color: colors.warning }]}>
                    {bookmarked ? '🔖' : '📌'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.xl, paddingBottom: 100 },
  pageTitle: { color: colors.textPrimary, ...typography.h1, marginBottom: spacing.lg },
  dayTabs: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  dayTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayTabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayTabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  dayTabTextActive: { color: '#fff' },
  sessionCard: {
    flexDirection: 'row',
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  trackBar: { width: 4 },
  sessionBody: { flex: 1, padding: spacing.lg },
  sessionMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  sessionTime: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  sessionDuration: { color: colors.textMuted, fontSize: 11 },
  trackBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  trackBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
  sessionTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', lineHeight: 20, marginBottom: spacing.sm },
  sessionFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sessionSpeaker: { color: colors.textSecondary, fontSize: 12, flex: 1 },
  bookmarkBtn: { padding: 4 },
  bookmarkIcon: { fontSize: 16, color: colors.textMuted },
});
