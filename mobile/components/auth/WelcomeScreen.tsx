import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  ActivityIndicator,
  Platform,
  Dimensions,
  Image,
  KeyboardTypeOptions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OtpInput } from './OtpInput';
import { sendOtp, verifyOtp, register, AuthUser } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius, typography } from '@/constants/theme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.75, 600);

type View_ = 'phone' | 'otp' | 'profile-review' | 'create-account';

const cleanPhone = (raw: string) => raw.replace(/\D/g, '');
const formatPhone = (digits: string) => {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

const DEMO_PHONES = [
  { label: 'Attendee #1', phone: '5550000001' },
  { label: 'Attendee #2', phone: '8156699646' },
  { label: 'Sponsor', phone: '5550009999' },
];

export function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { login } = useAuth();

  const sheetAnim = useRef(new Animated.Value(0)).current;
  const [sheetOpen, setSheetOpen] = useState(false);

  const [view, setView] = useState<View_>('phone');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const [otpValue, setOtpValue] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const resendRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [resolvedUser, setResolvedUser] = useState<AuthUser | null>(null);
  const [resolvedToken, setResolvedToken] = useState('');

  const [createForm, setCreateForm] = useState({ name: '', email: '', title: '', company: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState('');

  const openSheet = () => {
    setSheetOpen(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 180 }).start();
  };

  const closeSheet = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
      setSheetOpen(false);
      setView('phone');
      setPhoneDigits('');
      setPhoneError('');
      setOtpValue('');
      setOtpError('');
      setResolvedUser(null);
      setCreateForm({ name: '', email: '', title: '', company: '' });
      setCreateError('');
      if (resendRef.current) clearInterval(resendRef.current);
      setResendCountdown(0);
    });
  };

  const startResendCountdown = useCallback(() => {
    setResendCountdown(30);
    resendRef.current = setInterval(() => {
      setResendCountdown((p) => {
        if (p <= 1) { if (resendRef.current) clearInterval(resendRef.current); return 0; }
        return p - 1;
      });
    }, 1000);
  }, []);

  const handlePhoneContinue = useCallback(async () => {
    const digits = cleanPhone(phoneDigits);
    if (digits.length < 10) { setPhoneError('Please enter a valid 10-digit phone number.'); return; }
    setPhoneError('');
    setPhoneLoading(true);
    try {
      const res = await sendOtp(digits);
      if (!res.success) { setPhoneError(res.error?.message ?? 'Failed to send code.'); return; }
      setOtpValue('');
      setOtpError('');
      setView('otp');
      startResendCountdown();
    } catch {
      setPhoneError('Something went wrong. Please try again.');
    } finally {
      setPhoneLoading(false);
    }
  }, [phoneDigits, startResendCountdown]);

  useEffect(() => {
    if (otpValue.length === 6 && view === 'otp') {
      handleVerifyOtp();
    }
  }, [otpValue]);

  const handleVerifyOtp = useCallback(async () => {
    const digits = cleanPhone(phoneDigits);
    setOtpLoading(true);
    try {
      const res = await verifyOtp(digits, otpValue);
      if (!res.success) { setOtpError(res.error?.message ?? 'Incorrect code. Please try again.'); return; }
      const data = res.data!;
      if (!data.isNewUser && data.user) {
        setResolvedUser(data.user);
        setResolvedToken(data.token);
        setView('profile-review');
      } else {
        setView('create-account');
      }
    } catch {
      setOtpError('Something went wrong. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  }, [phoneDigits, otpValue]);

  const handleProfileConfirm = async () => {
    if (!resolvedUser) return;
    await login(resolvedToken, resolvedUser);
    router.replace('/(tabs)/feed');
  };

  const handleCreateAccount = useCallback(async () => {
    if (!createForm.name.trim() || !createForm.email.trim()) {
      setCreateError('Name and email are required.');
      return;
    }
    setCreateError('');
    setCreateLoading(true);
    try {
      const digits = cleanPhone(phoneDigits);
      const res = await register({ phone: digits, ...createForm });
      if (!res.success || !res.data) { setCreateError(res.error?.message ?? 'Registration failed.'); return; }
      await login(res.data.token, res.data.user);
      router.replace('/(tabs)/feed');
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, phoneDigits, login]);

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SHEET_HEIGHT, 0],
  });

  const backdropOpacity = sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <View style={styles.container}>

      <LinearGradient
        colors={['#0d0d1a', '#1a0d2e', '#0d1a2e']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <LinearGradient
        colors={['transparent', 'rgba(109,40,217,0.15)', 'rgba(4,4,16,0.97)']}
        style={[StyleSheet.absoluteFill, { top: '30%' }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      <View style={[styles.topBar, { paddingTop: insets.top + spacing.md }]}>
        <Image source={require('@/assets/cxo-logo.png')} style={styles.logo} resizeMode="contain" />
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

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
          <Text style={styles.heroGradientText}>Future Connects</Text>
        </Text>
        <Text style={styles.heroSub}>
          Engage with leaders, earn points, climb the leaderboard — your event experience, fully gamified.
        </Text>

        <TouchableOpacity style={styles.ctaButton} onPress={openSheet} activeOpacity={0.85}>
          <LinearGradient
            colors={['#7c3aed', '#4f46e5', '#0ea5e9']}
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          />
          <Text style={styles.ctaText}>Start Networking</Text>
        </TouchableOpacity>

        <Text style={styles.ctaSub}>Sign in to your account to get started</Text>
      </View>

      {sheetOpen && (
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="box-only"
        >
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={closeSheet} />
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.sheet,
          { transform: [{ translateY: sheetTranslate }], paddingBottom: insets.bottom + spacing.lg },
        ]}
        pointerEvents={sheetOpen ? 'box-none' : 'none'}
      >
        <View style={styles.sheetHandle} />

        <TouchableOpacity style={styles.sheetClose} onPress={closeSheet}>
          <Text style={styles.sheetCloseX}>✕</Text>
        </TouchableOpacity>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: spacing.xl }}
        >
          {view === 'phone' && (
            <PhoneView
              phoneDigits={phoneDigits}
              setPhoneDigits={(v) => { setPhoneDigits(v); setPhoneError(''); }}
              phoneError={phoneError}
              phoneLoading={phoneLoading}
              onContinue={handlePhoneContinue}
              onDemoFill={(d) => { setPhoneDigits(d); setPhoneError(''); }}
            />
          )}

          {view === 'otp' && (
            <OtpView
              phone={formatPhone(phoneDigits)}
              otpValue={otpValue}
              setOtpValue={(v) => { setOtpValue(v); setOtpError(''); }}
              otpError={otpError}
              otpLoading={otpLoading}
              resendCountdown={resendCountdown}
              onResend={() => {
                if (resendCountdown > 0) return;
                setOtpValue('');
                setOtpError('');
                handlePhoneContinue();
              }}
              onBack={() => setView('phone')}
            />
          )}

          {view === 'profile-review' && resolvedUser && (
            <ProfileReview user={resolvedUser} onConfirm={handleProfileConfirm} onBack={() => setView('otp')} />
          )}

          {view === 'create-account' && (
            <CreateAccount
              form={createForm}
              setForm={setCreateForm}
              error={createError}
              loading={createLoading}
              onSubmit={handleCreateAccount}
              onBack={() => setView('otp')}
            />
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function PhoneView({
  phoneDigits, setPhoneDigits, phoneError, phoneLoading, onContinue, onDemoFill,
}: {
  phoneDigits: string;
  setPhoneDigits: (v: string) => void;
  phoneError: string;
  phoneLoading: boolean;
  onContinue: () => void;
  onDemoFill: (d: string) => void;
}) {
  return (
    <View style={sheetStyles.section}>
      <View style={sheetStyles.iconBox}>
        <Text style={{ fontSize: 22 }}>📱</Text>
      </View>
      <Text style={sheetStyles.title}>Log in</Text>
      <Text style={sheetStyles.subtitle}>Enter your mobile number to continue</Text>

      <Text style={sheetStyles.fieldLabel}>MOBILE NUMBER</Text>
      <View style={sheetStyles.phoneRow}>
        <View style={sheetStyles.countryCode}>
          <Text style={sheetStyles.flag}>🇺🇸</Text>
          <Text style={sheetStyles.countryNum}>+1</Text>
        </View>
        <TextInput
          style={sheetStyles.phoneInput}
          value={formatPhone(phoneDigits)}
          onChangeText={(t) => setPhoneDigits(cleanPhone(t).slice(0, 10))}
          keyboardType="phone-pad"
          placeholder="(555) 000-0000"
          placeholderTextColor="rgba(255,255,255,0.25)"
          returnKeyType="done"
          onSubmitEditing={onContinue}
        />
      </View>
      {!!phoneError && <Text style={sheetStyles.errorText}>{phoneError}</Text>}

      <TouchableOpacity
        style={[sheetStyles.btn, phoneLoading && sheetStyles.btnDisabled]}
        onPress={onContinue}
        disabled={phoneLoading}
        activeOpacity={0.85}
      >
        {phoneLoading
          ? <ActivityIndicator color="#fff" />
          : <Text style={sheetStyles.btnText}>Send Code →</Text>
        }
      </TouchableOpacity>

      <Text style={[sheetStyles.subtitle, { marginTop: spacing.xl, marginBottom: spacing.sm }]}>
        Demo shortcuts:
      </Text>
      <View style={{ gap: spacing.sm }}>
        {DEMO_PHONES.map(({ label, phone }) => (
          <TouchableOpacity key={phone} style={sheetStyles.demoBtn} onPress={() => onDemoFill(phone)}>
            <Text style={sheetStyles.demoBtnText}>{label} — {formatPhone(phone)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

function OtpView({
  phone, otpValue, setOtpValue, otpError, otpLoading, resendCountdown, onResend, onBack,
}: {
  phone: string;
  otpValue: string;
  setOtpValue: (v: string) => void;
  otpError: string;
  otpLoading: boolean;
  resendCountdown: number;
  onResend: () => void;
  onBack: () => void;
}) {
  return (
    <View style={sheetStyles.section}>
      <TouchableOpacity style={sheetStyles.backBtn} onPress={onBack}>
        <Text style={sheetStyles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <View style={sheetStyles.iconBox}>
        <Text style={{ fontSize: 22 }}>🔐</Text>
      </View>
      <Text style={sheetStyles.title}>Verify Code</Text>
      <Text style={sheetStyles.subtitle}>We sent a 6-digit code to +1 {phone}</Text>
      <Text style={[sheetStyles.subtitle, { color: colors.primary, marginTop: 4 }]}>
        (Demo: use 123456)
      </Text>

      <View style={{ marginVertical: spacing.xl }}>
        <OtpInput value={otpValue} onChange={setOtpValue} hasError={!!otpError} />
      </View>

      {!!otpError && <Text style={[sheetStyles.errorText, { textAlign: 'center' }]}>{otpError}</Text>}
      {otpLoading && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />}

      <TouchableOpacity onPress={onResend} disabled={resendCountdown > 0} style={{ marginTop: spacing.lg }}>
        <Text style={[sheetStyles.subtitle, { textAlign: 'center', color: resendCountdown > 0 ? colors.textMuted : colors.primary }]}>
          {resendCountdown > 0 ? `Resend in ${resendCountdown}s` : 'Resend code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ProfileReview({ user, onConfirm, onBack }: { user: AuthUser; onConfirm: () => void; onBack: () => void }) {
  return (
    <View style={sheetStyles.section}>
      <TouchableOpacity style={sheetStyles.backBtn} onPress={onBack}>
        <Text style={sheetStyles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={sheetStyles.title}>Welcome back!</Text>
      <Text style={sheetStyles.subtitle}>Confirm your profile to continue</Text>

      <View style={sheetStyles.profileCard}>
        <Image
          source={{ uri: user.avatar }}
          style={sheetStyles.profileAvatar}
        />
        <View style={{ flex: 1 }}>
          <Text style={sheetStyles.profileName}>{user.name}</Text>
          <Text style={sheetStyles.profileRole}>{user.title} · {user.company}</Text>
          <View style={[sheetStyles.roleBadge, user.role === 'sponsor' && sheetStyles.roleBadgeSponsor]}>
            <Text style={sheetStyles.roleBadgeText}>
              {user.role === 'sponsor' ? 'Sponsor' : 'Attendee'}
            </Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={sheetStyles.btn} onPress={onConfirm} activeOpacity={0.85}>
        <Text style={sheetStyles.btnText}>This is me — Continue →</Text>
      </TouchableOpacity>
    </View>
  );
}

function CreateAccount({ form, setForm, error, loading, onSubmit, onBack }: {
  form: { name: string; email: string; title: string; company: string };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  error: string;
  loading: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const fields: Array<{ key: keyof typeof form; label: string; placeholder: string; keyboard?: KeyboardTypeOptions }> = [
    { key: 'name', label: 'FULL NAME', placeholder: 'Jane Doe' },
    { key: 'email', label: 'EMAIL', placeholder: 'jane@company.com', keyboard: 'email-address' },
    { key: 'title', label: 'JOB TITLE', placeholder: 'Product Manager' },
    { key: 'company', label: 'COMPANY', placeholder: 'Acme Corp' },
  ];

  return (
    <View style={sheetStyles.section}>
      <TouchableOpacity style={sheetStyles.backBtn} onPress={onBack}>
        <Text style={sheetStyles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={sheetStyles.title}>Create Account</Text>
      <Text style={sheetStyles.subtitle}>Just a few details to get you set up</Text>

      <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
        {fields.map(({ key, label, placeholder, keyboard }) => (
          <View key={key}>
            <Text style={sheetStyles.fieldLabel}>{label}</Text>
            <TextInput
              style={sheetStyles.textInput}
              value={form[key]}
              onChangeText={(t) => setForm((p) => ({ ...p, [key]: t }))}
              placeholder={placeholder}
              placeholderTextColor="rgba(255,255,255,0.25)"
              keyboardType={keyboard}
              returnKeyType="next"
              autoCapitalize={key === 'email' ? 'none' : 'words'}
            />
          </View>
        ))}
      </View>

      {!!error && <Text style={[sheetStyles.errorText, { marginTop: spacing.md }]}>{error}</Text>}

      <TouchableOpacity
        style={[sheetStyles.btn, { marginTop: spacing.xl }, loading && sheetStyles.btnDisabled]}
        onPress={onSubmit}
        disabled={loading}
        activeOpacity={0.85}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={sheetStyles.btnText}>Join the Event →</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
  },
  logo: {
    height: 40,
    width: 120,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34d399',
  },
  liveText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  spacer: { flex: 1 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.5)',
  },
  chipEmoji: { fontSize: 12 },
  chipLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  hero: {
    paddingHorizontal: spacing.xxl,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 38,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 44,
    marginBottom: 10,
  },
  heroGradientText: {
    color: '#c4b5fd',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  ctaButton: {
    height: 56,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  ctaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  ctaSub: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    zIndex: 10,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,10,20,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    zIndex: 20,
    maxHeight: SCREEN_HEIGHT * 0.9,
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
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  sheetCloseX: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '600',
  },
});

const sheetStyles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.lg,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 8,
    marginTop: spacing.lg,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    height: 52,
    paddingLeft: spacing.md,
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.md,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.12)',
    marginRight: spacing.md,
  },
  flag: { fontSize: 18 },
  countryNum: { color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: '600' },
  phoneInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    height: '100%',
  },
  textInput: {
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    color: colors.textPrimary,
    fontSize: 15,
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 6,
  },
  btn: {
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  backBtn: {
    marginBottom: spacing.md,
  },
  backBtnText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  demoBtn: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  demoBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.2)',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  profileRole: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
    marginBottom: 8,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(99,102,241,0.4)',
  },
  roleBadgeSponsor: {
    backgroundColor: 'rgba(236,72,153,0.2)',
    borderColor: 'rgba(236,72,153,0.4)',
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});
