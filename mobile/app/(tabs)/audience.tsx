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
import { colors, spacing, radius, typography } from '@/constants/theme';

const { height: SH } = Dimensions.get('window');

const MOCK_ATTENDEES = [
  { id: '1', name: 'Dr. Sarah Chen', title: 'Chief AI Officer', company: 'TechCorp Solutions', color: '#6366f1', tier: 'Platinum', interests: ['AI', 'Leadership'], bio: 'Pioneering AI research at TechCorp. Speaker at 30+ global conferences.' },
  { id: '2', name: 'Marcus Johnson', title: 'VP of Engineering', company: 'InnovateLab', color: '#8b5cf6', tier: 'Gold', interests: ['Engineering', 'Remote Work'], bio: 'Building distributed engineering teams across 3 continents.' },
  { id: '3', name: 'Priya Patel', title: 'Product Lead', company: 'DesignFlow', color: '#ec4899', tier: 'Silver', interests: ['Design', 'Product', 'UX'], bio: 'Transforming complex workflows into delightful user experiences.' },
  { id: '4', name: 'Elena Rodriguez', title: 'Head of Data Science', company: 'QuantumLeap AI', color: '#10b981', tier: 'Gold', interests: ['ML', 'Data', 'Analytics'], bio: 'ML models that power real-time decisions for Fortune 500s.' },
  { id: '5', name: 'James Wilson', title: 'CTO', company: 'CloudNine Systems', color: '#f59e0b', tier: 'Gold', interests: ['Cloud', 'Infrastructure', 'Startups'], bio: 'Scaling cloud infrastructure from 0 to 100M users.' },
  { id: '6', name: 'Aisha Kamara', title: 'Growth Director', company: 'Launchpad Inc', color: '#06b6d4', tier: 'Platinum', interests: ['Growth', 'Marketing', 'B2B'], bio: 'Growth hacker who turned 3 startups into unicorns.' },
  { id: '7', name: 'Dev Sharma', title: 'Principal Engineer', company: 'Nexus Labs', color: '#7c3aed', tier: 'Gold', interests: ['Distributed Systems', 'OSS'], bio: 'Open source contributor and distributed systems enthusiast.' },
  { id: '8', name: 'Lena Fischer', title: 'UX Director', company: 'Designly', color: '#f43f5e', tier: 'Silver', interests: ['UX', 'Design Systems'], bio: 'Design systems architect passionate about accessibility.' },
  { id: '9', name: 'Omar Hassan', title: 'CFO', company: 'Momentum Capital', color: '#34d399', tier: 'Silver', interests: ['Finance', 'Startups', 'VC'], bio: 'Helping startups navigate their growth financing journey.' },
  { id: '10', name: 'Yuki Tanaka', title: 'ML Engineer', company: 'DeepMind Labs', color: '#a78bfa', tier: 'Bronze', interests: ['ML', 'NLP', 'Research'], bio: 'NLP researcher applying language models to healthcare.' },
  { id: '11', name: 'Carlos Mendez', title: 'DevRel Engineer', company: 'Stripe', color: '#60a5fa', tier: 'Bronze', interests: ['DevRel', 'APIs', 'Community'], bio: 'Building developer communities and evangelizing great APIs.' },
  { id: '12', name: 'Nadia Kim', title: 'VP Product', company: 'Fintopia', color: '#fb923c', tier: 'Silver', interests: ['Fintech', 'Product', 'Leadership'], bio: 'Former Goldman Sachs, now redefining consumer finance.' },
];

const FILTER_TIERS = ['All', 'Platinum', 'Gold', 'Silver', 'Bronze'];
const TIER_COLORS: Record<string, string> = { Bronze: '#cd7f32', Silver: '#c0c0c0', Gold: '#ffd700', Platinum: '#e5e4e2' };

type Attendee = typeof MOCK_ATTENDEES[0];

