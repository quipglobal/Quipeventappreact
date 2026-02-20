/**
 * WelcomeScreen — Login + Email Verification Gating
 * ─────────────────────────────────────────────────────────────────────────────
 * Two views managed internally:
 *   "login"        → email / password form with social sign-in stubs
 *   "verification" → email verification required banner + actions
 *
 * Navigation contract (matches App.tsx):
 *   props.onLogin() → called when login succeeds AND emailVerified === true
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Mail,
  Lock,
  Sparkles,
  Eye,
  EyeOff,
  Users,
  Building2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  ArrowLeft,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '@/app/context/AppContext';
import {
  loginApi,
  resendVerificationApi,
  getMeApi,
  initiateGoogleOAuth,
  initiateLinkedInOAuth,
} from '@/app/api/authClient';
import {
  validateEmail,
  validatePassword,
  isLoginFormValid,
  runAuthValidationTests,
} from '@/app/utils/authValidation';

// ─── Types ────────────────────────────────────────────────────────────────────

type LoginView = 'login' | 'verification';

interface WelcomeScreenProps {
  onLogin: () => void;
}

interface FormState {
  email: string;
  password: string;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

interface VerificationState {
  email: string;
  resendStatus: 'idle' | 'loading' | 'success' | 'error';
  resendMessage?: string;
  checkStatus: 'idle' | 'loading' | 'success' | 'error';
  checkMessage?: string;
}

// ─── LinkedIn SVG Icon (lucide-react compatible style) ────────────────────────
const LinkedInIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

// ─── Google SVG Icon ──────────────────────────────────────────────────────────
const GoogleIcon = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

// ─── Inline Alert component ───────────────────────────────────────────────────
interface AlertBannerProps {
  type: 'error' | 'success' | 'info';
  message: string;
  className?: string;
}

const AlertBanner: React.FC<AlertBannerProps> = ({ type, message, className = '' }) => {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const Icon = type === 'error' ? AlertCircle : type === 'success' ? CheckCircle2 : AlertCircle;

  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 border rounded-xl ${styles[type]} ${className}`}>
      <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <p className="text-sm leading-snug">{message}</p>
    </div>
  );
};

// ─── Email Verification View ──────────────────────────────────────────────────
interface EmailVerificationViewProps {
  state: VerificationState;
  onResend: () => void;
  onCheckVerified: () => void;
  onBack: () => void;
}

const EmailVerificationView: React.FC<EmailVerificationViewProps> = ({
  state,
  onResend,
  onCheckVerified,
  onBack,
}) => (
  <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
    {/* Icon */}
    <div className="relative mb-6">
      <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-xl">
        <Mail className="w-12 h-12 text-white" />
      </div>
      <div className="absolute -bottom-2 -right-2 w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center border-2 border-white shadow">
        <ShieldCheck className="w-5 h-5 text-amber-600" />
      </div>
    </div>

    {/* Heading */}
    <h2 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Email</h2>
    <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
      Please verify your email to continue.{' '}
      <br />
      We sent a verification link to:
    </p>
    <div className="mt-2 mb-6 px-4 py-2 bg-gray-100 rounded-xl inline-flex items-center gap-2">
      <Mail className="w-4 h-4 text-indigo-500 flex-shrink-0" />
      <span className="text-sm font-medium text-gray-800 break-all">{state.email}</span>
    </div>

    {/* Resend section */}
    <div className="w-full space-y-3">
      {/* Status feedback */}
      {state.resendStatus === 'success' && (
        <AlertBanner type="success" message={state.resendMessage ?? 'Verification email sent! Check your inbox.'} />
      )}
      {state.resendStatus === 'error' && (
        <AlertBanner type="error" message={state.resendMessage ?? 'Failed to resend. Please try again.'} />
      )}
      {state.checkStatus === 'success' && (
        <AlertBanner type="success" message="Email verified! Signing you in…" />
      )}
      {state.checkStatus === 'error' && (
        <AlertBanner type="error" message={state.checkMessage ?? 'Email not verified yet. Please check your inbox.'} />
      )}

      {/* "I've verified" — primary action */}
      <button
        type="button"
        onClick={onCheckVerified}
        disabled={state.checkStatus === 'loading' || state.checkStatus === 'success'}
        className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold shadow-lg hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {state.checkStatus === 'loading' ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            Checking…
          </>
        ) : state.checkStatus === 'success' ? (
          <>
            <CheckCircle2 className="w-5 h-5" />
            Verified!
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" />
            I've verified my email
          </>
        )}
      </button>

      {/* Resend */}
      <button
        type="button"
        onClick={onResend}
        disabled={state.resendStatus === 'loading' || state.resendStatus === 'success'}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2 border-gray-200 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state.resendStatus === 'loading' ? (
          <>
            <RefreshCw className="w-4 h-4 animate-spin" />
            Sending…
          </>
        ) : state.resendStatus === 'success' ? (
          <>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            Email sent!
          </>
        ) : (
          <>
            <Send className="w-4 h-4" />
            Resend verification email
          </>
        )}
      </button>

      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to sign in
      </button>
    </div>

    {/* Help tip */}
    <div className="mt-6 p-3.5 bg-amber-50 border border-amber-200 rounded-xl w-full">
      <p className="text-xs text-amber-700 text-center leading-relaxed">
        <strong>Didn't receive the email?</strong> Check your spam folder or contact{' '}
        <span className="underline cursor-pointer">support@eventhub.app</span>
      </p>
    </div>
  </div>
);

