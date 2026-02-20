import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, TrendingUp, Clock } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { mockPolls } from '@/app/data/mockData';

interface PollsListPageProps { onBack: () => void; }

export const PollsListPage: React.FC<PollsListPageProps> = ({ onBack }) => {
  const { votedPolls, setVotedPolls, addPoints, gamificationConfig } = useApp();
  const { t } = useTheme();
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});

  const handleVote = (pollId: string) => {
    if (!votedPolls.includes(pollId) && selectedOptions[pollId]) {
      setVotedPolls([...votedPolls, pollId]);
      addPoints(gamificationConfig.pointActions.votePoll, 'Poll vote submitted!');
    }
  };
  const totalVotes = (poll: typeof mockPolls[0]) => poll.options.reduce((s, o) => s + o.votes, 0);

  return (
    <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
      <div className="sticky top-0 z-10 px-5 pt-12 pb-6 text-white" style={{ background: 'linear-gradient(135deg,#7c3aed,#ec4899)' }}>
        <button onClick={onBack} className="mb-3"><ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} /></button>
        <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Live Polls</h1>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>Vote to earn +{gamificationConfig.pointActions.votePoll} points per poll</p>
      </div>

      <div className="px-5 py-5 space-y-5">
        {mockPolls.map(poll => {
          const hasVoted    = votedPolls.includes(poll.id);
          const total       = totalVotes(poll);
          const userChoice  = selectedOptions[poll.id];
          const winVotes    = Math.max(...poll.options.map(o => o.votes));

          return (
            <div key={poll.id} className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1">
                  {poll.isLive && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full mb-2" style={{ background: t.errorBg }}>
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: t.errorText }} />
                      <span style={{ color: t.errorText, fontSize: 11, fontWeight: 700 }}>LIVE</span>
                    </div>
                  )}
                  <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{poll.title}</h3>
                  <p style={{ color: t.textSec, fontSize: 13 }}>{poll.description}</p>
                </div>
                {hasVoted && <CheckCircle style={{ width: 22, height: 22, color: t.successText, flexShrink: 0 }} />}
              </div>

              {/* Options */}
              <div className="space-y-3 mb-4">
                {poll.options.map(option => {
                  const pct       = total > 0 ? Math.round((option.votes / total) * 100) : 0;
                  const isChosen  = userChoice === option.id;
                  const isWinning = hasVoted && option.votes === winVotes;

                  return (
                    <button key={option.id}
                      onClick={() => !hasVoted && setSelectedOptions({ ...selectedOptions, [poll.id]: option.id })}
                      disabled={hasVoted}
                      className="w-full text-left rounded-xl relative overflow-hidden transition-all"
                      style={{
                        padding: '14px 16px',
                        border: `1.5px solid ${hasVoted ? t.border : isChosen ? t.borderAcc : t.border}`,
                        background: hasVoted ? 'transparent' : isChosen ? t.accentBg : t.inputBg,
                        cursor: hasVoted ? 'default' : 'pointer',
                      }}>
                      {hasVoted && (
                        <div className="absolute inset-0 rounded-xl transition-all"
                          style={{ width: `${pct}%`, background: isWinning ? 'rgba(124,58,237,0.12)' : t.surface2 }} />
                      )}
                      <div className="relative flex items-center justify-between">
                        <div className="flex items-center gap-2.5 flex-1">
                          {!hasVoted && (
                            <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, border: `2px solid ${isChosen ? t.accent : t.border}`, background: isChosen ? t.accent : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {isChosen && <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff' }} />}
                            </div>
                          )}
                          <span style={{ color: hasVoted ? t.text : isChosen ? t.accentSoft : t.textSec, fontWeight: isChosen ? 700 : 500, fontSize: 14 }}>{option.text}</span>
                        </div>
                        {hasVoted && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span style={{ color: t.textSec, fontSize: 13 }}>{option.votes.toLocaleString()}</span>
                            <span style={{ color: isWinning ? t.accentSoft : t.textSec, fontWeight: 700, fontSize: 13, minWidth: 40, textAlign: 'right' }}>{pct}%</span>
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
                  ? <p className="flex items-center gap-1.5" style={{ color: t.textMuted, fontSize: 13 }}><Clock style={{ width: 14, height: 14 }} />Total votes: {total.toLocaleString()}</p>
                  : <p style={{ color: t.successText, fontSize: 13, fontWeight: 600 }}>+{poll.rewardPoints} points</p>}
                {!hasVoted && (
                  <button onClick={() => handleVote(poll.id)} disabled={!userChoice}
                    className="px-5 py-2 rounded-xl font-semibold text-white transition-all"
                    style={{ background: userChoice ? 'linear-gradient(135deg,#7c3aed,#ec4899)' : t.surface2, color: userChoice ? '#fff' : t.textMuted, cursor: userChoice ? 'pointer' : 'not-allowed' }}>
                    Submit Vote
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
