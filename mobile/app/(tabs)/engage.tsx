import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

const MOCK_CHALLENGES = [
  { id: 'c1', emoji: '🎤', title: 'Visit 3 Booths', desc: 'Scan badges at 3 sponsor booths', points: 75, progress: 2, total: 3 },
  { id: 'c2', emoji: '🗳️', title: 'Vote in 5 Polls', desc: 'Participate in live session polls', points: 50, progress: 3, total: 5 },
  { id: 'c3', emoji: '🤝', title: 'Make 5 Connections', desc: 'Connect with other attendees', points: 100, progress: 1, total: 5 },
  { id: 'c4', emoji: '📸', title: 'Session Selfie', desc: 'Share your event experience', points: 30, progress: 0, total: 1 },
  { id: 'c5', emoji: '📝', title: 'Complete Survey', desc: 'Fill out the midday survey', points: 50, progress: 0, total: 1 },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: 'Aisha Kamara', points: 680, tier: 'Platinum', color: '#e5e4e2' },
  { rank: 2, name: 'Dev Sharma', points: 540, tier: 'Gold', color: '#ffd700' },
  { rank: 3, name: 'Lena Fischer', points: 420, tier: 'Gold', color: '#ffd700' },
  { rank: 4, name: 'Omar Hassan', points: 310, tier: 'Silver', color: '#c0c0c0' },
  { rank: 5, name: 'Yuki Tanaka', points: 290, tier: 'Silver', color: '#c0c0c0' },
];

const MOCK_GIVEAWAYS = [
  { id: 'g1', title: 'MacBook Pro 16"', sponsor: 'TechCorp Solutions', entries: 142, ends: '3:00 PM', entered: false, color: '#7c3aed' },
  { id: 'g2', title: '$500 AWS Credits', sponsor: 'CloudNine Systems', entries: 89, ends: '5:00 PM', entered: false, color: '#06b6d4' },
];

