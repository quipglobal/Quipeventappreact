import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft, Trophy, CheckCircle2, Loader2, Lock,
  Users, ClipboardList, Star, Zap, Building2,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import {
  listEventChallengesApi,
  claimEventChallengeApi,
  BackendChallenge,
  ChallengeCriteriaType,
} from '@/app/api/engageClient';

interface ChallengesPageProps { onBack: () => void; }

// ─── Criteria metadata ────────────────────────────────────────────────────────

interface CriteriaConfig {
  label: string;
  hint: string;         // shown when criteria not yet met
  icon: React.ElementType;
  color: string;
  gradient: string;
}

const CRITERIA: Record<string, CriteriaConfig> = {
  SURVEY_AND_POLL: {
    label: 'Survey & Poll',
    hint: 'Vote in a poll and submit a survey to unlock.',
    icon: ClipboardList,
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg,#8b5cf6,#6366f1)',
  },
  PARTNER_MEETING: {
    label: 'Partner Meeting',
    hint: 'Complete a meeting with a sponsor rep to unlock.',
    icon: Users,
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg,#06b6d4,#0ea5e9)',
  },
  SPONSOR_FEEDBACK: {
    label: 'Sponsor Feedback',
    hint: 'Submit a sponsor review to unlock.',
    icon: Star,
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg,#f59e0b,#f97316)',
  },
  EXTERNAL_ACTION: {
    label: 'Special Action',
    hint: 'An organiser will mark you eligible when the criteria is met.',
    icon: Zap,
    color: '#ec4899',
    gradient: 'linear-gradient(135deg,#ec4899,#f43f5e)',
  },
  VISIT_ALL_SPONSORS: {
    label: 'Visit All Partners',
    hint: 'Get scanned by a rep from every partner company at the event.',
    icon: Building2,
    color: '#10b981',
    gradient: 'linear-gradient(135deg,#10b981,#0d9488)',
  },
};

const DEFAULT_CRITERIA: CriteriaConfig = {
  label: 'Challenge',
  hint: 'Complete the required criteria to unlock.',
  icon: Trophy,
  color: '#3b82f6',
  gradient: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
};

