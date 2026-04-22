import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, CheckCircle2, Loader2 } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import {
  listEventChallengesApi,
  completeEventChallengeApi,
  BackendChallenge,
} from '@/app/api/engageClient';

interface ChallengesPageProps { onBack: () => void; }

export const ChallengesPage: React.FC<ChallengesPageProps> = ({ onBack }) => {
  const { completedChallenges, completeChallenge, addPoints, showToast, eventConfig } = useApp();
  const { t } = useTheme();
  const eventId = eventConfig?.eventId;

  const [challenges, setChallenges] = useState<BackendChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  useEffect(() => {
    if (!eventId) return;
    let stale = false;
    setLoading(true);
    setLoadError(null);
    setChallenges([]);
    listEventChallengesApi(eventId).then(res => {
      if (stale) return;
      if (res.success && res.data) {
        setChallenges(res.data.filter(c => c.is_active));
      } else {
        setLoadError(res.error?.message ?? 'Failed to load challenges.');
      }
      setLoading(false);
    });
    return () => { stale = true; };
  }, [eventId]);

  const isFull = (c: BackendChallenge) =>
    typeof c.max_completions === 'number' && c.completions_count >= c.max_completions;

  const handleComplete = async (c: BackendChallenge) => {
    if (!eventId || claimingId !== null) return;
    if (completedChallenges.includes(String(c.id))) return;

    setClaimingId(c.id);
    const res = await completeEventChallengeApi(eventId, c.id);
    setClaimingId(null);

    if (res.success && res.data) {
      const pts = res.data.points_earned || c.points;
      if (res.data.awarded && pts > 0) {
        addPoints(pts, `Challenge complete: ${c.title}`);
      } else {
        showToast(`Challenge already counted.`);
      }
      completeChallenge(String(c.id), true);
    } else {
      showToast(res.error?.message ?? 'Failed to complete challenge. Please try again.');
    }
  };

  const activeCount = challenges.filter(c => !completedChallenges.includes(String(c.id))).length;
  const completedCount = challenges.filter(c => completedChallenges.includes(String(c.id))).length;

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

      {!loading && !loadError && challenges.length > 0 && (
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
      )}

      <div className="px-5 space-y-4 mb-5">
        {loading && (
          <div className="flex items-center justify-center py-16" style={{ color: t.textMuted }}>
            <Loader2 className="animate-spin" style={{ width: 28, height: 28 }} />
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-2xl p-5" style={{ background: t.errorBg, color: t.errorText, fontSize: 13 }}>{loadError}</div>
        )}

        {!loading && !loadError && challenges.length === 0 && (
          <div className="rounded-2xl p-10 text-center" style={{ background: t.surface, color: t.textMuted, border: `1px solid ${t.border}` }}>
            No challenges are available yet.
          </div>
        )}

        {!loading && challenges.map(c => {
          const isDone = completedChallenges.includes(String(c.id));
          const full = isFull(c);
          return (
            <div key={c.id} className="rounded-2xl p-5"
              style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}`, opacity: isDone ? 0.75 : 1 }}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{c.title}</h3>
                    {isDone && <CheckCircle2 style={{ width: 18, height: 18, color: t.successText, flexShrink: 0 }} />}
                  </div>
                  {c.description && (
                    <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5 }}>{c.description}</p>
                  )}
                </div>
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>
                  <Trophy style={{ width: 26, height: 26, color: '#fff' }} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px solid ${t.divider}` }}>
                <div className="flex items-center gap-3">
                  <span style={{ color: t.successText, fontWeight: 700, fontSize: 13 }}>+{c.points} pts</span>
                  {typeof c.max_completions === 'number' && (
                    <span style={{ color: t.textMuted, fontSize: 12 }}>
                      {c.completions_count}/{c.max_completions} claimed
                    </span>
                  )}
                </div>

                {isDone ? (
                  <div className="px-4 py-2 rounded-xl font-semibold"
                    style={{ background: t.successBg, color: t.successText, fontSize: 13 }}>
                    Completed ✓
                  </div>
                ) : full ? (
                  <div className="px-4 py-2 rounded-xl font-semibold"
                    style={{ background: t.surface2, color: t.textMuted, fontSize: 13 }}>
                    Fully claimed
                  </div>
                ) : (
                  <button onClick={() => handleComplete(c)} disabled={claimingId === c.id}
                    className="px-5 py-2 rounded-xl font-semibold text-white transition-opacity"
                    style={{
                      background: 'linear-gradient(135deg,#10b981,#0d9488)',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                      opacity: claimingId === c.id ? 0.7 : 1,
                    }}>
                    {claimingId === c.id ? 'Submitting…' : 'Mark Complete'}
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