// ─── Main WelcomeScreen Component ─────────────────────────────────────────────
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onLogin }) => {
  const { setUser, eventConfig } = useApp();

  // Run validation tests once in dev (inside effect, never at module level)
  useEffect(() => {
    if (import.meta.env.DEV) {
      runAuthValidationTests();
    }
  }, []);

  // ── View state
  const [view, setView] = useState<LoginView>('login');

  // ── Login form state
  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [userRole, setUserRole] = useState<'attendee' | 'sponsor'>('attendee');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [forgotToast, setForgotToast] = useState(false);
  const [socialToast, setSocialToast] = useState<string | null>(null);

  // ── Verification state
  const [verification, setVerification] = useState<VerificationState>({
    email: '',
    resendStatus: 'idle',
    checkStatus: 'idle',
  });

  // ─── Field change handlers with live validation ──────────────────────────
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, email: value }));
    if (touched.email) {
      setFieldErrors((fe) => ({ ...fe, email: validateEmail(value) }));
    }
    if (loginError) setLoginError(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, password: value }));
    if (touched.password) {
      setFieldErrors((fe) => ({ ...fe, password: validatePassword(value) }));
    }
    if (loginError) setLoginError(null);
  };

  const handleBlur = (field: 'email' | 'password') => {
    setTouched((t) => ({ ...t, [field]: true }));
    if (field === 'email') {
      setFieldErrors((fe) => ({ ...fe, email: validateEmail(form.email) }));
    }
    if (field === 'password') {
      setFieldErrors((fe) => ({ ...fe, password: validatePassword(form.password) }));
    }
  };

  const formValid = isLoginFormValid(form);

  // ─── Login submit ────────────────────────────────────────────────────────
  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Touch all fields to show errors
      setTouched({ email: true, password: true });
      setFieldErrors({
        email: validateEmail(form.email),
        password: validatePassword(form.password),
      });

      if (!formValid) return;

      setLoginLoading(true);
      setLoginError(null);

      try {
        const res = await loginApi({ email: form.email.trim().toLowerCase(), password: form.password });

        if (res.success && res.data?.user.emailVerified) {
          // ✅ Fully authenticated → store user → navigate to app
          const apiUser = res.data.user;
          // Store auth token (use localStorage for web; swap to SecureStore on native)
          localStorage.setItem('auth_token', res.data.token);

          setUser({
            id: apiUser.id,
            email: apiUser.email,
            name: apiUser.name,
            emailVerified: apiUser.emailVerified,
            role: apiUser.role ?? userRole,
            company: apiUser.company ?? '',
            title: apiUser.title ?? '',
            avatar:
              apiUser.avatar ??
              `https://ui-avatars.com/api/?name=${encodeURIComponent(apiUser.name)}&background=6366f1&color=fff`,
            points: apiUser.points ?? 0,
            tier: apiUser.tier ?? 'Bronze',
            interests: apiUser.interests ?? [],
            profileComplete: apiUser.profileComplete ?? false,
          });

          onLogin();
          return;
        }

        if (
          !res.success &&
          res.error?.code === 'EMAIL_NOT_VERIFIED'
        ) {
          // ⚠️ Email not verified → show gating screen
          const unverifiedEmail = res.data?.user.email ?? form.email.trim();
          setVerification({
            email: unverifiedEmail,
            resendStatus: 'idle',
            checkStatus: 'idle',
          });
          setView('verification');
          return;
        }

        // Other errors (wrong password, etc.)
        setLoginError(res.error?.message ?? 'Sign in failed. Please try again.');
      } catch {
        setLoginError('Unable to connect. Please check your internet connection and try again.');
      } finally {
        setLoginLoading(false);
      }
    },
    [form, formValid, userRole, setUser, onLogin]
  );

  // ─── Resend verification email ───────────────────────────────────────────
  const handleResend = useCallback(async () => {
    setVerification((v) => ({ ...v, resendStatus: 'loading', resendMessage: undefined }));
    try {
      const res = await resendVerificationApi(verification.email);
      if (res.success) {
        setVerification((v) => ({
          ...v,
          resendStatus: 'success',
          resendMessage: 'Verification email sent! Check your inbox.',
        }));
      } else {
        setVerification((v) => ({
          ...v,
          resendStatus: 'error',
          resendMessage: res.error?.message ?? 'Failed to resend. Please try again.',
        }));
      }
    } catch {
      setVerification((v) => ({
        ...v,
        resendStatus: 'error',
        resendMessage: 'Network error. Please try again.',
      }));
    }
  }, [verification.email]);

  // ─── Check verification status ("I've verified") ─────────────────────────
  const handleCheckVerified = useCallback(async () => {
    setVerification((v) => ({ ...v, checkStatus: 'loading', checkMessage: undefined }));
    try {
      const res = await getMeApi(verification.email);
      if (res.success && res.data?.emailVerified) {
        setVerification((v) => ({ ...v, checkStatus: 'success' }));

        // Brief delay so user sees success state before navigating
        setTimeout(() => {
          const apiUser = res.data!;
          localStorage.setItem('auth_token', `mock-token-${Date.now()}`);
          setUser({
            id: apiUser.id,
            email: apiUser.email,
            name: apiUser.name,
            emailVerified: true,
            role: apiUser.role ?? userRole,
            company: apiUser.company ?? '',
            title: apiUser.title ?? '',
            avatar:
              apiUser.avatar ??
              `https://ui-avatars.com/api/?name=${encodeURIComponent(apiUser.name)}&background=6366f1&color=fff`,
            points: apiUser.points ?? 0,
            tier: apiUser.tier ?? 'Bronze',
            interests: apiUser.interests ?? [],
            profileComplete: apiUser.profileComplete ?? false,
          });
          onLogin();
        }, 1200);
      } else {
        setVerification((v) => ({
          ...v,
          checkStatus: 'error',
          checkMessage: "Email not verified yet. Please click the link in your inbox first.",
        }));
      }
    } catch {
      setVerification((v) => ({
        ...v,
        checkStatus: 'error',
        checkMessage: 'Network error. Please try again.',
      }));
    }
  }, [verification.email, userRole, setUser, onLogin]);

  // ─── Social sign-in (OAuth stubs) ────────────────────────────────────────
  const handleGoogleSignIn = useCallback(async () => {
    try {
      await initiateGoogleOAuth();
    } catch {
      /* OAUTH_NOT_CONFIGURED — show "Coming soon" message */
      // TODO: Remove this block once Google OAuth is wired at BASE_URL/auth/google
      setSocialToast('Google sign-in coming soon!');
      setTimeout(() => setSocialToast(null), 3000);
    }
  }, []);

  const handleLinkedInSignIn = useCallback(async () => {
    try {
      await initiateLinkedInOAuth();
    } catch {
      /* OAUTH_NOT_CONFIGURED — show "Coming soon" message */
      // TODO: Remove this block once LinkedIn OAuth is wired at BASE_URL/auth/linkedin
      setSocialToast('LinkedIn sign-in coming soon!');
      setTimeout(() => setSocialToast(null), 3000);
    }
  }, []);

  // ─── Forgot password ──────────────────────────────────────────────────────
  const handleForgotPassword = () => {
    // TODO: Navigate to ForgotPasswordScreen or POST /auth/forgot-password
    setForgotToast(true);
    setTimeout(() => setForgotToast(false), 3000);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 flex flex-col overflow-x-hidden">

      {/* ── Decorative background orbs ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-0">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-300/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute top-1/2 -right-32 w-96 h-96 bg-purple-300/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '1.5s' }}
        />
        <div
          className="absolute -bottom-24 left-1/3 w-72 h-72 bg-pink-300/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: '0.75s' }}
        />
      </div>

      {/* ── "Coming soon" social toast ── */}
      {socialToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top duration-300">
          <div className="bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-indigo-300" />
            {socialToast}
          </div>
        </div>
      )}

      {/* ── Forgot password toast ── */}
      {forgotToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-top duration-300">
          <div className="bg-gray-900 text-white text-sm font-medium px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-indigo-300" />
            {/* TODO: wire to POST /auth/forgot-password */}
            Password reset coming soon!
          </div>
        </div>
      )}

      {/* ── Logo header ── */}
      <div className="relative z-10 px-6 pt-14 pb-6 text-center flex-shrink-0">
        <div className="inline-flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-[72px] h-[72px] bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-[22px] flex items-center justify-center shadow-2xl">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
            <div className="absolute inset-0 rounded-[22px] blur-xl bg-gradient-to-br from-indigo-600/50 via-purple-600/50 to-pink-600/50 -z-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 tracking-tight">EventHub</h1>
            <p className="text-sm text-gray-500 mt-0.5">{eventConfig.name} · {eventConfig.location}</p>
          </div>
        </div>
      </div>

      {/* ── Main card ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-start px-5 pb-10 max-w-md mx-auto w-full">
        <div className="bg-white/80 backdrop-blur-2xl rounded-3xl shadow-2xl shadow-indigo-100/50 border border-white/60 p-7 overflow-hidden">

          {/* ─ Login View ─────────────────────────────────────────────── */}
          {view === 'login' && (
            <div className="animate-in fade-in duration-400">
              {/* Greeting */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Welcome back 👋</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Sign in to start earning points and engaging
                </p>
              </div>

              {/* Role selector */}
              <div className="grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={() => setUserRole('attendee')}
                  className={`group flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all ${
                    userRole === 'attendee'
                      ? 'border-indigo-500 bg-indigo-50 shadow-sm shadow-indigo-100'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      userRole === 'attendee'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                    }`}
                  >
                    <Users className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <span
                      className={`block text-sm font-semibold ${
                        userRole === 'attendee' ? 'text-indigo-700' : 'text-gray-600'
                      }`}
                    >
                      Attendee
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">
                      Explore & engage
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setUserRole('sponsor')}
                  className={`group flex flex-col items-center gap-2.5 p-4 rounded-2xl border-2 transition-all ${
                    userRole === 'sponsor'
                      ? 'border-purple-500 bg-purple-50 shadow-sm shadow-purple-100'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                      userRole === 'sponsor'
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div className="text-center">
                    <span
                      className={`block text-sm font-semibold ${
                        userRole === 'sponsor' ? 'text-purple-700' : 'text-gray-600'
                      }`}
                    >
                      Sponsor
                    </span>
                    <span className="block text-[11px] text-gray-400 mt-0.5">
                      Connect & promote
                    </span>
                  </div>
                </button>
              </div>

              {/* Server-level error banner */}
              {loginError && (
                <AlertBanner type="error" message={loginError} className="mb-4" />
              )}

              {/* Form */}
              <form onSubmit={handleLogin} noValidate className="space-y-4">
                {/* Email */}
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 transition-colors ${
                        fieldErrors.email && touched.email
                          ? 'text-red-400'
                          : form.email && !fieldErrors.email
                          ? 'text-indigo-500'
                          : 'text-gray-400'
                      }`}
                      style={{ width: 18, height: 18 }}
                    />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      value={form.email}
                      onChange={handleEmailChange}
                      onBlur={() => handleBlur('email')}
                      placeholder="your@email.com"
                      aria-invalid={!!fieldErrors.email && touched.email}
                      aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                      className={`w-full pl-10 pr-4 py-3.5 border-2 rounded-xl text-sm transition-all outline-none
                        ${
                          fieldErrors.email && touched.email
                            ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                            : form.email && !fieldErrors.email
                            ? 'border-indigo-400 bg-indigo-50/30 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                            : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                        }`}
                    />
                  </div>
                  {fieldErrors.email && touched.email && (
                    <p id="email-error" role="alert" className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {fieldErrors.email}
                    </p>
                  )}
                </div>

                {/* Password */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock
                      className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                        fieldErrors.password && touched.password
                          ? 'text-red-400'
                          : form.password && !fieldErrors.password
                          ? 'text-indigo-500'
                          : 'text-gray-400'
                      }`}
                      style={{ width: 18, height: 18 }}
                    />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={form.password}
                      onChange={handlePasswordChange}
                      onBlur={() => handleBlur('password')}
                      placeholder="••••••••"
                      aria-invalid={!!fieldErrors.password && touched.password}
                      aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                      className={`w-full pl-10 pr-11 py-3.5 border-2 rounded-xl text-sm transition-all outline-none
                        ${
                          fieldErrors.password && touched.password
                            ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-200'
                            : form.password && !fieldErrors.password
                            ? 'border-indigo-400 bg-indigo-50/30 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200'
                            : 'border-gray-200 bg-gray-50 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100'
                        }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-0.5 rounded"
                    >
                      {showPassword ? (
                        <EyeOff style={{ width: 18, height: 18 }} />
                      ) : (
                        <Eye style={{ width: 18, height: 18 }} />
                      )}
                    </button>
                  </div>
                  {fieldErrors.password && touched.password && (
                    <p id="password-error" role="alert" className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />
                      {fieldErrors.password}
                    </p>
                  )}
                </div>

                {/* Sign In button — disabled until form is valid */}
                <button
                  type="submit"
                  disabled={loginLoading}
                  aria-disabled={!formValid || loginLoading}
                  className={`w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white font-semibold transition-all mt-2
                    ${
                      formValid && !loginLoading
                        ? 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:shadow-lg hover:shadow-indigo-200 hover:scale-[1.02] active:scale-[0.98]'
                        : 'bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 opacity-70 cursor-not-allowed'
                    }`}
                >
                  {loginLoading ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-white/80 text-xs text-gray-400 font-medium uppercase tracking-wider">
                    Or continue with
                  </span>
                </div>
              </div>

              {/* Social sign-in buttons */}
              {/*
               * TODO (OAuth integration):
               *   1. Set VITE_GOOGLE_CLIENT_ID in .env
               *   2. Set VITE_LINKEDIN_CLIENT_ID in .env
               *   3. Implement real OAuth flows in authClient.ts
               *      (initiateGoogleOAuth / initiateLinkedInOAuth)
               *   4. Add /auth/callback route to handle redirect
               */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all text-sm font-medium text-gray-700"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <button
                  type="button"
                  onClick={handleLinkedInSignIn}
                  className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-gray-200 rounded-2xl hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98] transition-all text-sm font-medium text-gray-700"
                >
                  <span className="text-[#0077B5]">
                    <LinkedInIcon />
                  </span>
                  Continue with LinkedIn
                </button>
              </div>

              {/* Demo credentials hint */}
              <div className="mt-5 p-3.5 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl">
                <p className="text-xs text-indigo-700 text-center mb-1.5 font-semibold">
                  🎮 Demo Credentials
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-indigo-600">
                  <div className="bg-white/70 rounded-lg px-2 py-1.5 text-center">
                    <div className="font-medium text-indigo-800">Attendee</div>
                    <div className="text-gray-500 mt-0.5">attendee@demo.com</div>
                    <div className="text-gray-400">demo123</div>
                  </div>
                  <div className="bg-white/70 rounded-lg px-2 py-1.5 text-center">
                    <div className="font-medium text-purple-800">Sponsor</div>
                    <div className="text-gray-500 mt-0.5">sponsor@demo.com</div>
                    <div className="text-gray-400">demo123</div>
                  </div>
                </div>
                <p className="text-[10px] text-center text-gray-400 mt-2">
                  Try <span className="font-mono text-amber-600">unverified@demo.com</span> to see email gating
                </p>
              </div>
            </div>
          )}

          {/* ─ Email Verification View ────────────────────────────────── */}
          {view === 'verification' && (
            <EmailVerificationView
              state={verification}
              onResend={handleResend}
              onCheckVerified={handleCheckVerified}
              onBack={() => {
                setView('login');
                setVerification({ email: '', resendStatus: 'idle', checkStatus: 'idle' });
              }}
            />
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by{' '}
          <span className="text-indigo-500 font-medium">EventHub Platform</span>
          {' '}· By signing in you agree to our{' '}
          <span className="underline cursor-pointer hover:text-indigo-500 transition-colors">Terms</span>{' '}
          &{' '}
          <span className="underline cursor-pointer hover:text-indigo-500 transition-colors">Privacy Policy</span>
        </p>
      </div>
    </div>
  );
};