import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Platform,
  Dimensions,
  Image,
  Keyboard,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OtpInput } from './OtpInput';
import { sendOtp, verifyOtp, register, loginWithPassword, AuthUser } from '@/lib/apiClient';
import { listAllCompanies } from '@/lib/api/companies';
import type { CompanyLookup } from '@/lib/api/companies';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';
import {
  fetchGlobalVideoFeeds,
  fetchGlobalArticles,
  fetchVideoCategories,
  fetchArticleCategories,
  GlobalVideoFeed,
  GlobalArticle,
  Category,
} from '@/lib/api/globalFeeds';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Sheet grows to fit content but never exceeds 92% of screen
const MAX_SHEET = SCREEN_HEIGHT * 0.92;

type SheetView = 'email' | 'no-account' | 'otp' | 'profile-review' | 'create-account';
type TopTab = 'feeds' | 'events' | null;
type FeedSubTab = 'podcast' | 'articles';

interface CreateForm {
  firstName: string;
  lastName: string;
  email: string;
  title: string;
  company: string;
  companyId: number | null;
  phone: string;
}

// ─── Input Row ────────────────────────────────────────────────────────────────
function InputRow({
  icon,
  placeholder,
  value,
  onChangeText,
  keyboardType,
  autoCapitalize,
  editable = true,
  style,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  placeholder: string;
  value: string;
  onChangeText?: (v: string) => void;
  keyboardType?: 'default' | 'email-address' | 'phone-pad';
  autoCapitalize?: 'none' | 'words' | 'sentences';
  editable?: boolean;
  style?: object;
}) {
  return (
    <View style={[sh.inputRow, !editable && sh.inputRowDisabled, style]}>
      <Ionicons name={icon} size={16} color="rgba(255,255,255,0.35)" style={sh.inputIcon} />
      <TextInput
        style={sh.inputText}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.28)"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'sentences'}
        autoCorrect={false}
        editable={editable}
        selectTextOnFocus={editable}
      />
    </View>
  );
}

// ─── Email View (Login) ───────────────────────────────────────────────────────
function EmailView({
  email,
  setEmail,
  error,
  loading,
  onContinue,
}: {
  email: string;
  setEmail: (v: string) => void;
  error: string;
  loading: boolean;
  onContinue: () => void;
}) {
  return (
    <View style={sh.sheetPad}>
      {/* Icon */}
      <View style={sh.iconWrap}>
        <LinearGradient colors={['#7c3aed', '#5b21b6']} style={sh.iconGrad}>
          <Ionicons name="mail" size={26} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={sh.sheetTitle}>Log in</Text>
      <Text style={sh.sheetSub}>Enter your email address to continue</Text>

      <Text style={sh.fieldLabel}>EMAIL ADDRESS</Text>
      <InputRow
        icon="mail-outline"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      {!!error && <Text style={sh.errorText}>{error}</Text>}

      {/* Continue */}
      <TouchableOpacity
        style={[sh.darkBtn, loading && { opacity: 0.6 }]}
        onPress={onContinue}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 8 }} />
            <Text style={sh.darkBtnText}>Continue</Text>
          </>
        )}
      </TouchableOpacity>

      <Text style={sh.footerNote}>
        We'll send a one-time verification code to your email address.
      </Text>
    </View>
  );
}

