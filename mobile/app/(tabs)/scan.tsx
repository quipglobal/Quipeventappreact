import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { useLeads, useLuckyDraw, useSubmitScan } from '@/hooks/useLeads';
import { leadsQueryKey } from '@/hooks/useLeads';
import { useGiveaways } from '@/hooks/useEngage';
import { BadgeCameraScanner } from '@/components/BadgeCameraScanner';
import { colors, spacing, radius } from '@/constants/theme';
import { submitScan } from '@/lib/api/leads';
import { saveGiveawayWinner } from '@/lib/api/engage';
import type { ApiResponse, Lead, Giveaway } from '@/lib/api/types';

type Mode = 'home' | 'scanner' | 'leads' | 'draw';

function ScannerView({ onBack, onScanSuccess }: { onBack: () => void; onScanSuccess: () => void }) {
  const insets = useSafeAreaInsets();
  const { addPoints, showToast } = useAuth();
  const { mutateAsync: submitScanAsync, isPending } = useSubmitScan();
  const inFlightRef = React.useRef(false);

  const handleCodeDetected = async (code: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const res = await submitScanAsync({ badgeData: code });
      if (res.success && res.data) {
        const name = res.data.name || 'attendee';
        const pts = typeof res.data.pointsAwarded === 'number' ? res.data.pointsAwarded : 0;
        if (pts > 0) addPoints(pts, `Scanned ${name}'s badge`);
        showToast(`Saved ${name} to your leads`);
        onScanSuccess();
      } else {
        const msg = res.error?.message || 'We couldn\'t recognize that badge. Please try again.';
        showToast(msg);
        setTimeout(() => { inFlightRef.current = false; }, 800);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Scan failed. Please try again.';
      showToast(msg);
      setTimeout(() => { inFlightRef.current = false; }, 800);
      return;
    }
    inFlightRef.current = false;
  };

  return (
    <View style={styles.container}>
      <View style={[styles.scannerPage, { paddingTop: insets.top + spacing.xl }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.sectionTitle}>Scan Attendee Badge</Text>
        <Text style={styles.sectionSub}>Point camera at attendee QR code</Text>
        <View style={styles.scannerFrame}>
          <BadgeCameraScanner onCodeDetected={handleCodeDetected} busy={isPending} />
        </View>
      </View>
    </View>
  );
}

function LeadsView({ leads, onBack }: { leads: Lead[]; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast, user } = useAuth();
  const { currentEventId } = useEvent();
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const inFlightRetriesRef = React.useRef<Set<string>>(new Set());

  const handleRetry = async (lead: Lead) => {
    if (inFlightRetriesRef.current.has(lead.id)) return;
    if (!lead.code) { showToast?.('Cannot retry — original badge code is missing.'); return; }
    inFlightRetriesRef.current.add(lead.id);
    setRetryingIds((prev) => new Set(prev).add(lead.id));
    try {
      const res = await submitScan({ badgeData: lead.code, name: lead.name, company: lead.company, title: lead.title });
      if (res.success && res.data && !res.data.pendingSync) {
        const newLead = res.data;
        const leadsKey = leadsQueryKey(user?.id ?? null, currentEventId);
        queryClient.setQueryData<ApiResponse<Lead[]>>(leadsKey, (prev) => {
          const existing = prev?.data ?? [];
          const filtered = existing.filter((l) => l.id !== lead.id && l.id !== newLead.id);
          return { success: true, data: [newLead, ...filtered] };
        });
        queryClient.invalidateQueries({ queryKey: leadsKey });
        showToast?.(`Synced ${lead.name} to the server`);
      } else {
        showToast?.('Still couldn\'t sync. Saved on this device for now.');
      }
    } finally {
      inFlightRetriesRef.current.delete(lead.id);
      setRetryingIds((prev) => { const next = new Set(prev); next.delete(lead.id); return next; });
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
    >
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>Scanned Contacts</Text>
      <Text style={styles.sectionSub}>{leads.length} contact{leads.length !== 1 ? 's' : ''} captured</Text>
      {leads.length === 0 && (
        <View style={styles.emptyLeads}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyText}>No contacts yet</Text>
          <Text style={styles.emptySub}>Scan attendee badges to build your list</Text>
        </View>
      )}
      {leads.map((l) => {
        const isRetrying = retryingIds.has(l.id);
        return (
          <View key={l.id} style={styles.leadCard}>
            <View style={styles.leadRow}>
              <View style={[styles.leadAvatar, { backgroundColor: l.color + '22', borderColor: l.color + '44' }]}>
                <Text style={[styles.leadAvatarText, { color: l.color }]}>{l.name[0]}</Text>
              </View>
              <View style={styles.leadInfo}>
                <Text style={styles.leadName}>{l.name}</Text>
                <Text style={styles.leadMeta}>{l.title} · {l.company}</Text>
                <Text style={styles.leadTime}>Scanned at {l.scannedAt}</Text>
              </View>
              <View style={[styles.statusDot, {
                backgroundColor: l.status === 'hot' ? '#ef4444' : l.status === 'warm' ? '#f59e0b' : '#6b7280'
              }]} />
            </View>
            {!!l.notes && <Text style={styles.leadNotes} numberOfLines={2}>{l.notes}</Text>}
            {!!l.tags?.length && (
              <View style={styles.tagsRow}>
                {l.tags.slice(0, 4).map((tag) => (
                  <View key={tag} style={styles.tagPill}><Text style={styles.tagText}>{tag}</Text></View>
                ))}
              </View>
            )}
            {l.pendingSync && (
              <View style={styles.pendingBar}>
                <Ionicons name="cloud-offline-outline" size={14} color="#d97706" />
                <Text style={styles.pendingText}>Saved on device — not synced</Text>
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
          </View>
        );
      })}
    </ScrollView>
  );
}

export default function ScanBadgeScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>('home');
  const [drawWinner, setDrawWinner] = useState<{ id: string; name: string; company?: string } | null>(null);
  const [selectedGiveaway, setSelectedGiveaway] = useState<Giveaway | null>(null);
  const [showGiveawayPicker, setShowGiveawayPicker] = useState(false);

  const { data: leadsData = [], refetch: refetchLeads } = useLeads();
  const { data: giveawaysForDraw = [] } = useGiveaways();
  const { mutate: triggerDraw, isPending: drawPending } = useLuckyDraw();

  const runDraw = () => {
    triggerDraw(selectedGiveaway?.id, {
      onSuccess: (res) => {
        const w = res.data?.winner;
        if (!w) return;
        const winner = { id: String(w.id), name: w.name ?? 'Unknown', company: w.company };
        setDrawWinner(winner);
        if (selectedGiveaway) {
          saveGiveawayWinner(selectedGiveaway.id, {
            id: winner.id, name: winner.name, company: winner.company, drawnAt: new Date().toISOString(),
          }).catch(() => {});
        }
      },
      onError: () => Alert.alert('Draw Failed', 'Could not pick a winner. Try again.'),
    });
  };

  if (mode === 'scanner') {
    return (
      <ScannerView
        onBack={() => setMode('home')}
        onScanSuccess={() => { refetchLeads(); setMode('leads'); }}
      />
    );
  }

  if (mode === 'leads') {
    return <LeadsView leads={leadsData} onBack={() => setMode('home')} />;
  }

  if (mode === 'draw') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
        <TouchableOpacity
          style={[styles.backBtn, { marginHorizontal: spacing.xl }]}
          onPress={() => { setMode('home'); setDrawWinner(null); setSelectedGiveaway(null); }}
        >
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.drawPage}>
          <Text style={styles.drawTitle}>Lucky Draw</Text>
          <Text style={styles.drawSubtitle}>{leadsData.length} participants</Text>

          {giveawaysForDraw.length > 0 && (
            <TouchableOpacity
              style={styles.giveawayPickerBtn}
              onPress={() => setShowGiveawayPicker((v) => !v)}
            >
              <Text style={styles.giveawayPickerLabel}>
                {selectedGiveaway ? selectedGiveaway.title : 'Select giveaway (optional)'}
              </Text>
              <Ionicons name={showGiveawayPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          {showGiveawayPicker && (
            <View style={styles.giveawayList}>
              <TouchableOpacity
                style={styles.giveawayItem}
                onPress={() => { setSelectedGiveaway(null); setShowGiveawayPicker(false); }}
              >
                <Text style={[styles.giveawayItemText, !selectedGiveaway && { color: colors.primary }]}>None</Text>
              </TouchableOpacity>
              {giveawaysForDraw.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.giveawayItem}
                  onPress={() => { setSelectedGiveaway(g); setShowGiveawayPicker(false); }}
                >
                  <Text style={[styles.giveawayItemText, selectedGiveaway?.id === g.id && { color: colors.primary }]}>
                    {g.title}
                  </Text>
                  {selectedGiveaway?.id === g.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <LinearGradient colors={['#3b1d8a', '#0d1a2e']} style={styles.drawBox}>
            {drawWinner ? (
              <>
                <Text style={styles.winnerLabel}>Winner!</Text>
                <Text style={styles.winnerName}>{drawWinner.name}</Text>
                {!!drawWinner.company && <Text style={styles.winnerCompany}>{drawWinner.company}</Text>}
              </>
            ) : (
              <>
                <Ionicons name="trophy" size={56} color="#ffd700" />
                <Text style={styles.drawHint}>Press button to pick winner</Text>
              </>
            )}
          </LinearGradient>

          <TouchableOpacity
            style={[styles.drawBtn, drawPending && { opacity: 0.6 }]}
            onPress={runDraw}
            disabled={drawPending}
          >
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.drawBtnGrad}>
              <Ionicons name="shuffle" size={18} color="#fff" />
              <Text style={styles.drawBtnText}>
                {drawPending ? 'Picking...' : drawWinner ? 'Draw Again' : 'Pick Winner'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Scan Badge</Text>
      <Text style={styles.pageSub}>Capture leads and manage your booth</Text>

      <View style={styles.heroPanel}>
        <TouchableOpacity style={styles.heroBtn} onPress={() => router.push('/qr-badge')}>
          <LinearGradient colors={['rgba(124,58,237,0.3)', 'rgba(79,70,229,0.15)']} style={styles.heroBtnGrad}>
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(124,58,237,0.25)' }]}>
              <Ionicons name="qr-code" size={28} color={colors.primary} />
            </View>
            <Text style={styles.heroBtnLabel}>My Badge</Text>
            <Text style={styles.heroBtnSub}>Show your QR code</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.heroBtn} onPress={() => setMode('scanner')}>
          <LinearGradient colors={['rgba(6,182,212,0.3)', 'rgba(79,70,229,0.15)']} style={styles.heroBtnGrad}>
            <View style={[styles.heroIcon, { backgroundColor: 'rgba(6,182,212,0.25)' }]}>
              <Ionicons name="scan" size={28} color={colors.accent} />
            </View>
            <Text style={styles.heroBtnLabel}>Scan Badge</Text>
            <Text style={styles.heroBtnSub}>Capture contact info</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{leadsData.length}</Text>
          <Text style={styles.statLabel}>Leads</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{leadsData.filter((l) => l.status === 'hot').length}</Text>
          <Text style={styles.statLabel}>Hot</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{leadsData.filter((l) => l.pendingSync).length}</Text>
          <Text style={styles.statLabel}>Pending sync</Text>
        </View>
      </View>

      <View style={styles.toolGrid}>
        <TouchableOpacity style={styles.toolCard} onPress={() => setMode('leads')}>
          <View style={[styles.toolIcon, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
            <Ionicons name="people" size={22} color="#06b6d4" />
          </View>
          <Text style={styles.toolTitle}>My Leads</Text>
          <Text style={styles.toolSub}>{leadsData.length} captured</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolCard} onPress={() => setMode('draw')}>
          <View style={[styles.toolIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
            <Ionicons name="trophy" size={22} color="#f59e0b" />
          </View>
          <Text style={styles.toolTitle}>Lucky Draw</Text>
          <Text style={styles.toolSub}>Pick winner</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toolCard}
          onPress={() => Alert.alert('Analytics', 'Full analytics coming soon.')}
        >
          <View style={[styles.toolIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
            <Ionicons name="bar-chart" size={22} color="#10b981" />
          </View>
          <Text style={styles.toolTitle}>Analytics</Text>
          <Text style={styles.toolSub}>Booth stats</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },

  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg, marginHorizontal: spacing.xl },
  backText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },

  pageTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  pageSub: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xl },

  heroPanel: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.xl },
  heroBtn: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  heroBtnGrad: { padding: spacing.lg, alignItems: 'center', gap: spacing.sm },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroBtnLabel: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  heroBtnSub: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },

  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xl,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },

  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  toolCard: {
    flex: 1,
    minWidth: '28%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  toolIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  toolTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  toolSub: { color: colors.textMuted, fontSize: 11, textAlign: 'center' },

  scannerPage: { flex: 1, paddingHorizontal: spacing.xl },
  sectionTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 4, marginHorizontal: spacing.xl },
  sectionSub: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xl, marginHorizontal: spacing.xl },
  scannerFrame: { flex: 1, borderRadius: radius.xl, overflow: 'hidden', minHeight: 340 },

  emptyLeads: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyText: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  emptySub: { color: colors.textMuted, fontSize: 13 },

  leadCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  leadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leadAvatar: {
    width: 44, height: 44, borderRadius: 22, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  leadAvatarText: { fontSize: 18, fontWeight: '800' },
  leadInfo: { flex: 1 },
  leadName: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  leadMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  leadTime: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  leadNotes: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm, fontStyle: 'italic' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: spacing.sm },
  tagPill: { backgroundColor: 'rgba(124,58,237,0.15)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  tagText: { color: colors.primary, fontSize: 10, fontWeight: '600' },
  pendingBar: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.sm, backgroundColor: 'rgba(217,119,6,0.1)', borderRadius: 8, padding: 8 },
  pendingText: { flex: 1, color: '#d97706', fontSize: 11 },
  retryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: 'rgba(217,119,6,0.15)', borderRadius: 6 },
  retryText: { color: '#b45309', fontSize: 11, fontWeight: '600' },

  drawPage: { paddingHorizontal: spacing.xl, alignItems: 'center', gap: spacing.xl },
  drawTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800' },
  drawSubtitle: { color: colors.textMuted, fontSize: 14 },
  giveawayPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md,
  },
  giveawayPickerLabel: { color: colors.textPrimary, fontSize: 14 },
  giveawayList: { width: '100%', backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  giveawayItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  giveawayItemText: { color: colors.textPrimary, fontSize: 14 },
  drawBox: { width: '100%', borderRadius: radius.xl, padding: spacing.xxl, alignItems: 'center', gap: spacing.md, minHeight: 180, justifyContent: 'center' },
  winnerLabel: { color: '#ffd700', fontSize: 16, fontWeight: '700' },
  winnerName: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  winnerCompany: { color: 'rgba(255,255,255,0.6)', fontSize: 14 },
  drawHint: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center' },
  drawBtn: { width: '100%', borderRadius: radius.xl, overflow: 'hidden' },
  drawBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.lg },
  drawBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
