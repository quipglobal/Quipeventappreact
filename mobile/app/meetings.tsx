import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useMeetings, useRespondToMeeting, useSendMeetingRequest } from '@/hooks/useMeetings';
import { useAudience } from '@/hooks/useAudience';
import { DataState } from '@/components/DataState';
import { colors, spacing, radius, typography } from '@/constants/theme';

const { height: SH } = Dimensions.get('window');

type MeetingStatus = 'pending' | 'confirmed' | 'declined';
type Meeting = {
  id: string;
  with: string;
  company: string;
  title: string;
  color: string;
  time: string;
  date: string;
  location: string;
  note: string;
  direction: 'incoming' | 'outgoing';
  status: MeetingStatus;
};

const STATUS_COLORS: Record<MeetingStatus, string> = {
  pending: '#f59e0b',
  confirmed: '#10b981',
  declined: '#ef4444',
};

const FALLBACK_ATTENDEES = [
  { id: 'a1', name: 'Dr. Sarah Chen', title: 'Chief AI Officer', company: 'TechCorp Solutions', color: '#6366f1' },
  { id: 'a2', name: 'Marcus Johnson', title: 'VP Engineering', company: 'InnovateLab', color: '#8b5cf6' },
  { id: 'a3', name: 'Priya Patel', title: 'Product Lead', company: 'DesignFlow', color: '#ec4899' },
];

