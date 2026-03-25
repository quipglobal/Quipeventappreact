import React, { useState } from 'react';
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
import { colors, spacing, radius } from '@/constants/theme';

const MOCK_SPONSORS = [
  {
    id: 's1',
    name: 'TechCorp Solutions',
    tier: 'Platinum',
    tagline: 'Building the future of enterprise AI',
    category: 'AI & Cloud',
    boothNumber: 'A1',
    color: '#e5e4e2',
    accentColor: '#7c3aed',
    giveaway: 'MacBook Pro 16"',
    website: 'techcorp.example.com',
  },
  {
    id: 's2',
    name: 'CloudNine Systems',
    tier: 'Gold',
    tagline: 'Scalable cloud infrastructure for teams of any size',
    category: 'Cloud Infrastructure',
    boothNumber: 'B3',
    color: '#ffd700',
    accentColor: '#06b6d4',
    giveaway: '$500 AWS Credits',
    website: 'cloudnine.example.com',
  },
  {
    id: 's3',
    name: 'QuantumLeap AI',
    tier: 'Gold',
    tagline: 'ML-powered solutions for enterprise workflows',
    category: 'AI/ML',
    boothNumber: 'B5',
    color: '#ffd700',
    accentColor: '#10b981',
    giveaway: 'AI Tool License (1 year)',
    website: 'quantumleap.example.com',
  },
  {
    id: 's4',
    name: 'InnovateLab',
    tier: 'Silver',
    tagline: 'Where ideas become products',
    category: 'Product & Design',
    boothNumber: 'C2',
    color: '#c0c0c0',
    accentColor: '#ec4899',
    giveaway: null,
    website: 'innovatelab.example.com',
  },
  {
    id: 's5',
    name: 'DesignFlow',
    tier: 'Silver',
    tagline: 'Design tools built for modern teams',
    category: 'Design Tools',
    boothNumber: 'C4',
    color: '#c0c0c0',
    accentColor: '#8b5cf6',
    giveaway: null,
    website: 'designflow.example.com',
  },
];

const TIER_ORDER = ['Platinum', 'Gold', 'Silver', 'Bronze'];

export default function PartnersScreen() {
  const insets = useSafeAreaInsets();
  const { showToast } = useAuth();
  const [savedPartners, setSavedPartners] = useState<string[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const tiers = ['All', ...TIER_ORDER.filter((t) => MOCK_SPONSORS.some((s) => s.tier === t))];
  const filtered = activeFilter === 'All' ? MOCK_SPONSORS : MOCK_SPONSORS.filter((s) => s.tier === activeFilter);

  const toggleSave = (id: string, name: string) => {
    setSavedPartners((prev) => {
      if (prev.includes(id)) {
        return prev.filter((p) => p !== id);
      }
      showToast(`Saved ${name}`);
      return [...prev, id];
    });
  };

  const requestMeeting = (name: string) => {
    Alert.alert('Meeting Request', `Your meeting request with ${name} has been submitted. They will contact you shortly.`);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Partners</Text>
        <Text style={styles.subtitle}>{MOCK_SPONSORS.length} sponsors · Tech Summit 2026</Text>
      </View>

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
            <LinearGradient
              colors={[s.accentColor + '22', colors.bgCard]}
              style={styles.cardHeader}
            >
              <View style={styles.cardHeaderRow}>
                <View style={[styles.logoBox, { backgroundColor: s.accentColor + '22', borderColor: s.accentColor + '44' }]}>
                  <Text style={[styles.logoText, { color: s.accentColor }]}>
                    {s.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                  </Text>
                </View>
                <View style={styles.nameBlock}>
                  <Text style={styles.sponsorName}>{s.name}</Text>
                  <View style={styles.tierRow}>
                    <View style={[styles.tierDot, { backgroundColor: s.color }]} />
                    <Text style={styles.tierText}>{s.tier} Sponsor</Text>
                    <Text style={styles.boothNum}>Booth {s.boothNumber}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => toggleSave(s.id, s.name)} style={styles.saveBtn}>
                  <Ionicons
                    name={saved ? 'bookmark' : 'bookmark-outline'}
                    size={18}
                    color={saved ? colors.primary : colors.textMuted}
                  />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  header: { marginBottom: spacing.lg },
  pageTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  filterBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  card: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  cardHeader: { padding: spacing.lg },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { fontSize: 16, fontWeight: '800' },
  nameBlock: { flex: 1 },
  sponsorName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 2 },
  tierDot: { width: 6, height: 6, borderRadius: 3 },
  tierText: { color: colors.textSecondary, fontSize: 11 },
  boothNum: { color: colors.textMuted, fontSize: 11, marginLeft: 'auto' },
  saveBtn: { padding: 4 },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  cardBody: { padding: spacing.lg },
  tagline: { color: colors.textSecondary, fontSize: 13, lineHeight: 19, marginBottom: spacing.md },
  giveawayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  giveawayText: { color: colors.textSecondary, fontSize: 12 },
  giveawayPrize: { color: '#f59e0b', fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: spacing.md },
  primaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
});
