import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ImageBackground,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEvent } from '@/context/EventContext';
import { useEvents } from '@/hooks/useEvents';
import { useAudience } from '@/hooks/useAudience';
import { colors, spacing, radius } from '@/constants/theme';
import type { Attendee } from '@/lib/api/types';

const AVATAR_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#10b981',
  '#f59e0b', '#06b6d4', '#7c3aed', '#f43f5e',
  '#34d399', '#a78bfa', '#fb7185', '#38bdf8',
];

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? '?';
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

function AvatarView({ name, id, size }: { name: string; id: string; size: number }) {
  const bg = getAvatarColor(id);
  const initials = getInitials(name);
  const fontSize = size > 60 ? size * 0.34 : size * 0.38;
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg + '22', borderColor: bg + '55' }]}>
      <Text style={[styles.avatarText, { color: bg, fontSize }]}>{initials}</Text>
    </View>
  );
}

function DetailAvatarView({ name, id }: { name: string; id: string }) {
  const bg = getAvatarColor(id);
  return (
    <View style={[styles.detailAvatar, { backgroundColor: bg + '30', borderColor: bg + '70' }]}>
      <Text style={[styles.detailAvatarText, { color: bg }]}>{getInitials(name)}</Text>
    </View>
  );
}

function DetailRow({ icon, iconBg, label, value }: { icon: string; iconBg: string; label: string; value: string | null }) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailRowIcon, { backgroundColor: iconBg + '22' }]}>
        <Ionicons name={icon as any} size={16} color={iconBg} />
      </View>
      <View style={styles.detailRowContent}>
        <Text style={styles.detailRowLabel}>{label}</Text>
        <Text style={styles.detailRowValue}>{value || '—'}</Text>
      </View>
    </View>
  );
}

export default function AudienceScreen() {
  const insets = useSafeAreaInsets();
  const { currentEventId } = useEvent();
  const { data: events = [] } = useEvents();
  const currentEvent = events.find((e) => String(e.id) === String(currentEventId)) ?? null;

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Attendee | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const { data: members = [], isLoading, isError, error, refetch, isRefetching, loadMore, hasMore, isLoadingMore } = useAudience();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      m.name.toLowerCase().includes(q) ||
      m.company.toLowerCase().includes(q) ||
      (m.title ?? '').toLowerCase().includes(q),
    );
  }, [search, members]);

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const openProfile = useCallback((a: Attendee) => {
    setSelected(a);
    setDetailVisible(true);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailVisible(false);
    setTimeout(() => setSelected(null), 350);
  }, []);

  const ListHeader = useMemo(() => (
    <View>
      <ImageBackground
        source={currentEvent?.bannerUrl ? { uri: currentEvent.bannerUrl } : require('../../assets/splash.png')}
        style={styles.bannerBg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['rgba(7,7,15,0.2)', 'rgba(7,7,15,0.5)', 'rgba(7,7,15,0.85)']}
          style={styles.bannerGrad}
        >
          <View style={[styles.bannerContent, { paddingTop: insets.top + 16 }]}>
            <View style={styles.bannerLabel}>
              <Ionicons name="people-outline" size={14} color="rgba(255,255,255,0.7)" />
              <Text style={styles.bannerLabelText}>EVENT AUDIENCE</Text>
            </View>
            <Text style={styles.bannerTitle} numberOfLines={2}>
              {currentEvent?.name ?? 'Event Attendees'}
            </Text>
            <Text style={styles.bannerSubtitle}>Checked-in attendees</Text>
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <Ionicons name="checkmark-circle" size={14} color="#00c97a" />
                <Text style={[styles.statNum, { color: '#00c97a' }]}>{members.length}{hasMore ? '+' : ''}</Text>
                <Text style={styles.statLabel}>checked in</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </ImageBackground>

      <View style={styles.controls}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name, company, or title…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={(t) => setSearch(t)}
            autoCorrect={false}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.countLabel}>
          {filtered.length}{!search && hasMore ? '+' : ''} checked-in attendee{filtered.length !== 1 ? 's' : ''}
          {search ? ' found' : ''}
        </Text>
      </View>
    </View>
  ), [currentEvent, insets.top, members.length, hasMore, search, filtered.length]);

  const renderItem = useCallback(({ item }: { item: Attendee }) => (
    <TouchableOpacity style={styles.card} onPress={() => openProfile(item)} activeOpacity={0.75}>
      <AvatarView name={item.name} id={item.id} size={46} />
      <View style={styles.cardInfo}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        {item.title ? <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text> : null}
        {item.company ? (
          <View style={styles.cardCompanyRow}>
            <Ionicons name="business-outline" size={11} color={colors.textMuted} />
            <Text style={styles.cardCompany} numberOfLines={1}>{item.company}</Text>
          </View>
        ) : null}
        <View style={styles.checkedInBadge}>
          <Ionicons name="checkmark-circle" size={11} color="#00c97a" />
          <Text style={styles.checkedInText}>Checked in</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  ), [openProfile]);

  const ListFooter = useMemo(() => {
    if (isLoadingMore) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }
    if (hasMore) {
      return (
        <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} activeOpacity={0.7}>
          <Text style={styles.loadMoreText}>Load more</Text>
          <Ionicons name="chevron-down" size={14} color={colors.primary} />
        </TouchableOpacity>
      );
    }
    return null;
  }, [isLoadingMore, hasMore, loadMore]);

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.empty}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.emptyText}>Loading attendees…</Text>
            </View>
          ) : isError ? (
            <View style={styles.errorCard}>
              <View style={styles.errorIconWrap}>
                <Ionicons name="people-outline" size={44} color="#f87171" />
              </View>
              <Text style={styles.errorCardTitle}>Couldn't load audience</Text>
              <Text style={styles.errorCardMsg}>
                {(error as Error)?.message ?? 'Failed to load attendees. Please try again.'}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={16} color="#fff" />
                <Text style={styles.retryBtnText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.empty}>
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>
                {search ? 'No attendees match your search' : 'No checked-in attendees yet'}
              </Text>
            </View>
          )
        }
        keyboardShouldPersistTaps="handled"
      />

      <Modal
        visible={detailVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={closeDetail}
      >
        <StatusBar barStyle="light-content" />
        {selected && <AttendeeDetailView attendee={selected} onBack={closeDetail} insets={insets} />}
      </Modal>
    </View>
  );
}