function AttendeeEngage() {
  const { user, completedChallenges, completeChallenge, votedPolls, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState<'challenges' | 'leaderboard' | 'giveaways'>('challenges');
  const [giveawayEntries, setGiveawayEntries] = useState<string[]>([]);

  const myRank = MOCK_LEADERBOARD.findIndex((l) => l.name === user?.name) + 1;

  const enterGiveaway = (id: string) => {
    if (giveawayEntries.includes(id)) return;
    setGiveawayEntries((prev) => [...prev, id]);
    showToast('Entered giveaway! Good luck! 🎁', 10);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pointsCard}>
        <LinearGradient colors={['#3b1d8a', '#1e3a5f']} style={styles.pointsGrad}>
          <View style={styles.pointsRow}>
            <View>
              <Text style={styles.pointsLabel}>Your Points</Text>
              <Text style={styles.pointsValue}>{user?.points ?? 0}</Text>
            </View>
            <View style={styles.tierBadge}>
              <Text style={styles.tierText}>{user?.tier ?? 'Bronze'}</Text>
            </View>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(((user?.points ?? 0) / 500) * 100, 100)}%` }]} />
          </View>
          <Text style={styles.nextTierText}>
            {(user?.points ?? 0) < 100 ? `${100 - (user?.points ?? 0)} pts to Silver` :
             (user?.points ?? 0) < 250 ? `${250 - (user?.points ?? 0)} pts to Gold` :
             (user?.points ?? 0) < 500 ? `${500 - (user?.points ?? 0)} pts to Platinum` :
             'Max tier reached!'}
          </Text>
        </LinearGradient>
      </View>

      <View style={styles.tabRow}>
        {(['challenges', 'leaderboard', 'giveaways'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'challenges' ? 'Challenges' : t === 'leaderboard' ? 'Leaderboard' : 'Giveaways'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'challenges' && MOCK_CHALLENGES.map((c) => {
        const done = completedChallenges.includes(c.id);
        const pct = Math.min((c.progress / c.total) * 100, 100);
        return (
          <View key={c.id} style={[styles.challengeCard, done && styles.challengeDone]}>
            <View style={styles.challengeLeft}>
              <Text style={styles.challengeEmoji}>{c.emoji}</Text>
            </View>
            <View style={styles.challengeBody}>
              <View style={styles.challengeHeader}>
                <Text style={styles.challengeTitle}>{c.title}</Text>
                <View style={styles.pointsPill}>
                  <Text style={styles.pointsPillText}>+{c.points} pts</Text>
                </View>
              </View>
              <Text style={styles.challengeDesc}>{c.desc}</Text>
              <View style={styles.challengeProgress}>
                <View style={styles.challengeProgressBg}>
                  <View style={[styles.challengeProgressFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.challengeProgressText}>{c.progress}/{c.total}</Text>
              </View>
            </View>
            {!done && c.progress === c.total && (
              <TouchableOpacity
                style={styles.claimBtn}
                onPress={() => completeChallenge(c.id)}
              >
                <Text style={styles.claimBtnText}>Claim</Text>
              </TouchableOpacity>
            )}
            {done && <Ionicons name="checkmark-circle" size={24} color={colors.success} />}
          </View>
        );
      })}

      {activeTab === 'leaderboard' && (
        <>
          {MOCK_LEADERBOARD.map((l) => (
            <View key={l.rank} style={[styles.rankRow, l.rank <= 3 && styles.rankRowTop]}>
              <View style={styles.rankNum}>
                {l.rank === 1 ? <Text style={styles.rankEmoji}>🥇</Text> :
                 l.rank === 2 ? <Text style={styles.rankEmoji}>🥈</Text> :
                 l.rank === 3 ? <Text style={styles.rankEmoji}>🥉</Text> :
                 <Text style={styles.rankText}>{l.rank}</Text>}
              </View>
              <View style={[styles.rankAvatar, { borderColor: l.color + '66' }]}>
                <Text style={styles.rankAvatarText}>{l.name[0]}</Text>
              </View>
              <View style={styles.rankInfo}>
                <Text style={styles.rankName}>{l.name}</Text>
                <Text style={styles.rankTier}>{l.tier}</Text>
              </View>
              <Text style={styles.rankPoints}>{l.points} pts</Text>
            </View>
          ))}
          <View style={styles.myRankCard}>
            <Text style={styles.myRankLabel}>Your rank</Text>
            <Text style={styles.myRankValue}>#{myRank > 0 ? myRank : '—'}</Text>
          </View>
        </>
      )}

      {activeTab === 'giveaways' && MOCK_GIVEAWAYS.map((g) => {
        const entered = giveawayEntries.includes(g.id);
        return (
          <View key={g.id} style={styles.giveawayCard}>
            <LinearGradient
              colors={[g.color + '22', colors.bgCard]}
              style={styles.giveawayGrad}
            >
              <View style={styles.giveawayHeader}>
                <Text style={styles.giveawayTitle}>{g.title}</Text>
                <Text style={styles.giveawayEnds}>Ends {g.ends}</Text>
              </View>
              <Text style={styles.giveawaySponsor}>by {g.sponsor}</Text>
              <View style={styles.giveawayFooter}>
                <Text style={styles.giveawayEntries}>{g.entries + (entered ? 1 : 0)} entries</Text>
                <TouchableOpacity
                  style={[styles.enterBtn, entered && styles.enterBtnDone, { backgroundColor: entered ? colors.success : g.color }]}
                  onPress={() => enterGiveaway(g.id)}
                  disabled={entered}
                >
                  <Text style={styles.enterBtnText}>{entered ? 'Entered ✓' : 'Enter Draw'}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        );
      })}
    </ScrollView>
  );
}

const MOCK_LEADS = [
  { id: 'l1', name: 'Alex Thompson', title: 'CTO', company: 'StartupXYZ', scannedAt: '9:32 AM', color: '#7c3aed', status: 'hot' },
  { id: 'l2', name: 'Rachel Kim', title: 'VP Product', company: 'ScaleUp Co', scannedAt: '10:15 AM', color: '#06b6d4', status: 'warm' },
  { id: 'l3', name: 'Tom Bradley', title: 'Head of IT', company: 'Enterprise Corp', scannedAt: '11:48 AM', color: '#10b981', status: 'cold' },
];

function SponsorEngage() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'tools' | 'scanner' | 'leads' | 'draw'>('tools');
  const [leads, setLeads] = useState(MOCK_LEADS);
  const [scanning, setScanning] = useState(false);
  const [drawWinner, setDrawWinner] = useState<string | null>(null);

  const simulateScan = () => {
    setScanning(true);
    setTimeout(() => {
      setScanning(false);
      const newLead = {
        id: `l${Date.now()}`,
        name: 'New Contact',
        title: 'Director',
        company: 'Demo Corp',
        scannedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        color: '#f59e0b',
        status: 'warm' as const,
      };
      setLeads((prev) => [newLead, ...prev]);
      Alert.alert('Lead Captured!', 'Contact saved to your leads list.');
    }, 1500);
  };

  const runDraw = () => {
    const all = [...leads];
    const winner = all[Math.floor(Math.random() * all.length)];
    setDrawWinner(winner.name);
  };

  if (mode === 'scanner') {
    return (
      <View style={styles.container}>
        <View style={[styles.scannerPage, { paddingTop: insets.top + spacing.xl }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => setMode('tools')}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.scannerTitle}>Scan Attendee Badge</Text>
          <Text style={styles.scannerSubtitle}>Point camera at attendee QR code</Text>

          <View style={styles.scannerFrame}>
            <LinearGradient colors={['#1a0d2e', '#0d1a2e']} style={styles.scannerBg}>
              <View style={styles.qrCorners}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />
              </View>
              {scanning ? (
                <Text style={styles.scanningText}>Scanning…</Text>
              ) : (
                <Text style={styles.scanHintText}>Align QR code here</Text>
              )}
            </LinearGradient>
          </View>

          <TouchableOpacity
            style={[styles.simulateBtn, scanning && styles.simulateBtnDisabled]}
            onPress={simulateScan}
            disabled={scanning}
          >
            <Ionicons name="qr-code" size={18} color="#fff" />
            <Text style={styles.simulateBtnText}>
              {scanning ? 'Scanning…' : 'Simulate Scan (Demo)'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (mode === 'leads') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setMode('tools')}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.scannerTitle}>My Leads</Text>
        <Text style={styles.scannerSubtitle}>{leads.length} contacts captured</Text>
        {leads.map((l) => (
          <View key={l.id} style={styles.leadCard}>
            <View style={[styles.leadAvatar, { backgroundColor: l.color + '22', borderColor: l.color + '44' }]}>
              <Text style={[styles.leadAvatarText, { color: l.color }]}>{l.name[0]}</Text>
            </View>
            <View style={styles.leadInfo}>
              <Text style={styles.leadName}>{l.name}</Text>
              <Text style={styles.leadRole}>{l.title} · {l.company}</Text>
              <Text style={styles.leadTime}>Scanned at {l.scannedAt}</Text>
            </View>
            <View style={[styles.statusDot, {
              backgroundColor: l.status === 'hot' ? '#ef4444' : l.status === 'warm' ? '#f59e0b' : '#6b7280'
            }]} />
          </View>
        ))}
      </ScrollView>
    );
  }

  if (mode === 'draw') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
        <TouchableOpacity style={[styles.backBtn, { marginHorizontal: spacing.xl }]} onPress={() => { setMode('tools'); setDrawWinner(null); }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.drawPage}>
          <Text style={styles.drawTitle}>Lucky Draw</Text>
          <Text style={styles.drawSubtitle}>{leads.length} participants</Text>

          <LinearGradient colors={['#3b1d8a', '#0d1a2e']} style={styles.drawBox}>
            {drawWinner ? (
              <>
                <Text style={styles.drawWinnerLabel}>🎉 Winner!</Text>
                <Text style={styles.drawWinnerName}>{drawWinner}</Text>
              </>
            ) : (
              <>
                <Ionicons name="trophy" size={56} color="#ffd700" />
                <Text style={styles.drawHint}>Press button to pick winner</Text>
              </>
            )}
          </LinearGradient>

          <TouchableOpacity
            style={styles.drawBtn}
            onPress={runDraw}
          >
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.drawBtnGrad}>
              <Ionicons name="shuffle" size={18} color="#fff" />
              <Text style={styles.drawBtnText}>{drawWinner ? 'Draw Again' : 'Pick Winner'}</Text>
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
      <Text style={styles.pageTitle}>Sponsor Tools</Text>
      <Text style={styles.pageSubtitle}>Manage your booth and leads</Text>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{leads.length}</Text>
          <Text style={styles.statLabel}>Leads</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>48</Text>
          <Text style={styles.statLabel}>Booth visits</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statValue}>92%</Text>
          <Text style={styles.statLabel}>Engagement</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryTool} onPress={() => setMode('scanner')}>
        <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.primaryToolGrad}>
          <View style={styles.primaryToolIcon}>
            <Ionicons name="qr-code" size={28} color="#fff" />
          </View>
          <View>
            <Text style={styles.primaryToolTitle}>Scan Badge</Text>
            <Text style={styles.primaryToolSub}>Capture attendee contact info</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.toolGrid}>
        <TouchableOpacity style={styles.toolCard} onPress={() => setMode('leads')}>
          <View style={[styles.toolIcon, { backgroundColor: 'rgba(6,182,212,0.15)' }]}>
            <Ionicons name="people" size={22} color="#06b6d4" />
          </View>
          <Text style={styles.toolTitle}>My Leads</Text>
          <Text style={styles.toolSub}>{leads.length} captured</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolCard} onPress={() => setMode('draw')}>
          <View style={[styles.toolIcon, { backgroundColor: 'rgba(245,158,11,0.15)' }]}>
            <Ionicons name="trophy" size={22} color="#f59e0b" />
          </View>
          <Text style={styles.toolTitle}>Lucky Draw</Text>
          <Text style={styles.toolSub}>Pick winner</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolCard} onPress={() => Alert.alert('Analytics', 'Full analytics coming soon.')}>
          <View style={[styles.toolIcon, { backgroundColor: 'rgba(16,185,129,0.15)' }]}>
            <Ionicons name="bar-chart" size={22} color="#10b981" />
          </View>
          <Text style={styles.toolTitle}>Analytics</Text>
          <Text style={styles.toolSub}>Booth stats</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolCard} onPress={() => Alert.alert('Messages', 'Coming soon.')}>
          <View style={[styles.toolIcon, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
            <Ionicons name="chatbubbles" size={22} color={colors.primary} />
          </View>
          <Text style={styles.toolTitle}>Messages</Text>
          <Text style={styles.toolSub}>Chat with leads</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

export default function EngageScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  if (user?.role === 'sponsor') {
    return <SponsorEngage />;
  }

  return (
    <View style={{ flex: 1, paddingTop: insets.top }}>
      <AttendeeEngage />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  pageTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '800', marginBottom: 4 },
  pageSubtitle: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.xl },

  pointsCard: { marginHorizontal: spacing.xl, marginTop: spacing.lg, marginBottom: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  pointsGrad: { padding: spacing.xl },
  pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: spacing.md },
  pointsLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '600' },
  pointsValue: { color: '#fff', fontSize: 36, fontWeight: '800' },
  tierBadge: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  tierText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  progressBarBg: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', marginBottom: spacing.sm },
  progressBarFill: { height: 4, borderRadius: 2, backgroundColor: '#ffd700' },
  nextTierText: { color: 'rgba(255,255,255,0.5)', fontSize: 11 },

  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  tab: { flex: 1, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  challengeCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.xl, marginBottom: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, gap: spacing.md },
  challengeDone: { opacity: 0.6 },
  challengeLeft: { alignItems: 'center', justifyContent: 'center', width: 40, height: 40, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.05)' },
  challengeEmoji: { fontSize: 20 },
  challengeBody: { flex: 1 },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  challengeTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  pointsPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)' },
  pointsPillText: { color: colors.primary, fontSize: 10, fontWeight: '700' },
  challengeDesc: { color: colors.textMuted, fontSize: 11, marginBottom: spacing.sm },
  challengeProgress: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  challengeProgressBg: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.08)' },
  challengeProgressFill: { height: 4, borderRadius: 2, backgroundColor: colors.primary },
  challengeProgressText: { color: colors.textMuted, fontSize: 10 },
  claimBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.primary },
  claimBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  rankRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.xl, marginBottom: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  rankRowTop: { borderColor: 'rgba(255,215,0,0.2)', backgroundColor: 'rgba(255,215,0,0.04)' },
  rankNum: { width: 32, alignItems: 'center' },
  rankEmoji: { fontSize: 22 },
  rankText: { color: colors.textMuted, fontSize: 14, fontWeight: '700' },
  rankAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1 },
  rankAvatarText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  rankInfo: { flex: 1 },
  rankName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rankTier: { color: colors.textMuted, fontSize: 11 },
  rankPoints: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  myRankCard: { marginHorizontal: spacing.xl, marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  myRankLabel: { color: colors.textSecondary, fontSize: 13 },
  myRankValue: { color: colors.primary, fontSize: 18, fontWeight: '800' },

  giveawayCard: { marginHorizontal: spacing.xl, marginBottom: spacing.md, borderRadius: radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  giveawayGrad: { padding: spacing.xl },
  giveawayHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  giveawayTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '800', flex: 1 },
  giveawayEnds: { color: colors.textMuted, fontSize: 11 },
  giveawaySponsor: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.lg },
  giveawayFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  giveawayEntries: { color: colors.textSecondary, fontSize: 12 },
  enterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: radius.full },
  enterBtnDone: {},
  enterBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  statsRow: { flexDirection: 'row', padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.xl },
  statBox: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  statLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statDivider: { width: 1, backgroundColor: colors.border },

  primaryTool: { marginBottom: spacing.md, borderRadius: radius.xl, overflow: 'hidden' },
  primaryToolGrad: { flexDirection: 'row', alignItems: 'center', padding: spacing.xl, gap: spacing.lg },
  primaryToolIcon: { width: 52, height: 52, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  primaryToolTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  primaryToolSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  toolCard: { width: '47%', padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  toolIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  toolTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  toolSub: { color: colors.textMuted, fontSize: 11 },

  scannerPage: { flex: 1, paddingHorizontal: spacing.xl, paddingBottom: 100 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl },
  backText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  scannerTitle: { color: colors.textPrimary, fontSize: 24, fontWeight: '800', marginBottom: 4 },
  scannerSubtitle: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xxl },
  scannerFrame: { borderRadius: radius.xl, overflow: 'hidden', marginBottom: spacing.xl, aspectRatio: 1 },
  scannerBg: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  qrCorners: { position: 'absolute', top: 20, left: 20, right: 20, bottom: 20 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: colors.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scanningText: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  scanHintText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },
  simulateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.primary },
  simulateBtnDisabled: { opacity: 0.5 },
  simulateBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  leadCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  leadAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  leadAvatarText: { fontSize: 18, fontWeight: '700' },
  leadInfo: { flex: 1 },
  leadName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  leadRole: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  leadTime: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },

  drawPage: { flex: 1, alignItems: 'center', padding: spacing.xl },
  drawTitle: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  drawSubtitle: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xxl },
  drawBox: { width: '100%', aspectRatio: 1.2, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  drawWinnerLabel: { color: '#ffd700', fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  drawWinnerName: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  drawHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: spacing.md },
  drawBtn: { width: '100%', borderRadius: radius.xl, overflow: 'hidden' },
  drawBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  drawBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