function getCriteria(type?: ChallengeCriteriaType): CriteriaConfig {
  return (type && CRITERIA[type]) ? CRITERIA[type] : DEFAULT_CRITERIA;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isDone(c: BackendChallenge, localIds: string[]): boolean {
  return c.user_status === 'claimed' || localIds.includes(String(c.id));
}

function isEligible(c: BackendChallenge, localIds: string[]): boolean {
  if (isDone(c, localIds)) return false;
  return c.can_claim || c.user_status === 'eligible';
}

function isFull(c: BackendChallenge): boolean {
  return typeof c.max_completions === 'number' && c.completions_count >= c.max_completions;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ChallengesPage: React.FC<ChallengesPageProps> = ({ onBack }) => {
  const { completedChallenges, completeChallenge, addPoints, showToast, eventConfig, refreshLeaderboard } = useApp();
  const { t } = useTheme();
  const eventId = eventConfig?.eventId;

  const [challenges, setChallenges] = useState<BackendChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);

  // Always fetch fresh — API is Cache-Control: private, no-store.
  const fetchChallenges = useCallback(async (silent = false) => {
    if (!eventId) return;
    if (!silent) { setLoading(true); setLoadError(null); }
    const res = await listEventChallengesApi(eventId);
    if (!silent) setLoading(false);
    if (res.success && res.data) {
      setChallenges(res.data.filter(c => c.is_active));
    } else if (!silent) {
      setLoadError(res.error?.message ?? 'Failed to load challenges.');
    }
  }, [eventId]);

  // Fresh fetch every time the screen opens.
  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  const handleClaim = async (c: BackendChallenge) => {
    if (!eventId || claimingId !== null) return;
    if (!isEligible(c, completedChallenges)) return;

    setClaimingId(c.id);
    const res = await claimEventChallengeApi(eventId, c.id);
    setClaimingId(null);

    if (res.success && res.data) {
      const pts = res.data.points_earned || c.points;
      if (res.data.awarded && pts > 0) {
        addPoints(pts, `Challenge: ${c.title}`);
      }
      // Mark locally so the UI updates instantly, then re-fetch to sync
      // server state (including any newly eligible challenges unlocked by
      // this action).
      completeChallenge(String(c.id), true);
      // Refresh the leaderboard so updated points are reflected immediately.
      refreshLeaderboard?.();
      fetchChallenges(true);
      return;
    }

    // 409 — already claimed on the server; reconcile local state.
    if (res.error?.code === 'ALREADY_CLAIMED') {
      completeChallenge(String(c.id), true);
      fetchChallenges(true);
      return;
    }

    // 422 — not yet eligible; re-fetch to get the latest user_status.
    if (res.error?.code === 'NOT_ELIGIBLE') {
      showToast('Criteria not met yet — keep going!');
      fetchChallenges(true);
      return;
    }

    showToast(res.error?.message ?? 'Failed to claim challenge. Please try again.');
  };

  const activeCount    = challenges.filter(c => !isDone(c, completedChallenges)).length;
  const completedCount = challenges.filter(c =>  isDone(c, completedChallenges)).length;

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
          Meet the criteria to claim bonus points
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
          const done     = isDone(c, completedChallenges);
          const eligible = isEligible(c, completedChallenges);
          const full     = isFull(c);
          const claiming = claimingId === c.id;
          const cfg      = getCriteria(c.criteria_type);
          const CfgIcon  = cfg.icon;

          return (
            <div key={c.id} className="rounded-2xl p-5"
              style={{
                background: t.surface,
                boxShadow: t.shadow,
                border: `1px solid ${done ? t.successText + '50' : eligible ? cfg.color + '50' : t.border}`,
                opacity: done ? 0.85 : 1,
                transition: 'border-color 0.2s',
              }}>

              {/* ── Title row ── */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <h3 style={{ color: t.text, fontSize: 16, fontWeight: 700 }}>{c.title}</h3>
                    {done && (
                      <CheckCircle2 style={{ width: 17, height: 17, color: t.successText, flexShrink: 0 }} />
                    )}
                    {/* Criteria type pill */}
                    <span className="px-2 py-0.5 rounded-md"
                      style={{
                        background: cfg.color + '18',
                        color: cfg.color,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: '0.05em',
                      }}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Description from backend, or fallback criteria hint */}
                  <p style={{ color: t.textSec, fontSize: 13, lineHeight: 1.5 }}>
                    {c.description || cfg.hint}
                  </p>

                  {/* Extra hint when locked */}
                  {!done && !eligible && c.description && (
                    <p className="mt-1.5 flex items-center gap-1.5"
                      style={{ color: t.textMuted, fontSize: 12 }}>
                      <Lock style={{ width: 11, height: 11, flexShrink: 0 }} />
                      {cfg.hint}
                    </p>
                  )}
                </div>

                {/* Icon orb */}
                <div className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: done ? t.successBg : cfg.gradient }}>
                  {done
                    ? <CheckCircle2 style={{ width: 26, height: 26, color: t.successText }} />
                    : <CfgIcon style={{ width: 26, height: 26, color: '#fff' }} />}
                </div>
              </div>

              {/* ── Footer ── */}
              <div className="flex items-center justify-between pt-3"
                style={{ borderTop: `1px solid ${t.divider}` }}>

                <div className="flex items-center gap-3">
                  <span style={{ color: t.successText, fontWeight: 700, fontSize: 13 }}>
                    +{c.points} pts
                  </span>
                  {typeof c.max_completions === 'number' && (
                    <span style={{ color: t.textMuted, fontSize: 12 }}>
                      {c.completions_count}/{c.max_completions} claimed
                    </span>
                  )}
                </div>

                {/* Action area */}
                {done ? (
                  <div className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: t.successBg, color: t.successText }}>
                    Completed ✓
                  </div>
                ) : full ? (
                  <div className="px-4 py-2 rounded-xl text-sm font-semibold"
                    style={{ background: t.surface2, color: t.textMuted }}>
                    Fully claimed
                  </div>
                ) : eligible ? (
                  <button
                    onClick={() => handleClaim(c)}
                    disabled={claiming}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-white transition-opacity active:scale-95"
                    style={{
                      background: 'linear-gradient(135deg,#10b981,#0d9488)',
                      boxShadow: '0 4px 16px rgba(16,185,129,0.3)',
                      opacity: claiming ? 0.7 : 1,
                    }}>
                    {claiming && <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />}
                    {claiming ? 'Claiming…' : 'Claim Points'}
                  </button>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-xl"
                    style={{ background: t.surface2, border: `1px solid ${t.border}` }}>
                    <Lock style={{ width: 12, height: 12, color: t.textMuted }} />
                    <span style={{ color: t.textMuted, fontSize: 12, fontWeight: 600 }}>
                      {c.criteria_type === 'VISIT_ALL_SPONSORS' ? 'Visit all partners' :
                       c.criteria_type === 'EXTERNAL_ACTION'    ? 'Waiting for organiser' :
                       'Criteria not met'}
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
