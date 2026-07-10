import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { useChallenges, useCompleteChallenge, usePolls, useVotePoll, useSurveys, useGetSurveyDetail, useSubmitSurvey, useGiveaways, useCreateGiveaway, useUpdateGiveaway, useRemoveGiveaway, useRecordGiveawayWinner } from '@/hooks/useEngage';
import { useLeaderboard } from '@/hooks/useAudience';
import { useLeads, useLuckyDraw, useSubmitScan, leadsQueryKey } from '@/hooks/useLeads';
import { DataState } from '@/components/DataState';
import { BadgeCameraScanner } from '@/components/BadgeCameraScanner';
import { SponsorReviews } from '@/components/SponsorReviews';
import { colors, spacing, radius } from '@/constants/theme';
import { submitScan } from '@/lib/api/leads';
import type { ApiResponse, LeaderboardEntry, Lead, Giveaway, GiveawayWinner, Survey, SurveyQuestion } from '@/lib/api/types';

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

function LeadsView({ leads, onBack }: { leads: Lead[]; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast, user } = useAuth();
  const { currentEventId } = useEvent();
  // Track which leads are currently being retried so we can disable the
  // retry button and show a spinner without re-rendering the whole list.
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  // Atomic in-flight guard: setState is async, so a fast double-tap can
  // slip through the `retryingIds.has(...)` check before React re-renders.
  // A ref updates synchronously so a second invocation aborts immediately.
  const inFlightRetriesRef = React.useRef<Set<string>>(new Set());

  const handleRetry = async (lead: Lead) => {
    if (inFlightRetriesRef.current.has(lead.id)) return;
    if (!lead.code) {
      showToast?.('Cannot retry — original badge code is missing.');
      return;
    }
    inFlightRetriesRef.current.add(lead.id);
    setRetryingIds((prev) => new Set(prev).add(lead.id));
    try {
      const res = await submitScan({
        badgeData: lead.code,
        name: lead.name,
        company: lead.company,
        title: lead.title,
      });
      if (res.success && res.data && !res.data.pendingSync) {
        // Backend accepted this time. Replace the local entry (matched by
        // both ids, since the server-assigned id likely differs) with the
        // canonical row, then trigger a refetch to reconcile.
        const newLead = res.data;
        const leadsKey = leadsQueryKey(user?.id ?? null, currentEventId);
        queryClient.setQueryData<ApiResponse<Lead[]>>(leadsKey, (prev) => {
          const existing = prev?.data ?? [];
          const filtered = existing.filter(
            (l) => l.id !== lead.id && l.id !== newLead.id,
          );
          return { success: true, data: [newLead, ...filtered] };
        });
        queryClient.invalidateQueries({ queryKey: leadsKey });
        showToast?.(`Synced ${lead.name} to the server`);
      } else {
        showToast?.('Still couldn\u2019t sync. Saved on this device for now.');
      }
    } finally {
      inFlightRetriesRef.current.delete(lead.id);
      setRetryingIds((prev) => {
        const next = new Set(prev);
        next.delete(lead.id);
        return next;
      });
    }
  };

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
      {leads.map((l) => {
        const isRetrying = retryingIds.has(l.id);
        return (
          <View key={l.id} style={styles.leadCard}>
            <View style={styles.leadCardRow}>
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
            {!!l.notes && (
              <Text style={styles.leadNotes} numberOfLines={2}>
                {l.notes}
              </Text>
            )}
            {!!l.tags?.length && (
              <View style={styles.leadTagsRow}>
                {l.tags.slice(0, 4).map((tag) => (
                  <View key={tag} style={styles.leadTagPill}>
                    <Text style={styles.leadTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
            {l.pendingSync && (
              <View style={styles.pendingSyncBar}>
                <Ionicons name="cloud-offline-outline" size={14} color="#d97706" />
                <Text style={styles.pendingSyncText}>
                  Saved on this device — not synced to server
                </Text>
                <TouchableOpacity
                  onPress={() => handleRetry(l)}
                  disabled={isRetrying}
                  style={[styles.pendingSyncBtn, isRetrying && styles.pendingSyncBtnDisabled]}
                  accessibilityRole="button"
                  accessibilityLabel={`Retry syncing ${l.name}`}
                  accessibilityState={{ disabled: isRetrying, busy: isRetrying }}
                >
                  {isRetrying ? (
                    <ActivityIndicator size="small" color="#b45309" />
                  ) : (
                    <Ionicons name="refresh" size={12} color="#b45309" />
                  )}
                  <Text style={styles.pendingSyncBtnText}>
                    {isRetrying ? 'Syncing…' : 'Retry'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      })}
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
        const name = res.data.name || 'attendee';
        // Use the server-awarded points (0 on duplicate scans means no
        // double-credit and no toast). Don't fall back to a hardcoded
        // number — the backend is the source of truth.
        const pts = typeof res.data.pointsAwarded === 'number' ? res.data.pointsAwarded : 0;
        if (pts > 0) {
          addPoints(pts, `Scanned ${name}'s badge`);
        }
        // Confirm the lead actually saved (this is what the user reported
        // missing — the lead landing in the Leads tab + event report).
        showToast(`Saved ${name} to your leads`);
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

interface SurveyDetailViewProps {
  survey: Survey;
  alreadyDone: boolean;
  onBack: () => void;
}

function SurveyDetailView({ survey, alreadyDone, onBack }: SurveyDetailViewProps) {
  const insets = useSafeAreaInsets();
  const { markSurveyDone, showToast } = useAuth();
  const { data: detail, isLoading } = useGetSurveyDetail(survey.id);
  const { mutate: submitSurveyMutation, isPending: submitting } = useSubmitSurvey();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const questions: SurveyQuestion[] = detail?.questionList?.length
    ? detail.questionList
    : [{ id: 'feedback', type: 'text', text: 'Share your overall feedback', required: false }];

  const setAnswer = (qId: string, val: string) =>
    setAnswers((prev) => ({ ...prev, [qId]: val }));

  const toggleCheckbox = (qId: string, optionText: string) => {
    setAnswers((prev) => {
      const parts = prev[qId] ? prev[qId].split('|||') : [];
      const idx = parts.indexOf(optionText);
      const next = idx === -1 ? [...parts, optionText] : parts.filter((_, i) => i !== idx);
      return { ...prev, [qId]: next.join('|||') };
    });
  };

  const handleSubmit = () => {
    const missing = questions.filter((q) => q.required && !answers[q.id]?.trim());
    if (missing.length > 0) {
      showToast?.(`Please answer: ${missing[0].text}`);
      return;
    }

    submitSurveyMutation(
      { surveyId: survey.id, answers },
      {
        onSuccess: (res) => {
          const firstTime = !alreadyDone;
          markSurveyDone(survey.id);
          const pts = res.data?.points ?? survey.points;
          showToast?.(firstTime ? `Survey submitted! +${pts} pts` : 'Answers updated!', firstTime ? pts : undefined);
          setSubmitted(true);
          setTimeout(() => onBack(), 1200);
        },
        onError: () => {
          // Fallback for demo mode/offline
          markSurveyDone(survey.id);
          const firstTime = !alreadyDone;
          showToast?.(firstTime ? `Saved! +${survey.points} pts` : 'Answers updated!', firstTime ? survey.points : undefined);
          setSubmitted(true);
          setTimeout(() => onBack(), 1200);
        },
      },
    );
  };

  if (submitted) {
    return (
      <View style={[styles.container, styles.surveySuccessCenter]}>
        <Ionicons name="checkmark-circle" size={72} color={colors.success} />
        <Text style={styles.surveySuccessTitle}>{alreadyDone ? 'Answers Updated!' : 'Survey Complete!'}</Text>
        {!alreadyDone && <Text style={styles.surveySuccessPts}>+{survey.points} pts earned</Text>}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.scannerTitle}>{survey.title}</Text>
        {!!survey.desc && <Text style={styles.surveyDetailDesc}>{survey.desc}</Text>}

        <View style={styles.surveyDetailMeta}>
          <Text style={styles.surveyMeta}>
            {isLoading ? '…' : `${questions.length} question${questions.length !== 1 ? 's' : ''}`}
          </Text>
          {!alreadyDone ? (
            <View style={styles.pointsPill}>
              <Text style={styles.pointsPillText}>+{survey.points} pts</Text>
            </View>
          ) : (
            <View style={styles.surveyDonePill}>
              <Ionicons name="checkmark-circle" size={12} color={colors.success} />
              <Text style={styles.surveyDonePillText}>Completed — update anytime</Text>
            </View>
          )}
        </View>

        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} />
        ) : (
          questions.map((q, idx) => (
            <View key={q.id} style={styles.questionCard}>
              <Text style={styles.questionNum}>
                Q{idx + 1}{q.required ? ' *' : ''}
              </Text>
              <Text style={styles.questionText}>{q.text}</Text>

              {(q.type === 'text') && (
                <TextInput
                  style={styles.textAnswerInput}
                  placeholder="Type your answer here…"
                  placeholderTextColor={colors.textMuted}
                  value={answers[q.id] ?? ''}
                  onChangeText={(v) => setAnswer(q.id, v)}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                />
              )}

              {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                <View style={styles.optionsList}>
                  {(q.options ?? []).map((opt) => {
                    const sel = answers[q.id] === opt.id || answers[q.id] === opt.text;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.optionRow, sel && styles.optionRowSelected]}
                        onPress={() => setAnswer(q.id, opt.text)}
                      >
                        <View style={[styles.radioCircle, sel && styles.radioCircleFilled]}>
                          {sel && <View style={styles.radioInnerDot} />}
                        </View>
                        <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt.text}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {q.type === 'checkbox' && (
                <View style={styles.optionsList}>
                  {(q.options ?? []).map((opt) => {
                    const sel = (answers[q.id] ?? '').split('|||').filter(Boolean).includes(opt.text);
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[styles.optionRow, sel && styles.optionRowSelected]}
                        onPress={() => toggleCheckbox(q.id, opt.text)}
                      >
                        <View style={[styles.checkboxBox, sel && styles.checkboxBoxFilled]}>
                          {sel && <Ionicons name="checkmark" size={11} color="#fff" />}
                        </View>
                        <Text style={[styles.optionText, sel && styles.optionTextSelected]}>{opt.text}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {q.type === 'rating' && (
                <View style={styles.ratingRow}>
                  {[1, 2, 3, 4, 5].map((star) => {
                    const filled = star <= parseInt(answers[q.id] ?? '0');
                    return (
                      <TouchableOpacity key={star} onPress={() => setAnswer(q.id, String(star))} style={styles.starBtn}>
                        <Ionicons
                          name={filled ? 'star' : 'star-outline'}
                          size={36}
                          color={filled ? colors.warning : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                  {answers[q.id] && (
                    <Text style={styles.ratingLabel}>{answers[q.id]} / 5</Text>
                  )}
                </View>
              )}

              {q.type === 'yes_no' && (
                <View style={styles.yesNoRow}>
                  {(['Yes', 'No'] as const).map((opt) => {
                    const sel = answers[q.id] === opt;
                    return (
                      <TouchableOpacity
                        key={opt}
                        style={[styles.yesNoBtn, sel && styles.yesNoBtnSelected]}
                        onPress={() => setAnswer(q.id, opt)}
                      >
                        <Text style={[styles.yesNoBtnText, sel && styles.yesNoBtnTextSelected]}>{opt}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          ))
        )}

        {!isLoading && (
          <TouchableOpacity
            style={[styles.surveySubmitBtn, submitting && { opacity: 0.6 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.surveySubmitGrad}>
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.surveySubmitText}>{alreadyDone ? 'Update Answers' : 'Submit Survey'}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type EngageSection = 'hub' | 'polls' | 'surveys' | 'challenges' | 'leaderboard' | 'giveaways' | 'reviews';

function AttendeeEngage() {
  const { user, completedChallenges, completeChallenge, votedPolls, markPollVoted, markSurveyDone, completedSurveys, showToast } = useAuth();
  const insets = useSafeAreaInsets();
  const { tab: deepLinkTab } = useLocalSearchParams<{ tab?: string }>();
  const [section, setSection] = useState<EngageSection>('hub');

  useEffect(() => {
    if (deepLinkTab === 'polls') setSection('polls');
    else if (deepLinkTab === 'leaderboard') setSection('leaderboard');
    else if (deepLinkTab === 'giveaways') setSection('giveaways');
  }, [deepLinkTab]);

  const [scanMode, setScanMode] = useState<'none' | 'scanner' | 'leads'>('none');
  const [pollVotes, setPollVotes] = useState<Record<string, string>>({});
  const [activeSurvey, setActiveSurvey] = useState<Survey | null>(null);
  const [reviewsCompanyId, setReviewsCompanyId] = useState<string | null>(null);

  const { data: challengesData = [], isLoading: loadingChallenges, isError: errorChallenges, refetch: refetchChallenges } = useChallenges();
  const { data: pollsData = [], isLoading: loadingPolls, isError: errorPolls, refetch: refetchPolls } = usePolls();
  const { data: surveysData = [] } = useSurveys();
  const { data: giveawaysData = [] } = useGiveaways();
  const { data: leaderboardData = [] } = useLeaderboard();
  const { data: leadsData = [], refetch: refetchLeads } = useLeads();

  const { mutate: completeChallengeMutation } = useCompleteChallenge();
  const { mutate: votePollMutation } = useVotePoll();

  const isLoading = loadingChallenges || loadingPolls;
  const isError = errorChallenges || errorPolls;
  const refetch = () => { refetchChallenges(); refetchPolls(); };

  const challenges = challengesData;
  const polls = pollsData;
  const surveys = surveysData;
  const giveaways = giveawaysData;
  const leaderboard = leaderboardData;

  const myRank = leaderboard.findIndex((l: { name: string }) => l.name === user?.name) + 1;
  const livePollsCount = polls.filter((p) => p.isLive).length;
  const pendingSurveysCount = surveys.filter((s) => !completedSurveys.includes(s.id)).length;

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

  if (activeSurvey) {
    return (
      <SurveyDetailView
        survey={activeSurvey}
        alreadyDone={completedSurveys.includes(activeSurvey.id)}
        onBack={() => setActiveSurvey(null)}
      />
    );
  }

  if (section === 'reviews' && reviewsCompanyId) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <TouchableOpacity style={[styles.backBtn, { marginHorizontal: spacing.xl, marginBottom: spacing.lg }]} onPress={() => { setSection('hub'); setReviewsCompanyId(null); }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <SponsorReviews companyId={reviewsCompanyId!} companyName={user?.company ?? ''} />
      </View>
    );
  }

  if (section === 'polls') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSection('hub')}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Engage</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Live Polls</Text>
        <DataState loading={loadingPolls} error={errorPolls ? 'Failed to load polls.' : null} onRetry={refetchPolls} />
        {polls.length === 0 && !loadingPolls && (
          <View style={styles.emptyLeads}>
            <Ionicons name="chatbubble-ellipses-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyLeadsText}>No live polls right now</Text>
            <Text style={styles.emptyLeadsSub}>Check back during sessions</Text>
          </View>
        )}
        {polls.map((poll) => {
          const voted = pollVotes[poll.id] || votedPolls[poll.id] || poll.userVotedOptionId || null;
          const totalVotes = poll.options.reduce((s, o) => s + o.votes, 0);
          return (
            <View key={poll.id} style={styles.pollCard}>
              <View style={styles.pollHeader}>
                <View style={styles.liveChip}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
                <Text style={styles.pollSession}>{poll.session}</Text>
                <View style={styles.pointsPill}><Text style={styles.pointsPillText}>+{poll.points} pts</Text></View>
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
                        markPollVoted(poll.id, opt.id);
                        votePollMutation({ pollId: poll.id, optionId: opt.id });
                        showToast(`Vote cast! +${poll.points} pts`, poll.points);
                      }}
                      disabled={!!voted}
                    >
                      <Text style={[styles.pollOptionText, isVoted && { color: colors.primary }]}>{opt.text}</Text>
                      {voted && <View style={styles.pollBarBg}><View style={[styles.pollBarFill, { width: `${pct}%` as `${number}%`, backgroundColor: isVoted ? colors.primary : 'rgba(255,255,255,0.15)' }]} /></View>}
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
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  if (section === 'surveys') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSection('hub')}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Engage</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Surveys</Text>
        {surveys.length === 0 && (
          <View style={styles.emptyLeads}>
            <Ionicons name="document-text-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyLeadsText}>No surveys yet</Text>
            <Text style={styles.emptyLeadsSub}>Check back soon</Text>
          </View>
        )}
        {surveys.map((sv) => {
          const done = completedSurveys.includes(sv.id);
          return (
            <TouchableOpacity key={sv.id} style={styles.surveyCard} onPress={() => setActiveSurvey(sv)} activeOpacity={0.85}>
              <View style={styles.surveyLeft}>
                <View style={styles.surveyIcon}>
                  <Ionicons name={done ? 'checkmark-circle' : 'document-text'} size={22} color={done ? colors.success : colors.primary} />
                </View>
                <View style={styles.surveyBody}>
                  <Text style={styles.surveyTitle}>{sv.title}</Text>
                  <Text style={styles.surveyDesc} numberOfLines={2}>{sv.desc}</Text>
                  <Text style={styles.surveyMeta}>{sv.questions} question{sv.questions !== 1 ? 's' : ''} · +{sv.points} pts</Text>
                </View>
              </View>
              <View style={[styles.surveyBtn, done && styles.surveyBtnDone]}>
                <Text style={[styles.surveyBtnText, done && styles.surveyBtnTextDone]}>{done ? 'Update' : 'Start'}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  if (section === 'challenges') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSection('hub')}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Engage</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Challenges</Text>
        <DataState loading={loadingChallenges} error={errorChallenges ? 'Failed to load challenges.' : null} onRetry={refetchChallenges} />
        {challenges.map((c) => {
          const done = completedChallenges.includes(c.id);
          const pct = Math.min((c.progress / c.total) * 100, 100);
          return (
            <View key={c.id} style={[styles.challengeCard, done && styles.challengeDone]}>
              <View style={styles.challengeLeft}><Text style={styles.challengeEmoji}>{c.emoji}</Text></View>
              <View style={styles.challengeBody}>
                <View style={styles.challengeHeader}>
                  <Text style={styles.challengeTitle}>{c.title}</Text>
                  <View style={styles.pointsPill}><Text style={styles.pointsPillText}>+{c.points} pts</Text></View>
                </View>
                <Text style={styles.challengeDesc}>{c.desc}</Text>
                <View style={styles.challengeProgress}>
                  <View style={styles.challengeProgressBg}><View style={[styles.challengeProgressFill, { width: `${pct}%` }]} /></View>
                  <Text style={styles.challengeProgressText}>{c.progress}/{c.total}</Text>
                </View>
              </View>
              {!done && c.progress === c.total && (
                <TouchableOpacity style={styles.claimBtn} onPress={() => { completeChallenge(c.id); completeChallengeMutation(c.id); }}>
                  <Text style={styles.claimBtnText}>Claim</Text>
                </TouchableOpacity>
              )}
              {done && <Ionicons name="checkmark-circle" size={24} color={colors.success} />}
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  if (section === 'leaderboard') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSection('hub')}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Engage</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Leaderboard</Text>
        <TouchableOpacity style={styles.fullLeaderboardBtn} onPress={() => router.push('/leaderboard')} activeOpacity={0.85}>
          <Ionicons name="trophy" size={16} color={colors.primary} />
          <Text style={styles.fullLeaderboardBtnText}>View full leaderboard</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
        </TouchableOpacity>
        {leaderboard.map((l: LeaderboardEntry) => (
          <View key={l.rank} style={[styles.rankRow, l.rank <= 3 && styles.rankRowTop]}>
            <View style={styles.rankNum}>
              {l.rank === 1 ? <Text style={styles.rankEmoji}>🥇</Text> : l.rank === 2 ? <Text style={styles.rankEmoji}>🥈</Text> : l.rank === 3 ? <Text style={styles.rankEmoji}>🥉</Text> : <Text style={styles.rankText}>{l.rank}</Text>}
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
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  if (section === 'giveaways') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]} showsVerticalScrollIndicator={false}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSection('hub')}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Engage</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Giveaways</Text>
        {giveaways.length === 0 && (
          <View style={styles.emptyLeads}>
            <Ionicons name="gift-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyLeadsText}>No active giveaways</Text>
          </View>
        )}
        {giveaways.map((g) => (
          <View key={g.id} style={styles.giveawayCard}>
            <LinearGradient colors={[g.color + '22', colors.bgCard]} style={styles.giveawayGrad}>
              <View style={styles.giveawayHeader}>
                <Text style={styles.giveawayTitle}>{g.title}</Text>
                {!!g.ends && <Text style={styles.giveawayEnds}>Ends {g.ends}</Text>}
              </View>
              <Text style={styles.giveawaySponsor}>by {g.sponsor}</Text>
              <View style={styles.giveawayHowToRow}>
                <Text style={styles.giveawayHowToText}>Visit the booth and have your badge scanned to enter the draw.</Text>
              </View>
            </LinearGradient>
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    );
  }

  // ── HUB (main engage screen) ──
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md, paddingBottom: 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>Engage</Text>
      <Text style={styles.pageSubtitle}>Your activity at this event</Text>

      {/* Points card */}
      <View style={styles.pointsCard}>
        <LinearGradient colors={['#3b1d8a', '#1e3a5f']} style={styles.pointsGrad}>
          <View style={styles.pointsRow}>
            <View>
              <Text style={styles.pointsLabel}>Your Points</Text>
              <Text style={styles.pointsValue}>{user?.points ?? 0}</Text>
            </View>
            <TouchableOpacity style={styles.pointsHistoryBtn} onPress={() => setSection('leaderboard')}>
              <Text style={styles.pointsHistoryText}>Leaderboard</Text>
              <Ionicons name="chevron-forward" size={12} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${Math.min(((user?.points ?? 0) / 500) * 100, 100)}%` }]} />
          </View>
          <View style={styles.pointsFooter}>
            <Text style={styles.pointsFooterText}>Rank #{myRank > 0 ? myRank : '—'} of {leaderboard.length}</Text>
            <Text style={styles.pointsFooterText}>{user?.tier ?? 'Bronze'} Tier</Text>
          </View>
        </LinearGradient>
      </View>

      {/* Engagement hub cards */}
      <Text style={styles.hubSectionLabel}>ENGAGEMENT HUB</Text>

      {/* Live Polls card */}
      <TouchableOpacity style={styles.hubCard} onPress={() => setSection('polls')} activeOpacity={0.85}>
        <View style={[styles.hubCardIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
          <Ionicons name="bar-chart" size={22} color="#ef4444" />
        </View>
        <View style={styles.hubCardBody}>
          <Text style={styles.hubCardTitle}>Live Polls</Text>
          <Text style={styles.hubCardSub}>{livePollsCount > 0 ? `${livePollsCount} active` : 'No active polls'}</Text>
        </View>
        {livePollsCount > 0 && (
          <View style={styles.hubLiveBadge}>
            <View style={styles.hubLiveDot} />
            <Text style={styles.hubLiveText}>LIVE</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Surveys card */}
      <TouchableOpacity style={styles.hubCard} onPress={() => setSection('surveys')} activeOpacity={0.85}>
        <View style={[styles.hubCardIcon, { backgroundColor: 'rgba(124,58,237,0.12)' }]}>
          <Ionicons name="document-text" size={22} color={colors.primary} />
        </View>
        <View style={styles.hubCardBody}>
          <Text style={styles.hubCardTitle}>Surveys</Text>
          <Text style={styles.hubCardSub}>{pendingSurveysCount > 0 ? `${pendingSurveysCount} to complete` : surveys.length > 0 ? 'All done!' : 'No surveys yet'}</Text>
        </View>
        {pendingSurveysCount > 0 && (
          <View style={[styles.hubBadge, { backgroundColor: colors.primary }]}>
            <Text style={styles.hubBadgeText}>{pendingSurveysCount}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Sponsor Reviews card */}
      <TouchableOpacity style={styles.hubCard} onPress={() => { setReviewsCompanyId(user?.id ?? 'default'); setSection('reviews'); }} activeOpacity={0.85}>
        <View style={[styles.hubCardIcon, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
          <Ionicons name="star" size={22} color={colors.warning} />
        </View>
        <View style={styles.hubCardBody}>
          <Text style={styles.hubCardTitle}>Sponsor Reviews</Text>
          <Text style={styles.hubCardSub}>Rate the sponsors you visited</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Challenges card */}
      <TouchableOpacity style={styles.hubCard} onPress={() => setSection('challenges')} activeOpacity={0.85}>
        <View style={[styles.hubCardIcon, { backgroundColor: 'rgba(16,185,129,0.12)' }]}>
          <Ionicons name="flash" size={22} color={colors.success} />
        </View>
        <View style={styles.hubCardBody}>
          <Text style={styles.hubCardTitle}>Challenges</Text>
          <Text style={styles.hubCardSub}>{challenges.length > 0 ? `${challenges.length} challenge${challenges.length !== 1 ? 's' : ''}` : 'Complete tasks, earn pts'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Giveaways card */}
      <TouchableOpacity style={styles.hubCard} onPress={() => setSection('giveaways')} activeOpacity={0.85}>
        <View style={[styles.hubCardIcon, { backgroundColor: 'rgba(236,72,153,0.12)' }]}>
          <Ionicons name="gift" size={22} color="#ec4899" />
        </View>
        <View style={styles.hubCardBody}>
          <Text style={styles.hubCardTitle}>Giveaways</Text>
          <Text style={styles.hubCardSub}>{giveaways.length > 0 ? `${giveaways.length} active` : 'No active giveaways'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </TouchableOpacity>

      {/* Badge scan quick actions */}
      <Text style={styles.hubSectionLabel}>QUICK ACTIONS</Text>
      <BadgeScanPanel onScanPress={() => setScanMode('scanner')} />
    </ScrollView>
  );
}

function GiveawaysManager({
  sponsorName,
  sponsorId,
  onBack,
}: {
  sponsorName: string;
  sponsorId: string;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { data: giveaways = [], isLoading, isError, refetch } = useGiveaways();
  const { mutate: createGiveaway } = useCreateGiveaway();
  const { mutate: updateGiveaway } = useUpdateGiveaway();
  const { mutate: removeGiveaway } = useRemoveGiveaway();

  const [title, setTitle] = useState('');
  const [items, setItems] = useState('1');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editItems, setEditItems] = useState('1');

  const handleCreate = () => {
    const trimmed = title.trim();
    const count = parseInt(items, 10);
    if (!trimmed) {
      Alert.alert('Missing title', 'Enter a name for the giveaway prize.');
      return;
    }
    createGiveaway({
      title: trimmed,
      numberOfItems: Number.isFinite(count) && count > 0 ? count : 1,
      image: '',
      sponsorName,
      sponsorId,
    });
    setTitle('');
    setItems('1');
  };

  const startEdit = (g: Giveaway) => {
    setEditingId(g.id);
    setEditTitle(g.title);
    setEditItems(String(g.numberOfItems ?? 1));
  };

  const saveEdit = (id: string) => {
    const trimmed = editTitle.trim();
    const count = parseInt(editItems, 10);
    if (!trimmed) {
      Alert.alert('Missing title', 'Giveaway title cannot be empty.');
      return;
    }
    updateGiveaway({
      id,
      updates: {
        title: trimmed,
        numberOfItems: Number.isFinite(count) && count > 0 ? count : 1,
      },
    });
    setEditingId(null);
  };

  const confirmDelete = (g: Giveaway) => {
    Alert.alert('Delete giveaway', `Remove "${g.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeGiveaway(g.id) },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Manage Giveaways</Text>
        <Text style={styles.pageSubtitle}>Create prizes for your lucky draw</Text>

        {/* Create form */}
        <View style={styles.gmForm}>
          <Text style={styles.gmLabel}>Prize title</Text>
          <TextInput
            style={styles.gmInput}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. AirPods Pro"
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
          />
          <Text style={styles.gmLabel}>Number of items</Text>
          <TextInput
            style={styles.gmInput}
            value={items}
            onChangeText={(t) => setItems(t.replace(/[^0-9]/g, ''))}
            placeholder="1"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.gmAddBtn} onPress={handleCreate}>
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.gmAddBtnGrad}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.gmAddBtnText}>Add Giveaway</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <DataState loading={isLoading} error={isError ? 'Failed to load giveaways.' : null} onRetry={refetch} />

        {!isLoading && giveaways.length === 0 && (
          <View style={styles.emptyLeads}>
            <Ionicons name="gift-outline" size={28} color={colors.textMuted} />
            <Text style={styles.emptyLeadsText}>No giveaways yet</Text>
            <Text style={styles.emptyLeadsSub}>Add a prize above to get started</Text>
          </View>
        )}

        {giveaways.map((g) => (
          <View key={g.id} style={styles.gmCard}>
            {editingId === g.id ? (
              <>
                <TextInput
                  style={styles.gmInput}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Prize title"
                  placeholderTextColor={colors.textMuted}
                />
                <TextInput
                  style={styles.gmInput}
                  value={editItems}
                  onChangeText={(t) => setEditItems(t.replace(/[^0-9]/g, ''))}
                  placeholder="1"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                />
                <View style={styles.gmEditRow}>
                  <TouchableOpacity style={styles.gmGhostBtn} onPress={() => setEditingId(null)}>
                    <Text style={styles.gmGhostBtnText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.gmSaveBtn} onPress={() => saveEdit(g.id)}>
                    <Text style={styles.gmSaveBtnText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <View style={styles.gmCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.gmCardTitle}>{g.title}</Text>
                    <Text style={styles.gmCardMeta}>
                      {(g.numberOfItems ?? 1)} item{(g.numberOfItems ?? 1) !== 1 ? 's' : ''}
                      {g.sponsor ? ` · by ${g.sponsor}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.gmIconBtn} onPress={() => startEdit(g)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.gmIconBtn} onPress={() => confirmDelete(g)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                {!!g.winners && g.winners.length > 0 && (
                  <View style={styles.gmWinners}>
                    <Text style={styles.gmWinnersLabel}>
                      Winner{g.winners.length !== 1 ? 's' : ''}
                    </Text>
                    {g.winners.map((w, i) => (
                      <View key={`${w.id}-${i}`} style={styles.gmWinnerRow}>
                        <Ionicons name="trophy" size={13} color="#ffd700" />
                        <Text style={styles.gmWinnerName} numberOfLines={1}>
                          {w.name}{w.company ? ` · ${w.company}` : ''}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        ))}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SponsorEngage() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [mode, setMode] = useState<'tools' | 'scanner' | 'leads' | 'draw' | 'giveaways'>('tools');
  const [drawWinner, setDrawWinner] = useState<{ id: string; name: string; company?: string; title?: string; avatar?: string } | null>(null);
  const [selectedGiveaway, setSelectedGiveaway] = useState<Giveaway | null>(null);
  const [showGiveawayPicker, setShowGiveawayPicker] = useState(false);
  const [drawShuffling, setDrawShuffling] = useState(false);

  const { data: leadsData = [], refetch: refetchLeads } = useLeads();
  const { data: giveawaysForDraw = [] } = useGiveaways();
  const { mutate: triggerDraw, isPending: drawPending } = useLuckyDraw();
  const recordWinner = useRecordGiveawayWinner();
  const leads = leadsData;

  const drawBusy = drawPending || drawShuffling;

  // Reveal a winner: brief shuffle animation cycling through candidate
  // names, then settle on the chosen winner and persist the result.
  const revealWinner = (
    winner: { id: string; name: string; company?: string; title?: string; avatar?: string },
    pool: Lead[],
  ) => {
    const candidates = pool.length > 0 ? pool : [{ id: winner.id, name: winner.name } as Lead];
    setDrawShuffling(true);
    let ticks = 0;
    const maxTicks = 12;
    const interval = setInterval(() => {
      ticks += 1;
      const rand = candidates[Math.floor(Math.random() * candidates.length)];
      setDrawWinner({ id: String(rand.id), name: rand.name ?? 'Picking…' });
      if (ticks >= maxTicks) {
        clearInterval(interval);
        setDrawWinner(winner);
        setDrawShuffling(false);
        if (selectedGiveaway) {
          const gw: GiveawayWinner = {
            id: winner.id,
            name: winner.name,
            company: winner.company,
            title: winner.title,
            avatar: winner.avatar,
            drawnAt: new Date().toISOString(),
          };
          void recordWinner(selectedGiveaway.id, gw);
        }
      }
    }, 80);
  };

  // Client-side fallback pick used when the backend `/leads/draw`
  // route isn't deployed (NOT_IMPLEMENTED) — mirrors the web
  // SponsorDrawPage fallback of choosing a random eligible lead.
  const pickLocalWinner = () => {
    const pool = leads;
    if (pool.length === 0) {
      Alert.alert('No participants', 'Scan some leads before running a draw.');
      return;
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    revealWinner(
      { id: String(chosen.id), name: chosen.name ?? 'Unknown', company: chosen.company, title: chosen.title },
      pool,
    );
  };

  const runDraw = () => {
    if (drawBusy) return;
    triggerDraw(selectedGiveaway?.id, {
      onSuccess: (res) => {
        const w = res.data?.winner;
        if (res.success && w) {
          revealWinner(
            { id: String(w.id), name: w.name ?? 'Unknown', company: w.company, title: w.title },
            leads,
          );
          return;
        }
        // Backend route missing (NOT_IMPLEMENTED) or a not-found style
        // failure — fall back to a client-side random pick from the
        // captured leads so the draw still works offline / pre-deploy.
        pickLocalWinner();
      },
      onError: () => pickLocalWinner(),
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

  if (mode === 'giveaways') {
    return (
      <GiveawaysManager
        sponsorName={user?.company || user?.name || ''}
        sponsorId={user?.id ?? ''}
        onBack={() => setMode('tools')}
      />
    );
  }

  if (mode === 'draw') {
    return (
      <View style={[styles.container, { paddingTop: insets.top + spacing.xl }]}>
        <TouchableOpacity style={[styles.backBtn, { marginHorizontal: spacing.xl }]} onPress={() => { setMode('tools'); setDrawWinner(null); setSelectedGiveaway(null); }}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
        <View style={styles.drawPage}>
          <Text style={styles.drawTitle}>Lucky Draw</Text>
          <Text style={styles.drawSubtitle}>{leads.length} participants</Text>

          {/* Giveaway selector — links the draw result to a specific prize */}
          {giveawaysForDraw.length > 0 && (
            <TouchableOpacity
              style={styles.giveawayPickerBtn}
              onPress={() => setShowGiveawayPicker(v => !v)}
            >
              <Text style={styles.giveawayPickerLabel}>
                {selectedGiveaway ? selectedGiveaway.title : 'Select giveaway (optional)'}
              </Text>
              <Ionicons name={showGiveawayPicker ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
            </TouchableOpacity>
          )}
          {showGiveawayPicker && (
            <View style={styles.giveawayPickerList}>
              <TouchableOpacity
                style={styles.giveawayPickerItem}
                onPress={() => { setSelectedGiveaway(null); setShowGiveawayPicker(false); }}
              >
                <Text style={[styles.giveawayPickerItemText, !selectedGiveaway && { color: colors.primary }]}>None</Text>
              </TouchableOpacity>
              {giveawaysForDraw.map(g => (
                <TouchableOpacity
                  key={g.id}
                  style={styles.giveawayPickerItem}
                  onPress={() => { setSelectedGiveaway(g); setShowGiveawayPicker(false); }}
                >
                  <Text style={[styles.giveawayPickerItemText, selectedGiveaway?.id === g.id && { color: colors.primary }]}>{g.title}</Text>
                  {selectedGiveaway?.id === g.id && <Ionicons name="checkmark" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <LinearGradient colors={['#3b1d8a', '#0d1a2e']} style={styles.drawBox}>
            {drawWinner ? (
              <>
                <Text style={styles.drawWinnerLabel}>Winner!</Text>
                <Text style={styles.drawWinnerName}>{drawWinner.name}</Text>
                {!!drawWinner.company && <Text style={styles.drawWinnerCompany}>{drawWinner.company}</Text>}
              </>
            ) : (
              <>
                <Ionicons name="trophy" size={56} color="#ffd700" />
                <Text style={styles.drawHint}>Press button to pick winner</Text>
              </>
            )}
          </LinearGradient>

          <TouchableOpacity
            style={[styles.drawBtn, drawBusy && { opacity: 0.6 }]}
            onPress={runDraw}
            disabled={drawBusy}
          >
            <LinearGradient colors={[colors.primary, colors.secondary]} style={styles.drawBtnGrad}>
              <Ionicons name="shuffle" size={18} color="#fff" />
              <Text style={styles.drawBtnText}>{drawBusy ? 'Picking...' : drawWinner ? 'Draw Again' : 'Pick Winner'}</Text>
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

        <TouchableOpacity style={styles.toolCard} onPress={() => setMode('giveaways')}>
          <View style={[styles.toolIcon, { backgroundColor: 'rgba(236,72,153,0.15)' }]}>
            <Ionicons name="gift" size={22} color="#ec4899" />
          </View>
          <Text style={styles.toolTitle}>Giveaways</Text>
          <Text style={styles.toolSub}>{giveawaysForDraw.length} active</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.toolCard} onPress={() => Alert.alert('Analytics', 'Full analytics coming soon.')}>
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
  pointsValue: { color: '#fff', fontSize: 32, fontWeight: '800' },
  pointsHistoryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.1)' },
  pointsHistoryText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  progressBarBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 3, marginTop: spacing.md },
  progressBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  pointsFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  pointsFooterText: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '500' },
  statsOuter: { paddingHorizontal: spacing.xl, marginBottom: spacing.xl },

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
  surveyBtnDone: { backgroundColor: 'rgba(16,185,129,0.12)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.4)' },
  surveyBtnTextDone: { color: colors.success },
  surveyDoneText: { color: colors.success, fontSize: 13, fontWeight: '700' },

  surveyDetailDesc: { color: colors.textMuted, fontSize: 13, marginHorizontal: spacing.xl, marginTop: spacing.sm, marginBottom: spacing.md, lineHeight: 20 },
  surveyDetailMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.xl, marginBottom: spacing.xl },
  surveyDonePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)' },
  surveyDonePillText: { color: colors.success, fontSize: 11, fontWeight: '600' },

  questionCard: { marginHorizontal: spacing.xl, marginBottom: spacing.lg, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border },
  questionNum: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: 4 },
  questionText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600', marginBottom: spacing.md, lineHeight: 22 },

  textAnswerInput: { color: colors.textPrimary, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md, minHeight: 100, lineHeight: 20 },

  optionsList: { gap: spacing.sm },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: colors.border },
  optionRowSelected: { borderColor: colors.primary + '80', backgroundColor: 'rgba(124,58,237,0.10)' },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  radioCircleFilled: { borderColor: colors.primary },
  radioInnerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  checkboxBox: { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.textMuted, alignItems: 'center', justifyContent: 'center' },
  checkboxBoxFilled: { borderColor: colors.primary, backgroundColor: colors.primary },
  optionText: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  optionTextSelected: { fontWeight: '600', color: colors.textPrimary },

  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  starBtn: { padding: 4 },
  ratingLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600', marginLeft: spacing.sm },

  yesNoRow: { flexDirection: 'row', gap: spacing.md },
  yesNoBtn: { flex: 1, paddingVertical: spacing.md, borderRadius: radius.lg, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.04)' },
  yesNoBtnSelected: { borderColor: colors.primary, backgroundColor: 'rgba(124,58,237,0.15)' },
  yesNoBtnText: { color: colors.textMuted, fontSize: 15, fontWeight: '600' },
  yesNoBtnTextSelected: { color: colors.textPrimary },

  surveySubmitBtn: { marginHorizontal: spacing.xl, marginTop: spacing.lg, borderRadius: radius.xl, overflow: 'hidden' },
  surveySubmitGrad: { paddingVertical: spacing.lg, alignItems: 'center', borderRadius: radius.xl },
  surveySubmitText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  surveySuccessCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  surveySuccessTitle: { color: colors.textPrimary, fontSize: 22, fontWeight: '800' },
  surveySuccessPts: { color: colors.primary, fontSize: 17, fontWeight: '700' },

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
  fullLeaderboardBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.xl, marginBottom: spacing.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.lg, backgroundColor: 'rgba(124,58,237,0.1)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },
  fullLeaderboardBtnText: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
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
  giveawayHowToRow: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  giveawayHowToText: { color: colors.textSecondary, fontSize: 12, lineHeight: 16 },

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

  leadCard: { padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  leadCardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  leadAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  leadAvatarText: { fontSize: 18, fontWeight: '700' },
  leadInfo: { flex: 1 },
  leadName: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  leadRole: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  leadTime: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  pendingSyncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.25)',
  },
  pendingSyncText: { color: '#b45309', fontSize: 11, fontWeight: '600', flex: 1 },
  pendingSyncBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245,158,11,0.18)',
  },
  pendingSyncBtnDisabled: { opacity: 0.6 },
  pendingSyncBtnText: { color: '#b45309', fontSize: 10, fontWeight: '700' },

  leadNotes: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  leadTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  leadTagPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leadTagText: { color: colors.textSecondary, fontSize: 10, fontWeight: '600' },

  drawPage: { flex: 1, alignItems: 'center', padding: spacing.xl },
  drawTitle: { color: colors.textPrimary, fontSize: 28, fontWeight: '800', marginBottom: 4 },
  drawSubtitle: { color: colors.textMuted, fontSize: 13, marginBottom: spacing.xxl },
  drawBox: { width: '100%', aspectRatio: 1.2, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  drawWinnerLabel: { color: '#ffd700', fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  drawWinnerName: { color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center' },
  drawWinnerCompany: { color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 4, textAlign: 'center' },
  drawHint: { color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: spacing.md },
  giveawayPickerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.lg,
    marginBottom: spacing.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  giveawayPickerLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', flex: 1 },
  giveawayPickerList: {
    width: '100%', backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg, marginBottom: spacing.md, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  giveawayPickerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  giveawayPickerItemText: { color: colors.textSecondary, fontSize: 13, fontWeight: '500', flex: 1 },
  drawBtn: { width: '100%', borderRadius: radius.xl, overflow: 'hidden' },
  drawBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, padding: spacing.xl },
  drawBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  gmForm: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg,
  },
  gmLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: spacing.xs, marginTop: spacing.sm },
  gmInput: {
    color: colors.textPrimary, fontSize: 14, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md, marginBottom: spacing.xs,
  },
  gmAddBtn: { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.md },
  gmAddBtnGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  gmAddBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  gmCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, borderWidth: 1,
    borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.md,
  },
  gmCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gmCardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  gmCardMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  gmIconBtn: {
    width: 34, height: 34, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: colors.border,
  },
  gmEditRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  gmGhostBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  gmGhostBtnText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  gmSaveBtn: { flex: 1, alignItems: 'center', paddingVertical: spacing.md, borderRadius: radius.lg, backgroundColor: colors.primary },
  gmSaveBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  gmWinners: { marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, gap: spacing.xs },
  gmWinnersLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1, marginBottom: spacing.xs },
  gmWinnerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  gmWinnerName: { flex: 1, color: colors.textSecondary, fontSize: 13, fontWeight: '600' },

  badgePanel: { flexDirection: 'row', gap: spacing.md, marginHorizontal: spacing.xl, marginBottom: spacing.lg },
  badgePanelBtn: { flex: 1, borderRadius: radius.xl, overflow: 'hidden' },
  badgePanelBtnGrad: { alignItems: 'center', padding: spacing.lg, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  badgePanelIcon: { width: 48, height: 48, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  badgePanelLabel: { color: colors.textPrimary, fontSize: 13, fontWeight: '700', marginBottom: 2 },
  badgePanelSub: { color: colors.textMuted, fontSize: 10, textAlign: 'center' },

  emptyLeads: { alignItems: 'center', paddingVertical: 60, gap: spacing.md },
  emptyLeadsText: { color: colors.textSecondary, fontSize: 16, fontWeight: '700' },
  emptyLeadsSub: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },

  spSection: {
    marginHorizontal: spacing.xl,
    marginBottom: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  spSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  spSectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spSectionTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
  spCountBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    marginLeft: 2,
  },
  spCountText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  spViewAll: { color: colors.primary, fontSize: 12, fontWeight: '700' },

  spPollPreview: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  spPollHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  spPollSession: { flex: 1, color: colors.textMuted, fontSize: 11 },
  spPollQuestion: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: spacing.md },
  spPollOptions: { gap: spacing.xs },
  spPollOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(124,58,237,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
  },
  spPollOptionText: { color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  spMoreOptions: { color: colors.primary, fontSize: 11, fontWeight: '600', marginTop: spacing.xs, textAlign: 'center' },
  spVotedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  spVotedMsg: { color: colors.success, fontSize: 12, fontWeight: '600' },

  spSurveyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  spSurveyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(124,58,237,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spSurveyInfo: { flex: 1 },
  spSurveyTitle: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  spSurveyMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  spSurveyBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  spSurveyBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  spSurveyDone: { color: colors.success, fontSize: 12, fontWeight: '700' },

  spEmpty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  spEmptyText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  spEmptySub: { color: colors.textMuted, fontSize: 11 },

  // Hub section
  hubSectionLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: spacing.lg, marginBottom: spacing.sm },
  hubCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm, gap: spacing.md },
  hubCardIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hubCardBody: { flex: 1 },
  hubCardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  hubCardSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  hubLiveBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  hubLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#ef4444' },
  hubLiveText: { color: '#ef4444', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  hubBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  hubBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },

});
