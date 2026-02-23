/**
 * WelcomeScreen — Mobile-first cinematic landing with background video
 * ──────────────────────────────────────────────────────────────────────
 * Full-screen background video (business networking)
 * "Start Networking" CTA slides up a dark login bottom-sheet
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2,
  RefreshCw, ArrowLeft, Send, ShieldCheck, X,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import {
  loginApi, resendVerificationApi, getMeApi,
  initiateGoogleOAuth, initiateLinkedInOAuth,
} from '@/app/api/authClient';
import {
  validateEmail, validatePassword, isLoginFormValid, runAuthValidationTests,
} from '@/app/utils/authValidation';

// ─── Types ────────────────────────────────────────────────────────────────────
type LoginView = 'credentials' | 'verification';
interface FormState    { email: string; password: string; }
interface FieldErrors  { email?: string; password?: string; }
interface VerifState {
  email: string;
  resendStatus: 'idle' | 'loading' | 'success' | 'error';
  resendMessage?: string;
  checkStatus:  'idle' | 'loading' | 'success' | 'error';
  checkMessage?: string;
}

// ─── Inline SVG icons ─────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
const LinkedInIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A66C2">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
    <rect x="2" y="9" width="4" height="12"/>
    <circle cx="4" cy="4" r="2"/>
  </svg>
);

// ─── Network SVG nodes (decorative) ───────────────────────────────────────────
const NetworkNodes = () => (
  <svg width="100%" height="100%" viewBox="0 0 390 200" fill="none" className="absolute inset-0 opacity-20" style={{ pointerEvents: 'none' }}>
    {/* Nodes */}
    {[
      [60, 40], [180, 70], [300, 30], [340, 110], [80, 140], [210, 160], [130, 90],
    ].map(([cx, cy], i) => (
      <circle key={i} cx={cx} cy={cy} r="3.5" fill="white" fillOpacity="0.7"
        style={{ animation: `pulse-node ${1.8 + i * 0.3}s ease-in-out infinite`, animationDelay: `${i * 0.2}s` }} />
    ))}
    {/* Lines */}
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