// ─── No Account Found View ────────────────────────────────────────────────────
function NoAccountView({
  email,
  onCreateAccount,
  onTryDifferent,
}: {
  email: string;
  onCreateAccount: () => void;
  onTryDifferent: () => void;
}) {
  return (
    <View style={[sh.sheetPad, { alignItems: 'center' }]}>
      {/* Warning icon */}
      <View style={sh.noAccountIconWrap}>
        <Ionicons name="search" size={28} color="#f87171" />
        <View style={sh.noAccountBadge}>
          <Ionicons name="alert" size={10} color="#fff" />
        </View>
      </View>

      <Text style={sh.sheetTitle}>No account found</Text>
      <Text style={[sh.sheetSub, { textAlign: 'center' }]}>
        We couldn't find an account for
      </Text>
      <View style={sh.emailPill}>
        <Text style={sh.emailPillText} numberOfLines={1}>{email}</Text>
      </View>

      {/* Create account */}
      <TouchableOpacity style={sh.purpleBtn} onPress={onCreateAccount} activeOpacity={0.85}>
        <LinearGradient
          colors={['#7c3aed', '#5b21b6']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
        <Text style={sh.purpleBtnText}>Create an Account</Text>
      </TouchableOpacity>

      <View style={sh.orRow}>
        <View style={sh.orLine} />
        <Text style={sh.orText}>or</Text>
        <View style={sh.orLine} />
      </View>

      <TouchableOpacity style={sh.darkBtn} onPress={onTryDifferent} activeOpacity={0.85}>
        <Text style={sh.darkBtnText}>Try a different email</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Create Profile View ──────────────────────────────────────────────────────
function CreateProfileView({
  form,
  setForm,
  error,
  loading,
  companies,
  onSubmit,
  onBack,
  onSignIn,
}: {
  form: CreateForm;
  setForm: (f: Partial<CreateForm>) => void;
  error: string;
  loading: boolean;
  companies: { id: number; name: string }[];
  onSubmit: () => void;
  onBack: () => void;
  onSignIn: () => void;
}) {
  const [companyOpen, setCompanyOpen] = React.useState(false);
  const filteredCompanies = React.useMemo(
    () => form.company.trim()
      ? companies.filter(c => c.name.toLowerCase().includes(form.company.toLowerCase())).slice(0, 8)
      : [],
    [companies, form.company],
  );
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={sh.sheetPad}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Back */}
      <TouchableOpacity style={sh.backRow} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.5)" />
        <Text style={sh.backText}>Back</Text>
      </TouchableOpacity>

      {/* Icon */}
      <View style={sh.iconWrap}>
        <LinearGradient colors={['#7c3aed', '#5b21b6']} style={sh.iconGrad}>
          <Ionicons name="person" size={26} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={sh.sheetTitle}>Create your profile</Text>
      <Text style={sh.sheetSub}>Tell us a bit about yourself to get started</Text>

      {/* First + Last */}
      <View style={sh.nameRow}>
        <View style={[sh.inputRow, { flex: 1 }]}>
          <Ionicons name="person-outline" size={16} color="rgba(255,255,255,0.35)" style={sh.inputIcon} />
          <TextInput
            style={sh.inputText}
            placeholder="First name"
            placeholderTextColor="rgba(255,255,255,0.28)"
            value={form.firstName}
            onChangeText={(v) => setForm({ firstName: v })}
            autoCapitalize="words"
          />
        </View>
        <View style={[sh.inputRow, { flex: 1 }]}>
          <TextInput
            style={[sh.inputText, { paddingLeft: 12 }]}
            placeholder="Last name"
            placeholderTextColor="rgba(255,255,255,0.28)"
            value={form.lastName}
            onChangeText={(v) => setForm({ lastName: v })}
            autoCapitalize="words"
          />
        </View>
      </View>

      {/* Email (pre-filled, read-only) */}
      <InputRow
        icon="mail-outline"
        placeholder="Email"
        value={form.email}
        editable={false}
        style={sh.inputMt}
      />

      {/* Job title */}
      <View style={[sh.inputRow, sh.inputMt]}>
        <Ionicons name="briefcase-outline" size={16} color="rgba(255,255,255,0.35)" style={sh.inputIcon} />
        <TextInput
          style={sh.inputText}
          placeholder="Job title"
          placeholderTextColor="rgba(255,255,255,0.28)"
          value={form.title}
          onChangeText={(v) => setForm({ title: v })}
          autoCapitalize="words"
        />
      </View>

      {/* Company autocomplete */}
      <View style={sh.inputMt}>
        <View style={sh.inputRow}>
          <Ionicons name="business-outline" size={16} color="rgba(255,255,255,0.35)" style={sh.inputIcon} />
          <TextInput
            style={sh.inputText}
            placeholder="Search or type your company"
            placeholderTextColor="rgba(255,255,255,0.28)"
            value={form.company}
            onChangeText={(v) => { setForm({ company: v, companyId: null }); setCompanyOpen(true); }}
            onFocus={() => setCompanyOpen(true)}
            autoCapitalize="words"
          />
          {form.companyId != null && (
            <TouchableOpacity
              onPress={() => setForm({ company: '', companyId: null })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginRight: 8 }}
            >
              <Ionicons name="close-circle" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>
          )}
        </View>
        {companyOpen && filteredCompanies.length > 0 && (
          <View style={{ borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', backgroundColor: '#1a1a2e', overflow: 'hidden' }}>
            {filteredCompanies.map((c, i) => (
              <TouchableOpacity
                key={c.id}
                onPress={() => { setForm({ company: c.name, companyId: c.id }); setCompanyOpen(false); Keyboard.dismiss(); }}
                style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: i < filteredCompanies.length - 1 ? 1 : 0, borderBottomColor: 'rgba(255,255,255,0.06)' }}
              >
                <Text style={{ color: '#e2e8f0', fontSize: 13 }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Phone (optional) */}
      <View style={[sh.inputRow, sh.inputMt]}>
        <Ionicons name="call-outline" size={16} color="rgba(255,255,255,0.35)" style={sh.inputIcon} />
        <TextInput
          style={sh.inputText}
          placeholder="Phone number (optional)"
          placeholderTextColor="rgba(255,255,255,0.28)"
          value={form.phone}
          onChangeText={(v) => setForm({ phone: v })}
          keyboardType="phone-pad"
        />
      </View>

      {!!error && <Text style={[sh.errorText, { marginTop: 10 }]}>{error}</Text>}

      <Text style={sh.termsText}>
        By creating an account, you agree to our{' '}
        <Text style={sh.termsLink}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={sh.termsLink}>Privacy Policy</Text>.
      </Text>

      {/* Create Account */}
      <TouchableOpacity
        style={[sh.darkBtn, loading && { opacity: 0.6 }]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <>
            <Ionicons name="lock-closed" size={16} color="rgba(255,255,255,0.7)" style={{ marginRight: 8 }} />
            <Text style={sh.darkBtnText}>Create Account</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Sign in link */}
      <TouchableOpacity onPress={onSignIn} style={sh.signInLink} activeOpacity={0.7}>
        <Text style={sh.signInText}>Already have an account? </Text>
        <Text style={[sh.signInText, sh.signInPurple]}>Sign in</Text>
      </TouchableOpacity>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

// ─── Profile Review View ──────────────────────────────────────────────────────
function ProfileReviewView({
  user,
  onConfirm,
  onBack,
}: {
  user: AuthUser;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <View style={sh.sheetPad}>
      <TouchableOpacity style={sh.backRow} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.5)" />
        <Text style={sh.backText}>Back</Text>
      </TouchableOpacity>

      <View style={sh.iconWrap}>
        <LinearGradient colors={['#10b981', '#047857']} style={sh.iconGrad}>
          <Ionicons name="checkmark-circle" size={26} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={sh.sheetTitle}>Welcome back!</Text>
      <Text style={sh.sheetSub}>Confirm it's you to continue</Text>

      <View style={sh.reviewCard}>
        <View style={sh.reviewAvatar}>
          <Text style={sh.reviewAvatarText}>
            {(user.name || user.email || 'U')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={sh.reviewName}>{user.name || 'User'}</Text>
          <Text style={sh.reviewEmail}>{user.email}</Text>
          {user.company ? <Text style={sh.reviewCompany}>{user.company}</Text> : null}
        </View>
      </View>

      <TouchableOpacity style={sh.purpleBtn} onPress={onConfirm} activeOpacity={0.85}>
        <LinearGradient
          colors={['#7c3aed', '#5b21b6']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <Text style={sh.purpleBtnText}>Continue as {user.name?.split(' ')[0] || 'me'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── OTP View ─────────────────────────────────────────────────────────────────
function OtpView({
  email,
  otpValue,
  setOtpValue,
  error,
  loading,
  resendCountdown,
  onResend,
  onBack,
}: {
  email: string;
  otpValue: string;
  setOtpValue: (v: string) => void;
  error: string;
  loading: boolean;
  resendCountdown: number;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <View style={sh.sheetPad}>
      <TouchableOpacity style={sh.backRow} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="arrow-back" size={16} color="rgba(255,255,255,0.5)" />
        <Text style={sh.backText}>Back</Text>
      </TouchableOpacity>

      <View style={sh.iconWrap}>
        <LinearGradient colors={['#7c3aed', '#5b21b6']} style={sh.iconGrad}>
          <Ionicons name="shield-checkmark" size={26} color="#fff" />
        </LinearGradient>
      </View>

      <Text style={sh.sheetTitle}>Enter code</Text>
      <Text style={sh.sheetSub}>
        We sent a 6-digit code to{'\n'}
        <Text style={{ color: '#c4b5fd' }}>{email}</Text>
      </Text>

      <OtpInput
        value={otpValue}
        onChange={setOtpValue}
        hasError={!!error}
      />
      {!!error && <Text style={[sh.errorText, { textAlign: 'center', marginTop: 8 }]}>{error}</Text>}

      {loading && (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
      )}

      <TouchableOpacity
        onPress={onResend}
        disabled={resendCountdown > 0}
        style={sh.resendRow}
        activeOpacity={0.7}
      >
        <Text style={[sh.resendText, resendCountdown > 0 && { color: 'rgba(255,255,255,0.3)' }]}>
          {resendCountdown > 0
            ? `Resend code in ${resendCountdown}s`
            : "Didn't receive it? Resend"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main WelcomeScreen ───────────────────────────────────────────────────────
export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  // Sheet animation
  const sheetAnim = useRef(new Animated.Value(0)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState<SheetView>('email');

  // Email / OTP state
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);
  const [identifier, setIdentifier] = useState(''); // what was actually sent to backend

  const [otpValue, setOtpValue] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [resolvedUser, setResolvedUser] = useState<AuthUser | null>(null);
  const [resolvedToken, setResolvedToken] = useState('');

  // Create-account form
  const [createForm, setCreateFormState] = useState<CreateForm>({
    firstName: '', lastName: '', email: '', title: '', company: '', companyId: null, phone: '',
  });
  const setCreateForm = (patch: Partial<CreateForm>) =>
    setCreateFormState((p) => ({ ...p, ...patch }));
  const [createError, setCreateError] = useState('');
  const [createLoading, setCreateLoading] = useState(false);

  // Companies for autocomplete on registration
  const [companies, setCompanies] = useState<CompanyLookup[]>([]);
  useEffect(() => {
    listAllCompanies().then(res => {
      if (res.success && res.data) setCompanies(res.data);
    });
  }, []);

  // Top-level tabs + feeds
  const [activeTab, setActiveTab] = useState<TopTab>(null);
  const [feedSubTab, setFeedSubTab] = useState<FeedSubTab>('podcast');
  const [videos, setVideos] = useState<GlobalVideoFeed[]>([]);
  const [articles, setArticles] = useState<GlobalArticle[]>([]);
  const [videoCats, setVideoCats] = useState<Category[]>([]);
  const [articleCats, setArticleCats] = useState<Category[]>([]);
  const [selectedVideoCat, setSelectedVideoCat] = useState<string | null>(null);
  const [selectedArticleCat, setSelectedArticleCat] = useState<string | null>(null);
  const [feedsLoading, setFeedsLoading] = useState(false);

  // Dev login
  const [devLoading, setDevLoading] = useState(false);
  const handleDevLogin = useCallback(async (devEmail: string, password: string) => {
    setDevLoading(true);
    try {
      const res = await loginWithPassword(devEmail, password);
      if (!res.success || !res.data) return;
      await login(res.data.token, res.data.user);
      router.replace('/events');
    } finally {
      setDevLoading(false);
    }
  }, [login]);

  // Feeds loading
  useEffect(() => {
    if (activeTab === 'feeds') loadFeeds();
  }, [activeTab, feedSubTab, selectedVideoCat, selectedArticleCat]);

  const loadFeeds = async () => {
    setFeedsLoading(true);
    try {
      if (feedSubTab === 'podcast') {
        const [vRes, cRes] = await Promise.all([
          fetchGlobalVideoFeeds({ category: selectedVideoCat ?? undefined }),
          videoCats.length ? Promise.resolve(null) : fetchVideoCategories(),
        ]);
        if (vRes.success && vRes.data) setVideos(vRes.data.data);
        if (cRes?.success && cRes.data) setVideoCats(cRes.data);
      } else {
        const [aRes, cRes] = await Promise.all([
          fetchGlobalArticles({ category: selectedArticleCat ?? undefined }),
          articleCats.length ? Promise.resolve(null) : fetchArticleCategories(),
        ]);
        if (aRes.success && aRes.data) setArticles(aRes.data.data);
        if (cRes?.success && cRes.data) setArticleCats(cRes.data);
      }
    } catch {
      // silent
    } finally {
      setFeedsLoading(false);
    }
  };

  // Sheet open/close
  const openSheet = useCallback(() => {
    setActiveTab('events');
    setSheetView('email');
    setSheetOpen(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 200 }).start();
  }, [sheetAnim]);

  const closeSheet = useCallback(() => {
    Keyboard.dismiss();
    Animated.timing(sheetAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => {
      setSheetOpen(false);
      setActiveTab(null);
      setSheetView('email');
      setEmail('');
      setEmailError('');
      setOtpValue('');
      setOtpError('');
      setResolvedUser(null);
      setResolvedToken('');
      setCreateFormState({ firstName: '', lastName: '', email: '', title: '', company: '', companyId: null, phone: '' });
      setCreateError('');
      if (resendRef.current) clearInterval(resendRef.current);
      setResendCountdown(0);
    });
  }, [sheetAnim]);

  // Keyboard lift (iOS only — Android uses adjustResize)
  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(keyboardOffset, { toValue: -e.endCoordinates.height, duration: e.duration || 250, useNativeDriver: true }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(keyboardOffset, { toValue: 0, duration: e.duration || 250, useNativeDriver: true }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [keyboardOffset]);

  const startResendCountdown = useCallback(() => {
    setResendCountdown(30);
    resendRef.current = setInterval(() => {
      setResendCountdown((p) => {
        if (p <= 1) { clearInterval(resendRef.current!); return 0; }
        return p - 1;
      });
    }, 1000);
  }, []);

  // Step 1 — email → OTP or no-account
  const handleEmailContinue = useCallback(async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailError('');
    setEmailLoading(true);
    try {
      const res = await sendOtp(trimmed);
      if (!res.success) { setEmailError(res.error?.message ?? 'Failed to send code.'); return; }
      setIdentifier(trimmed);
      Keyboard.dismiss();
      if (!res.data?.otpSent) {
        // No account — show "No account found" interstitial
        setCreateForm({ email: trimmed });
        setSheetView('no-account');
      } else {
        setOtpValue('');
        setOtpError('');
        setSheetView('otp');
        startResendCountdown();
      }
    } catch {
      setEmailError('Something went wrong. Please try again.');
    } finally {
      setEmailLoading(false);
    }
  }, [email, startResendCountdown]);

  // OTP auto-verify when 6 digits entered
  useEffect(() => {
    if (otpValue.length === 6 && sheetView === 'otp') handleVerifyOtp();
  }, [otpValue]);

  const handleVerifyOtp = useCallback(async () => {
    setOtpLoading(true);
    try {
      const res = await verifyOtp(identifier, otpValue);
      if (!res.success || !res.data) { setOtpError(res.error?.message ?? 'Incorrect code. Try again.'); return; }
      const data = res.data;
      if (!data.isNewUser && data.user) {
        setResolvedUser(data.user);
        setResolvedToken(data.token);
        setSheetView('profile-review');
      } else {
        setCreateForm({ email: identifier });
        setSheetView('create-account');
      }
    } catch {
      setOtpError('Something went wrong. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  }, [identifier, otpValue]);

  const handleProfileConfirm = useCallback(async () => {
    if (!resolvedUser) return;
    await login(resolvedToken, resolvedUser);
    router.replace('/events');
  }, [resolvedUser, resolvedToken, login]);

  const handleCreateAccount = useCallback(async () => {
    if (!createForm.firstName.trim() || !createForm.email.trim()) {
      setCreateError('First name and email are required.');
      return;
    }
    setCreateError('');
    setCreateLoading(true);
    try {
      const fullName = `${createForm.firstName.trim()} ${createForm.lastName.trim()}`.trim();
      const res = await register({
        name: fullName,
        email: createForm.email,
        phone: createForm.phone,
        title: createForm.title,
        company: createForm.company,
        companyId: createForm.companyId,
      });
      if (!res.success || !res.data) { setCreateError(res.error?.message ?? 'Registration failed.'); return; }
      await login(res.data.token, res.data.user);
      router.replace('/events');
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, login]);

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [MAX_SHEET, 0],
  });
  const backdropOpacity = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient colors={['#0d0d1a', '#1a0d2e', '#0d1a2e']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <LinearGradient colors={['transparent', 'rgba(109,40,217,0.15)', 'rgba(4,4,16,0.97)']} style={[StyleSheet.absoluteFill, { top: '30%' }]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 1 }} />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={() => setActiveTab(null)}>
          <Image source={require('@/assets/cxo-logo.png')} style={styles.logo} resizeMode="contain" />
        </TouchableOpacity>

        <View style={styles.topTabs}>
          <TouchableOpacity
            style={[styles.topTab, activeTab === 'feeds' && styles.topTabActive]}
            onPress={() => setActiveTab('feeds')}
          >
            <Text style={[styles.topTabText, activeTab === 'feeds' && styles.topTabTextActive]}>CXO Feeds</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.topTab, activeTab === 'events' && styles.topTabActive]}
            onPress={openSheet}
          >
            <Text style={[styles.topTabText, activeTab === 'events' && styles.topTabTextActive]}>Events</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Content area */}
      {activeTab === 'feeds' ? (
        <View style={styles.feedsContainer}>
          {/* Sub-tabs */}
          <View style={styles.subTabs}>
            {(['podcast', 'articles'] as FeedSubTab[]).map((st) => (
              <TouchableOpacity
                key={st}
                style={[styles.subTab, feedSubTab === st && styles.subTabActive]}
                onPress={() => setFeedSubTab(st)}
              >
                <Text style={[styles.subTabText, feedSubTab === st && styles.subTabTextActive]}>
                  {st === 'podcast' ? 'Podcast' : 'Articles'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Category chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <TouchableOpacity
              style={[styles.filterChip, !(feedSubTab === 'podcast' ? selectedVideoCat : selectedArticleCat) && styles.filterChipActive]}
              onPress={() => feedSubTab === 'podcast' ? setSelectedVideoCat(null) : setSelectedArticleCat(null)}
            >
              <Text style={[styles.filterChipText, !(feedSubTab === 'podcast' ? selectedVideoCat : selectedArticleCat) && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {(feedSubTab === 'podcast' ? videoCats : articleCats).map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[styles.filterChip, (feedSubTab === 'podcast' ? selectedVideoCat === cat.slug : selectedArticleCat === cat.slug) && styles.filterChipActive]}
                onPress={() => feedSubTab === 'podcast' ? setSelectedVideoCat(cat.slug) : setSelectedArticleCat(cat.slug)}
              >
                <Text style={[styles.filterChipText, (feedSubTab === 'podcast' ? selectedVideoCat === cat.slug : selectedArticleCat === cat.slug) && styles.filterChipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {feedsLoading ? (
            <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
          ) : (
            <FlatList
              data={(feedSubTab === 'podcast' ? videos : articles) as any[]}
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.feedList}
              renderItem={({ item }) => (
                <View style={styles.feedCard}>
                  {item.thumbnail ? (
                    <Image source={{ uri: item.thumbnail }} style={styles.cardThumb} />
                  ) : null}
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      {item.category ? (
                        <View style={styles.cardCategory}>
                          <Text style={styles.cardCategoryText}>{String(item.category)}</Text>
                        </View>
                      ) : null}
                      {(item.duration || item.read_time) ? (
                        <Text style={styles.cardDuration}>{String(item.duration ?? item.read_time)}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{String(item.title)}</Text>
                    {item.excerpt ? <Text style={styles.cardExcerpt} numberOfLines={2}>{String(item.excerpt)}</Text> : null}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>No content available yet.</Text>
                </View>
              }
            />
          )}
        </View>
      ) : (
        <>
          <View style={styles.spacer} />
          <View style={styles.chips}>
            {[
              { emoji: '⚡', label: 'Live Polls' },
              { emoji: '🏆', label: 'Leaderboard' },
              { emoji: '🤝', label: 'Networking' },
              { emoji: '📊', label: 'Surveys' },
              { emoji: '🎯', label: 'Challenges' },
            ].map(({ emoji, label }) => (
              <View key={label} style={styles.chip}>
                <Text style={styles.chipEmoji}>{emoji}</Text>
                <Text style={styles.chipLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.hero, { paddingBottom: insets.bottom + spacing.xl }]}>
            <Text style={styles.heroTitle}>
              Where the{'\n'}
              <Text style={styles.heroAccent}>Future Connects</Text>
            </Text>
            <Text style={styles.heroSub}>
              Engage with leaders, earn points, climb the leaderboard — your event experience, fully gamified.
            </Text>

            <TouchableOpacity style={styles.ctaButton} onPress={openSheet} activeOpacity={0.85}>
              <LinearGradient colors={['#7c3aed', '#4f46e5', '#0ea5e9']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} />
              <Text style={styles.ctaText}>Start Networking</Text>
            </TouchableOpacity>
            <Text style={styles.ctaSub}>Sign in to your account to get started</Text>

            {__DEV__ && (
              <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textAlign: 'center', marginBottom: 4 }}>DEV ONLY</Text>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(124,58,237,0.2)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.4)', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center' }}
                  onPress={() => handleDevLogin('testuser@cxoinc.com', 'Test1234!')}
                  disabled={devLoading}
                >
                  {devLoading ? <ActivityIndicator color="#7c3aed" size="small" /> : <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '600' }}>Login as Attendee</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(6,182,212,0.1)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.3)', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center' }}
                  onPress={() => handleDevLogin('testsponsor@cxoinc.com', 'Test1234!')}
                  disabled={devLoading}
                >
                  {devLoading ? <ActivityIndicator color="#06b6d4" size="small" /> : <Text style={{ color: '#67e8f9', fontSize: 12, fontWeight: '600' }}>Login as Sponsor</Text>}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}

      {/* Backdrop */}
      {sheetOpen && (
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]} pointerEvents="box-only">
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>
      )}

      {/* Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: sheetTranslate }, { translateY: keyboardOffset }] },
        ]}
        pointerEvents={sheetOpen ? 'box-none' : 'none'}
      >
        {/* Handle */}
        <View style={styles.sheetHandle} />

        {/* Close */}
        <TouchableOpacity style={styles.sheetClose} onPress={closeSheet}>
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>

        {sheetView === 'email' && (
          <EmailView
            email={email}
            setEmail={(v) => { setEmail(v); setEmailError(''); }}
            error={emailError}
            loading={emailLoading}
            onContinue={handleEmailContinue}
          />
        )}

        {sheetView === 'no-account' && (
          <NoAccountView
            email={identifier || email}
            onCreateAccount={() => setSheetView('create-account')}
            onTryDifferent={() => { setSheetView('email'); setEmail(''); setEmailError(''); }}
          />
        )}

        {sheetView === 'otp' && (
          <OtpView
            email={identifier}
            otpValue={otpValue}
            setOtpValue={(v) => { setOtpValue(v); setOtpError(''); }}
            error={otpError}
            loading={otpLoading}
            resendCountdown={resendCountdown}
            onResend={() => {
              if (resendCountdown > 0) return;
              setOtpValue('');
              setOtpError('');
              handleEmailContinue();
            }}
            onBack={() => { setSheetView('email'); setOtpValue(''); setOtpError(''); }}
          />
        )}

        {sheetView === 'profile-review' && resolvedUser && (
          <ProfileReviewView
            user={resolvedUser}
            onConfirm={handleProfileConfirm}
            onBack={() => setSheetView('otp')}
          />
        )}

        {sheetView === 'create-account' && (
          <CreateProfileView
            form={createForm}
            setForm={setCreateForm}
            error={createError}
            loading={createLoading}
            companies={companies}
            onSubmit={handleCreateAccount}
            onBack={() => setSheetView(identifier ? 'no-account' : 'email')}
            onSignIn={() => { setSheetView('email'); setEmail(''); setEmailError(''); }}
          />
        )}
      </Animated.View>
    </View>
  );
}

// ─── Sheet sub-styles ─────────────────────────────────────────────────────────
const sh = StyleSheet.create({
  sheetPad: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  iconWrap: {
    marginBottom: 18,
    marginTop: 4,
  },
  iconGrad: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  sheetSub: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    marginTop: 20,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    minHeight: 50,
    overflow: 'hidden',
  },
  inputRowDisabled: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputIcon: {
    marginLeft: 14,
    marginRight: 6,
  },
  inputText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    paddingVertical: 13,
    paddingRight: 14,
  },
  inputMt: {
    marginTop: 10,
  },
  nameRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 6,
  },
  darkBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  darkBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  purpleBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 24,
    width: '100%',
  },
  purpleBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  footerNote: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 16,
  },
  // No-account view
  noAccountIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 12,
    alignSelf: 'center',
  },
  noAccountBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailPill: {
    marginTop: 10,
    marginBottom: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    maxWidth: '90%',
    alignSelf: 'center',
  },
  emailPillText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    fontWeight: '600',
  },
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
    width: '100%',
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  orText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    fontWeight: '500',
  },
  // Create account
  termsText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 18,
  },
  termsLink: {
    color: 'rgba(196,181,253,0.7)',
  },
  signInLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  signInText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
  },
  signInPurple: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  // Back button
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  backText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '500',
  },
  // OTP
  resendRow: {
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 8,
  },
  resendText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  // Profile review
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
  },
  reviewAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(124,58,237,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: {
    color: '#c4b5fd',
    fontSize: 22,
    fontWeight: '800',
  },
  reviewName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  reviewEmail: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 2,
  },
  reviewCompany: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    marginTop: 2,
  },
});

// ─── Outer screen styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  logo: { height: 32, width: 100 },
  topTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topTab: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999 },
  topTabActive: { backgroundColor: colors.primary },
  topTabText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  topTabTextActive: { color: '#fff' },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#34d399' },
  liveText: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  feedsContainer: { flex: 1 },
  subTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  subTab: { paddingBottom: 8, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  subTabActive: { borderBottomColor: colors.primary },
  subTabText: { color: colors.textSecondary, fontSize: 15, fontWeight: '600' },
  subTabTextActive: { color: colors.primary },
  filterScroll: { paddingHorizontal: spacing.xl, gap: 8, paddingBottom: spacing.md },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterChipTextActive: { color: '#fff' },
  feedList: { paddingHorizontal: spacing.xl, paddingBottom: 100 },
  feedCard: {
    backgroundColor: colors.bgCard,
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardThumb: { width: '100%', height: 180, backgroundColor: 'rgba(255,255,255,0.05)' },
  cardContent: { padding: spacing.md },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCategory: { backgroundColor: 'rgba(124,58,237,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  cardCategoryText: { color: '#c4b5fd', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  cardDuration: { color: colors.textMuted, fontSize: 11 },
  cardTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', lineHeight: 22, marginBottom: 6 },
  cardExcerpt: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { color: colors.textMuted, fontSize: 14 },
  spacer: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: spacing.xxl, marginBottom: spacing.xl },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.5)',
  },
  chipEmoji: { fontSize: 12 },
  chipLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  hero: { paddingHorizontal: spacing.xxl },
  heroTitle: { color: '#fff', fontSize: 38, fontWeight: '900', letterSpacing: -1.5, lineHeight: 44, marginBottom: 10 },
  heroAccent: { color: '#c4b5fd' },
  heroSub: { color: 'rgba(255,255,255,0.5)', fontSize: 14, lineHeight: 21, marginBottom: spacing.xl },
  ctaButton: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: spacing.md },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  ctaSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, textAlign: 'center' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)', zIndex: 10 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a14',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 20,
    maxHeight: MAX_SHEET,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  sheetClose: {
    position: 'absolute',
    top: 14,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
