/**
 * SwitchEventModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Bottom-sheet modal that lets a user enter their event access code to switch
 * into a different event/conference.
 *
 * Flow:
 *   [Code Entry] ──valid code──► [Event Preview] ──confirm──► [Switched ✓]
 *                ◄──── back ─────
 *
 * Real backend is called on Verify:
 *   POST /api/v1/events/join  { event_code, code }  → join + get eventId
 *   GET  /api/v1/events/:id                          → full event details for preview
 *   POST /api/v1/events/:id/self-check-in            → auto check-in on confirm
 */

import React, {
  useRef,
  useState,
  useCallback,
  useEffect,
  KeyboardEvent,
  ClipboardEvent,
} from 'react';
import {
  X,
  Ticket,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Calendar,
  MapPin,
  ArrowLeft,
  Lock,
  Users,
  Zap,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { EventConfig } from '@/app/types/config';
import { joinEventByCodeApi, getEventApi, OrganizerEvent } from '@/app/api/eventsClient';
import { selfCheckInApi } from '@/app/api/audienceClient';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

function eventToConfig(ev: OrganizerEvent): EventConfig {
  return {
    eventId: ev.id,
    name: ev.title,
    dates: ev.dates,
    endDate: ev.dateRange?.end || undefined,
    timezone: 'UTC',
    location: ev.location,
    logoURL: '',
    backgroundURL: ev.cover,
    themeColors: { primary: '#7c3aed', secondary: '#4f46e5', accent: '#ec4899' },
    modulesEnabled: {
      agenda: true, sponsors: true, surveys: true, polls: true,
      leaderboard: true, audience: true, challenges: true, notifications: true,
    },
    permissions: { guestAccess: true, sponsorRoleEnabled: true, networkingEnabled: true },
  };
}

// The input grid supports up to MAX_CHARS boxes; the "Verify" button enables once
// the user has typed at least MIN_CODE_LEN alphanumeric characters.
const MAX_CHARS = 8;
const MIN_CODE_LEN = 4;

// ─── Props ────────────────────────────────────────────────────────────────────

interface SwitchEventModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Step types ───────────────────────────────────────────────────────────────

type ModalStep = 'entry' | 'preview' | 'success';

// ─── Component ────────────────────────────────────────────────────────────────

export const SwitchEventModal: React.FC<SwitchEventModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { eventConfig, switchEvent, joinEvent } = useApp();
  const { t } = useTheme();

  const [step, setStep] = useState<ModalStep>('entry');
  const [chars, setChars] = useState<string[]>(Array(MAX_CHARS).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The matched event config (real data from backend)
  const [matchedConfig, setMatchedConfig] = useState<EventConfig | null>(null);
  // The event ID returned by the join endpoint — used for self-check-in
  const [joinedEventId, setJoinedEventId] = useState<string>('');
  const [switching, setSwitching] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('entry');
        setChars(Array(MAX_CHARS).fill(''));
        setError(null);
        setMatchedConfig(null);
        setJoinedEventId('');
        setVerifying(false);
        setSwitching(false);
      }, 300);
    } else {
      setTimeout(() => inputRefs.current[0]?.focus(), 200);
    }
  }, [isOpen]);

  const code = chars.join('').trim();
  const isReady = code.length >= MIN_CODE_LEN;

  // ─── Input handling ────────────────────────────────────────────────────────

  const handleCharInput = useCallback(
    (index: number, value: string) => {
      const cleaned = normalize(value).slice(-1);
      if (!cleaned && value !== '') return;

      const next = [...chars];
      next[index] = cleaned;
      setChars(next);
      setError(null);

      if (cleaned && index < MAX_CHARS - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [chars],
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Backspace') {
        if (chars[index]) {
          const next = [...chars];
          next[index] = '';
          setChars(next);
          setError(null);
        } else if (index > 0) {
          const next = [...chars];
          next[index - 1] = '';
          setChars(next);
          setError(null);
          inputRefs.current[index - 1]?.focus();
        }
        e.preventDefault();
      } else if (e.key === 'ArrowLeft' && index > 0) {
        inputRefs.current[index - 1]?.focus();
      } else if (e.key === 'ArrowRight' && index < MAX_CHARS - 1) {
        inputRefs.current[index + 1]?.focus();
      } else if (e.key === 'Enter' && isReady && step === 'entry') {
        handleVerify();
      }
    },
    [chars, isReady, step],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = normalize(e.clipboardData.getData('text')).slice(0, MAX_CHARS);
      if (!pasted) return;
      const next = Array(MAX_CHARS).fill('');
      pasted.split('').forEach((c, i) => { next[i] = c; });
      setChars(next);
      setError(null);
      const focusIdx = Math.min(pasted.length, MAX_CHARS - 1);
      inputRefs.current[focusIdx]?.focus();
    },
    [],
  );

  // ─── Verify code (real backend) ────────────────────────────────────────────

  const handleVerify = useCallback(async () => {
    if (!isReady || verifying) return;
    setVerifying(true);
    setError(null);

    const res = await joinEventByCodeApi(code);
    const is409 = !res.success && res.error?.code === '409';

    if (!res.success && !is409) {
      setError(res.error?.message ?? 'Invalid event code. Please check and try again.');
      setVerifying(false);
      setChars(Array(MAX_CHARS).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      return;
    }

    const eventId = res.data?.eventId ?? '';
    setJoinedEventId(eventId);

    // Fetch full event details for the preview step
    if (eventId) {
      try {
        const evRes = await getEventApi(eventId);
        if (evRes.success && evRes.data) {
          // Guard: don't let the user "switch" to the event they're already in
          if (evRes.data.id === eventConfig.eventId) {
            setError("You're already attending this event!");
            setVerifying(false);
            return;
          }
          setMatchedConfig(eventToConfig(evRes.data));
        }
      } catch {
        // Non-fatal — still proceed with a minimal config
      }
    }

    setStep('preview');
    setVerifying(false);
  }, [code, isReady, verifying, eventConfig.eventId]);

  // ─── Confirm switch ────────────────────────────────────────────────────────

  const handleConfirmSwitch = useCallback(async () => {
    if (!matchedConfig) return;
    setSwitching(true);

    // switchEvent resets hasJoinedEvent; joinEvent re-gates immediately.
    // Both state updates are batched by React 18 → single render with hasJoinedEvent=true.
    switchEvent(matchedConfig);
    joinEvent();

    // Auto check-in so the user appears in the new event's audience immediately.
    if (joinedEventId) selfCheckInApi(joinedEventId).catch(() => {});

    setStep('success');
    setSwitching(false);
    setTimeout(() => onClose(), 1800);
  }, [matchedConfig, switchEvent, joinEvent, onClose, joinedEventId]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] animate-in fade-in duration-200"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Switch Event"
        className="fixed bottom-0 left-0 right-0 z-[110] max-w-[430px] mx-auto animate-in slide-in-from-bottom duration-300"
      >
        <div className="rounded-t-[2rem] overflow-hidden" style={{ background: t.surface, border: `1px solid ${t.border}`, borderBottom: 'none', boxShadow: '0 -24px 80px rgba(0,0,0,0.5)' }}>
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full" style={{ background: t.border }} />
          </div>

          {/* ── Step: Code Entry ─────────────────────────────────────── */}
          {step === 'entry' && (
            <div className="px-6 pt-4 pb-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                    <Ticket className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Switch Event</h2>
                    <p style={{ color: t.textMuted, fontSize: 12 }}>Enter your event access code</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 flex items-center justify-center rounded-full transition-colors"
                  style={{ background: t.surface2 }}
                >
                  <X style={{ width: 15, height: 15, color: t.textSec }} />
                </button>
              </div>

              {/* Code hint */}
              <div className="flex items-center gap-2 mb-5 px-3 py-2.5 rounded-xl" style={{ background: t.accentBg, border: `1px solid ${t.borderAcc}` }}>
                <Lock style={{ width: 13, height: 13, color: t.accentSoft, flexShrink: 0 }} />
                <p style={{ color: t.accentSoft, fontSize: 12, lineHeight: 1.4 }}>
                  Your unique event access code is provided by the event organiser
                </p>
              </div>

              {/* OTP-style inputs */}
              <div className="flex justify-center gap-1.5 mb-5 flex-wrap">
                {chars.map((char, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="text"
                    maxLength={1}
                    value={char}
                    onChange={(e) => handleCharInput(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    className="text-center font-mono font-bold outline-none rounded-xl transition-all"
                    style={{
                      width: 40, height: 48, fontSize: 18,
                      background: char ? t.accentBg : t.inputBg,
                      border: `2px solid ${char ? t.borderAcc : error ? 'rgba(239,68,68,0.5)' : t.border}`,
                      color: t.text,
                    }}
                    aria-label={`Character ${i + 1}`}
                  />
                ))}
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4" style={{ background: t.errorBg, border: `1px solid rgba(239,68,68,0.25)` }}>
                  <AlertCircle style={{ width: 14, height: 14, color: t.errorText, flexShrink: 0 }} />
                  <p style={{ color: t.errorText, fontSize: 13, fontWeight: 500 }}>{error}</p>
                </div>
              )}

              {/* Hint */}
              <p style={{ color: t.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 16 }}>
                Type your code — {MIN_CODE_LEN}+ characters needed
              </p>

              {/* Verify button */}
              <button
                onClick={handleVerify}
                disabled={!isReady || verifying}
                className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-white transition-all"
                style={{
                  height: 52,
                  background: isReady && !verifying ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : t.surface2,
                  color: isReady ? '#fff' : t.textMuted,
                  cursor: isReady && !verifying ? 'pointer' : 'not-allowed',
                  boxShadow: isReady && !verifying ? '0 8px 28px rgba(124,58,237,0.4)' : 'none',
                }}
              >
                {verifying ? (
                  <><RefreshCw style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> Verifying…</>
                ) : (
                  <><ArrowRight style={{ width: 17, height: 17 }} /> Verify Code</>
                )}
              </button>
            </div>
          )}

          {/* ── Step: Preview ─────────────────────────────────────────── */}
          {step === 'preview' && matchedConfig && (
            <div className="px-6 pt-4 pb-10">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('entry')} className="hover:opacity-70 transition-opacity">
                  <ArrowLeft style={{ width: 22, height: 22, color: t.textSec }} />
                </button>
                <h2 style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Event Preview</h2>
              </div>

              {/* Event banner */}
              <div className="rounded-2xl p-5 text-white mb-5"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5,#6366f1)' }}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <Ticket style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{matchedConfig.name}</h3>
                    {matchedConfig.dates && (
                      <div className="flex items-center gap-1.5" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                        <Calendar style={{ width: 13, height: 13 }} />
                        <span>{matchedConfig.dates}</span>
                      </div>
                    )}
                    {matchedConfig.location && (
                      <div className="flex items-center gap-1.5 mt-0.5" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                        <MapPin style={{ width: 13, height: 13 }} />
                        <span>{matchedConfig.location}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <Users style={{ width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>You are registered for this event</span>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-5"
                style={{ background: t.warningBg, border: `1px solid ${t.border}` }}>
                <Zap style={{ width: 15, height: 15, color: t.warningText, flexShrink: 0, marginTop: 1 }} />
                <p style={{ color: t.warningText, fontSize: 13, fontWeight: 500 }}>
                  Your progress for the current event will be preserved.
                </p>
              </div>

              <button onClick={handleConfirmSwitch} disabled={switching}
                className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-white"
                style={{ height: 52, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', opacity: switching ? 0.7 : 1, boxShadow: '0 8px 28px rgba(124,58,237,0.4)' }}>
                {switching
                  ? <><RefreshCw style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> Switching…</>
                  : <><CheckCircle2 style={{ width: 17, height: 17 }} /> Enter Event</>}
              </button>
            </div>
          )}

          {/* ── Step: Preview (no event details) ──────────────────────── */}
          {step === 'preview' && !matchedConfig && (
            <div className="px-6 pt-4 pb-10">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('entry')} className="hover:opacity-70 transition-opacity">
                  <ArrowLeft style={{ width: 22, height: 22, color: t.textSec }} />
                </button>
                <h2 style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Event Found</h2>
              </div>

              <div className="rounded-2xl p-5 text-white mb-5"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                <div className="flex items-center gap-3">
                  <CheckCircle2 style={{ width: 28, height: 28, color: '#34d399' }} />
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700 }}>Code accepted</p>
                    <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13 }}>
                      You have been registered for this event.
                    </p>
                  </div>
                </div>
              </div>

              <button onClick={handleConfirmSwitch} disabled={switching}
                className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-white"
                style={{ height: 52, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', opacity: switching ? 0.7 : 1, boxShadow: '0 8px 28px rgba(124,58,237,0.4)' }}>
                {switching
                  ? <><RefreshCw style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> Switching…</>
                  : <><CheckCircle2 style={{ width: 17, height: 17 }} /> Enter Event</>}
              </button>
            </div>
          )}

          {/* ── Step: Success ─────────────────────────────────────────── */}
          {step === 'success' && (
            <div className="px-6 pt-6 pb-10 text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
                style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)', boxShadow: '0 12px 40px rgba(16,185,129,0.35)' }}>
                <CheckCircle2 style={{ width: 36, height: 36, color: '#fff' }} />
              </div>
              <h2 style={{ color: t.text, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Switched!</h2>
              <p style={{ color: t.textSec, fontSize: 14, marginBottom: 4 }}>You're now at</p>
              <p style={{ color: t.accentSoft, fontSize: 17, fontWeight: 700 }}>
                {matchedConfig?.name ?? 'the new event'}
              </p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};