// ─── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge: React.FC<{ type: 'success' | 'error'; message: string }> = ({ type, message }) => (
  <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl"
    style={{
      background: type === 'success' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
      border: `1px solid ${type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
    }}>
    {type === 'success'
      ? <CheckCircle2 style={{ width: 14, height: 14, color: '#4ade80', flexShrink: 0 }} />
      : <AlertCircle  style={{ width: 14, height: 14, color: '#f87171', flexShrink: 0 }} />}
    <p style={{ fontSize: 13, fontWeight: 500, color: type === 'success' ? '#86efac' : '#fca5a5' }}>{message}</p>
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
interface WelcomeScreenProps { onLogin: () => void; }

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLogin }) => {
  const { setUser, eventConfig } = useApp();
  const [sheetOpen, setSheetOpen]   = useState(false);
  const [loginView, setLoginView]   = useState<LoginView>('credentials');
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (import.meta.env.DEV) runAuthValidationTests();
  }, []);

  // ── Form state ──────────────────────────────────────────────────────────
  const [form, setForm]             = useState<FormState>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched]       = useState({ email: false, password: false });
  const [showPw, setShowPw]         = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [socialToast, setSocialToast] = useState<string | null>(null);
  const [forgotToast, setForgotToast] = useState(false);
  const formValid = isLoginFormValid(form);

  const [verif, setVerif] = useState<VerifState>({
    email: '', resendStatus: 'idle', checkStatus: 'idle',
  });

  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (sheetOpen && loginView === 'credentials') {
      setTimeout(() => emailRef.current?.focus(), 400);
    }
  }, [sheetOpen, loginView]);

  useEffect(() => {
    document.body.style.overflow = sheetOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sheetOpen]);

  // ── Field handlers ──────────────────────────────────────────────────────
  const onEmailChange = (v: string) => {
    setForm(f => ({ ...f, email: v }));
    if (touched.email) setFieldErrors(e => ({ ...e, email: validateEmail(v) }));
    if (loginError) setLoginError(null);
  };
  const onPasswordChange = (v: string) => {
    setForm(f => ({ ...f, password: v }));
    if (touched.password) setFieldErrors(e => ({ ...e, password: validatePassword(v) }));
    if (loginError) setLoginError(null);
  };
  const onBlur = (field: 'email' | 'password') => {
    setTouched(t => ({ ...t, [field]: true }));
    if (field === 'email')    setFieldErrors(e => ({ ...e, email:    validateEmail(form.email) }));
    if (field === 'password') setFieldErrors(e => ({ ...e, password: validatePassword(form.password) }));
  };

  const handleLogin = useCallback(async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched({ email: true, password: true });
    setFieldErrors({ email: validateEmail(form.email), password: validatePassword(form.password) });
    if (!formValid) return;
    setLoginLoading(true); setLoginError(null);
    try {
      // Mock Sponsor Check
      const isSponsorEmail = form.email.toLowerCase().includes('sponsor');
      const mockRole = isSponsorEmail ? 'sponsor' : 'attendee';

      const res = await loginApi({ email: form.email.trim().toLowerCase(), password: form.password });
      if (res.success && res.data?.user.emailVerified) {
        localStorage.setItem('auth_token', res.data.token);
        const u = res.data.user;
        setUser({
          id: u.id, email: u.email, name: u.name, emailVerified: true,
          role: mockRole, company: u.company ?? '', title: u.title ?? '',
          avatar: u.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=7c3aed&color=fff`,
          points: u.points ?? 0, tier: u.tier ?? 'Bronze',
          interests: u.interests ?? [], profileComplete: u.profileComplete ?? false,
          isRegistered: u.email.includes('registered') // Mock logic: email with 'registered' is pre-registered
        });
        onLogin(); return;
      }
      if (!res.success && res.error?.code === 'EMAIL_NOT_VERIFIED') {
        setVerif({ email: res.data?.user.email ?? form.email.trim(), resendStatus: 'idle', checkStatus: 'idle' });
        setLoginView('verification'); return;
      }
      setLoginError(res.error?.message ?? 'Sign in failed. Please try again.');
    } catch { setLoginError('Unable to connect. Please try again.'); }
    finally   { setLoginLoading(false); }
  }, [form, formValid, setUser, onLogin]);

  const handleResend = useCallback(async () => {
    setVerif(v => ({ ...v, resendStatus: 'loading', resendMessage: undefined }));
    try {
      const res = await resendVerificationApi(verif.email);
      setVerif(v => ({
        ...v,
        resendStatus: res.success ? 'success' : 'error',
        resendMessage: res.success ? 'Email sent! Check your inbox.' : (res.error?.message ?? 'Failed. Try again.'),
      }));
    } catch { setVerif(v => ({ ...v, resendStatus: 'error', resendMessage: 'Network error.' })); }
  }, [verif.email]);

  const handleCheckVerified = useCallback(async () => {
    setVerif(v => ({ ...v, checkStatus: 'loading', checkMessage: undefined }));
    try {
      const res = await getMeApi(verif.email);
      if (res.success && res.data?.emailVerified) {
        setVerif(v => ({ ...v, checkStatus: 'success' }));
        setTimeout(() => {
          const u = res.data!;
          localStorage.setItem('auth_token', `mock-token-${Date.now()}`);
          const isSponsorEmail = verif.email.toLowerCase().includes('sponsor');
          const mockRole = isSponsorEmail ? 'sponsor' : 'attendee';

          setUser({
            id: u.id, email: u.email, name: u.name, emailVerified: true,
            role: mockRole, company: u.company ?? '', title: u.title ?? '',
            avatar: u.avatar ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name)}&background=7c3aed&color=fff`,
            points: u.points ?? 0, tier: u.tier ?? 'Bronze',
            interests: u.interests ?? [], profileComplete: u.profileComplete ?? false,
            isRegistered: u.email.includes('registered') 
          });
          onLogin();
        }, 1200);
      } else {
        setVerif(v => ({ ...v, checkStatus: 'error', checkMessage: 'Not verified yet. Check your inbox.' }));
      }
    } catch { setVerif(v => ({ ...v, checkStatus: 'error', checkMessage: 'Network error.' })); }
  }, [verif.email, setUser, onLogin]);

  const handleSocial = async (provider: 'google' | 'linkedin') => {
    try {
      if (provider === 'google') await initiateGoogleOAuth();
      else await initiateLinkedInOAuth();
    } catch {
      setSocialToast(`${provider === 'google' ? 'Google' : 'LinkedIn'} sign-in coming soon`);
      setTimeout(() => setSocialToast(null), 3000);
    }
  };

  const closeSheet = () => {
    setSheetOpen(false);
    setTimeout(() => {
      setLoginView('credentials');
      setForm({ email: '', password: '' });
      setFieldErrors({});
      setTouched({ email: false, password: false });
      setLoginError(null);
      setVerif({ email: '', resendStatus: 'idle', checkStatus: 'idle' });
    }, 380);
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    /* Outer shell — black bg so the phone borders look clean on desktop */
    <div
      className="flex items-center justify-center min-h-screen w-full"
      style={{ background: '#000', fontFamily: 'Inter,sans-serif' }}
    >
      {/* ─── Phone-sized mobile viewport ─────────────────────────────────── */}
      <div
        className="relative w-full overflow-hidden flex flex-col"
        style={{
          maxWidth: 430,
          height: '100svh',
          minHeight: 667,
          maxHeight: 932,
        }}
      >

        {/* ── Background video ─────────────────────────────────────────── */}
        {!videoError ? (
          <video
            ref={videoRef}
            autoPlay muted loop playsInline
            onError={() => setVideoError(true)}
            className="absolute inset-0 w-full h-full"
            style={{ objectFit: 'cover', objectPosition: 'center' }}
          >
            {/* Pexels business networking footage — multiple qualities for reliability */}
            <source src="https://videos.pexels.com/video-files/3252668/3252668-hd_1280_720_25fps.mp4" type="video/mp4" />
            <source src="https://videos.pexels.com/video-files/2795405/2795405-hd_1280_720_25fps.mp4" type="video/mp4" />
          </video>
        ) : (
          /* Gradient fallback when video can't load */
          <div className="absolute inset-0"
            style={{ background: 'linear-gradient(135deg,#0d0d1a 0%,#1a0d2e 30%,#0d1a2e 60%,#0d0d1a 100%)' }} />
        )}

        {/* ── Gradient overlays (layered for cinematic depth) ─────────── */}
        {/* Top vignette */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 25%, transparent 45%)' }} />
        {/* Bottom heavy overlay — where content lives */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, rgba(4,4,16,1) 0%, rgba(4,4,16,0.97) 18%, rgba(4,4,16,0.88) 35%, rgba(4,4,16,0.4) 55%, transparent 72%)' }} />
        {/* Subtle purple cast */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 100% 60% at 50% 100%, rgba(109,40,217,0.18) 0%, transparent 70%)' }} />

        {/* ── Decorative network nodes ─────────────────────────────────── */}
        <div className="absolute top-0 left-0 right-0" style={{ height: 200, overflow: 'hidden' }}>
          <NetworkNodes />
        </div>

        {/* ── Status bar area + Top bar ────────────────────────────────── */}
        <div className="relative z-20 flex items-center justify-between px-6 pt-14 pb-2 flex-shrink-0">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3.2" fill="white"/>
                <circle cx="4" cy="5"   r="1.8" fill="white" fillOpacity="0.65"/>
                <circle cx="20" cy="5"  r="1.8" fill="white" fillOpacity="0.65"/>
                <circle cx="4" cy="19"  r="1.8" fill="white" fillOpacity="0.65"/>
                <circle cx="20" cy="19" r="1.8" fill="white" fillOpacity="0.65"/>
                <line x1="12" y1="12" x2="4"  y2="5"  stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="12" y1="12" x2="20" y2="5"  stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="12" y1="12" x2="4"  y2="19" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round"/>
                <line x1="12" y1="12" x2="20" y2="19" stroke="white" strokeOpacity="0.4" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.02em' }}>
              Audience App
            </span>
          </div>

          {/* Live pill */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#34d399', animation: 'live-pulse 1.6s ease-in-out infinite' }} />
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Live
            </span>
          </div>
        </div>

        {/* ── Middle spacer — let the video breathe ────────────────────── */}
        <div className="flex-1" />

        {/* ── Floating feature chips ───────────────────────────────────── */}
        <div className="relative z-20 px-6 mb-8 flex-shrink-0">
          <div className="flex flex-wrap gap-2">
            {[
              { emoji: '⚡', label: 'Live Polls', color: 'rgba(124,58,237,0.75)' },
              { emoji: '🏆', label: 'Leaderboard', color: 'rgba(245,158,11,0.75)' },
              { emoji: '🤝', label: 'Networking',  color: 'rgba(16,185,129,0.75)' },
              { emoji: '📊', label: 'Surveys',     color: 'rgba(6,182,212,0.75)' },
              { emoji: '🎯', label: 'Challenges',  color: 'rgba(239,68,68,0.65)' },
            ].map(({ emoji, label, color }) => (
              <div key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(0,0,0,0.5)',
                  border: `1px solid ${color}`,
                  backdropFilter: 'blur(12px)',
                }}>
                <span style={{ fontSize: 12 }}>{emoji}</span>
                <span style={{ color: '#fff', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Bottom hero content ──────────────────────────────────────── */}
        <div className="relative z-20 px-6 pb-10 flex-shrink-0">

          {/* Event pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-4"
            style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.45)', backdropFilter: 'blur(8px)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#a78bfa' }} />
            <span style={{ color: '#c4b5fd', fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {eventConfig?.name ?? 'Tech Summit 2026'} · {eventConfig?.location ?? 'San Francisco'}
            </span>
          </div>

          {/* Headline */}
          <h1 style={{ color: '#fff', fontSize: 40, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, marginBottom: 10 }}>
            Where the<br />
            <span style={{
              background: 'linear-gradient(110deg,#c4b5fd 0%,#818cf8 45%,#38bdf8 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            }}>
              Future Connects
            </span>
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 1.55, marginBottom: 20 }}>
            Engage with speakers, earn points, climb the leaderboard — your event experience, fully gamified.
          </p>

          {/* Stats row */}
          <div className="flex items-center gap-4 mb-6">
            {[
              { value: '2,400+', label: 'Attendees' },
              { value: '48',     label: 'Sessions' },
              { value: '32',     label: 'Sponsors' },
            ].map(({ value, label }, i, arr) => (
              <div key={label} className="flex items-center gap-4">
                <div>
                  <p style={{ color: '#fff', fontSize: 17, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</p>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</p>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.15)' }} />
                )}
              </div>
            ))}
          </div>

          {/* ── START NETWORKING CTA ─────────────────────────────────── */}
          <button
            onClick={() => setSheetOpen(true)}
            className="w-full relative overflow-hidden flex items-center justify-center gap-3 rounded-2xl"
            style={{
              height: 58,
              background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 55%, #0ea5e9 100%)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.15) inset, 0 20px 60px rgba(109,40,217,0.55)',
            }}
          >
            {/* shimmer */}
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: 'linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.13) 50%, transparent 70%)', animation: 'shimmer-cta 2.6s ease-in-out infinite' }} />

            {/* People icon */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
              Start Networking
            </span>
          </button>

          {/* Hint text */}
          <p className="text-center mt-3" style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12 }}>
            Sign in to your account to get started
          </p>
        </div>

        {/* ── Toast notifications ──────────────────────────────────────── */}
        {socialToast && (
          <div className="absolute top-24 left-1/2 z-[300] px-4 py-3 rounded-2xl flex items-center gap-2"
            style={{ transform: 'translateX(-50%)', background: 'rgba(15,15,30,0.96)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{socialToast}</span>
          </div>
        )}
        {forgotToast && (
          <div className="absolute top-24 left-1/2 z-[300] px-4 py-3 rounded-2xl flex items-center gap-2"
            style={{ transform: 'translateX(-50%)', background: 'rgba(15,15,30,0.96)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)', backdropFilter: 'blur(12px)' }}>
            <Mail style={{ width: 14, height: 14, color: '#a78bfa' }} />
            <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>Password reset link sent to your inbox</span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
             LOGIN BOTTOM SHEET
        ══════════════════════════════════════════════════════════════ */}

        {/* Backdrop */}
        <div
          onClick={closeSheet}
          aria-hidden="true"
          className="absolute inset-0 z-[200] transition-opacity duration-300"
          style={{
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            opacity: sheetOpen ? 1 : 0,
            pointerEvents: sheetOpen ? 'auto' : 'none',
          }}
        />

        {/* Sheet */}
        <div
          role="dialog" aria-modal="true" aria-label="Sign in"
          className="absolute left-0 right-0 bottom-0 z-[210]"
          style={{
            transform: sheetOpen ? 'translateY(0)' : 'translateY(105%)',
            transition: 'transform 0.4s cubic-bezier(0.32,0.72,0,1)',
          }}
        >
          <div className="rounded-t-[2rem] overflow-hidden overflow-y-auto"
            style={{
              background: 'rgba(10,10,20,0.97)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderBottom: 'none',
              boxShadow: '0 -32px 80px rgba(0,0,0,0.8)',
              backdropFilter: 'blur(24px)',
              maxHeight: '90svh',
            }}>

            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
              <div style={{ width: 36, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* Close btn */}
            <button onClick={closeSheet} aria-label="Close"
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center hover:opacity-70 transition-opacity"
              style={{ background: 'rgba(255,255,255,0.08)' }}>
              <X style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.55)' }} />
            </button>

            {/* ── CREDENTIALS ────────────────────────────────────────── */}
            {loginView === 'credentials' && (
              <div className="px-6 pt-3 pb-10">
                <div className="mb-6">
                  <h2 style={{ color: '#fff', fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em' }}>Welcome back</h2>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 3 }}>Sign in to access your event experience</p>
                </div>

                {loginError && (
                  <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl mb-5"
                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <AlertCircle style={{ width: 15, height: 15, color: '#f87171', flexShrink: 0 }} />
                    <p style={{ color: '#fca5a5', fontSize: 13, fontWeight: 500 }}>{loginError}</p>
                  </div>
                )}

                <form onSubmit={handleLogin} noValidate className="space-y-4">
                  {/* Email */}
                  <div>
                    <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                      Email address
                    </label>
                    <div className="relative mt-2">
                      <Mail style={{
                        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                        width: 15, height: 15,
                        color: fieldErrors.email && touched.email ? '#f87171' : form.email ? '#a78bfa' : 'rgba(255,255,255,0.25)',
                        transition: 'color 0.15s',
                      }} />
                      <input
                        ref={emailRef} type="email" autoComplete="email"
                        autoCapitalize="none" spellCheck={false}
                        value={form.email}
                        onChange={e => onEmailChange(e.target.value)}
                        onBlur={() => onBlur('email')}
                        placeholder="you@example.com"
                        className="w-full rounded-xl pl-10 pr-4 outline-none"
                        style={{
                          height: 50,
                          background: 'rgba(255,255,255,0.06)',
                          border: `1.5px solid ${fieldErrors.email && touched.email ? 'rgba(239,68,68,0.5)' : form.email && !fieldErrors.email ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
                          color: '#fff', fontSize: 15,
                          transition: 'border-color 0.15s',
                        }}
                      />
                    </div>
                    {fieldErrors.email && touched.email && (
                      <p className="mt-1.5 flex items-center gap-1" style={{ color: '#f87171', fontSize: 12 }}>
                        <AlertCircle style={{ width: 11, height: 11 }} />{fieldErrors.email}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                        Password
                      </label>
                      <button type="button" onClick={() => { setForgotToast(true); setTimeout(() => setForgotToast(false), 3000); }}
                        style={{ color: '#a78bfa', fontSize: 12, fontWeight: 600 }}
                        className="hover:opacity-75 transition-opacity">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock style={{
                        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                        width: 15, height: 15,
                        color: fieldErrors.password && touched.password ? '#f87171' : form.password ? '#a78bfa' : 'rgba(255,255,255,0.25)',
                        transition: 'color 0.15s',
                      }} />
                      <input
                        type={showPw ? 'text' : 'password'}
                        autoComplete="current-password"
                        value={form.password}
                        onChange={e => onPasswordChange(e.target.value)}
                        onBlur={() => onBlur('password')}
                        placeholder="••••••••"
                        className="w-full rounded-xl pl-10 pr-12 outline-none"
                        style={{
                          height: 50,
                          background: 'rgba(255,255,255,0.06)',
                          border: `1.5px solid ${fieldErrors.password && touched.password ? 'rgba(239,68,68,0.5)' : form.password && !fieldErrors.password ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
                          color: '#fff', fontSize: 15,
                          transition: 'border-color 0.15s',
                        }}
                      />
                      <button type="button" onClick={() => setShowPw(v => !v)} aria-label="Toggle password"
                        style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}
                        className="hover:opacity-70 transition-opacity">
                        {showPw
                          ? <EyeOff style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.3)' }} />
                          : <Eye    style={{ width: 15, height: 15, color: 'rgba(255,255,255,0.3)' }} />}
                      </button>
                    </div>
                    {fieldErrors.password && touched.password && (
                      <p className="mt-1.5 flex items-center gap-1" style={{ color: '#f87171', fontSize: 12 }}>
                        <AlertCircle style={{ width: 11, height: 11 }} />{fieldErrors.password}
                      </p>
                    )}
                  </div>

                  {/* Sign In */}
                  <button type="submit" disabled={loginLoading}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl transition-all"
                    style={{
                      height: 52,
                      background: formValid && !loginLoading
                        ? 'linear-gradient(135deg,#7c3aed,#4f46e5,#0ea5e9)'
                        : 'rgba(255,255,255,0.07)',
                      color: formValid ? '#fff' : 'rgba(255,255,255,0.28)',
                      fontWeight: 700, fontSize: 15,
                      cursor: loginLoading ? 'not-allowed' : 'pointer',
                      boxShadow: formValid && !loginLoading ? '0 8px 28px rgba(124,58,237,0.45)' : 'none',
                    }}>
                    {loginLoading
                      ? <><RefreshCw style={{ width: 17, height: 17, animation: 'spin-cw 1s linear infinite' }} /> Signing in…</>
                      : 'Sign In'}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-5 flex items-center gap-3">
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: 12, fontWeight: 500 }}>or continue with</span>
                  <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
                </div>

                {/* Social */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {[
                    { icon: <GoogleIcon />,   label: 'Google',   action: () => handleSocial('google') },
                    { icon: <LinkedInIcon />, label: 'LinkedIn', action: () => handleSocial('linkedin') },
                  ].map(({ icon, label, action }) => (
                    <button key={label} type="button" onClick={action}
                      className="flex items-center justify-center gap-2 rounded-xl hover:opacity-80 active:scale-95 transition-all"
                      style={{ height: 46, background: 'rgba(255,255,255,0.05)', border: '1.5px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: 600 }}>
                      {icon} {label}
                    </button>
                  ))}
                </div>

                {/* Demo creds */}
                <div className="px-4 py-3.5 rounded-2xl"
                  style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.22)' }}>
                  <p style={{ color: 'rgba(167,139,250,0.65)', fontSize: 10, fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                    Demo Credentials
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: 'Attendee', email: 'attendee@demo.com', pw: 'demo123' },
                      { label: 'Sponsor',  email: 'sponsor@demo.com',  pw: 'demo123' },
                    ].map(({ label, email, pw }) => (
                      <button key={label} type="button"
                        onClick={() => { setForm({ email, password: pw }); setFieldErrors({}); setTouched({ email: false, password: false }); }}
                        className="text-left px-3 py-2.5 rounded-xl hover:opacity-80 transition-opacity"
                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <p style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>{label}</p>
                        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 10, marginTop: 1 }}>{email}</p>
                        <p style={{ color: '#7c3aed', fontSize: 10, fontWeight: 600 }}>{pw}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-center mt-2" style={{ color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>
                    Try <span style={{ fontFamily: 'monospace', color: '#fbbf24' }}>unverified@demo.com</span> to see email gating
                  </p>
                </div>
              </div>
            )}

            {/* ── VERIFICATION VIEW ───────────────────────────────────── */}
            {loginView === 'verification' && (
              <div className="px-6 pt-3 pb-10">
                <button type="button" onClick={() => setLoginView('credentials')}
                  className="flex items-center gap-2 mb-5 hover:opacity-70 transition-opacity"
                  style={{ color: 'rgba(255,255,255,0.38)', fontSize: 13, fontWeight: 500 }}>
                  <ArrowLeft style={{ width: 15, height: 15 }} /> Back to sign in
                </button>

                <div className="flex flex-col items-center text-center mb-6">
                  <div className="relative mb-4">
                    <div className="w-18 h-18 rounded-3xl flex items-center justify-center"
                      style={{ width: 72, height: 72, background: 'linear-gradient(135deg,#f59e0b,#ef4444)', boxShadow: '0 12px 40px rgba(245,158,11,0.3)' }}>
                      <Mail style={{ width: 30, height: 30, color: '#fff' }} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                      style={{ background: '#0a0a14', border: '2px solid rgba(255,255,255,0.1)' }}>
                      <ShieldCheck style={{ width: 14, height: 14, color: '#fbbf24' }} />
                    </div>
                  </div>
                  <h2 style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.025em' }}>Verify your email</h2>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 5 }}>We sent a verification link to</p>
                  <div className="mt-2 px-3 py-2 rounded-xl flex items-center gap-2"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <Mail style={{ width: 13, height: 13, color: '#a78bfa' }} />
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{verif.email}</span>
                  </div>
                </div>

                <div className="space-y-3 mb-4">
                  {verif.resendStatus === 'success' && <StatusBadge type="success" message={verif.resendMessage ?? 'Email sent!'} />}
                  {verif.resendStatus === 'error'   && <StatusBadge type="error"   message={verif.resendMessage ?? 'Failed.'} />}
                  {verif.checkStatus  === 'error'   && <StatusBadge type="error"   message={verif.checkMessage  ?? 'Not verified yet.'} />}
                  {verif.checkStatus  === 'success' && <StatusBadge type="success" message="Verified! Signing you in…" />}
                </div>

                <div className="space-y-3">
                  <button type="button" onClick={handleCheckVerified}
                    disabled={verif.checkStatus === 'loading' || verif.checkStatus === 'success'}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl"
                    style={{
                      height: 52, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                      color: '#fff', fontWeight: 700, fontSize: 15,
                      opacity: verif.checkStatus === 'loading' || verif.checkStatus === 'success' ? 0.6 : 1,
                      boxShadow: '0 8px 28px rgba(124,58,237,0.35)',
                    }}>
                    {verif.checkStatus === 'loading'
                      ? <><RefreshCw style={{ width: 17, height: 17, animation: 'spin-cw 1s linear infinite' }} /> Checking…</>
                      : verif.checkStatus === 'success'
                      ? <><CheckCircle2 style={{ width: 17, height: 17 }} /> Verified!</>
                      : <><CheckCircle2 style={{ width: 17, height: 17 }} /> I've verified my email</>}
                  </button>

                  <button type="button" onClick={handleResend}
                    disabled={verif.resendStatus === 'loading' || verif.resendStatus === 'success'}
                    className="w-full flex items-center justify-center gap-2 rounded-xl"
                    style={{
                      height: 46, background: 'rgba(255,255,255,0.05)',
                      border: '1.5px solid rgba(255,255,255,0.1)',
                      color: 'rgba(255,255,255,0.55)', fontWeight: 600, fontSize: 14,
                      opacity: verif.resendStatus === 'loading' || verif.resendStatus === 'success' ? 0.5 : 1,
                    }}>
                    {verif.resendStatus === 'loading'
                      ? <><RefreshCw style={{ width: 14, height: 14, animation: 'spin-cw 1s linear infinite' }} /> Sending…</>
                      : verif.resendStatus === 'success'
                      ? <><CheckCircle2 style={{ width: 14, height: 14, color: '#4ade80' }} /> Sent!</>
                      : <><Send style={{ width: 14, height: 14 }} /> Resend verification email</>}
                  </button>
                </div>

                <p className="mt-4 text-center" style={{ color: 'rgba(255,255,255,0.18)', fontSize: 12 }}>
                  Check your spam folder or contact{' '}
                  <span style={{ color: '#a78bfa' }}>support@audienceapp.io</span>
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
        @keyframes spin-cw {
          to { transform: rotate(360deg); }
        }
        @keyframes live-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(0.7); }
        }
        @keyframes pulse-node {
          0%, 100% { opacity: 0.7; r: 3.5; }
          50%       { opacity: 0.3; r: 2.5; }
        }
        @keyframes line-dash {
          to { stroke-dashoffset: -20; }
        }
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
        input { color-scheme: dark; }
      `}</style>
    </div>
  );
};