import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { OtpInput } from './OtpInput';
import { sendOtp, verifyOtp, loginWithPassword } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { colors, radius } from '@/constants/theme';

type Step = 'email' | 'otp';

export function WelcomeScreen() {
  const { login } = useAuth();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devLoading, setDevLoading] = useState(false);

  const handleSendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await sendOtp(trimmed);
      if (res.success) {
        setStep('otp');
        setOtp('');
      } else {
        setError(res.error?.message ?? 'Failed to send code. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    if (code.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const res = await verifyOtp(email.trim().toLowerCase(), code);
      if (res.success && res.data?.token) {
        await login(res.data.token, res.data.user!);
        router.replace('/events');
      } else {
        setError(res.error?.message ?? 'Invalid code. Please try again.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDevLogin = async (devEmail: string, password: string) => {
    setDevLoading(true);
    try {
      const res = await loginWithPassword(devEmail, password);
      if (res.success && res.data) {
        await login(res.data.token, res.data.user);
        router.replace('/events');
      }
    } finally {
      setDevLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#1a0a3e', '#0e0e1f', '#07070F']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoArea}>
            <Image
              source={require('@/assets/cxo-logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.taglineRow}>
              <View style={styles.taglineDot} />
              <Text style={styles.tagline}>Connect · Engage · Innovate</Text>
              <View style={styles.taglineDot} />
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>
                {step === 'email' ? 'Sign in' : 'Enter your code'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {step === 'email'
                  ? 'Use your registered email address to continue'
                  : `We sent a 6-digit code to\n${email}`}
              </Text>
            </View>

            {step === 'email' ? (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Email address</Text>
                <View style={[styles.inputRow, !!error && styles.inputRowError]}>
                  <Ionicons name="mail-outline" size={17} color="rgba(255,255,255,0.35)" />
                  <TextInput
                    style={styles.textInput}
                    placeholder="you@company.com"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    value={email}
                    onChangeText={(t) => { setEmail(t); setError(''); }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    autoCorrect={false}
                    returnKeyType="send"
                    onSubmitEditing={handleSendOtp}
                    autoFocus
                  />
                </View>

                {!!error && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={14} color="#f87171" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleSendOtp}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#7c3aed', '#4f46e5']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.primaryBtnText}>Send Code</Text>
                  }
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>6-digit verification code</Text>
                <OtpInput
                  value={otp}
                  onChange={(code) => {
                    setOtp(code);
                    setError('');
                    if (code.length === 6) handleVerifyOtp(code);
                  }}
                  hasError={!!error}
                />

                {!!error && (
                  <View style={styles.errorRow}>
                    <Ionicons name="alert-circle-outline" size={14} color="#f87171" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.primaryBtn, (loading || otp.length < 6) && styles.btnDisabled]}
                  onPress={() => handleVerifyOtp(otp)}
                  disabled={loading || otp.length < 6}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={['#7c3aed', '#4f46e5']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  />
                  {loading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.primaryBtnText}>Verify</Text>
                  }
                </TouchableOpacity>

                <View style={styles.otpActions}>
                  <TouchableOpacity
                    style={styles.textLink}
                    onPress={() => { setStep('email'); setOtp(''); setError(''); }}
                  >
                    <Ionicons name="arrow-back-outline" size={14} color="rgba(255,255,255,0.4)" />
                    <Text style={styles.textLinkGrey}>Change email</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.textLink}
                    onPress={handleSendOtp}
                    disabled={loading}
                  >
                    <Text style={styles.textLinkPurple}>Resend code</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {__DEV__ && (
            <View style={styles.devSection}>
              <View style={styles.devDivider}>
                <View style={styles.devLine} />
                <Text style={styles.devLabel}>DEV QUICK LOGIN</Text>
                <View style={styles.devLine} />
              </View>
              <TouchableOpacity
                style={styles.devBtn}
                onPress={() => handleDevLogin('testuser@cxoinc.com', 'Test1234!')}
                disabled={devLoading}
                activeOpacity={0.75}
              >
                {devLoading
                  ? <ActivityIndicator color="#a78bfa" size="small" />
                  : (
                    <>
                      <Ionicons name="person-outline" size={14} color="#a78bfa" />
                      <Text style={styles.devBtnText}>Login as Attendee</Text>
                    </>
                  )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.devBtn, styles.devBtnSponsor]}
                onPress={() => handleDevLogin('testsponsor@cxoinc.com', 'Test1234!')}
                disabled={devLoading}
                activeOpacity={0.75}
              >
                {devLoading
                  ? <ActivityIndicator color="#67e8f9" size="small" />
                  : (
                    <>
                      <Ionicons name="briefcase-outline" size={14} color="#67e8f9" />
                      <Text style={[styles.devBtnText, { color: '#67e8f9' }]}>Login as Sponsor</Text>
                    </>
                  )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070F' },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24 },

  logoArea: {
    alignItems: 'center',
    paddingTop: 52,
    paddingBottom: 32,
  },
  logo: { width: 148, height: 60 },
  taglineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  taglineDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(124,58,237,0.5)',
  },
  tagline: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: 0.8,
  },

  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    padding: 24,
    gap: 20,
  },
  cardHeader: { gap: 6 },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 21,
  },

  formGroup: { gap: 14 },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 0.4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.md,
    paddingHorizontal: 14,
  },
  inputRowError: {
    borderColor: 'rgba(248,113,113,0.5)',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 15,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
    flex: 1,
  },

  primaryBtn: {
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  otpActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 4,
  },
  textLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  textLinkGrey: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  textLinkPurple: { color: colors.primary, fontSize: 14, fontWeight: '600' },

  devSection: { marginTop: 32, gap: 10 },
  devDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 2,
  },
  devLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  devLabel: {
    color: 'rgba(255,255,255,0.15)',
    fontSize: 9,
    letterSpacing: 1.2,
    fontWeight: '600',
  },
  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(124,58,237,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.4)',
    borderRadius: 10,
    paddingVertical: 11,
  },
  devBtnSponsor: {
    backgroundColor: 'rgba(6,182,212,0.1)',
    borderColor: 'rgba(6,182,212,0.3)',
  },
  devBtnText: {
    color: '#c4b5fd',
    fontSize: 13,
    fontWeight: '600',
  },
});