export default function MeetingsScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useAuth();
  const [tab, setTab] = useState<'all' | 'incoming' | 'outgoing'>('all');
  const [requestVisible, setRequestVisible] = useState(false);
  const [reqAttendeeId, setReqAttendeeId] = useState<string | null>(null);
  const [reqTime, setReqTime] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqLocation, setReqLocation] = useState('');

  const { data: meetingsData = [], isLoading, isError, refetch } = useMeetings();
  const { mutate: respond } = useRespondToMeeting();
  const { mutate: sendRequest } = useSendMeetingRequest();
  const { data: audienceData = [] } = useAudience();
  const attendees = audienceData.length > 0
    ? audienceData.map((a) => ({ id: a.id, name: a.name, title: a.title, company: a.company, color: '#7c3aed' }))
    : FALLBACK_ATTENDEES;

  const meetings = useMemo(() => meetingsData.map((m) => ({
    id: m.id,
    with: m.attendee.name,
    company: m.attendee.company,
    title: m.attendee.title,
    color: '#7c3aed',
    time: m.proposedTime ?? '',
    date: new Date(m.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    location: 'TBD',
    note: m.message ?? '',
    direction: m.type as 'incoming' | 'outgoing',
    status: (m.status === 'accepted' ? 'confirmed' : m.status) as MeetingStatus,
  })), [meetingsData]);

  const filtered = useMemo(() => meetings.filter((m) => tab === 'all' || m.direction === tab), [meetings, tab]);

  const handleAccept = useCallback((id: string) => {
    respond({ meetingId: id, action: 'accept' });
    showToast('Meeting confirmed!', 20);
  }, [showToast, respond]);

  const handleDecline = useCallback((id: string) => {
    Alert.alert('Decline Meeting', 'Are you sure you want to decline this meeting?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Decline', style: 'destructive', onPress: () => {
        respond({ meetingId: id, action: 'decline' });
      }},
    ]);
  }, [respond]);

  const handleSendRequest = useCallback(() => {
    const selectedId = reqAttendeeId ?? attendees[0]?.id;
    if (!selectedId) { Alert.alert('Select an attendee'); return; }
    if (!reqTime.trim()) { Alert.alert('Add a time preference'); return; }
    sendRequest({ attendeeId: selectedId, proposedTime: reqTime, message: reqNote }, {
      onSuccess: () => refetch(),
    });
    setRequestVisible(false);
    setReqAttendeeId(null);
    setReqTime('');
    setReqNote('');
    setReqLocation('');
    showToast('Meeting request sent!', 15);
  }, [reqAttendeeId, attendees, reqTime, reqNote, reqLocation, showToast, sendRequest, refetch]);

  const renderMeeting = useCallback(({ item }: { item: Meeting }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.avatar, { backgroundColor: item.color + '25', borderColor: item.color + '55' }]}>
          <Text style={[styles.avatarText, { color: item.color }]}>{item.with[0]}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.with}</Text>
          <Text style={styles.cardRole}>{item.title} · {item.company}</Text>
          <View style={styles.cardMeta}>
            <Ionicons name="time-outline" size={11} color={colors.textMuted} />
            <Text style={styles.cardMetaText}>{item.date} · {item.time}</Text>
            <Ionicons name="location-outline" size={11} color={colors.textMuted} />
            <Text style={styles.cardMetaText}>{item.location}</Text>
          </View>
        </View>
        <View style={styles.badges}>
          <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20', borderColor: STATUS_COLORS[item.status] + '50' }]}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>{item.status.charAt(0).toUpperCase() + item.status.slice(1)}</Text>
          </View>
          <View style={[styles.dirBadge, { backgroundColor: item.direction === 'incoming' ? 'rgba(124,58,237,0.15)' : 'rgba(6,182,212,0.12)' }]}>
            <Text style={[styles.dirText, { color: item.direction === 'incoming' ? colors.primary : colors.accent }]}>
              {item.direction === 'incoming' ? '← In' : '→ Out'}
            </Text>
          </View>
        </View>
      </View>

      {item.note.length > 0 && (
        <Text style={styles.cardNote} numberOfLines={2}>{item.note}</Text>
      )}

      {item.direction === 'incoming' && item.status === 'pending' && (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.declineBtn} onPress={() => handleDecline(item.id)}>
            <Ionicons name="close" size={14} color="#ef4444" />
            <Text style={styles.declineBtnText}>Decline</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)}>
            <Ionicons name="checkmark" size={14} color="#fff" />
            <Text style={styles.acceptBtnText}>Accept</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  ), [handleAccept, handleDecline]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Meetings</Text>
        <TouchableOpacity style={styles.fabSmall} onPress={() => setRequestVisible(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(['all', 'incoming', 'outgoing'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <DataState
        loading={isLoading}
        error={isError ? 'Failed to load meetings. Check your connection.' : null}
        onRetry={refetch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        renderItem={renderMeeting}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="calendar-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No meetings yet</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => setRequestVisible(true)}>
              <Text style={styles.emptyBtnText}>Request a Meeting</Text>
            </TouchableOpacity>
          </View>
        }
      />

      <Modal visible={requestVisible} animationType="slide" transparent onRequestClose={() => setRequestVisible(false)}>
        <TouchableOpacity style={styles.backdrop} onPress={() => setRequestVisible(false)} activeOpacity={1} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Request a Meeting</Text>

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.sheetLabel}>WITH</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attendeeRow}>
              {attendees.map((a) => {
                const isSelected = (reqAttendeeId ?? attendees[0]?.id) === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.attendeeChip, isSelected && styles.attendeeChipActive]}
                    onPress={() => setReqAttendeeId(a.id)}
                  >
                    <View style={[styles.chipAvatar, { backgroundColor: a.color + '25' }]}>
                      <Text style={[styles.chipAvatarText, { color: a.color }]}>{a.name[0]}</Text>
                    </View>
                    <Text style={[styles.chipName, isSelected && styles.chipNameActive]}>{a.name.split(' ')[0]}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.sheetLabel}>TIME PREFERENCE</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 2:00 PM, Jan 16"
              placeholderTextColor={colors.textMuted}
              value={reqTime}
              onChangeText={setReqTime}
            />

            <Text style={styles.sheetLabel}>LOCATION (OPTIONAL)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Booth A-12, Coffee Station"
              placeholderTextColor={colors.textMuted}
              value={reqLocation}
              onChangeText={setReqLocation}
            />

            <Text style={styles.sheetLabel}>NOTE (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, styles.inputMulti]}
              placeholder="What would you like to discuss?"
              placeholderTextColor={colors.textMuted}
              value={reqNote}
              onChangeText={setReqNote}
              multiline
              numberOfLines={3}
            />

            <TouchableOpacity style={styles.sendBtn} onPress={handleSendRequest}>
              <Ionicons name="send" size={16} color="#fff" />
              <Text style={styles.sendBtnText}>Send Request</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },
  fabSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: 'rgba(124,58,237,0.18)', borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: colors.primary },

  list: { padding: spacing.xl, paddingBottom: 100, gap: spacing.md },
  card: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  cardTop: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.sm },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  cardInfo: { flex: 1 },
  cardName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  cardRole: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  cardMetaText: { color: colors.textMuted, fontSize: 11, marginRight: 6 },
  badges: { gap: 6, alignItems: 'flex-end' },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1 },
  statusText: { fontSize: 10, fontWeight: '700' },
  dirBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.full },
  dirText: { fontSize: 10, fontWeight: '600' },
  cardNote: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginBottom: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  declineBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)' },
  declineBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },
  acceptBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: '#10b981' },
  acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  empty: { alignItems: 'center', paddingVertical: 64, gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  emptyBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: radius.full, backgroundColor: colors.primary },
  emptyBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#0e0e1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SH * 0.85, paddingHorizontal: spacing.xl },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.18)', alignSelf: 'center', marginTop: 12, marginBottom: spacing.lg },
  sheetTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: spacing.xl },
  sheetLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: spacing.sm, marginTop: spacing.md },
  attendeeRow: { gap: spacing.sm, paddingBottom: spacing.md },
  attendeeChip: { alignItems: 'center', gap: 5, padding: 10, borderRadius: radius.lg, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, minWidth: 70 },
  attendeeChipActive: { borderColor: colors.primary, backgroundColor: 'rgba(124,58,237,0.12)' },
  chipAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  chipAvatarText: { fontSize: 13, fontWeight: '700' },
  chipName: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  chipNameActive: { color: colors.primary },
  input: { borderRadius: radius.lg, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.textPrimary, fontSize: 14, marginBottom: spacing.md },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  sendBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 14, borderRadius: radius.xl, backgroundColor: colors.primary, marginTop: spacing.md, marginBottom: spacing.xl },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
