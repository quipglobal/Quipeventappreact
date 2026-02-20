import React from 'react';
import { ArrowLeft, Trophy, Target, Clock, CheckCircle2 } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { mockChallenges } from '@/app/data/mockData';

interface ChallengesPageProps {
  onBack: () => void;
}

export const ChallengesPage: React.FC<ChallengesPageProps> = ({ onBack }) => {
  const { completedChallenges, completedSurveys, votedPolls, metSponsors, bookmarkedSessions, completeChallenge } = useApp();
  const { t } = useTheme();

  const getChallengeProgress = (challenge: typeof mockChallenges[0]) => {
    switch (challenge.type) {
      case 'sponsor_visits':
        return Math.min(metSponsors.length, challenge.target);
      case 'survey_completion':
        return Math.min(completedSurveys.length, challenge.target);
      case 'poll_votes':
        return Math.min(votedPolls.length, challenge.target);
      case 'session_attendance':
        return Math.min(bookmarkedSessions.length, challenge.target);
      default:
        return 0;
    }
  };

  const challenges = mockChallenges.map(c => ({
    ...c,
    progress: getChallengeProgress(c),
    completed: completedChallenges.includes(c.id) || getChallengeProgress(c) >= c.target,
  }));

  const handleClaim = (id: string) => {
    const c = challenges.find(x => x.id === id);
    if (c && c.progress >= c.target && !completedChallenges.includes(id)) completeChallenge(id);
  };

  const activeCount    = challenges.filter(c => !c.completed).length;
  const completedCount = challenges.filter(c => c.completed).length;

  return (
    <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
      <div className="sticky top-0 z-10 px-5 pt-12 pb-6 text-white" style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>
        <button onClick={onBack} className="mb-3"><ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} /></button>
        <div className="flex items-center gap-3 mb-1">
          <Trophy style={{ width: 26, height: 26, color: '#fff' }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Challenges</h1>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>Complete challenges for bonus points</p>
      </div>

      <div className="px-5 -mt-4 mb-5">
        <div className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p style={{ color: '#3b82f6', fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em' }}>{activeCount}</p>
              <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>Active</p>
            </div>
            <div>
              <p style={{ color: t.successText, fontSize: 28, fontWeight: 800, letterSpacing: '-0.04em' }}>{completedCount}</p>
              <p style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>Completed</p>
            </div>
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4 mb-5">
        {challenges.map(c => {
          const pct      = (c.progress / c.target) * 100;
          const canClaim = c.progress >= c.target && !completedChallenges.includes(c.id);
          return (
            <div key={c.id} className="rounded-2xl p-5" style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}`, opacity: c.completed ? 0.75 : 1 }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{c.title}</h3>
                    {c.completed && <CheckCircle2 style={{ width: 18, height: 18, color: t.successText, flexShrink: 0 }} />}
                  </div>
                  <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5 }}>{c.description}</p>
                </div>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>
                  <Trophy style={{ width: 26, height: 26, color: '#fff' }} />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5"><Target style={{ width: 13, height: 13, color: t.textMuted }} /><span style={{ color: t.textSec, fontSize: 13 }}>Progress: {c.progress}/{c.target}</span></div>
                  <span style={{ color: '#3b82f6', fontWeight: 700, fontSize: 13 }}>{Math.round(pct)}%</span>
                </div>
                <div className="h-3 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(pct, 100)}%`, background: c.completed ? 'linear-gradient(135deg,#10b981,#0d9488)' : 'linear-gradient(135deg,#3b82f6,#06b6d4)' }} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${t.divider}` }}>
                <div className="flex items-center gap-3">
                  <span style={{ color: t.successText, fontWeight: 700, fontSize: 13 }}>+{c.rewardPoints} pts</span>
                  {c.expiresAt && !c.completed && (
                    <div className="flex items-center gap-1"><Clock style={{ width: 13, height: 13, color: t.textMuted }} /><span style={{ color: t.textMuted, fontSize: 12 }}>Expires soon</span></div>
                  )}
                </div>
                {canClaim && (
                  <button onClick={() => handleClaim(c.id)} className="px-5 py-2 rounded-xl font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)', boxShadow: '0 4px 16px rgba(16,185,129,0.3)' }}>
                    Claim Reward
                  </button>
                )}
                {c.completed && !canClaim && (
                  <div className="px-4 py-2 rounded-xl font-semibold" style={{ background: t.successBg, color: t.successText, fontSize: 13 }}>
                    Completed ✓
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-5">
        <div className="rounded-2xl p-5" style={{ background: 'rgba(59,130,246,0.1)', border: `1px solid ${t.border}` }}>
          <div className="flex items-start gap-3">
            <Trophy style={{ width: 18, height: 18, color: '#60a5fa', flexShrink: 0, marginTop: 2 }} />
            <div>
              <h3 style={{ color: t.text, fontSize: 14, fontWeight: 700, marginBottom: 4 }}>How Challenges Work</h3>
              <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5 }}>
                Complete activities throughout the event to progress. Once you reach the target, claim your reward to earn bonus points!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};