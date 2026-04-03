import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { usePartners } from '@/hooks/usePartners';
import { useLeads, useUpdateLeadStatus } from '@/hooks/useLeads';
import { DataState } from '@/components/DataState';
import { colors, spacing, radius } from '@/constants/theme';

const TIER_ORDER = ['Platinum', 'Gold', 'Silver', 'Bronze'];
const STATUS_COLORS = { hot: '#ef4444', warm: '#f59e0b', cold: '#6b7280' };

function AttendeePartners() {
  const insets = useSafeAreaInsets();
  const { showToast } = useAuth();
  const [savedPartners, setSavedPartners] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState('All');

  const { data: sponsors = [], isLoading, isError, refetch } = usePartners();

  const tiers = useMemo(() => ['All', ...TIER_ORDER.filter((t) => sponsors.some((s) => s.tier === t))], [sponsors]);
  const filtered = useMemo(() => activeFilter === 'All' ? sponsors : sponsors.filter((s) => s.tier === activeFilter), [sponsors, activeFilter]);

  const toggleSave = (id: string, name: string) => {
    setSavedPartners((prev) => {
      if (prev.includes(id)) return prev.filter((p) => p !== id);
      showToast(`Saved ${name}`);
      return [...prev, id];
    });
  };

  const requestMeeting = (name: string) => {
    Alert.alert('Meeting Request Sent', `Your request with ${name} has been submitted. They'll reach out shortly.`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Partners</Text>
        <Text style={styles.subtitle}>{sponsors.length > 0 ? `${sponsors.length} sponsors at this event` : 'Event Sponsors'}</Text>
      </View>

      <DataState
        loading={isLoading}
        error={isError ? 'Failed to load partners. Check your connection.' : null}
        onRetry={refetch}
      />

      <View style={styles.filterRow}>
        {tiers.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.filterBtn, activeFilter === t && styles.filterBtnActive]}
            onPress={() => setActiveFilter(t)}
          >
            <Text style={[styles.filterText, activeFilter === t && styles.filterTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map((s) => {
        const saved = savedPartners.includes(s.id);
        return (
          <View key={s.id} style={styles.card}>
            <LinearGradient colors={[s.accentColor + '22', colors.bgCard]} style={styles.cardHeader}>
              <View style={styles.cardHeaderRow}>
                <View style={[styles.logoBox, { backgroundColor: s.accentColor + '22', borderColor: s.accentColor + '44' }]}>
                  <Text style={[styles.logoText, { color: s.accentColor }]}>
                    {s.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.nameBlock}>
                  <Text style={styles.sponsorName}>{s.name}</Text>
                  <View style={styles.tierRow}>
                    <View style={[styles.tierDot, { backgroundColor: s.tierColor }]} />
                    <Text style={styles.tierText}>{s.tier} Sponsor</Text>
                    <Text style={styles.boothNum}>Booth {s.boothNumber}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => toggleSave(s.id, s.name)} style={styles.iconBtn}>
                  <Ionicons name={saved ? 'bookmark' : 'bookmark-outline'} size={18} color={saved ? colors.primary : colors.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.categoryTag}>{s.category}</Text>
            </LinearGradient>
            <View style={styles.cardBody}>
              <Text style={styles.tagline}>{s.tagline}</Text>
              {s.giveaway && (
                <View style={styles.giveawayRow}>
                  <Ionicons name="gift" size={14} color="#f59e0b" />
                  <Text style={styles.giveawayText}>Giveaway: <Text style={styles.giveawayPrize}>{s.giveaway}</Text></Text>
                </View>
              )}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => requestMeeting(s.name)}>
                  <Ionicons name="calendar-outline" size={14} color="#fff" />
                  <Text style={styles.primaryBtnText}>Book Meeting</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => Alert.alert('Website', s.website)}>
                  <Ionicons name="globe-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.secondaryBtnText}>Website</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

function SponsorLeads() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<'all' | 'hot' | 'warm' | 'cold'>('all');

  const { data: leads = [], isLoading, isError, refetch } = useLeads();
  const { mutate: updateStatusMutation } = useUpdateLeadStatus();

  const filtered = activeFilter === 'all' ? leads : leads.filter((l) => l.status === activeFilter);
  const counts = { all: leads.length, hot: leads.filter((l) => l.status === 'hot').length, warm: leads.filter((l) => l.status === 'warm').length, cold: leads.filter((l) => l.status === 'cold').length };

  const updateStatus = (id: string, status: 'hot' | 'warm' | 'cold') => {
    updateStatusMutation({ leadId: id, status });
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>My Leads</Text>
        <Text style={styles.subtitle}>{leads.length} contacts captured at this event</Text>
      </View>

      <DataState loading={isLoading} error={isError ? 'Failed to load leads.' : null} onRetry={refetch} />

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <View style={[styles.statDot, { backgroundColor: STATUS_COLORS.hot }]} />
          <Text style={styles.statValue}>{counts.hot}</Text>
          <Text style={styles.statLabel}>Hot</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <View style={[styles.statDot, { backgroundColor: STATUS_COLORS.warm }]} />
          <Text style={styles.statValue}>{counts.warm}</Text>
          <Text style={styles.statLabel}>Warm</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <View style={[styles.statDot, { backgroundColor: STATUS_COLORS.cold }]} />
          <Text style={styles.statValue}>{counts.cold}</Text>
          <Text style={styles.statLabel}>Cold</Text>
        </View>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'hot', 'warm', 'cold'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, activeFilter === f && styles.filterBtnActive]}
            onPress={() => setActiveFilter(f)}
          >
            <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)} {f !== 'all' && `(${counts[f]})`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.map((l) => (
        <View key={l.id} style={styles.leadCard}>
          <View style={[styles.leadAvatar, { backgroundColor: l.color + '22', borderColor: l.color + '44' }]}>
            <Text style={[styles.leadAvatarText, { color: l.color }]}>{l.name[0]}</Text>
          </View>
          <View style={styles.leadInfo}>
            <Text style={styles.leadName}>{l.name}</Text>
            <Text style={styles.leadRole}>{l.title} · {l.company}</Text>
            <Text style={styles.leadEmail}>{l.email}</Text>
            <Text style={styles.leadTime}>Scanned {l.scannedAt}</Text>
          </View>
          <View style={styles.leadRight}>
            <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[l.status] + '22', borderColor: STATUS_COLORS[l.status] + '44' }]}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[l.status] }]} />
              <Text style={[styles.statusText, { color: STATUS_COLORS[l.status] }]}>{l.status}</Text>
            </View>
            <TouchableOpacity
              style={styles.contactBtn}
              onPress={() => Alert.alert('Contact', `Send follow-up to ${l.email}?`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Email', onPress: () => Alert.alert('Sent', `Follow-up sent to ${l.name}`) },
              ])}
            >
              <Ionicons name="mail-outline" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export default function PartnersScreen() {
  const { user } = useAuth();

  if (user?.role === 'sponsor') {
    return <SponsorLeads />;
  }

  return <AttendeePartners />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  header: { marginBottom: spacing.lg },
  pageTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },

  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  filterBtn: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },

  card: { borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md, overflow: 'hidden' },
  cardHeader: { padding: spacing.lg },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  logoBox: { width: 48, height: 48, borderRadius: radius.lg, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 16, fontWeight: '800' },
  nameBlock: { flex: 1 },
  sponsorName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { color: colors.textSecondary, fontSize: 11 },
  boothNum: { color: colors.textMuted, fontSize: 11, marginLeft: 'auto' },
  iconBtn: { padding: 4 },
  categoryTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.06)', color: colors.textMuted, fontSize: 11, fontWeight: '600' },
  cardBody: { padding: spacing.lg },
  tagline: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  giveawayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  giveawayText: { color: colors.textSecondary, fontSize: 12 },
  giveawayPrize: { color: '#f59e0b', fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: spacing.md },
  primaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: colors.primary },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: 10, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border },
  secondaryBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  statsRow: { flexDirection: 'row', padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  statBox: { flex: 1, alignItems: 'center', gap: spacing.xs },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11 },
  statDivider: { width: 1, backgroundColor: colors.border },

  leadCard: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  leadAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  leadAvatarText: { fontSize: 18, fontWeight: '700' },
  leadInfo: { flex: 1 },
  leadName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  leadRole: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  leadEmail: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  leadTime: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
  leadRight: { alignItems: 'flex-end', gap: spacing.sm },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: '700' },
  contactBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(124,58,237,0.12)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)', alignItems: 'center', justifyContent: 'center' },
});
