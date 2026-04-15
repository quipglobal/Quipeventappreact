/**
 * WelcomeScreen — Mobile-first cinematic landing with background video
 * ──────────────────────────────────────────────────────────────────────
 * Full-screen background video (business networking)
 * Email login → OTP → Profile review / Create account
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import cxoLogo from '@/assets/cxo-logo-transparent.png';
import { User, Mail, Briefcase, Building2, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, X, Phone, LogOut } from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import { sendOtp, verifyOtp, registerUser, AuthUser } from '@/app/api/authClient';
import { clearToken } from '@/app/api/client';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

// ─── Network SVG nodes (decorative) ───────────────────────────────────────────
const NetworkNodes = () => (
  <svg width="100%" height="100%" viewBox="0 0 390 200" fill="none" className="absolute inset-0 opacity-20" style={{ pointerEvents: 'none' }}>
    {[
      [60, 40], [180, 70], [300, 30], [340, 110], [80, 140], [210, 160], [130, 90],
    ].map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r="3.5" fill="white" fillOpacity="0.7"
        style={{ animation: `pulse-node ${1.8 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
    ))}
    {[
      [60,40,180,70],[180,70,300,30],[300,30,340,110],[80,140,210,160],
      [130,90,180,70],[130,90,80,140],[210,160,340,110],[60,40,130,90],
    ].map(([x1,y1,x2,y2], i) => (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
        stroke="white" strokeOpacity="0.25" strokeWidth="1"
        strokeDasharray="4 6"
        style={{ animation: `line-dash ${3 + i * 0.4}s linear infinite`, animationDelay: `${i * 0.15}s` }} />
    ))}
  </svg>
);

// ─── OTP Input ────────────────────────────────────────────────────────────────
interface OtpInputProps {
  value: string;
  onChange: (v: string) => void;
  hasError: boolean;
}
const OtpInput: React.FC<OtpInputProps> = ({ value, onChange, hasError }) => {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (value[i]) {
        onChange(value.slice(0, i) + value.slice(i + 1));
      } else if (i > 0) {
        refs.current[i - 1]?.focus();
        onChange(value.slice(0, i - 1) + value.slice(i));
      }
    }
  };

  const handleChange = (i: number, char: string) => {
    const digit = char.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    const next = (value.slice(0, i) + digit + value.slice(i + 1)).slice(0, 6);
    onChange(next);
    if (i < 5) refs.current[i + 1]?.focus();
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted) { onChange(pasted); refs.current[Math.min(pasted.length, 5)]?.focus(); }
    e.preventDefault();
  };

  return (
    <div className="flex gap-2 justify-center" onPaste={handlePaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKey(i, e)}
          onFocus={e => e.target.select()}
          className="outline-none text-center font-bold rounded-xl transition-all"
          style={{
            width: 46, height: 54,
            fontSize: 22,
            background: hasError ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.06)',
            border: `2px solid ${
              hasError ? 'rgba(239,68,68,0.5)'
              : value[i] ? 'rgba(124,58,237,0.7)'
              : 'rgba(255,255,255,0.12)'
            }`,
            color: '#fff',
          }}
        />
      ))}
    </div>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────
type SheetView = 'phone' | 'otp' | 'not-found' | 'profile-review' | 'create-account' | 'registered';

interface WelcomeScreenProps { onLogin: () => void; }

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLogin }) => {
  const { setUser } = useApp();

  const handleLogout = useCallback(() => {
    clearToken();
    setUser(null);
  }, [setUser]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [view, setView] = useState<SheetView>('phone');
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // ── Email input state ─────────────────────────────────────────────────
  const [emailInput, setEmailInput] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  // ── OTP state ─────────────────────────────────────────────────────────
  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Tracks why we entered the OTP screen: 'login' (existing user check)
  // or 'signup' (email verification before account creation)
  const [otpContext, setOtpContext] = useState<'login' | 'signup'>('login');

  // ── Resolved existing user (if found) ─────────────────────────────────
  const [existingUser, setExistingUser] = useState<AuthUser | null>(null);

  // ── Create account form ───────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({ firstName: '', lastName: '', title: '', company: '', phone: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  // ── Registered user (held until "Login" is pressed on the success screen) ──
  const [registeredUserData, setRegisteredUserData] = useState<Parameters<typeof setUser>[0]>(null);

  const startResendCountdown = useCallback(() => {
    setResendCountdown(30);
    resendRef.current = setInterval(() => {
      setResendCountdown(p => {
        if (p <= 1) { if (resendRef.current) clearInterval(resendRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  }, []);

  // ── Submit email (login path) ─────────────────────────────────────────
  // Uses type:'login'. Backend only sends OTP when account exists; we detect
  // this via the expires_in field. Non-existing users go to 'not-found'.
  const handlePhoneContinue = useCallback(async () => {
    const email = emailInput.trim();
    if (!isValidEmail(email)) { setPhoneError('Please enter a valid email address.'); return; }
    setPhoneError('');
    setPhoneLoading(true);

    try {
      const res = await sendOtp(email, 'login');
      if (!res.success) {
        setPhoneError(res.error?.message ?? 'Failed to check your account. Please try again.');
        return;
      }
      if (!res.otpSent) {
        // No account with this email — skip OTP and show "not found" screen
        setView('not-found');
        return;
      }
      // Account exists — OTP was sent, proceed to verification
      setOtpContext('login');
      setOtpValue('');
      setOtpError('');
      setView('otp');
      startResendCountdown();
    } catch {
      setPhoneError('Network error. Please check your connection and try again.');
    } finally {
      setPhoneLoading(false);
    }
  }, [emailInput, startResendCountdown]);

  // ── Start signup (from 'not-found' screen) ────────────────────────────
  // Go directly to the registration form — no OTP step required.
  const handleStartSignup = useCallback(() => {
    setCreateForm({ firstName: '', lastName: '', title: '', company: '', phone: '' });
    setCreateError('');
    setView('create-account');
  }, []);

  // ── Verify OTP (auto-submits when 6 digits entered) ───────────────────
  useEffect(() => {
    if (otpValue.length !== 6 || otpLoading) return;

    setOtpLoading(true);
    const email = emailInput.trim();
    const type = otpContext === 'signup' ? 'email_verify' : 'login';

    verifyOtp(email, otpValue, type)
      .then(res => {
        if (!res.success || !res.data) {
          setOtpError(res.error?.message ?? 'Verification failed. Please try again.');
          return;
        }
        const { user, accountExists } = res.data;
        if (accountExists && user) {
          // Existing account verified — token already saved by verifyOtp
          setExistingUser(user);
          setView('profile-review');
        } else {
          // No account — if we were doing signup OTP, go to form; else not-found
          setExistingUser(null);
          setView(otpContext === 'signup' ? 'create-account' : 'not-found');
        }
      })
      .catch(() => {
        setOtpError('Network error. Please check your connection and try again.');
      })
      .finally(() => {
        setOtpLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otpValue]);

  // ── Resend OTP ────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (resendCountdown > 0) return;
    const email = emailInput.trim();
    const type = otpContext === 'signup' ? 'email_verify' : 'login';
    setOtpValue('');
    setOtpError('');
    try {
      const res = await sendOtp(email, type);
      if (!res.success) {
        setOtpError(res.error?.message ?? 'Failed to resend code. Please try again.');
        return;
      }
      startResendCountdown();
    } catch {
      setOtpError('Network error. Please check your connection and try again.');
    }
  }, [resendCountdown, emailInput, otpContext, startResendCountdown]);

  // ── Confirm existing profile ──────────────────────────────────────────
  const handleProfileConfirm = useCallback(() => {
    if (!existingUser) return;
    setUser({
      id: existingUser.id,
      name: existingUser.name,
      email: existingUser.email ?? '',
      title: existingUser.title ?? '',
      company: existingUser.company ?? '',
      role: existingUser.role,
      avatar: existingUser.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(existingUser.name)}&background=7c3aed&color=fff`,
      points: existingUser.points ?? 0,
      tier: existingUser.tier ?? 'Bronze',
      interests: existingUser.interests ?? [],
      profileComplete: existingUser.profileComplete ?? true,
      emailVerified: existingUser.emailVerified ?? true,
    });
    onLogin();
  }, [existingUser, setUser, onLogin]);

  // ── Create new account ────────────────────────────────────────────────
  const handleCreateAccount = useCallback(async () => {
    if (!createForm.firstName.trim()) {
      setCreateError('First name is required.');
      return;
    }
    if (!createForm.lastName.trim()) {
      setCreateError('Last name is required.');
      return;
    }
    setCreateError('');
    setCreateLoading(true);

    try {
      const res = await registerUser({
        email: emailInput.trim(),
        firstName: createForm.firstName.trim(),
        lastName: createForm.lastName.trim(),
        phone: createForm.phone.trim(),
        title: createForm.title.trim(),
        company: createForm.company.trim(),
      });

      if (!res.success || !res.data) {
        setCreateError(res.error?.message ?? 'Registration failed. Please try again.');
        return;
      }

      const { user } = res.data;
      const fullName = user.name || `${createForm.firstName.trim()} ${createForm.lastName.trim()}`;

      // Store the user so the success screen's "Login" button can sign them in
      setRegisteredUserData({
        id: user.id,
        name: fullName,
        email: user.email ?? emailInput.trim(),
        title: user.title ?? createForm.title.trim(),
        company: user.company ?? createForm.company.trim(),
        role: user.role,
        avatar: user.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=7c3aed&color=fff`,
        points: user.points ?? 0,
        tier: user.tier ?? 'Bronze',
        interests: user.interests ?? [],
        profileComplete: true,
        emailVerified: true,
      });

      setView('registered');
    } catch {
      setCreateError('Network error. Please check your connection and try again.');
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, emailInput, setUser]);

  // ── Sign in after successful registration ─────────────────────────────
  const handleLoginAfterRegister = useCallback(() => {
    if (!registeredUserData) return;
    setUser(registeredUserData);
    onLogin();
  }, [registeredUserData, setUser, onLogin]);

  // ── Reset and close sheet ─────────────────────────────────────────────
  const closeSheet = () => {
    setSheetOpen(false);
    setTimeout(() => {
      setView('phone');
      setEmailInput('');
      setPhoneError('');
      setOtpValue('');
      setOtpError('');
      setOtpContext('login');
      setExistingUser(null);
      setCreateForm({ firstName: '', lastName: '', title: '', company: '', phone: '' });
      setCreateError('');
      setRegisteredUserData(null);
      if (resendRef.current) clearInterval(resendRef.current);
      setResendCountdown(0);
    }, 380);
  };

  // ── Input field helper ────────────────────────────────────────────────
  const inputStyle = (focused: boolean, hasVal: boolean): React.CSSProperties => ({
    width: '100%', height: 52,
    background: 'rgba(255,255,255,0.06)',
    border: `1.5px solid ${focused ? 'rgba(124,58,237,0.65)' : hasVal ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 14, paddingLeft: 46, paddingRight: 16,
    color: '#fff', fontSize: 15, outline: 'none',
    transition: 'border-color 0.15s',
  });

  const [focusedField, setFocusedField] = useState('');

  return (
    <div className="flex items-center justify-center min-h-screen w-full" style={{ background: '#000', fontFamily: 'Inter,sans-serif' }}>
      <div className="relative w-full overflow-hidden flex flex-col" style={{ maxWidth: 430, height: '100svh', minHeight: 667, maxHeight: 932 }}>

        {/* ── Background video ─────────────────────────────────────────── */}
        {!videoError ? (
          <video ref={videoRef} autoPlay muted loop playsInline onError={() => setVideoError(true)}
            className="absolute inset-0 w-full h-full" style={{ objectFit: 'cover', objectPosition: 'center' }}>
            <source src="https://videos.pexels.com/video-files/3252668/3252668-hd_1280_720_25fps.mp4" type="video/mp4" />
            <source src="https://videos.pexels.com/video-files/2795405/2795405-hd_1280_720_25fps.mp4" type="video/mp4" />
          </video>
        ) : (
          <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg,#0d0d1a 0%,#1a0d2e 30%,#0d1a2e 60%,#0d0d1a 100%)' }} />
        )}

        {/* ── Gradient overlays ────────────────────────────────────────── */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 25%, transparent 45%)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(4,4,16,1) 0%, rgba(4,4,16,0.97) 18%, rgba(4,4,16,0.88) 35%, rgba(4,4,16,0.4) 55%, transparent 72%)' }} />
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse 100% 60% at 50% 100%, rgba(109,40,217,0.18) 0%, transparent 70%)' }} />

        {/* ── Decorative network nodes ─────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0" style={{ height: 200, overflow: 'hidden' }}>
          <NetworkNodes />
        </div>

        {/* ── Log off button — top-left corner ─────────────────────────── */}
        <button
          onClick={handleLogout}
          className="absolute z-30 flex items-center gap-1.5 rounded-full transition-all active:scale-95"
          style={{
            top: 'max(env(safe-area-inset-top, 12px), 12px)',
            left: 16,
            padding: '6px 12px 6px 10px',
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.13)',
            backdropFilter: 'blur(10px)',
          }}
          aria-label="Log off"
        >
          <LogOut size={13} color="rgba(255,255,255,0.6)" />
          <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, letterSpacing: '0.01em' }}>Log off</span>
        </button>

        {/* ── Top bar ──────────────────────────────────────────────────── */}
        <div className="relative z-20 flex items-center justify-between px-6 pt-14 pb-2 flex-shrink-0">
          <img src={cxoLogo} alt="CXO Inc" style={{ height: 48, width: 'auto' }} />
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399', animation: 'live-pulse 1.6s ease-in-out infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Live</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* ── Feature chips ────────────────────────────────────────────── */}
        <div className="relative z-20 px-6 mb-8 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {[
              { emoji: '⚡', label: 'Live Polls', color: 'rgba(124,58,237,0.75)' },
              { emoji: '🏆', label: 'Leaderboard', color: 'rgba(245,158,11,0.75)' },
              { emoji: '🤝', label: 'Networking',  color: 'rgba(16,185,129,0.75)' },
              { emoji: '📊', label: 'Surveys',     color: 'rgba(6,182,212,0.75)' },
              { emoji: '🎯', label: 'Challenges',  color: 'rgba(239,68,68,0.65)' },
            ].map(({ emoji, label, color }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(0,0,0,0.5)', border: `1px solid ${color}`, backdropFilter: 'blur(12px)' }}>
                <span style={{ fontSize: 12 }}>{emoji}</span>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Hero text + CTA ──────────────────────────────────────────── */}
        <div className="relative z-20 px-6 pb-10 flex-shrink-0">
          <h1 style={{ color: '#fff', fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 10 }}>
            Where the<br />
            <span style={{ background: 'linear-gradient(110deg,#c4b5fd 0%,#818cf8 45%,#38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Future Connects
            </span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.55, marginBottom: 20 }}>
            Engage with leaders, earn points, climb the leaderboard — your event experience, fully gamified.
          </p>
          <button onClick={() => setSheetOpen(true)}
            className="w-full relative overflow-hidden flex items-center justify-center gap-3 rounded-2xl"
            style={{ height: 58, background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 55%, #0ea5e9 100%)', boxShadow: '0 0 0 1px rgba(255,255,255,0.15) inset, 0 20px 60px rgba(109,40,217,0.55)' }}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.13) 50%, transparent 70%)', animation: 'shimmer-cta 2.6s ease-in-out infinite' }} />
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>Start Networking</span>
          </button>
          <p className="text-center mt-3" style={{ color: '#fff', fontSize: 12 }}>Sign in to your account to get started</p>
        </div>

        {/* ══════════════════════════════════════════════════════════════
             BOTTOM SHEET
        ══════════════════════════════════════════════════════════════ */}

        {/* Backdrop */}
        <div onClick={closeSheet} aria-hidden="true"
          className="absolute inset-0 z-[200] transition-opacity duration-300"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', opacity: sheetOpen ? 1 : 0, pointerEvents: sheetOpen ? 'auto' : 'none' }} />

        {/* Sheet panel */}
        <div role="dialog" aria-modal="true" aria-label="Sign in"
          className="absolute left-0 right-0 bottom-0 z-[210]"
          style={{ transform: sheetOpen ? 'translateY(0)' : 'translateY(105%)', transition: 'transform 0.4s cubic-bezier(0.32,0.72,0,1)' }}>
          <div className="rounded-t-[2rem] overflow-hidden overflow-y-auto"
            style={{ background: 'rgba(10,10,20,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', boxShadow: '0 -32px 80px rgba(0,0,0,0.8)', backdropFilter: 'blur(24px)', maxHeight: '92svh' }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* Close */}
            <button onClick={closeSheet} aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <X style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.55)' }} />
            </button>

            {/* ── PHONE NUMBER VIEW ────────────────────────────────────── */}
            {view === 'phone' && (
              <div className="px-6 pt-2 pb-10">
                {/* Header */}
                <div className="mb-6">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
                    <Mail size={22} color="white" />
                  </div>
                  <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em' }}>Log in</h2>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 3 }}>Enter your email address to continue</p>
                </div>

                {/* Email input */}
                <div className="mb-2">
                  <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Email Address
                  </label>
                  <div className="relative mt-2">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2">
                      <Mail size={16} color="rgba(255,255,255,0.35)" />
                    </div>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={e => {
                        setEmailInput(e.target.value);
                        setPhoneError('');
                      }}
                      onFocus={() => setFocusedField('email')}
                      onBlur={() => setFocusedField('')}
                      onKeyDown={e => e.key === 'Enter' && handlePhoneContinue()}
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="w-full rounded-2xl outline-none"
                      style={{
                        height: 56, paddingLeft: 44, paddingRight: 16,
                        background: 'rgba(255,255,255,0.06)',
                        border: `1.5px solid ${phoneError ? 'rgba(239,68,68,0.5)' : focusedField === 'email' ? 'rgba(124,58,237,0.65)' : 'rgba(255,255,255,0.12)'}`,
                        color: '#fff', fontSize: 16, fontWeight: 400,
                      }}
                    />
                  </div>
                  {phoneError && (
                    <p className="mt-2 flex items-center gap-1.5" style={{ color: '#f87171', fontSize: 12 }}>
                      <AlertCircle size={12} />{phoneError}
                    </p>
                  )}
                </div>

                {/* Continue button */}
                <button onClick={handlePhoneContinue} disabled={phoneLoading || !isValidEmail(emailInput)}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl mt-5 transition-all active:scale-[0.98]"
                  style={{
                    height: 56,
                    background: isValidEmail(emailInput)
                      ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                      : 'rgba(255,255,255,0.07)',
                    color: isValidEmail(emailInput) ? '#fff' : 'rgba(255,255,255,0.25)',
                    fontWeight: 700, fontSize: 16,
                    boxShadow: isValidEmail(emailInput) ? '0 8px 28px rgba(124,58,237,0.45)' : 'none',
                  }}>
                  {phoneLoading
                    ? <><RefreshCw size={18} style={{ animation: 'spin-cw 1s linear infinite' }} /> Sending code…</>
                    : <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        Continue
                      </>
                  }
                </button>

                <p className="mt-4 text-center" style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, lineHeight: 1.6 }}>
                  We'll send a one-time verification code to your email address.
                </p>
              </div>
            )}

            {/* ── OTP VIEW ─────────────────────────────────────────────── */}
            {view === 'otp' && (
              <div className="px-6 pt-2 pb-10">
                <button
                  onClick={() => setView(otpContext === 'signup' ? 'not-found' : 'phone')}
                  className="flex items-center gap-2 mb-5 hover:opacity-70 transition-opacity"
                  style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500 }}>
                  <ArrowLeft size={15} /> Back
                </button>

                <div className="text-center mb-7">
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mx-auto mb-4"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 12px 40px rgba(124,58,237,0.4)' }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>
                    {otpContext === 'signup' ? 'Verify your email' : 'Check your email'}
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
                    {otpContext === 'signup'
                      ? <>Enter the code we sent to verify<br /><span style={{ color: 'rgba(167,139,250,0.8)', fontWeight: 600 }}>{emailInput.trim()}</span></>
                      : <>We sent a 6-digit code to<br /><span style={{ color: 'rgba(167,139,250,0.8)', fontWeight: 600 }}>{emailInput.trim()}</span></>
                    }
                  </p>
                </div>

                {/* 6-digit OTP boxes */}
                <div className="mb-4">
                  <OtpInput value={otpValue} onChange={(v) => { setOtpValue(v); setOtpError(''); }} hasError={!!otpError} />
                </div>

                {/* Loading indicator */}
                {otpLoading && (
                  <div className="flex justify-center mb-3">
                    <RefreshCw size={18} color="#a78bfa" style={{ animation: 'spin-cw 1s linear infinite' }} />
                  </div>
                )}

                {/* Error */}
                {otpError && (
                  <div className="flex items-center gap-2 justify-center mb-3">
                    <AlertCircle size={13} color="#f87171" />
                    <p style={{ color: '#f87171', fontSize: 13 }}>{otpError}</p>
                  </div>
                )}

                {/* Resend */}
                <div className="text-center mt-4">
                  <button onClick={handleResend} disabled={resendCountdown > 0}
                    style={{ color: resendCountdown > 0 ? 'rgba(255,255,255,0.25)' : '#7c3aed', fontSize: 13, fontWeight: 600, cursor: resendCountdown > 0 ? 'default' : 'pointer' }}>
                    {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : "Didn't get a code?"}
                  </button>
                </div>

                {/* Demo hint */}
                <div className="mt-6 px-4 py-3 rounded-xl text-center" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                  <p style={{ color: 'rgba(167,139,250,0.6)', fontSize: 11 }}>
                    Demo OTP: <span style={{ color: '#fbbf24', fontFamily: 'monospace', fontSize: 15, fontWeight: 700 }}>123456</span>
                  </p>
                </div>
              </div>
            )}

            {/* ── PROFILE REVIEW VIEW ──────────────────────────────────── */}
            {view === 'profile-review' && existingUser && (
              <div className="px-6 pt-2 pb-10">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                    <CheckCircle2 size={20} color="#34d399" />
                  </div>
                  <div>
                    <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.03em' }}>Welcome back!</h2>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>Please confirm your details</p>
                  </div>
                </div>

                {/* Profile card */}
                <div className="rounded-2xl p-5 mb-5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center gap-4 mb-4">
                    <img
                      src={existingUser.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(existingUser.name)}&background=7c3aed&color=fff`}
                      alt={existingUser.name}
                      className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
                    <div>
                      <p style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>{existingUser.name}</p>
                      <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>{existingUser.title}</p>
                      <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{existingUser.company}</p>
                    </div>
                  </div>
                  {[
                    { icon: <Mail size={14} />, label: 'Email', value: existingUser.email ?? emailInput.trim() },
                    { icon: <User size={14} />, label: 'Role', value: existingUser.role.charAt(0).toUpperCase() + existingUser.role.slice(1) },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <span style={{ color: '#7c3aed' }}>{icon}</span>
                      <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, minWidth: 44 }}>{label}</span>
                      <span style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{value}</span>
                    </div>
                  ))}
                </div>

                <button onClick={handleProfileConfirm}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl transition-all active:scale-[0.98]"
                  style={{ height: 54, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', color: '#fff', fontWeight: 700, fontSize: 16, boxShadow: '0 8px 28px rgba(124,58,237,0.45)' }}>
                  <CheckCircle2 size={18} /> Looks good, continue
                </button>

                <button onClick={() => setView('phone')} className="w-full text-center mt-3 hover:opacity-70 transition-opacity"
                  style={{ color: 'rgba(255,255,255,0.3)', fontSize: 13 }}>
                  Not you? Go back
                </button>
              </div>
            )}

            {/* ── NOT FOUND VIEW ───────────────────────────────────────── */}
            {view === 'not-found' && (
              <div className="px-6 pt-2 pb-10">
                <div className="flex flex-col items-center text-center pt-4 mb-8">
                  {/* Icon */}
                  <div className="w-16 h-16 rounded-3xl flex items-center justify-center mb-5"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1.5px solid rgba(239,68,68,0.25)' }}>
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                      <line x1="11" y1="8" x2="11" y2="12"/><line x1="11" y1="16" x2="11.01" y2="16"/>
                    </svg>
                  </div>

                  <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
                    No account found
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14, lineHeight: 1.55, maxWidth: 280 }}>
                    We couldn't find an account for
                  </p>
                  <div className="mt-1 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <span style={{ color: '#a78bfa', fontSize: 14, fontWeight: 600 }}>{emailInput.trim()}</span>
                  </div>
                </div>

                {/* Create account CTA */}
                <button
                  onClick={handleStartSignup}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl transition-all active:scale-[0.98] mb-3"
                  style={{
                    height: 56,
                    background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                    color: '#fff', fontWeight: 700, fontSize: 16,
                    boxShadow: '0 8px 28px rgba(124,58,237,0.45)',
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                    <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                  </svg>
                  Create an Account
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>or</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
                </div>

                <button
                  onClick={() => { setView('phone'); setEmailInput(''); setOtpValue(''); }}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl transition-all active:scale-[0.98]"
                  style={{
                    height: 52,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                    color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 15,
                  }}>
                  Try a different email
                </button>
              </div>
            )}

            {/* ── CREATE ACCOUNT VIEW ──────────────────────────────────── */}
            {view === 'create-account' && (
              <div className="px-6 pt-2 pb-10">
                <button onClick={() => setView('not-found')} className="flex items-center gap-2 mb-5 hover:opacity-70 transition-opacity"
                  style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 500 }}>
                  <ArrowLeft size={15} /> Back
                </button>

                <div className="mb-5">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', boxShadow: '0 8px 24px rgba(124,58,237,0.4)' }}>
                    <User size={22} color="white" />
                  </div>
                  <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Create your profile</h2>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 3 }}>
                    Tell us a bit about yourself to get started
                  </p>
                </div>

                {createError && (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl mb-4"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <AlertCircle size={14} color="#f87171" />
                    <p style={{ color: '#fca5a5', fontSize: 13 }}>{createError}</p>
                  </div>
                )}

                <div className="space-y-3">
                  {/* First Name + Last Name side by side */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <User size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: createForm.firstName ? '#a78bfa' : 'rgba(255,255,255,0.25)' }} />
                      <input
                        type="text" placeholder="First name"
                        value={createForm.firstName}
                        onChange={e => setCreateForm(f => ({ ...f, firstName: e.target.value }))}
                        onFocus={() => setFocusedField('firstName')} onBlur={() => setFocusedField('')}
                        className="outline-none w-full"
                        style={{ ...inputStyle(focusedField === 'firstName', !!createForm.firstName), paddingLeft: 36 }}
                      />
                    </div>
                    <div className="relative flex-1">
                      <input
                        type="text" placeholder="Last name"
                        value={createForm.lastName}
                        onChange={e => setCreateForm(f => ({ ...f, lastName: e.target.value }))}
                        onFocus={() => setFocusedField('lastName')} onBlur={() => setFocusedField('')}
                        className="outline-none w-full"
                        style={{ ...inputStyle(focusedField === 'lastName', !!createForm.lastName), paddingLeft: 16 }}
                      />
                    </div>
                  </div>

                  {/* Email (read-only — already verified by OTP) */}
                  <div className="relative">
                    <Mail size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#a78bfa' }} />
                    <div className="outline-none flex items-center"
                      style={{ ...inputStyle(false, true), cursor: 'default', opacity: 0.7 }}>
                      <span style={{ paddingLeft: 30, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>{emailInput.trim()}</span>
                    </div>
                  </div>

                  {/* Job Title */}
                  <div className="relative">
                    <Briefcase size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: createForm.title ? '#a78bfa' : 'rgba(255,255,255,0.25)' }} />
                    <input
                      type="text" placeholder="Job title"
                      value={createForm.title}
                      onChange={e => setCreateForm(f => ({ ...f, title: e.target.value }))}
                      onFocus={() => setFocusedField('title')} onBlur={() => setFocusedField('')}
                      className="outline-none"
                      style={inputStyle(focusedField === 'title', !!createForm.title)}
                    />
                  </div>

                  {/* Company */}
                  <div className="relative">
                    <Building2 size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: createForm.company ? '#a78bfa' : 'rgba(255,255,255,0.25)' }} />
                    <input
                      type="text" placeholder="Company"
                      value={createForm.company}
                      onChange={e => setCreateForm(f => ({ ...f, company: e.target.value }))}
                      onFocus={() => setFocusedField('company')} onBlur={() => setFocusedField('')}
                      className="outline-none"
                      style={inputStyle(focusedField === 'company', !!createForm.company)}
                    />
                  </div>

                  {/* Phone Number */}
                  <div className="relative">
                    <Phone size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: createForm.phone ? '#a78bfa' : 'rgba(255,255,255,0.25)' }} />
                    <input
                      type="tel" placeholder="Phone number (optional)"
                      value={createForm.phone}
                      onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
                      onFocus={() => setFocusedField('phone')} onBlur={() => setFocusedField('')}
                      className="outline-none"
                      style={inputStyle(focusedField === 'phone', !!createForm.phone)}
                    />
                  </div>
                </div>

                <p className="mt-4 text-center" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, lineHeight: 1.6 }}>
                  By creating an account, you agree to our Terms of Service and Privacy Policy.
                </p>

                <button
                  onClick={handleCreateAccount}
                  disabled={createLoading || !createForm.firstName.trim() || !createForm.lastName.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl mt-4 transition-all active:scale-[0.98]"
                  style={{
                    height: 54,
                    background: (createForm.firstName && createForm.lastName)
                      ? 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                      : 'rgba(255,255,255,0.07)',
                    color: (createForm.firstName && createForm.lastName) ? '#fff' : 'rgba(255,255,255,0.25)',
                    fontWeight: 700, fontSize: 16,
                    boxShadow: (createForm.firstName && createForm.lastName) ? '0 8px 28px rgba(124,58,237,0.45)' : 'none',
                    opacity: createLoading ? 0.7 : 1,
                  }}>
                  {createLoading
                    ? <><RefreshCw size={18} style={{ animation: 'spin-cw 1s linear infinite' }} /> Creating account…</>
                    : <>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                        </svg>
                        Create Account
                      </>
                  }
                </button>

                <button onClick={() => setView('phone')} className="w-full text-center mt-3"
                  style={{ color: '#7c3aed', fontSize: 13, fontWeight: 600 }}>
                  Already have an account? Sign in
                </button>
              </div>
            )}

            {/* ── REGISTERED SUCCESS VIEW ───────────────────────────────── */}
            {view === 'registered' && (
              <div className="px-6 pt-4 pb-10">
                {/* Success icon */}
                <div className="flex flex-col items-center text-center pt-2 mb-8">
                  <div className="relative mb-5">
                    <div className="w-20 h-20 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(5,150,105,0.08))', border: '2px solid rgba(16,185,129,0.35)' }}>
                      <CheckCircle2 size={38} color="#34d399" />
                    </div>
                    <div className="absolute -right-1 -bottom-1 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: '2px solid rgba(10,10,20,1)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    </div>
                  </div>

                  <h2 style={{ color: '#fff', fontSize: 24, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 8 }}>
                    Account Created!
                  </h2>
                  <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.6, maxWidth: 280 }}>
                    Your account has been created successfully. You can now log in and start networking.
                  </p>
                </div>

                {/* Name chip */}
                {registeredUserData && (
                  <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl mb-6"
                    style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                      <User size={18} color="white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p style={{ color: '#fff', fontSize: 15, fontWeight: 700, lineHeight: 1.3 }}>
                        {registeredUserData.name}
                      </p>
                      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }} className="truncate">
                        {registeredUserData.email}
                      </p>
                    </div>
                    <div className="flex-shrink-0 px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                      <span style={{ color: '#34d399', fontSize: 10, fontWeight: 700 }}>New</span>
                    </div>
                  </div>
                )}

                {/* Login button */}
                <button
                  onClick={handleLoginAfterRegister}
                  className="w-full flex items-center justify-center gap-2 rounded-2xl transition-all active:scale-[0.98]"
                  style={{
                    height: 56,
                    background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                    color: '#fff', fontWeight: 700, fontSize: 16,
                    boxShadow: '0 8px 28px rgba(124,58,237,0.45)',
                  }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
                  </svg>
                  Log In
                </button>

                <p className="text-center mt-4" style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, lineHeight: 1.6 }}>
                  You're all set! Tap Log In to start exploring.
                </p>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* ── Keyframes ──────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes shimmer-cta {
          0%   { transform: translateX(-120%); }
          55%  { transform: translateX(220%); }
          100% { transform: translateX(220%); }
        }
        @keyframes spin-cw { to { transform: rotate(360deg); } }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
        @keyframes pulse-node {
          0%, 100% { opacity: 0.7; r: 3.5; }
          50%       { opacity: 0.3; r: 2.5; }
        }
        @keyframes line-dash { to { stroke-dashoffset: -20; } }
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
        input { color-scheme: dark; }
      `}</style>
    </div>
  );
};
