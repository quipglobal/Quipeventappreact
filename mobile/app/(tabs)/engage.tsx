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
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { useChallenges, useCompleteChallenge, usePolls, useVotePoll, useSurveys, useSubmitSurvey, useGiveaways, useEnterGiveaway } from '@/hooks/useEngage';
import { useLeaderboard } from '@/hooks/useAudience';
import { useLeads, useLuckyDraw, useSubmitScan } from '@/hooks/useLeads';
import { DataState } from '@/components/DataState';
import { BadgeCameraScanner } from '@/components/BadgeCameraScanner';
import { colors, spacing, radius } from '@/constants/theme';
import type { LeaderboardEntry } from '@/lib/api/types';

function BadgeScanPanel({ onScanPress }: { onScanPress: () => void }) {
  return (
    <View style={styles.badgePanel}>
      <TouchableOpacity style={styles.badgePanelBtn} onPress={() => router.push('/qr-badge')}>
        <LinearGradient colors={['rgba(124,58,237,0.25)', 'rgba(79,70,229,0.15)']} style={styles.badgePanelBtnGrad}>
          <View style={[styles.badgePanelIcon, { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
            <Ionicons name="qr-code" size={22} color={colors.primary} />
          </View>
          <Text style={styles.badgePanelLabel}>My Badge</Text>
          <Text style={styles.badgePanelSub}>Show your QR code</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.badgePanelBtn} onPress={onScanPress}>
        <LinearGradient colors={['rgba(6,182,212,0.25)', 'rgba(79,70,229,0.15)']} style={styles.badgePanelBtnGrad}>
          <View style={[styles.badgePanelIcon, { backgroundColor: 'rgba(6,182,212,0.2)' }]}>
            <Ionicons name="scan" size={22} color={colors.accent} />
          </View>
          <Text style={styles.badgePanelLabel}>Scan Badge</Text>
          <Text style={styles.badgePanelSub}>Capture contact info</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

function LeadsView({ leads, onBack }: { leads: Array<{ id: string; name: string; title: string; company: string; scannedAt: string; color: string; status: string }>; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}>
      <TouchableOpacity style={styles.backBtn} onPress={onBack}>
        <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      <Text style={styles.scannerTitle}>Scanned Contacts</Text>
      <Text style={styles.scannerSubtitle}>{leads.length} contact{leads.length !== 1 ? 's' : ''} captured</Text>
      {leads.length === 0 && (
        <View style={styles.emptyLeads}>
          <Ionicons name="people-outline" size={48} color={colors.textMuted} />
          <Text style={styles.emptyLeadsText}>No contacts yet</Text>
          <Text style={styles.emptyLeadsSub}>Scan attendee badges to build your list</Text>
        </View>
      )}
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
        // Mirror the web app: scan = lookup + auto check-in + points award.
        addPoints(25, `Scanned ${res.data.name || 'attendee'}'s badge`);
        onScanSuccess();
      } else {
        const msg = res.error?.message || 'We couldn\u2019t recognize that badge. Please try again.';
        showToast(msg);
        // Allow another scan attempt after a brief moment.
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
        <Text style={styles.scannerTitle}>Scan Attendee Badge</Text>
        <Text style={styles.scannerSubtitle}>Point camera at attendee QR code</Text>

        <View style={styles.scannerFrame}>
          <BadgeCameraScanner onCodeDetected={handleCodeDetected} busy={isPending} />
        </View>
      </View>
    </View>
  );
}

function AttendeeEngage() {
  const { user, completedChallenges, completeChallenge, votedPolls, markPollVoted, markSurveyDone, completedSurveys, showToast } = useAuth();
  const [activeTab, setActiveTab] = useState<'challenges' | 'polls' | 'leaderboard' | 'giveaways'>('challenges');
  const [scanMode, setScanMode] = useState<'none' | 'scanner' | 'leads'>('none');
  const [pollVotes, setPollVotes] = useState<Record<string, string>>({});
  const [giveawayEntries, setGiveawayEntries] = useState<string[]>([]);

  const { data: challengesData = [], isLoading: loadingChallenges, isError: errorChallenges, refetch: refetchChallenges } = useChallenges();
  const { data: pollsData = [], isLoading: loadingPolls, isError: errorPolls, refetch: refetchPolls } = usePolls();
  const { data: surveysData = [] } = useSurveys();
  const { data: giveawaysData = [] } = useGiveaways();
  const { data: leaderboardData = [] } = useLeaderboard();
  const { data: leadsData = [], refetch: refetchLeads } = useLeads();

  const { mutate: completeChallengeMutation } = useCompleteChallenge();
  const { mutate: votePollMutation } = useVotePoll();
  const { mutate: submitSurveyMutation } = useSubmitSurvey();
  const { mutate: enterGiveawayMutation } = useEnterGiveaway();

  const isLoading = loadingChallenges || loadingPolls;
  const isError = errorChallenges || errorPolls;
  const refetch = () => { refetchChallenges(); refetchPolls(); };

  const challenges = challengesData;
  const polls = pollsData;
  const surveys = surveysData;
  const giveaways = giveawaysData;
  const leaderboard = leaderboardData;

  const myRank = leaderboard.findIndex((l: { name: string }) => l.name === user?.name) + 1;

  const enterGiveaway = (id: string) => {
    if (giveawayEntries.includes(id)) return;
    setGiveawayEntries((prev) => [...prev, id]);
    enterGiveawayMutation(id);
    showToast('Entered giveaway! Good luck!', 10);
  };

  if (scanMode === 'scanner') {
    return (
      <ScannerView
        onBack={() => setScanMode('none')}
        onScanSuccess={() => { refetchLeads(); setScanMode('leads'); }}
      />
    );
  }

  if (scanMode === 'leads') {
    return <LeadsView leads={leadsData} onBack={() => setScanMode('none')} />;
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <BadgeScanPanel onScanPress={() => setScanMode('scanner')} />

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScrollRow} contentContainerStyle={styles.tabScrollContent}>
        {(['challenges', 'polls', 'leaderboard', 'giveaways'] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'challenges' ? 'Challenges' : t === 'polls' ? 'Polls & Surveys' : t === 'leaderboard' ? 'Leaderboard' : 'Giveaways'}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <DataState loading={isLoading} error={isError ? 'Failed to load content.' : null} onRetry={refetch} />

      {activeTab === 'challenges' && challenges.map((c) => {
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
                onPress={() => {
                  completeChallenge(c.id);
                  completeChallengeMutation(c.id);
                }}
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
          {leaderboard.map((l: LeaderboardEntry) => (
            <View key={l.rank} style={[styles.rankRow, l.rank <= 3 && styles.rankRowTop]}>
              <View style={styles.rankNum}>
                {l.rank === 1 ? <Text style={styles.rankEmoji}>🥇</Text> :
                 l.rank === 2 ? <Text style={styles.rankEmoji}>🥈</Text> :
                 l.rank === 3 ? <Text style={styles.rankEmoji}>🥉</Text> :
                 <Text style={styles.rankText}>{l.rank}</Text>}
              </View>
              <View style={[styles.rankAvatar, { borderColor: (l.tierColor ?? colors.primary) + '66' }]}>
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

      {activeTab === 'polls' && (
        <>
          <Text style={styles.pollSectionLabel}>LIVE POLLS</Text>
          {polls.map((poll) => {
            const voted = pollVotes[poll.id];
            const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
            return (
              <View key={poll.id} style={styles.pollCard}>
                <View style={styles.pollHeader}>
                  <View style={styles.liveChip}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                  <Text style={styles.pollSession}>{poll.session}</Text>
                  <View style={styles.pointsPill}>
                    <Text style={styles.pointsPillText}>+{poll.points} pts</Text>
                  </View>
                </View>
                <Text style={styles.pollQuestion}>{poll.question}</Text>
                <View style={styles.pollOptions}>
                  {poll.options.map((opt) => {
                    const pct = totalVotes > 0 ? (opt.votes / totalVotes) * 100 : 0;
                    const isVoted = voted === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.pollOption, voted && isVoted && styles.pollOptionVoted, voted && !isVoted && styles.pollOptionDim]}
                        onPress={() => {
                          if (voted) return;
                          setPollVotes((p) => ({ ...p, [poll.id]: opt.id }));
                          markPollVoted(poll.id);
                          votePollMutation({ pollId: poll.id, optionId: opt.id });
                          showToast(`Vote cast! +${poll.points} pts`, poll.points);
                        }}
                        disabled={!!voted}
                      >
                        <Text style={[styles.pollOptionText, isVoted && { color: colors.primary }]}>{opt.text}</Text>
                        {voted && (
                          <View style={styles.pollBarBg}>
                            <View style={[styles.pollBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: isVoted ? colors.primary : 'rgba(255,255,255,0.15)' }]} />
                          </View>
                        )}
                        {voted && <Text style={styles.pollPct}>{Math.round(pct)}%</Text>}
                        {!voted && <Ionicons name="radio-button-off" size={18} color={colors.textMuted} />}
                        {isVoted && <Ionicons name="checkmark-circle" size={18} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}

          <Text style={styles.pollSectionLabel}>SURVEYS</Text>
          {surveys.map((sv) => {
            const done = completedSurveys.includes(sv.id);
            return (
              <View key={sv.id} style={[styles.surveyCard, done && { opacity: 0.6 }]}>
                <View style={styles.surveyLeft}>
                  <View style={styles.surveyIcon}>
                    <Ionicons name={done ? 'checkmark-circle' : 'document-text'} size={22} color={done ? colors.success : colors.primary} />
                  </View>
                  <View style={styles.surveyBody}>
                    <Text style={styles.surveyTitle}>{sv.title}</Text>
                    <Text style={styles.surveyDesc} numberOfLines={2}>{sv.desc}</Text>
                    <Text style={styles.surveyMeta}>{sv.questions} questions · +{sv.points} pts</Text>
                  </View>
                </View>
                {!done && (
                  <TouchableOpacity style={styles.surveyBtn} onPress={() => { markSurveyDone(sv.id); submitSurveyMutation({ surveyId: sv.id, answers: {} }); showToast(`Survey submitted! +${sv.points} pts`, sv.points); }}>
                    <Text style={styles.surveyBtnText}>Start</Text>
                  </TouchableOpacity>
                )}
                {done && <Text style={styles.surveyDoneText}>Done</Text>}
              </View>
            );
          })}
        </>
      )}

      {activeTab === 'giveaways' && giveaways.map((g) => {
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

function SponsorEngage() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<'tools' | 'scanner' | 'leads' | 'draw'>('tools');
  const [drawWinner, setDrawWinner] = useState<string | null>(null);

  const { data: leadsData = [], refetch: refetchLeads } = useLeads();
  const { mutate: triggerDraw, isPending: drawPending } = useLuckyDraw();
  const leads = leadsData;

  const runDraw = () => {
    triggerDraw(undefined, {
      onSuccess: (res) => {
        const winner = res.data?.winner;
        setDrawWinner(winner?.name ?? 'Unknown');
      },
      onError: () => Alert.alert('Draw Failed', 'Could not pick a winner. Try again.'),
    });
  };

  if (mode === 'scanner') {
    return (
      <ScannerView
        onBack={() => setMode('tools')}
        onScanSuccess={() => { refetchLeads(); setMode('leads'); }}
      />
    );
  }

  if (mode === 'leads') {
    return <LeadsView leads={leads} onBack={() => setMode('tools')} />;
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
                <Text style={styles.drawWinnerLabel}>Winner!</Text>
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
            style={[styles.drawBtn, drawPending && { opacity: 0.6 }]}
            onPress={runDraw}
            disabled={drawPending}
          >
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.drawBtnGrad}>
              <Ionicons name="shuffle" size={18} color="#fff" />
              <Text style={styles.drawBtnText}>{drawPending ? 'Picking...' : drawWinner ? 'Draw Again' : 'Pick Winner'}</Text>
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

      <BadgeScanPanel onScanPress={() => setMode('scanner')} />

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
  tabScrollRow: { marginBottom: spacing.lg },
  tabScrollContent: { gap: spacing.sm, paddingHorizontal: spacing.xl },
  tab: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, alignItems: 'center', borderRadius: radius.full, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  tabActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#fff' },

  pollSectionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginHorizontal: spacing.xl, marginTop: spacing.md, marginBottom: spacing.sm },
  pollCard: { marginHorizontal: spacing.xl, marginBottom: spacing.md, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  pollHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  liveChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText: { color: '#ef4444', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  pollSession: { flex: 1, color: colors.textMuted, fontSize: 11 },
  pollQuestion: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginBottom: spacing.md },
  pollOptions: { gap: spacing.sm },
  pollOption: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border },
  pollOptionVoted: { borderColor: colors.primary + '60', backgroundColor: 'rgba(124,58,237,0.08)' },
  pollOptionDim: { opacity: 0.5 },
  pollOptionText: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  pollBarBg: { position: 'absolute', left: 0, top: 0, bottom: 0, right: 0, borderRadius: radius.lg, overflow: 'hidden' },
  pollBarFill: { height: '100%', borderRadius: radius.lg },
  pollPct: { color: colors.textMuted, fontSize: 11, fontWeight: '600', minWidth: 32, textAlign: 'right' },

  surveyCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.xl, marginBottom: spacing.sm, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  surveyLeft: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  surveyIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(124,58,237,0.12)', alignItems: 'center', justifyContent: 'center' },
  surveyBody: { flex: 1 },
  surveyTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 4 },
  surveyDesc: { color: colors.textMuted, fontSize: 12, marginBottom: 4 },
  surveyMeta: { color: colors.textSecondary, fontSize: 11 },
  surveyBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: colors.primary },
  surveyBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  surveyDoneText: { color: colors.success, fontSize: 13, fontWeight: '700' },

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
  scanHintText: { color: 'rgba(255,255,255,0.4)', fontSize: 13 },

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

  badgePanel: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  badgePanelBtn: { flex: 1, borderRadius: radius.xl, overflow: 'hidden' },
  badgePanelBtnGrad: { alignItems: 'center', padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  badgePanelIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  badgePanelLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  badgePanelSub: { color: colors.textMuted, fontSize: 10, textAlign: 'center' },

  emptyLeads: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyLeadsText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
  emptyLeadsSub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

});
