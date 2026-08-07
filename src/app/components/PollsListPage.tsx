import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, TrendingUp, Loader2 } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import {
  listEventPollsApi,
  getEventPollApi,
  submitEventPollVoteApi,
  BackendPollSummary,
  BackendPollDetail,
  PollResultRow,
} from '@/app/api/engageClient';
import { getCached, setCached, deleteCached } from '@/app/lib/pageCache';

interface PollsListPageProps { onBack: () => void; }

interface PollState {
  detail: BackendPollDetail;
  /** Loaded results (after vote, or from initial load if visibility = ALWAYS). */
  results?: PollResultRow[];
  totalVotes?: number;
  votedOptionId?: number;
}

export const PollsListPage: React.FC<PollsListPageProps> = ({ onBack }) => {
  const { votedPolls, setVotedPolls, savedPollResults, setSavedPollResults, addPoints, gamificationConfig, eventConfig, showToast } = useApp();
  // votedPolls is Record<pollId, optionId> — both "voted?" and "which option" in one map.
  // savedPollResults is Record<pollId, { results, totalVotes, votedOptionId }> — persisted so
  // the results bar reappears correctly after a page refresh.
  const { t } = useTheme();
  const eventId = eventConfig?.eventId;

  const [polls, setPolls] = useState<PollState[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [submittingPollId, setSubmittingPollId] = useState<number | null>(null);
  /** Poll id currently in "change vote" mode — options become selectable again. */
  const [reVotingPollId, setReVotingPollId] = useState<number | null>(null);

  /** Build PollState array from resolved details, re-hydrating saved results where available. */
  const buildPolls = (
    details: Array<{ success: true; data: BackendPollDetail } | { success: false; data?: undefined }>,
    currentVotedPolls: Record<string, number>,
    currentSavedResults: typeof savedPollResults,
  ): PollState[] => {
    const built: PollState[] = [];
    details.forEach((r) => {
      if (r.success && r.data) {
        const stored = currentSavedResults[String(r.data.id)];
        if (stored && String(r.data.id) in currentVotedPolls) {
          built.push({
            detail: r.data,
            results: stored.results as PollResultRow[],
            totalVotes: stored.totalVotes,
            votedOptionId: stored.votedOptionId,
          });
        } else {
          built.push({ detail: r.data });
        }
      }
    });
    return built;
  };

  useEffect(() => {
    if (!eventId) return;
    let stale = false;
    setLoading(true);
    setLoadError(null);
    setPolls([]);

    (async () => {
      // ── Phase 1: serve from cache immediately (instant render) ──────────
      const cachedSummaries = getCached<BackendPollSummary[]>('polls', eventId);
      if (cachedSummaries) {
        const live = cachedSummaries.filter(p => p.status === 'LIVE' || p.status === 'CLOSED');
        const detailResults = await Promise.all(
          live.map(p => {
            const cached = getCached<BackendPollDetail>(`poll-detail:${p.id}`, eventId);
            if (cached) return Promise.resolve({ success: true as const, data: cached });
            return getEventPollApi(eventId, p.id).then(r => {
              if (r.success && r.data) setCached(`poll-detail:${p.id}`, eventId, r.data);
              return r;
            });
          })
        );
        if (!stale) {
          setPolls(buildPolls(detailResults, votedPolls, savedPollResults));
          setLoading(false);
        }
      }

      // ── Phase 2: always refresh from server in background ───────────────
      // This re-syncs the user's prior vote so a fresh session / logout-login
      // doesn't show polls as unanswered.
      const listRes = await listEventPollsApi(eventId);
      if (stale) return;
      if (!listRes.success || !listRes.data) {
        if (!cachedSummaries) {
          setLoadError(listRes.error?.message ?? 'Failed to load polls.');
          setLoading(false);
        }
        return;
      }
      const freshSummaries = listRes.data;
      setCached('polls', eventId, freshSummaries);

      // Seed server-confirmed votes into local state so a fresh session
      // immediately shows the user's prior selections. Never overwrite a
      // vote the user already cast this session (local wins for recency).
      const voteUpdates: Record<string, number> = {};
      for (const s of freshSummaries) {
        if (s.user_voted_option_id != null && !(String(s.id) in votedPolls)) {
          voteUpdates[String(s.id)] = s.user_voted_option_id;
        }
      }
      if (Object.keys(voteUpdates).length > 0) {
        setVotedPolls({ ...votedPolls, ...voteUpdates });
      }

      const live = freshSummaries.filter(p => p.status === 'LIVE' || p.status === 'CLOSED');
      // Phase 2 always fetches fresh details — never serves the cache here.
      // This ensures vote counts are up-to-date every time the screen is
      // revisited, regardless of the 15-minute detail-cache TTL.
      const detailResults = await Promise.all(
        live.map(p =>
          getEventPollApi(eventId, p.id).then(r => {
            if (r.success && r.data) setCached(`poll-detail:${p.id}`, eventId, r.data);
            return r;
          })
        )
      );
      if (stale) return;

      // Merge server-seeded votes into the combined map used for buildPolls.
      const mergedVoted = { ...votedPolls, ...voteUpdates };
      setPolls(buildPolls(detailResults, mergedVoted, savedPollResults));
      setLoading(false);
    })();

    return () => { stale = true; };
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Submit a vote. When `isRevote` is true (user is changing an existing vote)
   * the request is sent normally but points are NOT awarded again.
   */
  const handleVote = async (pollId: number, isRevote: boolean) => {
    if (!eventId) return;
    const optionId = selectedOptions[pollId];
    if (!optionId || submittingPollId !== null) return;

    setSubmittingPollId(pollId);
    const res = await submitEventPollVoteApi(eventId, pollId, optionId);
    setSubmittingPollId(null);

    if (res.success && res.data) {
      // Invalidate the detail cache so the next mount (revisit) fetches
      // fresh vote totals rather than replaying the pre-vote snapshot.
      if (eventId) deleteCached(`poll-detail:${pollId}`, eventId);
      setPolls(prev => prev.map(p => p.detail.id === pollId
        ? { ...p, results: res.data!.results, totalVotes: res.data!.total_votes, votedOptionId: res.data!.voted_option_id }
        : p
      ));
      setVotedPolls({ ...votedPolls, [String(pollId)]: optionId });
      setSavedPollResults(prev => ({
        ...prev,
        [String(pollId)]: {
          results: res.data!.results,
          totalVotes: res.data!.total_votes,
          votedOptionId: res.data!.voted_option_id,
        },
      }));
      if (!isRevote) {
        addPoints(gamificationConfig.pointActions.votePoll, 'Poll vote submitted!');
      } else {
        showToast('Vote updated!');
      }
      setReVotingPollId(null);
    } else if (res.error?.code === 'ALREADY_VOTED') {
      // Server already has this vote — mark locally with the option the user
      // selected (authoritative if they just picked it) and exit re-vote mode.
      setVotedPolls({ ...votedPolls, [String(pollId)]: optionId });
      setReVotingPollId(null);
      showToast(isRevote ? 'Vote unchanged — already recorded.' : 'You already voted in this poll.');
    } else {
      showToast(res.error?.message ?? 'Failed to submit vote. Please try again.');
    }
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
      <div className="sticky top-0 z-10 px-5 pt-12 pb-6 text-white" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
        <button onClick={onBack} className="mb-3"><ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} /></button>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Live Polls</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>
          Vote to earn +{gamificationConfig.pointActions.votePoll} points per poll
        </p>
      </div>

      <div className="px-5 py-5 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-16" style={{ color: t.textMuted }}>
            <Loader2 className="animate-spin" style={{ width: 28, height: 28 }} />
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-2xl p-5" style={{ background: t.errorBg, color: t.errorText, fontSize: 13 }}>{loadError}</div>
        )}

        {!loading && !loadError && polls.length === 0 && (
          <div className="rounded-2xl p-10 text-center" style={{ background: t.surface, color: t.textMuted, border: `1px solid ${t.border}` }}>
            No polls are available yet.
          </div>
        )}

        {!loading && polls.map(({ detail: poll, results, totalVotes, votedOptionId }) => {
          const storedOptionId = votedPolls[String(poll.id)]; // persisted choice (survives refresh)
          const committedVoted = storedOptionId !== undefined || votedOptionId !== undefined;
          const isChangingVote = reVotingPollId === poll.id;
          const hasVoted = committedVoted && !isChangingVote; // true when showing locked results view
          const userChoice = selectedOptions[poll.id];
          // The authoritative "which option did I vote for" — prefer the live API response,
          // fall back to what was stored in context (restored from localStorage).
          const myVotedOptionId = votedOptionId ?? storedOptionId;
          const total = totalVotes ?? 0;
          const isLive = poll.status === 'LIVE';
          const winnerVotes = results ? Math.max(...results.map(r => r.votes)) : 0;

          return (
            <div key={poll.id} className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1">
                  {isLive && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2" style={{ background: t.errorBg }}>
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: t.errorText }} />
                      <span style={{ color: t.errorText, fontSize: 11, fontWeight: 700 }}>LIVE</span>
                    </div>
                  )}
                  <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{poll.title}</h3>
                </div>
                {committedVoted && !isChangingVote && <CheckCircle style={{ width: 22, height: 22, color: t.successText, flexShrink: 0 }} />}
              </div>

              {/* Options */}
              <div className="space-y-3 mb-4">
                {poll.options.map(option => {
                  const result = results?.find(r => r.id === option.id);
                  const liveVotes = result?.votes ?? 0;
                  const pct = result?.percentage ?? 0;
                  // isChosen: option the user has tapped but not yet submitted.
                  // Previously this was gated on isChangingVote, which meant
                  // first-time selections were never highlighted.  The hasVoted
                  // branch below takes over styling once a vote is committed, so
                  // it is safe to always reflect the current tap here.
                  const isChosen = userChoice === option.id && !hasVoted;
                  const isMyVote = committedVoted && !isChangingVote && option.id === myVotedOptionId;
                  const isPrevVote = isChangingVote && option.id === myVotedOptionId; // prior choice shown dimly in change mode
                  const isWinning = hasVoted && results && liveVotes === winnerVotes && winnerVotes > 0;
                  const canClick = !hasVoted && submittingPollId !== poll.id;

                  return (
                    <button key={option.id}
                      onClick={() => canClick && setSelectedOptions(prev => ({ ...prev, [poll.id]: option.id }))}
                      disabled={!canClick}
                      className="w-full text-left rounded-xl relative overflow-hidden transition-all"
                      style={{
                        padding: '14px 16px',
                        border: `1.5px solid ${hasVoted ? t.border : isChosen ? t.borderAcc : isPrevVote ? t.borderAcc : t.border}`,
                        background: hasVoted ? 'transparent' : isChosen ? t.accentBg : isPrevVote ? t.accentBg : t.inputBg,
                        opacity: hasVoted ? 1 : isPrevVote && !isChosen ? 0.6 : 1,
                        cursor: canClick ? 'pointer' : 'default',
                      }}>
                      {hasVoted && results && (
                        <div className="absolute inset-0 rounded-xl transition-all"
                          style={{ width: `${pct}%`, background: isWinning ? 'rgba(124,58,237,0.12)' : t.surface2 }} />
                      )}
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-2.5 flex-1">
                          {!hasVoted && (
                            <div style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                              border: `2px solid ${isChosen ? t.accent : isPrevVote ? t.accent : t.border}`,
                              background: isChosen ? t.accent : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {isChosen && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                            </div>
                          )}
                          <div className="flex flex-col gap-0.5">
                            <span style={{ color: hasVoted ? (isMyVote ? t.accentSoft : t.text) : isChosen ? t.accentSoft : isPrevVote ? t.accentSoft : t.textSec, fontWeight: isMyVote || isChosen || isPrevVote ? 700 : 500, fontSize: 14 }}>
                              {option.option_text}
                            </span>
                            {isMyVote && (
                              <span style={{ color: t.accentSoft, fontSize: 11, fontWeight: 600 }}>Your vote ✓</span>
                            )}
                            {isPrevVote && (
                              <span style={{ color: t.accentSoft, fontSize: 11, fontWeight: 600 }}>Previous vote</span>
                            )}
                          </div>
                        </div>
                        {hasVoted && results && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span style={{ color: isWinning ? t.accentSoft : t.textSec, fontWeight: 700, fontSize: 13, minWidth: 40, textAlign: 'right' }}>
                              {pct}%
                            </span>
                            {isWinning && <TrendingUp style={{ width: 14, height: 14, color: t.accentSoft }} />}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4" style={{ borderTop: `1px solid ${t.divider}` }}>
                {hasVoted
                  ? <div className="flex items-center gap-3">
                      {!results && (
                        <p style={{ color: t.textMuted, fontSize: 13 }}>Vote recorded — results hidden</p>
                      )}
                      {isLive && (
                        <button
                          onClick={() => {
                            // Pre-select the prior answer so the user sees what they voted for.
                            if (myVotedOptionId) {
                              setSelectedOptions(prev => ({ ...prev, [poll.id]: myVotedOptionId }));
                            }
                            setReVotingPollId(poll.id);
                          }}
                          style={{ color: t.accentSoft, fontSize: 12, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          Change vote
                        </button>
                      )}
                    </div>
                  : isChangingVote
                    ? <p style={{ color: t.textMuted, fontSize: 13 }}>Select a new option above</p>
                    : <p style={{ color: t.successText, fontSize: 13, fontWeight: 600 }}>+{gamificationConfig.pointActions.votePoll} points</p>}

                {isChangingVote && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setReVotingPollId(null); setSelectedOptions(prev => { const n = { ...prev }; delete n[poll.id]; return n; }); }}
                      className="px-4 py-2 rounded-xl font-semibold transition-all"
                      style={{ background: t.surface2, border: `1.5px solid ${t.border}`, color: t.textSec, fontSize: 13 }}>
                      Cancel
                    </button>
                    <button onClick={() => handleVote(poll.id, true)} disabled={!userChoice || submittingPollId === poll.id}
                      className="px-5 py-2 rounded-xl font-semibold text-white transition-all"
                      style={{
                        background: userChoice ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : t.surface2,
                        color: userChoice ? '#fff' : t.textMuted,
                        cursor: userChoice ? 'pointer' : 'not-allowed',
                        opacity: submittingPollId === poll.id ? 0.7 : 1,
                      }}>
                      {submittingPollId === poll.id ? 'Updating…' : 'Update vote'}
                    </button>
                  </div>
                )}
                {!committedVoted && (
                  <button onClick={() => handleVote(poll.id, false)} disabled={!userChoice || submittingPollId === poll.id}
                    className="px-5 py-2 rounded-xl font-semibold text-white transition-all"
                    style={{
                      background: userChoice ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : t.surface2,
                      color: userChoice ? '#fff' : t.textMuted,
                      cursor: userChoice ? 'pointer' : 'not-allowed',
                      opacity: submittingPollId === poll.id ? 0.7 : 1,
                    }}>
                    {submittingPollId === poll.id ? 'Submitting…' : 'Submit Vote'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
