import React, { useEffect, useState } from 'react';
import { ArrowLeft, Trophy, CheckCircle2, Loader2, Lock, Users, Building2 } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import {
  listEventChallengesApi,
  completeEventChallengeApi,
  BackendChallenge,
} from '@/app/api/engageClient';

interface ChallengesPageProps { onBack: () => void; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * True when the user is allowed to press "Mark Complete" for this challenge.
 *
 * Logic:
 *   - If the backend sends `can_complete`, that is authoritative.
 *   - If absent (older API), fall back to the pre-existing behaviour: always
 *     enabled unless the challenge is already done or fully claimed.
 */
function canMarkComplete(c: BackendChallenge, isDone: boolean, isFull: boolean): boolean {
  if (isDone || isFull) return false;
  if (typeof c.can_complete === 'boolean') return c.can_complete;
  return true; // graceful degradation for older backend
}

/** True when the server has already counted this challenge as completed. */
function isServerDone(c: BackendChallenge, localDoneIds: string[]): boolean {
  return localDoneIds.includes(String(c.id)) || c.user_completed === true;
}

function isFull(c: BackendChallenge): boolean {
  return typeof c.max_completions === 'number' && c.completions_count >= c.max_completions;
}

/** Friendly label for the challenge type. */
function typeLabel(type?: string): string | null {
  if (!type) return null;
  switch (type) {
    case 'partner_scan': return 'Partner Visit';
    case 'session_checkin': return 'Session';
    case 'manual': return null; // no pill for plain manual challenges
    default: return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

// ─── Progress bar for partner_scan and other progress-based challenges ───────

const ChallengeProgressBar: React.FC<{
  current: number;
  required: number;
  label?: string;
  completedItems?: { id: number | string; name: string }[];
}> = ({ current, required, label, completedItems }) => {
  const { t } = useTheme();
  const pct = required > 0 ? Math.min(100, Math.round((current / required) * 100)) : 0;
  const done = current >= required;

  return (
    <div className="mt-3 mb-1">
      {/* Bar */}
      <div className="flex items-center justify-between mb-1.5">
        <span style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
          {label ? `${current} / ${required} ${label}` : `${current} / ${required}`}
        </span>
        <span style={{ color: done ? t.successText : t.accent, fontSize: 12, fontWeight: 700 }}>
          {pct}%
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: t.surface2 }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: done
              ? 'linear-gradient(90deg,#10b981,#0d9488)'
              : 'linear-gradient(90deg,#3b82f6,#06b6d4)',
          }}
        />
      </div>

      {/* Completed item chips (companies visited, etc.) */}
      {completedItems && completedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {completedItems.map(item => (
            <div
              key={item.id}
              className="flex items-center gap-1 px-2 py-1 rounded-lg"
              style={{ background: t.successBg, border: `1px solid ${t.successText}30` }}
            >
              <CheckCircle2 style={{ width: 11, height: 11, color: t.successText }} />
              <span style={{ color: t.successText, fontSize: 11, fontWeight: 600 }}>{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

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

  const handleComplete = async (c: BackendChallenge) => {
    if (!eventId || claimingId !== null) return;
    const done = isServerDone(c, completedChallenges);
    if (done || !canMarkComplete(c, done, isFull(c))) return;

    setClaimingId(c.id);
    const res = await completeEventChallengeApi(eventId, c.id);
    setClaimingId(null);

    if (res.success && res.data) {
      const pts = res.data.points_earned || c.points;
      if (res.data.awarded && pts > 0) {
        addPoints(pts, `Challenge complete: ${c.title}`);
      } else {
        showToast('Challenge already counted.');
      }
      completeChallenge(String(c.id), true);
    } else {
      showToast(res.error?.message ?? 'Failed to complete challenge. Please try again.');
    }
  };

  const activeCount   = challenges.filter(c => !isServerDone(c, completedChallenges)).length;
  const completedCount = challenges.filter(c =>  isServerDone(c, completedChallenges)).length;

  return (
    <div className="min-h-screen pb-20" style={{ background: t.bgPage }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 px-5 pt-12 pb-6 text-white"
        style={{ background: 'linear-gradient(135deg,#3b82f6,#06b6d4)' }}>
        <button onClick={onBack} className="mb-3">
          <ArrowLeft style={{ width: 22, height: 22, color: '#fff' }} />
        </button>
        <div className="flex items-center gap-3 mb-1">
          <Trophy style={{ width: 26, height: 26, color: '#fff' }} />
          <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Challenges</h1>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
          Complete the criteria to unlock each challenge reward
        </p>
      </div>

      {/* ── Summary card ───────────────────────────────────────── */}
      {!loading && !loadError && challenges.length > 0 && (
        <div className="px-5 -mt-4 mb-5">
          <div className="rounded-2xl p-5"
            style={{ background: t.surface, boxShadow: t.shadow, border: `1px solid ${t.border}` }}>
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

      {/* ── List ───────────────────────────────────────────────── */}
      <div className="px-5 space-y-4 mb-5">
        {loading && (
          <div className="flex items-center justify-center py-16" style={{ color: t.textMuted }}>
            <Loader2 className="animate-spin" style={{ width: 28, height: 28 }} />
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-2xl p-5"
            style={{ background: t.errorBg, color: t.errorText, fontSize: 13 }}>
            {loadError}
          </div>
        )}

        {!loading && !loadError && challenges.length === 0 && (
          <div className="rounded-2xl p-10 text-center"
            style={{ background: t.surface, color: t.textMuted, border: `1px solid ${t.border}` }}>
            No challenges are available yet.
          </div>
        )}

        {!loading && challenges.map(c => {
          const done      = isServerDone(c, completedChallenges);
          const full      = isFull(c);
          const eligible  = canMarkComplete(c, done, full);
          const claiming  = claimingId === c.id;
          const isPartnerScan = c.challenge_type === 'partner_scan';
          const hasProgress   = !!c.progress;
          const typePill      = typeLabel(c.challenge_type);

          return (
            <div key={c.id} className="rounded-2xl p-5"
              style={{
                background: t.surface,
                boxShadow: t.shadow,
                border: `1px solid ${done ? t.successText + '40' : t.border}`,
                opacity: done ? 0.85 : 1,
              }}>

              {/* ── Title row ── */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{c.title}</h3>
                    {done && <CheckCircle2 style={{ width: 18, height: 18, color: t.successText, flexShrink: 0 }} />}
                    {typePill && (
                      <span className="px-2 py-0.5 rounded-md"
                        style={{
                          background: isPartnerScan ? 'rgba(99,102,241,0.12)' : 'rgba(59,130,246,0.1)',
                          color: isPartnerScan ? '#818cf8' : '#60a5fa',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                        }}>
                        {isPartnerScan && <Building2 style={{ width: 9, height: 9, display: 'inline', marginRight: 3 }} />}
                        {typePill}
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5 }}>{c.description}</p>
                  )}
                </div>

                {/* Icon */}
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isPartnerScan
                      ? 'linear-gradient(135deg,#6366f1,#8b5cf6)'
                      : 'linear-gradient(135deg,#3b82f6,#06b6d4)',
                  }}>
                  {isPartnerScan
                    ? <Users style={{ width: 26, height: 26, color: '#fff' }} />
                    : <Trophy style={{ width: 26, height: 26, color: '#fff' }} />}
                </div>
              </div>

              {/* ── Progress bar (partner_scan + any progress-tracked challenge) ── */}
              {hasProgress && c.progress && (
                <ChallengeProgressBar
                  current={c.progress.current}
                  required={c.progress.required}
                  label={c.progress.label ?? (isPartnerScan ? 'companies visited' : undefined)}
                  completedItems={c.progress.completed_items}
                />
              )}

              {/* ── Footer row ── */}
              <div className="flex items-center justify-between pt-3"
                style={{ borderTop: `1px solid ${t.divider}`, marginTop: hasProgress ? 12 : 0 }}>
                <div className="flex items-center gap-3">
                  <span style={{ color: t.successText, fontWeight: 700, fontSize: 13 }}>+{c.points} pts</span>
                  {typeof c.max_completions === 'number' && (
                    <span style={{ color: t.textMuted, fontSize: 12 }}>
                      {c.completions_count}/{c.max_completions} claimed
                    </span>
                  )}
                </div>

                {/* ── Action button ── */}
                {done ? (
                  <div className="px-4 py-2 rounded-xl font-semibold"
                    style={{ background: t.successBg, color: t.successText, fontSize: 13 }}>
                    Completed ✓
                  </div>
                ) : full ? (
                  <div className="px-4 py-2 rounded-xl font-semibold"
                    style={{ background: t.surface2, color: t.textMuted, fontSize: 13 }}>
                    Fully claimed
                  </div>
                ) : eligible ? (
                  <button
                    onClick={() => handleComplete(c)}
                    disabled={claiming}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-white transition-opacity"
                    style={{
                      background: 'linear-gradient(135deg,#10b981,#0d9488)',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                      opacity: claiming ? 0.7 : 1,
                    }}>
                    {claiming && <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />}
                    {claiming ? 'Submitting…' : 'Mark Complete'}
                  </button>
                ) : (
                  /* Criteria not yet met — locked state */
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                    style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
                    <Lock style={{ width: 13, height: 13, color: t.textMuted }} />
                    <span style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
                      {isPartnerScan ? 'Visit more partners' : 'Criteria not met'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
