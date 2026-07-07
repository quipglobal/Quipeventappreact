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
  Dimensions,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useAudience } from '@/hooks/useAudience';
import { DataState } from '@/components/DataState';
import { colors, spacing, radius, typography } from '@/constants/theme';
import type { Attendee } from '@/lib/api/types';

const { height: SH } = Dimensions.get('window');

const FILTER_TIERS = ['All', 'Platinum', 'Gold', 'Silver', 'Bronze'];
const TIER_COLORS: Record<string, string> = { Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700', Platinum: '#e5e4e2' };

const AVATAR_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#7c3aed', '#f43f5e', '#34d399', '#a78bfa'];
function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export default function AudienceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('All');
  const [selected, setSelected] = useState<Attendee | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { data: attendeesData = [], isLoading, isError, refetch } = useAudience();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return attendeesData.filter((a) => {
      const matchSearch =
        a.name.toLowerCase().includes(q) ||
        a.company.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q);
      const matchTier = filterTier === 'All' || a.tier === filterTier;
      return matchSearch && matchTier;
    });
  }, [search, filterTier, attendeesData]);

  const openProfile = useCallback((a: Attendee) => {
    setSelected(a);
    setSheetVisible(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => setSelected(null), 300);
  }, []);

  const renderItem = useCallback(({ item }: { item: Attendee }) => {
    return (
      <TouchableOpacity style={styles.card} onPress={() => openProfile(item)} activeOpacity={0.75}>
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.id) + '25', borderColor: getAvatarColor(item.id) + '55' }]}>
          <Text style={[styles.avatarText, { color: getAvatarColor(item.id) }]}>{item.name[0]}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[item.tier] ?? colors.textMuted }]} />
          </View>
          <Text style={styles.role}>{item.title}</Text>
          <Text style={styles.company}>{item.company}</Text>
        </View>
      </TouchableOpacity>
    );
  }, [openProfile]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Audience</Text>
        <Text style={styles.subtitle}>{attendeesData.length > 0 ? `${attendeesData.length} attendees at this event` : 'Event Attendees'}</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} style={{ marginRight: spacing.sm }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, company or title…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTER_TIERS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filterChip, filterTier === t && styles.filterChipActive]}
            onPress={() => setFilterTier(t)}
          >
            {t !== 'All' && <View style={[styles.chipDot, { backgroundColor: TIER_COLORS[t] }]} />}
            <Text style={[styles.filterChipText, filterTier === t && styles.filterChipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <DataState
        loading={isLoading}
        error={isError ? 'Failed to load attendees. Check your connection.' : null}
        onRetry={refetch}
      />

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No attendees found</Text>
          </View>
        }
        keyboardShouldPersistTaps="handled"
      />

      <Modal
        visible={sheetVisible}
        animationType="slide"
        transparent
        onRequestClose={closeSheet}
      >
        <TouchableOpacity style={styles.backdrop} onPress={closeSheet} activeOpacity={1} />
        {selected && (
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.sheetHandle} />

            <LinearGradient colors={['#1a0d2e', '#0d1a2e']} style={styles.sheetHero}>
              <View style={[styles.sheetAvatar, { backgroundColor: getAvatarColor(selected.id) + '30', borderColor: getAvatarColor(selected.id) + '80' }]}>
                <Text style={[styles.sheetAvatarText, { color: getAvatarColor(selected.id) }]}>{selected.name[0]}</Text>
              </View>
              <Text style={styles.sheetName}>{selected.name}</Text>
              <Text style={styles.sheetTitle}>{selected.title} · {selected.company}</Text>
              <View style={[styles.tierBadge, { borderColor: TIER_COLORS[selected.tier] + '60', backgroundColor: TIER_COLORS[selected.tier] + '15' }]}>
                <Text style={[styles.tierBadgeText, { color: TIER_COLORS[selected.tier] }]}>{selected.tier} Member</Text>
              </View>
            </LinearGradient>

            <ScrollView style={styles.sheetBody} showsVerticalScrollIndicator={false}>
              <Text style={styles.sheetBio}>{selected.bio}</Text>

              <Text style={styles.sheetSectionTitle}>INTERESTS</Text>
              <View style={styles.interests}>
                {selected.interests.map((i) => (
                  <View key={i} style={styles.interest}>
                    <Text style={styles.interestText}>{i}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.sheetActions}>
                <TouchableOpacity style={styles.sheetActionBtn}>
                  <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.sheetActionGrad}>
                    <Ionicons name="person-add" size={16} color="#fff" />
                    <Text style={styles.sheetActionText}>Connect</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetIconBtn}>
                  <Ionicons name="mail-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetIconBtn}>
                  <Ionicons name="calendar-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  pageTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  searchWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  searchInput: { flex: 1, color: colors.textPrimary, fontSize: 14, paddingVertical: 0 },

  filterRow: { paddingHorizontal: spacing.xl, gap: spacing.sm, paddingBottom: spacing.md },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 7, borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  filterChipActive: { backgroundColor: colors.primary + '20', borderColor: colors.primary },
  filterChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: colors.primary },
  chipDot: { width: 6, height: 6, borderRadius: 3 },

  list: { paddingHorizontal: spacing.xl, paddingBottom: 100, gap: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  tierDot: { width: 7, height: 7, borderRadius: 3.5 },
  role: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  company: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  empty: { alignItems: 'center', paddingVertical: 64, gap: spacing.md },
  emptyText: { color: colors.textMuted, fontSize: 14 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: { backgroundColor: '#0e0e1a', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: SH * 0.82 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetHero: { padding: spacing.xl, alignItems: 'center', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  sheetAvatar: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 2, marginBottom: spacing.md },
  sheetAvatarText: { fontSize: 28, fontWeight: '800' },
  sheetName: { color: colors.textPrimary, fontSize: 20, fontWeight: '800', marginBottom: 4 },
  sheetTitle: { color: colors.textSecondary, fontSize: 13, marginBottom: spacing.md },
  tierBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  tierBadgeText: { fontSize: 12, fontWeight: '700' },
  sheetBody: { padding: spacing.xl },
  sheetBio: { color: colors.textSecondary, fontSize: 14, lineHeight: 21, marginBottom: spacing.xl },
  sheetSectionTitle: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: spacing.sm },
  interests: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  interest: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, backgroundColor: 'rgba(124,58,237,0.12)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },
  interestText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'center' },
  sheetActionBtn: { flex: 1, height: 48, borderRadius: radius.xl, overflow: 'hidden' },
  sheetActionGrad: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sheetActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sheetIconBtn: { width: 48, height: 48, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
