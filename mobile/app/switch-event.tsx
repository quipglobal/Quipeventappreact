import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvents, useJoinEvent } from '@/hooks/useEvents';
import { DataState } from '@/components/DataState';
import { colors, spacing, radius } from '@/constants/theme';

export default function SwitchEventScreen() {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');

  const { data: events = [], isLoading: eventsLoading, isError: eventsError, refetch } = useEvents();
  const { mutate: joinEvent, isPending: joining } = useJoinEvent();

  const handleJoin = () => {
    if (!code.trim()) { Alert.alert('Enter an event code'); return; }
    joinEvent(code.trim(), {
      onSuccess: (res) => {
        const event = res.data;
        Alert.alert('Event Joined!', `You have joined "${event?.name}".`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      },
      onError: (err) => {
        Alert.alert('Event Not Found', err.message ?? `No event found for code "${code.toUpperCase()}".`);
      },
    });
  };

  const handleSelectEvent = (event: NonNullable<typeof events>[0]) => {
    if (event.status === 'live') {
      Alert.alert('Already Here', 'You are currently in this event.');
      return;
    }
    Alert.alert('Switch Event', `Switch to "${event.name}"?\n\nYou can switch back at any time.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', onPress: () => router.back() },
    ]);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Switch Event</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.hero}>
            <View style={styles.heroIcon}>
              <Ionicons name="swap-horizontal" size={32} color={colors.primary} />
            </View>
            <Text style={styles.heroTitle}>Join a Different Event</Text>
            <Text style={styles.heroSub}>Enter your event code to access a new event, or select from your events below.</Text>
          </View>

          <Text style={styles.label}>EVENT CODE</Text>
          <View style={styles.codeRow}>
            <TextInput
              style={styles.codeInput}
              placeholder="e.g. CXOSUMMIT26"
              placeholderTextColor={colors.textMuted}
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleJoin}
            />
            <TouchableOpacity
              style={[styles.joinBtn, joining && { opacity: 0.6 }]}
              onPress={handleJoin}
              disabled={joining}
            >
              {joining
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.joinBtnText}>Join</Text>
              }
            </TouchableOpacity>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>OR</Text>
            <View style={styles.dividerLine} />
          </View>

          <Text style={styles.label}>YOUR EVENTS</Text>

          <DataState
            loading={eventsLoading}
            error={eventsError ? 'Failed to load events.' : null}
            onRetry={refetch}
          />

          <View style={styles.eventsList}>
            {events.map((event) => {
              const isActive = event.status === 'live';
              return (
                <TouchableOpacity
                  key={event.id}
                  style={[styles.eventCard, isActive && styles.eventCardActive]}
                  onPress={() => handleSelectEvent(event)}
                  activeOpacity={0.75}
                >
                  <View style={styles.eventLeft}>
                    <View style={[styles.eventIcon, { backgroundColor: isActive ? colors.primary + '25' : 'rgba(255,255,255,0.06)' }]}>
                      <Ionicons name="calendar" size={18} color={isActive ? colors.primary : colors.textMuted} />
                    </View>
                    <View style={styles.eventInfo}>
                      <View style={styles.eventNameRow}>
                        <Text style={styles.eventName} numberOfLines={1}>{event.name}</Text>
                        {isActive && (
                          <View style={styles.activeBadge}>
                            <Text style={styles.activeBadgeText}>CURRENT</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.eventDate}>{event.startDate} – {event.endDate}</Text>
                      <Text style={styles.eventLocation}>{event.location}</Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={isActive ? colors.primary : colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  content: { padding: spacing.xl, paddingBottom: 60 },

  hero: { alignItems: 'center', paddingVertical: spacing.xl, marginBottom: spacing.xl },
  heroIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  heroTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: spacing.sm, textAlign: 'center' },
  heroSub: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  label: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: spacing.sm },
  codeRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  codeInput: {
    flex: 1,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
  },
  joinBtn: { paddingHorizontal: 24, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', minWidth: 64 },
  joinBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },

  eventsList: { gap: spacing.sm },
  eventCard: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  eventCardActive: { borderColor: colors.primary + '60', backgroundColor: 'rgba(124,58,237,0.06)' },
  eventLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  eventIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1 },
  eventNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  eventName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  activeBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)' },
  activeBadgeText: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  eventDate: { color: colors.textSecondary, fontSize: 12, marginTop: 3 },
  eventLocation: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