export default function AudienceScreen() {
  const insets = useSafeAreaInsets();
  const { user, showToast } = useAuth();
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('All');
  const [connections, setConnections] = useState<string[]>([]);
  const [selected, setSelected] = useState<Attendee | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return MOCK_ATTENDEES.filter((a) => {
      const matchSearch =
        a.name.toLowerCase().includes(q) ||
        a.company.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q);
      const matchTier = filterTier === 'All' || a.tier === filterTier;
      return matchSearch && matchTier;
    });
  }, [search, filterTier]);

  const openProfile = useCallback((a: Attendee) => {
    setSelected(a);
    setSheetVisible(true);
  }, []);

  const closeSheet = useCallback(() => {
    setSheetVisible(false);
    setTimeout(() => setSelected(null), 300);
  }, []);

  const toggleConnect = useCallback((id: string) => {
    setConnections((prev) => {
      if (prev.includes(id)) return prev.filter((c) => c !== id);
      showToast('Connection request sent!', 15);
      return [...prev, id];
    });
  }, [showToast]);

  const renderItem = useCallback(({ item }: { item: Attendee }) => {
    const isConnected = connections.includes(item.id);
    return (
      <TouchableOpacity style={styles.card} onPress={() => openProfile(item)} activeOpacity={0.75}>
        <View style={[styles.avatar, { backgroundColor: item.color + '25', borderColor: item.color + '55' }]}>
          <Text style={[styles.avatarText, { color: item.color }]}>{item.name[0]}</Text>
        </View>
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{item.name}</Text>
            <View style={[styles.tierDot, { backgroundColor: TIER_COLORS[item.tier] ?? colors.textMuted }]} />
          </View>
          <Text style={styles.role}>{item.title}</Text>
          <Text style={styles.company}>{item.company}</Text>
        </View>
        <TouchableOpacity
          style={[styles.connectBtn, isConnected && styles.connectBtnActive]}
          onPress={() => toggleConnect(item.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name={isConnected ? 'checkmark' : 'person-add-outline'}
            size={16}
            color={isConnected ? '#fff' : colors.primary}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  }, [connections, openProfile, toggleConnect]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Audience</Text>
        <Text style={styles.subtitle}>{MOCK_ATTENDEES.length} attendees · Tech Summit 2026</Text>
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

      {connections.length > 0 && (
        <View style={styles.connBar}>
          <Ionicons name="people" size={14} color={colors.primary} />
          <Text style={styles.connBarText}>{connections.length} pending connection{connections.length > 1 ? 's' : ''}</Text>
        </View>
      )}

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
              <View style={[styles.sheetAvatar, { backgroundColor: selected.color + '30', borderColor: selected.color + '80' }]}>
                <Text style={[styles.sheetAvatarText, { color: selected.color }]}>{selected.name[0]}</Text>
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
                <TouchableOpacity
                  style={[styles.sheetBtn, connections.includes(selected.id) && styles.sheetBtnActive]}
                  onPress={() => { toggleConnect(selected.id); closeSheet(); }}
                >
                  <Ionicons name={connections.includes(selected.id) ? 'checkmark' : 'person-add'} size={16} color={connections.includes(selected.id) ? '#fff' : colors.primary} />
                  <Text style={[styles.sheetBtnText, connections.includes(selected.id) && { color: '#fff' }]}>
                    {connections.includes(selected.id) ? 'Connected' : 'Connect'}
                  </Text>
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

  connBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.lg, backgroundColor: 'rgba(124,58,237,0.08)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.2)', marginBottom: spacing.md },
  connBarText: { color: colors.primary, fontSize: 12, fontWeight: '600' },

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
  connectBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  connectBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
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
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  sheetBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 12, borderRadius: radius.xl, borderWidth: 1.5, borderColor: colors.primary },
  sheetBtnActive: { backgroundColor: colors.primary },
  sheetBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  sheetIconBtn: { width: 48, height: 48, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
