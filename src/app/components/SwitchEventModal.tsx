/**
 * SwitchEventModal
 * ─────────────────────────────────────────────────────────────────────────────
 * Bottom-sheet modal that lets a user enter a 6-character event access code
 * to switch into a different event/conference.
 *
 * Flow:
 *   [Code Entry] ──valid code──► [Event Preview] ──confirm──► [Switched ✓]
 *                ◄──── back ─────
 *
 * Mock event codes (replace with API call when backend is live):
 *   TECH26 · DEVCON · SUMMIT · HEALTH · DESIGN · FUTURE
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
  Sparkles,
  Lock,
  Users,
  Zap,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { useTheme } from '@/app/context/ThemeContext';
import { EventConfig } from '@/app/types/config';

// ─── Mock Event Code Registry ─────────────────────────────────────────────────
// TODO: Replace with GET /events/verify-code?code=XXXXX when backend is ready

interface EventPreview {
  config: EventConfig;
  attendeeCount: number;
  description: string;
  color: string; // tailwind gradient classes
}

const EVENT_CODES: Record<string, EventPreview> = {
  TECH26: {
    attendeeCount: 2400,
    description: 'The premier technology conference for builders, designers, and innovators.',
    color: 'from-indigo-500 via-purple-600 to-pink-600',
    config: {
      eventId: 'tech-summit-2026',
      name: 'Tech Summit 2026',
      dates: 'January 16–18, 2026',
      timezone: 'PST',
      location: 'San Francisco, CA',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#ec4899' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: true, leaderboard: true, audience: true, challenges: true, notifications: true },
      permissions: { guestAccess: true, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
  DEVCON: {
    attendeeCount: 1800,
    description: 'A hands-on developer conference covering cloud, AI, and open-source.',
    color: 'from-cyan-500 via-blue-600 to-indigo-600',
    config: {
      eventId: 'devcon-winter-2026',
      name: 'DevCon Winter 2026',
      dates: 'February 20–22, 2026',
      timezone: 'CST',
      location: 'Austin, TX',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#0ea5e9', secondary: '#3b82f6', accent: '#6366f1' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: true, leaderboard: true, audience: false, challenges: true, notifications: true },
      permissions: { guestAccess: false, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
  SUMMIT: {
    attendeeCount: 950,
    description: 'Exclusive leadership conference for C-suite executives and founders.',
    color: 'from-amber-500 via-orange-500 to-red-500',
    config: {
      eventId: 'leadership-summit-2026',
      name: 'Leadership Summit 2026',
      dates: 'March 5–7, 2026',
      timezone: 'EST',
      location: 'New York, NY',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#f59e0b', secondary: '#ef4444', accent: '#f97316' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: false, leaderboard: false, audience: true, challenges: false, notifications: true },
      permissions: { guestAccess: false, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
  HEALTH: {
    attendeeCount: 3100,
    description: 'Where healthcare innovation meets technology — connecting clinicians, startups, and investors.',
    color: 'from-emerald-500 via-teal-500 to-cyan-600',
    config: {
      eventId: 'healthtech-expo-2026',
      name: 'HealthTech Expo 2026',
      dates: 'April 10–12, 2026',
      timezone: 'EST',
      location: 'Boston, MA',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#10b981', secondary: '#14b8a6', accent: '#06b6d4' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: true, leaderboard: true, audience: true, challenges: true, notifications: true },
      permissions: { guestAccess: true, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
  DESIGN: {
    attendeeCount: 1200,
    description: 'Two days of inspiration, workshops, and talks from the world\'s leading designers.',
    color: 'from-pink-500 via-rose-500 to-purple-600',
    config: {
      eventId: 'design-forward-2026',
      name: 'Design Forward 2026',
      dates: 'May 8–9, 2026',
      timezone: 'PST',
      location: 'Seattle, WA',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#ec4899', secondary: '#f43f5e', accent: '#a855f7' },
      modulesEnabled: { agenda: true, sponsors: false, surveys: true, polls: true, leaderboard: true, audience: true, challenges: false, notifications: true },
      permissions: { guestAccess: true, sponsorRoleEnabled: false, networkingEnabled: true },
    },
  },
  FUTURE: {
    attendeeCount: 5000,
    description: 'The world\'s largest future-of-work conference, exploring AI, automation, and society.',
    color: 'from-violet-600 via-purple-600 to-fuchsia-600',
    config: {
      eventId: 'future-of-work-2026',
      name: 'Future of Work 2026',
      dates: 'June 15–18, 2026',
      timezone: 'GMT',
      location: 'London, UK',
      logoURL: '',
      backgroundURL: '',
      themeColors: { primary: '#7c3aed', secondary: '#a21caf', accent: '#c026d3' },
      modulesEnabled: { agenda: true, sponsors: true, surveys: true, polls: true, leaderboard: true, audience: true, challenges: true, notifications: true },
      permissions: { guestAccess: false, sponsorRoleEnabled: true, networkingEnabled: true },
    },
  },
};

const CODE_LENGTH = 6;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalize = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

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
  const { eventConfig, switchEvent } = useApp();
  const { t } = useTheme();

  const [step, setStep] = useState<ModalStep>('entry');
  const [chars, setChars] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matched, setMatched] = useState<EventPreview | null>(null);
  const [switching, setSwitching] = useState(false);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Reset on open/close
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setStep('entry');
        setChars(Array(CODE_LENGTH).fill(''));
        setError(null);
        setMatched(null);
        setVerifying(false);
        setSwitching(false);
      }, 300); // wait for close animation
    } else {
      // Auto-focus first input when modal opens
      setTimeout(() => inputRefs.current[0]?.focus(), 200);
    }
  }, [isOpen]);

  const code = chars.join('');
  const isFilled = code.length === CODE_LENGTH;

  // ─── Input handling ────────────────────────────────────────────────────────
  const handleCharInput = useCallback(
    (index: number, value: string) => {
      const cleaned = normalize(value).slice(-1);
      if (!cleaned && value !== '') return; // reject non-alphanumeric (but allow empty for delete)

      const next = [...chars];
      next[index] = cleaned;
      setChars(next);
      setError(null);

      if (cleaned && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    },
    [chars]
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
      } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
        inputRefs.current[index + 1]?.focus();
      } else if (e.key === 'Enter' && isFilled && step === 'entry') {
        handleVerify();
      }
    },
    [chars, isFilled, step]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = normalize(e.clipboardData.getData('text')).slice(0, CODE_LENGTH);
      if (!pasted) return;
      const next = Array(CODE_LENGTH).fill('');
      pasted.split('').forEach((c, i) => { next[i] = c; });
      setChars(next);
      setError(null);
      const focusIdx = Math.min(pasted.length, CODE_LENGTH - 1);
      inputRefs.current[focusIdx]?.focus();
    },
    []
  );

  // ─── Verify code ───────────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (!isFilled || verifying) return;
    setVerifying(true);
    setError(null);

    // TODO: replace with real API: GET /events/verify-code?code=CODE
    await new Promise((r) => setTimeout(r, 900));

    const lookup = EVENT_CODES[code];

    if (!lookup) {
      setError('Invalid event code. Please check and try again.');
      setVerifying(false);
      // Shake effect: clear + refocus
      setChars(Array(CODE_LENGTH).fill(''));
      setTimeout(() => inputRefs.current[0]?.focus(), 50);
      return;
    }

    if (lookup.config.eventId === eventConfig.eventId) {
      setError("You're already attending this event!");
      setVerifying(false);
      return;
    }

    setMatched(lookup);
    setStep('preview');
    setVerifying(false);
  }, [code, isFilled, verifying, eventConfig.eventId]);

  // ─── Confirm switch ────────────────────────────────────────────────────────
  const handleConfirmSwitch = useCallback(async () => {
    if (!matched) return;
    setSwitching(true);
    // Simulate a brief handshake
    await new Promise((r) => setTimeout(r, 1100));
    switchEvent(matched.config);
    setStep('success');
    setSwitching(false);
    // Auto-close after showing success
    setTimeout(() => onClose(), 1800);
  }, [matched, switchEvent, onClose]);

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
                  Your 6-character code is provided by the event organiser
                </p>
              </div>

              {/* OTP inputs */}
              <div className="flex justify-center gap-2 mb-5">
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
                      width: 46, height: 52, fontSize: 20,
                      background: char ? t.accentBg : t.inputBg,
                      border: `2px solid ${char ? t.borderAcc : error ? 'rgba(239,68,68,0.5)' : t.border}`,
                      color: t.text,
                    }}
                    aria-label={`Digit ${i + 1}`}
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

              {/* Hint codes */}
              <p style={{ color: t.textMuted, fontSize: 11, textAlign: 'center', marginBottom: 16 }}>
                Try: <span style={{ fontFamily: 'monospace', color: t.accentSoft }}>TECH26 · DEVCON · SUMMIT · HEALTH</span>
              </p>

              {/* Verify button */}
              <button
                onClick={handleVerify}
                disabled={!isFilled || verifying}
                className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-white transition-all"
                style={{
                  height: 52,
                  background: isFilled && !verifying ? 'linear-gradient(135deg,#7c3aed,#4f46e5)' : t.surface2,
                  color: isFilled ? '#fff' : t.textMuted,
                  cursor: isFilled && !verifying ? 'pointer' : 'not-allowed',
                  boxShadow: isFilled && !verifying ? '0 8px 28px rgba(124,58,237,0.4)' : 'none',
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
          {step === 'preview' && matched && (
            <div className="px-6 pt-4 pb-10">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setStep('entry')} className="hover:opacity-70 transition-opacity">
                  <ArrowLeft style={{ width: 22, height: 22, color: t.textSec }} />
                </button>
                <h2 style={{ color: t.text, fontSize: 17, fontWeight: 700 }}>Event Preview</h2>
              </div>

              {/* Event banner */}
              <div className={`bg-gradient-to-br ${matched.color} rounded-2xl p-5 text-white mb-5`}>
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.25)' }}>
                    <Sparkles style={{ width: 24, height: 24 }} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>{matched.config.name}</h3>
                    <div className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                      <Calendar style={{ width: 13, height: 13 }} /><span>{matched.config.dates}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1" style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
                      <MapPin style={{ width: 13, height: 13 }} /><span>{matched.config.location}</span>
                    </div>
                  </div>
                </div>
                <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 1.5, marginBottom: 12 }}>{matched.description}</p>
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.2)' }}>
                  <Users style={{ width: 15, height: 15 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{matched.attendeeCount.toLocaleString()} expected attendees</span>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-5" style={{ background: t.warningBg, border: `1px solid ${t.border}` }}>
                <Zap style={{ width: 15, height: 15, color: t.warningText, flexShrink: 0, marginTop: 1 }} />
                <p style={{ color: t.warningText, fontSize: 13, fontWeight: 500 }}>Your progress for the current event will be preserved.</p>
              </div>

              <button onClick={handleConfirmSwitch} disabled={switching}
                className="w-full flex items-center justify-center gap-2 rounded-2xl font-semibold text-white"
                style={{ height: 52, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', opacity: switching ? 0.7 : 1, boxShadow: '0 8px 28px rgba(124,58,237,0.4)' }}>
                {switching
                  ? <><RefreshCw style={{ width: 17, height: 17, animation: 'spin 1s linear infinite' }} /> Switching…</>
                  : <><CheckCircle2 style={{ width: 17, height: 17 }} /> Confirm Switch</>}
              </button>
            </div>
          )}

          {/* ── Step: Success ─────────────────────────────────────────── */}
          {step === 'success' && matched && (
            <div className="px-6 pt-6 pb-10 text-center">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5" style={{ background: 'linear-gradient(135deg,#10b981,#0d9488)', boxShadow: '0 12px 40px rgba(16,185,129,0.35)' }}>
                <CheckCircle2 style={{ width: 36, height: 36, color: '#fff' }} />
              </div>
              <h2 style={{ color: t.text, fontSize: 22, fontWeight: 800, marginBottom: 6 }}>Switched!</h2>
              <p style={{ color: t.textSec, fontSize: 14, marginBottom: 4 }}>You're now at</p>
              <p style={{ color: t.accentSoft, fontSize: 17, fontWeight: 700 }}>{matched.config.name}</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
};