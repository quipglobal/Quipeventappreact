import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

const MOCK_ATTENDEES = [
  { id: '1', name: 'Dr. Sarah Chen', title: 'Chief AI Officer', company: 'TechCorp Solutions', color: '#6366f1', connected: false },
  { id: '2', name: 'Marcus Johnson', title: 'VP of Engineering', company: 'InnovateLab', color: '#8b5cf6', connected: false },
  { id: '3', name: 'Priya Patel', title: 'Product Lead', company: 'DesignFlow', color: '#ec4899', connected: false },
  { id: '4', name: 'Elena Rodriguez', title: 'Head of Data Science', company: 'QuantumLeap AI', color: '#10b981', connected: false },
  { id: '5', name: 'James Wilson', title: 'CTO', company: 'CloudNine Systems', color: '#f59e0b', connected: false },
  { id: '6', name: 'Aisha Kamara', title: 'Growth Director', company: 'Launchpad Inc', color: '#06b6d4', connected: false },
  { id: '7', name: 'Dev Sharma', title: 'Principal Engineer', company: 'Nexus Labs', color: '#7c3aed', connected: false },
  { id: '8', name: 'Lena Fischer', title: 'UX Director', company: 'Designly', color: '#f43f5e', connected: false },
  { id: '9', name: 'Omar Hassan', title: 'CFO', company: 'Momentum Capital', color: '#34d399', connected: false },
  { id: '10', name: 'Yuki Tanaka', title: 'ML Engineer', company: 'DeepMind Labs', color: '#a78bfa', connected: false },
];

export default function AudienceScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [connections, setConnections] = useState<string[]>([]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return MOCK_ATTENDEES.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.company.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q)
    );
  }, [search]);

  const toggleConnect = (id: string) => {
    setConnections((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Audience</Text>
        <Text style={styles.subtitle}>{MOCK_ATTENDEES.length} attendees · Tech Summit 2026</Text>
      </View>

      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, company or title…"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {connections.length > 0 && (
        <View style={styles.connectionsBar}>
          <Ionicons name="people" size={14} color={colors.primary} />
          <Text style={styles.connectionsText}>{connections.length} connection{connections.length > 1 ? 's' : ''}</Text>
        </View>
      )}

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No attendees found</Text>
        </View>
      ) : (
        filtered.map((a) => (
          <View key={a.id} style={styles.card}>
            <View style={[styles.avatar, { backgroundColor: a.color + '33', borderColor: a.color + '55' }]}>
              <Text style={[styles.avatarText, { color: a.color }]}>{a.name[0]}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{a.name}</Text>
              <Text style={styles.role}>{a.title}</Text>
              <Text style={styles.company}>{a.company}</Text>
            </View>
            <TouchableOpacity
              style={[styles.connectBtn, connections.includes(a.id) && styles.connectBtnActive]}
              onPress={() => toggleConnect(a.id)}
            >
              <Ionicons
                name={connections.includes(a.id) ? 'checkmark' : 'person-add-outline'}
                size={14}
                color={connections.includes(a.id) ? '#fff' : colors.primary}
              />
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  header: { marginBottom: spacing.lg },
  pageTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
    paddingVertical: 0,
  },
  connectionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
    marginBottom: spacing.lg,
  },
  connectionsText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  avatarText: { fontSize: 18, fontWeight: '700' },
  info: { flex: 1 },
  name: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  role: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  company: { color: colors.textMuted, fontSize: 11, marginTop: 1 },
  connectBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  empty: { alignItems: 'center', paddingVertical: 48 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
});
