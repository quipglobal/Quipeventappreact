import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, TrendingUp, Clock, Loader2 } from 'lucide-react';
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
import { getCached, setCached } from '@/app/lib/pageCache';

interface PollsListPageProps { onBack: () => void; }

interface PollState {
  detail: BackendPollDetail;
  /** Loaded results (after vote, or from initial load if visibility = ALWAYS). */
  results?: PollResultRow[];
  totalVotes?: number;
  votedOptionId?: number;
}

export const PollsListPage: React.FC<PollsListPageProps> = ({ onBack }) => {
  const { votedPolls, setVotedPolls, addPoints, gamificationConfig, eventConfig, showToast } = useApp();
  const { t } = useTheme();
  const eventId = eventConfig?.eventId;

  const [polls, setPolls] = useState<PollState[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [submittingPollId, setSubmittingPollId] = useState<number | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let stale = false;
    setLoading(true);
    setLoadError(null);
    setPolls([]);

    (async () => {
      // Serve the polls list from the preloader cache when available.
      // If it's a cache miss, fetch and store so subsequent visits are instant.
      let summaries = getCached<BackendPollSummary[]>('polls', eventId);
      if (!summaries) {
        const listRes = await listEventPollsApi(eventId);
        if (stale) return;
        if (!listRes.success || !listRes.data) {
          setLoadError(listRes.error?.message ?? 'Failed to load polls.');
          setLoading(false);
          return;
        }
        summaries = listRes.data;
        setCached('polls', eventId, summaries);
      }
      if (stale) return;
      const live = summaries.filter(p => p.status === 'LIVE' || p.status === 'CLOSED');

      // Serve each poll detail from cache if the preloader already fetched it.
      // Only fire a network request for polls that aren't cached yet — and cache
      // the result so subsequent visits (and other components) pay zero cost.
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
      if (stale) return;
      const built: PollState[] = [];
      detailResults.forEach((r) => {
        if (r.success && r.data) built.push({ detail: r.data });
      });
      setPolls(built);
      setLoading(false);
    })();

    return () => { stale = true; };
  }, [eventId]);

  const handleVote = async (pollId: number) => {
    if (!eventId) return;
    const optionId = selectedOptions[pollId];
    if (!optionId || submittingPollId !== null || votedPolls.includes(String(pollId))) return;

    setSubmittingPollId(pollId);
    const res = await submitEventPollVoteApi(eventId, pollId, optionId);
    setSubmittingPollId(null);

    if (res.success && res.data) {
      setPolls(prev => prev.map(p => p.detail.id === pollId
        ? { ...p, results: res.data!.results, totalVotes: res.data!.total_votes, votedOptionId: res.data!.voted_option_id }
        : p
      ));
      setVotedPolls([...votedPolls, String(pollId)]);
      addPoints(gamificationConfig.pointActions.votePoll, 'Poll vote submitted!');
    } else if (res.error?.code === 'ALREADY_VOTED') {
      setVotedPolls([...votedPolls, String(pollId)]);
      showToast('You already voted in this poll.');
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
          const hasVoted = votedPolls.includes(String(poll.id)) || votedOptionId !== undefined;
          const userChoice = selectedOptions[poll.id];
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
                {hasVoted && <CheckCircle style={{ width: 22, height: 22, color: t.successText, flexShrink: 0 }} />}
              </div>

              {/* Options */}
              <div className="space-y-3 mb-4">
                {poll.options.map(option => {
                  const result = results?.find(r => r.id === option.id);
                  const liveVotes = result?.votes ?? 0;
                  const pct = result?.percentage ?? 0;
                  const isChosen = userChoice === option.id;
                  const isWinning = hasVoted && results && liveVotes === winnerVotes && winnerVotes > 0;

                  return (
                    <button key={option.id}
                      onClick={() => !hasVoted && setSelectedOptions(prev => ({ ...prev, [poll.id]: option.id }))}
                      disabled={hasVoted || submittingPollId === poll.id}
                      className="w-full text-left rounded-xl relative overflow-hidden transition-all"
                      style={{
                        padding: '14px 16px',
                        border: `1.5px solid ${hasVoted ? t.border : isChosen ? t.borderAcc : t.border}`,
                        background: hasVoted ? 'transparent' : isChosen ? t.accentBg : t.inputBg,
                        cursor: hasVoted ? 'default' : 'pointer',
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
                              border: `2px solid ${isChosen ? t.accent : t.border}`,
                              background: isChosen ? t.accent : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {isChosen && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                            </div>
                          )}
                          <span style={{ color: hasVoted ? t.text : isChosen ? t.accentSoft : t.textSec, fontWeight: isChosen ? 700 : 500, fontSize: 14 }}>
                            {option.option_text}
                          </span>
                        </div>
                        {hasVoted && results && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span style={{ color: t.textSec, fontSize: 13 }}>{liveVotes.toLocaleString()}</span>
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
                  ? results
                    ? <p className="flex items-center gap-1.5" style={{ color: t.textMuted, fontSize: 13 }}>
                        <Clock style={{ width: 14, height: 14 }} />Total votes: {total.toLocaleString()}
                      </p>
                    : <p style={{ color: t.textMuted, fontSize: 13 }}>Vote recorded — results hidden</p>
                  : <p style={{ color: t.successText, fontSize: 13, fontWeight: 600 }}>+{gamificationConfig.pointActions.votePoll} points</p>}
                {!hasVoted && (
                  <button onClick={() => handleVote(poll.id)} disabled={!userChoice || submittingPollId === poll.id}
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
