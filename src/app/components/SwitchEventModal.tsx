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
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom sheet panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Switch Event"
        className="fixed bottom-0 left-0 right-0 z-[110] max-w-md mx-auto animate-in slide-in-from-bottom duration-300"
      >
        <div className="bg-white rounded-t-[2rem] shadow-2xl overflow-hidden">
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 bg-gray-200 rounded-full" />
          </div>

          {/* ── Step: Code Entry ─────────────────────────────────────── */}
          {step === 'entry' && (
            <div className="px-6 pt-4 pb-10">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-md">
                    <Ticket className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 leading-tight">Switch Event</h2>
                    <p className="text-xs text-gray-400">Enter your event access code</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Code hint */}
              <div className="flex items-center gap-2 mb-5 px-3 py-2.5 bg-indigo-50 border border-indigo-100 rounded-xl">
                <Lock className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
                <p className="text-xs text-indigo-700 leading-snug">
                  Your 6-character code is provided by the event organiser
                </p>
              </div>

              {/* OTP-style code boxes */}
              <div
                className={`flex items-center justify-center gap-2.5 mb-2 transition-all ${error ? 'animate-[shake_0.35s_ease]' : ''}`}
              >
                {chars.map((ch, idx) => (
                  <input
                    key={idx}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    type="text"
                    inputMode="text"
                    maxLength={2} // allow 1 char + overtype
                    value={ch}
                    onChange={(e) => handleCharInput(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    onFocus={(e) => e.target.select()}
                    aria-label={`Code character ${idx + 1}`}
                    className={`w-11 h-14 text-center text-xl font-bold uppercase rounded-xl border-2 outline-none transition-all caret-transparent select-none
                      ${ch
                        ? error
                          ? 'border-red-400 bg-red-50 text-red-600'
                          : 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100'
                        : 'border-gray-200 bg-gray-50 text-gray-900 focus:border-indigo-400 focus:bg-white focus:shadow-sm focus:shadow-indigo-100'
                      }`}
                  />
                ))}
              </div>

              {/* Separator dots between groups of 3 */}
              <div className="flex justify-center mb-4">
                <div className="flex items-center gap-1">
                  {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                    <div
                      key={i}
                      className={`transition-all duration-200 rounded-full ${
                        chars[i]
                          ? error
                            ? 'w-2 h-2 bg-red-400'
                            : 'w-2 h-2 bg-indigo-500'
                          : 'w-1.5 h-1.5 bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2 mb-4 px-3.5 py-3 bg-red-50 border border-red-200 rounded-xl animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Verify button */}
              <button
                type="button"
                onClick={handleVerify}
                disabled={!isFilled || verifying}
                className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-white transition-all
                  ${isFilled && !verifying
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:shadow-lg hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 opacity-60 cursor-not-allowed'
                  }`}
              >
                {verifying ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Verifying code…
                  </>
                ) : (
                  <>
                    Verify Code
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              {/* Demo hint */}
              <div className="mt-4 p-3.5 bg-gradient-to-r from-gray-50 to-gray-50 border border-gray-100 rounded-2xl">
                <p className="text-[11px] text-gray-400 text-center mb-1.5 font-medium uppercase tracking-wide">
                  Demo Codes
                </p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {Object.keys(EVENT_CODES).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => {
                        const filled = c.split('');
                        setChars(filled);
                        setError(null);
                        inputRefs.current[CODE_LENGTH - 1]?.focus();
                      }}
                      className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg font-mono text-[11px] font-bold text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step: Event Preview ──────────────────────────────────── */}
          {step === 'preview' && matched && (
            <div className="px-6 pt-2 pb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Header */}
              <div className="flex items-center justify-between mb-5">
                <button
                  onClick={() => { setStep('entry'); setMatched(null); }}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Event preview card */}
              <div className={`bg-gradient-to-br ${matched.color} rounded-3xl p-6 text-white mb-5 shadow-xl relative overflow-hidden`}>
                {/* Background orb */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <div className="bg-white/20 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {code}
                      </span>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold mb-1 tracking-tight">{matched.config.name}</h3>
                  <p className="text-white/80 text-sm leading-relaxed mb-4">
                    {matched.description}
                  </p>
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <Calendar className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{matched.config.dates}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <MapPin className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{matched.config.location}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{matched.attendeeCount.toLocaleString()} attending</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modules info */}
              <div className="flex flex-wrap gap-2 mb-5">
                {Object.entries(matched.config.modulesEnabled)
                  .filter(([, enabled]) => enabled)
                  .map(([mod]) => (
                    <span
                      key={mod}
                      className="px-2.5 py-1 bg-indigo-50 border border-indigo-100 rounded-lg text-[11px] font-semibold text-indigo-600 uppercase tracking-wide flex items-center gap-1"
                    >
                      <Zap className="w-2.5 h-2.5" />
                      {mod}
                    </span>
                  ))}
              </div>

              {/* Warning about switching */}
              <div className="flex items-start gap-2.5 mb-5 px-3.5 py-3 bg-amber-50 border border-amber-200 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 leading-relaxed">
                  Switching will reset your current session and load{' '}
                  <strong>{matched.config.name}</strong>. Your earned points are preserved.
                </p>
              </div>

              {/* Confirm button */}
              <button
                type="button"
                onClick={handleConfirmSwitch}
                disabled={switching}
                className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl font-semibold text-white transition-all
                  ${!switching
                    ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:shadow-lg hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98]'
                    : 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-70 cursor-not-allowed'
                  }`}
              >
                {switching ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Switching event…
                  </>
                ) : (
                  <>
                    <Ticket className="w-5 h-5" />
                    Switch to This Event
                  </>
                )}
              </button>
            </div>
          )}

          {/* ── Step: Success ────────────────────────────────────────── */}
          {step === 'success' && matched && (
            <div className="px-6 pt-6 pb-12 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
              <div className="relative mb-5">
                <div className={`w-20 h-20 bg-gradient-to-br ${matched.color} rounded-3xl flex items-center justify-center shadow-xl`}>
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <div className={`absolute inset-0 rounded-3xl blur-xl bg-gradient-to-br ${matched.color} opacity-40 -z-10`} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-1.5">Event Switched!</h3>
              <p className="text-sm text-gray-500 max-w-xs">
                Welcome to <strong className="text-gray-800">{matched.config.name}</strong>
                . Loading your new experience…
              </p>
              <div className="flex gap-1.5 mt-5">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className={`w-2 h-2 rounded-full bg-gradient-to-br ${matched.color} animate-bounce`}
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
      `}</style>
    </>
  );
};