function AttendeeDetailView({ attendee, onBack, insets }: {
  attendee: Attendee;
  onBack: () => void;
  insets: ReturnType<typeof import('react-native-safe-area-context').useSafeAreaInsets>;
}) {
  const bg = getAvatarColor(attendee.id);

  return (
    <View style={styles.detailRoot}>
      <LinearGradient
        colors={['#4C1D95', '#6D28D9', '#7C3AED']}
        style={[styles.detailHeader, { paddingTop: insets.top + 12 }]}
      >
        <TouchableOpacity style={styles.backBtn} onPress={onBack} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={18} color="#fff" />
          <Text style={styles.backText}>Audience</Text>
        </TouchableOpacity>

        <View style={styles.detailHero}>
          <DetailAvatarView name={attendee.name} id={attendee.id} />
          <Text style={styles.detailName}>{attendee.name}</Text>
          <Text style={styles.detailTitle}>{attendee.title || attendee.role}</Text>
          <View style={styles.checkedInPill}>
            <Ionicons name="checkmark-circle" size={13} color="#00c97a" />
            <Text style={styles.checkedInPillText}>Checked in</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView style={styles.detailBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        <Text style={styles.sectionTitle}>Profile Details</Text>
        <View style={styles.detailCard}>
          <DetailRow icon="person-outline" iconBg="#4F81FF" label="First Name" value={attendee.firstName} />
          <View style={styles.rowDivider} />
          <DetailRow icon="person-outline" iconBg="#4F81FF" label="Last Name" value={attendee.lastName} />
          <View style={styles.rowDivider} />
          <DetailRow icon="briefcase-outline" iconBg="#F97316" label="Job Title" value={attendee.title} />
          <View style={styles.rowDivider} />
          <DetailRow icon="business-outline" iconBg="#F97316" label="Company" value={attendee.company} />
          <View style={styles.rowDivider} />
          <DetailRow icon="globe-outline" iconBg="#4F81FF" label="Company Industry" value={attendee.industry} />
        </View>

        <Text style={styles.sectionTitle}>Introduction</Text>
        <View style={styles.detailCard}>
          <Text style={styles.bioText}>{attendee.bio || '—'}</Text>
        </View>

        {(attendee.interestedTopics.length > 0 || attendee.interests.length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Interested Topics</Text>
            <View style={styles.topicsWrap}>
              {[...new Set([...attendee.interestedTopics, ...attendee.interests])].map((t) => (
                <View key={t} style={styles.topicPill}>
                  <Text style={styles.topicText}>{t}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {(attendee.linkedinUrl || Object.keys(attendee.socialLinks).length > 0) && (
          <>
            <Text style={styles.sectionTitle}>Social Links</Text>
            <View style={styles.detailCard}>
              {attendee.linkedinUrl ? (
                <View style={styles.socialRow}>
                  <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
                  <Text style={styles.socialLabel} numberOfLines={1}>{attendee.linkedinUrl}</Text>
                </View>
              ) : null}
              {Object.entries(attendee.socialLinks).map(([k, v]) => (
                <View key={k} style={styles.socialRow}>
                  <Ionicons name="globe-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.socialLabel} numberOfLines={1}>{v}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  errorCard: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: spacing.xl, gap: spacing.md },
  errorIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#f8717120', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  errorCardTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  errorCardMsg: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, paddingHorizontal: spacing.lg },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.sm, paddingHorizontal: 24, paddingVertical: 13, borderRadius: radius.full, backgroundColor: colors.primary },
  retryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  bannerBg: { width: '100%', height: 200 },
  bannerGrad: { flex: 1 },
  bannerContent: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, justifyContent: 'flex-end' },
  bannerLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  bannerLabelText: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 1.4 },
  bannerTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginBottom: 4 },
  bannerSubtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 12 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statNum: { color: '#fff', fontSize: 16, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  controls: { paddingTop: spacing.lg },
  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.xl, paddingHorizontal: spacing.lg, paddingVertical: 11, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 0 },
  countLabel: { color: colors.textMuted, fontSize: 12, paddingHorizontal: spacing.xl, paddingTop: spacing.xs, paddingBottom: spacing.md },

  listContent: { gap: 0 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.lg, backgroundColor: colors.bgCard, borderBottomWidth: 1, borderBottomColor: colors.border },
  avatarCircle: { borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '700' },
  cardInfo: { flex: 1, minWidth: 0 },
  cardName: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  cardTitle: { color: colors.textSecondary, fontSize: 12, marginBottom: 2 },
  cardCompanyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 3 },
  cardCompany: { color: colors.textMuted, fontSize: 11, flex: 1 },
  checkedInBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  checkedInText: { color: '#00c97a', fontSize: 11, fontWeight: '600' },

  footer: { paddingVertical: 20, alignItems: 'center' },
  loadMoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 16, marginHorizontal: spacing.xl, marginVertical: spacing.md, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  loadMoreText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 64, gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', paddingHorizontal: spacing.xl },

  detailRoot: { flex: 1, backgroundColor: colors.bg },
  detailHeader: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  backText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  detailHero: { alignItems: 'center', gap: 8 },
  detailAvatar: { width: 84, height: 84, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginBottom: 4 },
  detailAvatarText: { fontSize: 30, fontWeight: '800' },
  detailName: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  detailTitle: { color: 'rgba(255,255,255,0.75)', fontSize: 14, textAlign: 'center' },
  checkedInPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(0,201,122,0.15)', borderWidth: 1, borderColor: 'rgba(0,201,122,0.3)' },
  checkedInPillText: { color: '#00c97a', fontSize: 12, fontWeight: '700' },

  detailBody: { flex: 1 },
  sectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginHorizontal: spacing.xl, marginTop: spacing.xl, marginBottom: spacing.sm },
  detailCard: { marginHorizontal: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: spacing.lg, paddingVertical: 14 },
  detailRowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  detailRowContent: { flex: 1 },
  detailRowLabel: { color: colors.textMuted, fontSize: 11, marginBottom: 2 },
  detailRowValue: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowDivider: { height: 1, backgroundColor: colors.border, marginLeft: spacing.lg + 34 + 12 },
  bioText: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, padding: spacing.lg },
  topicsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.xl },
  topicPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full, backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '30' },
  topicText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  socialRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.lg, paddingVertical: 12 },
  socialLabel: { color: colors.textSecondary, fontSize: 13, flex: 1 },
});
