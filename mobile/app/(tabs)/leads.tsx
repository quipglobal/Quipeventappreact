import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { useLeads, useSubmitScan } from '@/hooks/useLeads';
import { leadsQueryKey } from '@/lib/leadsCacheKey';
import { submitScan } from '@/lib/api/leads';
import { colors, spacing, radius } from '@/constants/theme';
import type { ApiResponse, Lead } from '@/lib/api/types';

export default function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const { user, showToast } = useAuth();
  const { currentEventId } = useEvent();
  const queryClient = useQueryClient();
  const { data: leads = [], isLoading, refetch } = useLeads();
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const inFlightRef = React.useRef<Set<string>>(new Set());

  const handleRetry = async (lead: Lead) => {
    if (inFlightRef.current.has(lead.id)) return;
    if (!lead.code) { showToast?.('Cannot retry — badge code missing.'); return; }
    inFlightRef.current.add(lead.id);
    setRetryingIds((p) => new Set(p).add(lead.id));
    try {
      const res = await submitScan({ badgeData: lead.code, name: lead.name, company: lead.company, title: lead.title });
      if (res.success && res.data && !res.data.pendingSync) {
        const newLead = res.data;
        const key = leadsQueryKey(user?.id ?? null, currentEventId);
        queryClient.setQueryData<ApiResponse<Lead[]>>(key, (prev) => {
          const filtered = (prev?.data ?? []).filter((l) => l.id !== lead.id && l.id !== newLead.id);
          return { success: true, data: [newLead, ...filtered] };
        });
        queryClient.invalidateQueries({ queryKey: key });
        showToast?.(`Synced ${lead.name} to the server`);
      } else {
        showToast?.('Still couldn\u2019t sync. Saved locally for now.');
      }
    } finally {
      inFlightRef.current.delete(lead.id);
      setRetryingIds((p) => { const n = new Set(p); n.delete(lead.id); return n; });
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Leads</Text>
        <Text style={styles.headerSub}>{leads.length} contact{leads.length !== 1 ? 's' : ''} captured</Text>
      </View>

      <TouchableOpacity
        style={styles.scanBtn}
        onPress={() => router.push('/(tabs)/engage' as any)}
        activeOpacity={0.85}
      >
        <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.scanBtnGrad}>
          <Ionicons name="qr-code-outline" size={18} color="#fff" />
          <Text style={styles.scanBtnText}>Scan a Badge</Text>
        </LinearGradient>
      </TouchableOpacity>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : leads.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={52} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No leads yet</Text>
          <Text style={styles.emptySub}>Scan attendee badges to build your list</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />}
        >
          {leads.map((l) => {
            const isRetrying = retryingIds.has(l.id);
            const priority = l.priority ?? l.status;
            const statusColor = priority === 'hot' ? '#ef4444' : priority === 'warm' ? '#f59e0b' : '#3b82f6';
            return (
              <TouchableOpacity
                key={l.id}
                style={styles.card}
                activeOpacity={0.85}
                onPress={() => router.push({ pathname: '/lead-detail', params: { id: l.id } } as any)}
              >
                <View style={styles.cardRow}>
                  <View style={[styles.avatar, { backgroundColor: l.color + '22', borderColor: l.color + '44' }]}>
                    <Text style={[styles.avatarText, { color: l.color }]}>{l.name[0]}</Text>
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{l.name}</Text>
                    <Text style={styles.role}>{l.title}{l.title && l.company ? ' · ' : ''}{l.company}</Text>
                    <Text style={styles.time}>Scanned at {l.scannedAt}</Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
                {!!l.notes && <Text style={styles.notes} numberOfLines={2}>{l.notes}</Text>}
                {!!l.tags?.length && (
                  <View style={styles.tagsRow}>
                    {l.tags.slice(0, 4).map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {l.pendingSync && (
                  <View style={styles.syncBar}>
                    <Ionicons name="cloud-offline-outline" size={13} color="#d97706" />
                    <Text style={styles.syncText}>Not synced to server</Text>
                    <TouchableOpacity
                      onPress={() => handleRetry(l)}
                      disabled={isRetrying}
                      style={[styles.retryBtn, isRetrying && { opacity: 0.5 }]}
                    >
                      {isRetrying
                        ? <ActivityIndicator size="small" color="#b45309" />
                        : <Ionicons name="refresh" size={12} color="#b45309" />}
                      <Text style={styles.retryText}>{isRetrying ? 'Syncing…' : 'Retry'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070F' },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, paddingBottom: spacing.md },
  headerTitle: { fontSize: 24, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.5 },
  headerSub: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  scanBtn: { marginHorizontal: spacing.xl, marginBottom: spacing.lg, borderRadius: radius.md, overflow: 'hidden' },
  scanBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13 },
  scanBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingBottom: 80 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl },
  list: { paddingHorizontal: spacing.xl, paddingBottom: 120 },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.08)' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  avatarText: { fontSize: 16, fontWeight: '700' },
  info: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  role: { fontSize: 12, color: colors.textMuted, marginTop: 1 },
  time: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  notes: { fontSize: 12, color: colors.textSecondary, marginTop: spacing.sm, lineHeight: 17 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm },
  tag: { backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { fontSize: 11, color: colors.primary },
  syncBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: 'rgba(217,119,6,0.1)', borderRadius: radius.sm, padding: 6 },
  syncText: { flex: 1, fontSize: 11, color: '#d97706' },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: 'rgba(180,83,9,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  retryText: { fontSize: 11, color: '#b45309', fontWeight: '600' },
});
