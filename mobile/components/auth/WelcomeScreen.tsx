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
  Modal,
  Keyboard,
  KeyboardTypeOptions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OtpInput } from './OtpInput';
import { sendOtp, verifyOtp, register, loginWithPassword, AuthUser, USE_MOCK_AUTH } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius, typography } from '@/constants/theme';
import {
  fetchGlobalVideoFeeds,
  fetchGlobalArticles,
  fetchVideoCategories,
  fetchArticleCategories,
  GlobalVideoFeed,
  GlobalArticle,
  Category,
} from '@/lib/api/globalFeeds';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const SHEET_HEIGHT = Math.min(SCREEN_HEIGHT * 0.75, 600);

type View_ = 'phone' | 'otp' | 'profile-review' | 'create-account';
type LoginMode = 'phone' | 'email';
type TopTab = 'feeds' | 'events' | null;
type FeedSubTab = 'podcast' | 'articles';

interface Country {
  flag: string;
  dialCode: string;
  name: string;
  localDigits: number;
}

const COUNTRIES: Country[] = [
  { flag: '🇺🇸', dialCode: '+1', name: 'United States', localDigits: 10 },
  { flag: '🇨🇦', dialCode: '+1', name: 'Canada', localDigits: 10 },
  { flag: '🇬🇧', dialCode: '+44', name: 'United Kingdom', localDigits: 10 },
  { flag: '🇮🇳', dialCode: '+91', name: 'India', localDigits: 10 },
  { flag: '🇦🇺', dialCode: '+61', name: 'Australia', localDigits: 9 },
  { flag: '🇦🇪', dialCode: '+971', name: 'UAE', localDigits: 9 },
  { flag: '🇸🇦', dialCode: '+966', name: 'Saudi Arabia', localDigits: 9 },
  { flag: '🇸🇬', dialCode: '+65', name: 'Singapore', localDigits: 8 },
  { flag: '🇩🇪', dialCode: '+49', name: 'Germany', localDigits: 11 },
  { flag: '🇫🇷', dialCode: '+33', name: 'France', localDigits: 9 },
  { flag: '🇯🇵', dialCode: '+81', name: 'Japan', localDigits: 11 },
  { flag: '🇨🇳', dialCode: '+86', name: 'China', localDigits: 11 },
  { flag: '🇧🇷', dialCode: '+55', name: 'Brazil', localDigits: 11 },
  { flag: '🇲🇽', dialCode: '+52', name: 'Mexico', localDigits: 10 },
  { flag: '🇰🇷', dialCode: '+82', name: 'South Korea', localDigits: 10 },
  { flag: '🇮🇹', dialCode: '+39', name: 'Italy', localDigits: 10 },
  { flag: '🇪🇸', dialCode: '+34', name: 'Spain', localDigits: 9 },
  { flag: '🇳🇱', dialCode: '+31', name: 'Netherlands', localDigits: 9 },
  { flag: '🇨🇭', dialCode: '+41', name: 'Switzerland', localDigits: 9 },
  { flag: '🇸🇪', dialCode: '+46', name: 'Sweden', localDigits: 9 },
  { flag: '🇳🇴', dialCode: '+47', name: 'Norway', localDigits: 8 },
  { flag: '🇩🇰', dialCode: '+45', name: 'Denmark', localDigits: 8 },
  { flag: '🇫🇮', dialCode: '+358', name: 'Finland', localDigits: 9 },
  { flag: '🇲🇾', dialCode: '+60', name: 'Malaysia', localDigits: 10 },
  { flag: '🇮🇩', dialCode: '+62', name: 'Indonesia', localDigits: 12 },
  { flag: '🇳🇿', dialCode: '+64', name: 'New Zealand', localDigits: 9 },
  { flag: '🇿🇦', dialCode: '+27', name: 'South Africa', localDigits: 9 },
  { flag: '🇳🇬', dialCode: '+234', name: 'Nigeria', localDigits: 10 },
  { flag: '🇪🇬', dialCode: '+20', name: 'Egypt', localDigits: 10 },
  { flag: '🇵🇰', dialCode: '+92', name: 'Pakistan', localDigits: 10 },
  { flag: '🇧🇩', dialCode: '+880', name: 'Bangladesh', localDigits: 10 },
  { flag: '🇷🇺', dialCode: '+7', name: 'Russia', localDigits: 10 },
  { flag: '🇹🇷', dialCode: '+90', name: 'Turkey', localDigits: 10 },
  { flag: '🇵🇱', dialCode: '+48', name: 'Poland', localDigits: 9 },
  { flag: '🇧🇪', dialCode: '+32', name: 'Belgium', localDigits: 9 },
  { flag: '🇦🇹', dialCode: '+43', name: 'Austria', localDigits: 10 },
  { flag: '🇵🇹', dialCode: '+351', name: 'Portugal', localDigits: 9 },
  { flag: '🇬🇷', dialCode: '+30', name: 'Greece', localDigits: 10 },
  { flag: '🇮🇪', dialCode: '+353', name: 'Ireland', localDigits: 9 },
  { flag: '🇵🇭', dialCode: '+63', name: 'Philippines', localDigits: 10 },
  { flag: '🇹🇭', dialCode: '+66', name: 'Thailand', localDigits: 9 },
  { flag: '🇻🇳', dialCode: '+84', name: 'Vietnam', localDigits: 9 },
  { flag: '🇹🇼', dialCode: '+886', name: 'Taiwan', localDigits: 9 },
  { flag: '🇭🇰', dialCode: '+852', name: 'Hong Kong', localDigits: 8 },
  { flag: '🇮🇱', dialCode: '+972', name: 'Israel', localDigits: 9 },
  { flag: '🇦🇷', dialCode: '+54', name: 'Argentina', localDigits: 10 },
  { flag: '🇨🇱', dialCode: '+56', name: 'Chile', localDigits: 9 },
  { flag: '🇨🇴', dialCode: '+57', name: 'Colombia', localDigits: 10 },
  { flag: '🇵🇪', dialCode: '+51', name: 'Peru', localDigits: 9 },
  { flag: '🇶🇦', dialCode: '+974', name: 'Qatar', localDigits: 8 },
  { flag: '🇰🇼', dialCode: '+965', name: 'Kuwait', localDigits: 8 },
  { flag: '🇧🇭', dialCode: '+973', name: 'Bahrain', localDigits: 8 },
  { flag: '🇴🇲', dialCode: '+968', name: 'Oman', localDigits: 8 },
  { flag: '🇯🇴', dialCode: '+962', name: 'Jordan', localDigits: 9 },
  { flag: '🇱🇧', dialCode: '+961', name: 'Lebanon', localDigits: 8 },
];

const DEFAULT_COUNTRY = COUNTRIES[0]; // United States

const cleanPhone = (raw: string) => raw.replace(/\D/g, '');

const formatUsPhone = (digits: string) => {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};

const formatPhone = (country: Country, digits: string) => {
  if (country.dialCode === '+1') return formatUsPhone(digits);
  return digits;
};

const buildIdentifier = (country: Country, digits: string): string => {
  return `${country.dialCode}${digits}`;
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
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const [sheetOpen, setSheetOpen] = useState(false);

  const [view, setView] = useState<View_>('phone');
  const [loginMode, setLoginMode] = useState<LoginMode>('email');
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phoneDigits, setPhoneDigits] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [phoneIdentifier, setPhoneIdentifier] = useState('');
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
  const [devLoading, setDevLoading] = useState(false);

  const handleDevLogin = useCallback(async (email: string, password: string) => {
    setDevLoading(true);
    try {
      const res = await loginWithPassword(email, password);
      if (!res.success || !res.data) {
        console.warn('[DevLogin] failed:', res.error);
        return;
      }
      await login(res.data.token, res.data.user);
      router.replace('/events');
    } catch (e) {
      console.warn('[DevLogin] error:', e);
    } finally {
      setDevLoading(false);
    }
  }, [login]);

  const [activeTab, setActiveTab] = useState<TopTab>(null);
  const [feedSubTab, setFeedSubTab] = useState<FeedSubTab>('podcast');

  const [videos, setVideos] = useState<GlobalVideoFeed[]>([]);
  const [articles, setArticles] = useState<GlobalArticle[]>([]);
  const [videoCats, setVideoCats] = useState<Category[]>([]);
  const [articleCats, setArticleCats] = useState<Category[]>([]);
  const [selectedVideoCat, setSelectedVideoCat] = useState<string | null>(null);
  const [selectedArticleCat, setSelectedArticleCat] = useState<string | null>(null);
  const [feedsLoading, setFeedsLoading] = useState(false);

  useEffect(() => {
    if (activeTab === 'feeds') {
      loadFeeds();
    }
  }, [activeTab, feedSubTab, selectedVideoCat, selectedArticleCat]);

  const loadFeeds = async () => {
    setFeedsLoading(true);
    try {
      if (feedSubTab === 'podcast') {
        const [vRes, cRes] = await Promise.all([
          fetchGlobalVideoFeeds({ category: selectedVideoCat || undefined }),
          videoCats.length ? Promise.resolve(null) : fetchVideoCategories(),
        ]);
        if (vRes.success && vRes.data) setVideos(vRes.data.data);
        if (cRes?.success && cRes.data) setVideoCats(cRes.data);
      } else {
        const [aRes, cRes] = await Promise.all([
          fetchGlobalArticles({ category: selectedArticleCat || undefined }),
          articleCats.length ? Promise.resolve(null) : fetchArticleCategories(),
        ]);
        if (aRes.success && aRes.data) setArticles(aRes.data.data);
        if (cRes?.success && cRes.data) setArticleCats(cRes.data);
      }
    } catch (e) {
      console.warn('Failed to load feeds', e);
    } finally {
      setFeedsLoading(false);
    }
  };

  const openSheet = () => {
    setActiveTab('events');
    setSheetOpen(true);
    Animated.spring(sheetAnim, { toValue: 1, useNativeDriver: true, damping: 20, stiffness: 180 }).start();
  };

  const closeSheet = () => {
    Keyboard.dismiss();
    Animated.timing(sheetAnim, { toValue: 0, duration: 280, useNativeDriver: true }).start(() => {
      setSheetOpen(false);
      setActiveTab(null);
      setView('phone');
      setLoginMode('email');
      setPhoneDigits('');
      setEmailInput('');
      setPhoneIdentifier('');
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
    const email = emailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setPhoneError('Please enter a valid email address.');
      return;
    }
    const identifier = email;
    setPhoneError('');
    setPhoneLoading(true);
    try {
      const res = await sendOtp(identifier);
      if (!res.success) { setPhoneError(res.error?.message ?? 'Failed to send code.'); return; }
      setPhoneIdentifier(identifier);
      Keyboard.dismiss();
      if (!res.data?.otpSent) {
        // Email not found — route to registration form instead of dead-end error
        setCreateForm((p) => ({ ...p, email: identifier }));
        setView('create-account');
        return;
      }
      setOtpValue('');
      setOtpError('');
      setView('otp');
      startResendCountdown();
    } catch {
      setPhoneError('Something went wrong. Please try again.');
    } finally {
      setPhoneLoading(false);
    }
  }, [emailInput, startResendCountdown]);

  useEffect(() => {
    // On Android the window uses adjustResize (see AndroidManifest), so the
    // OS already lifts the bottom-anchored sheet above the keyboard — adding
    // our own translate there would double-adjust. iOS never resizes for the
    // keyboard, so the sheet must be lifted manually to keep inputs visible.
    if (Platform.OS !== 'ios') return;
    const showSub = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(keyboardOffset, {
        toValue: -e.endCoordinates.height,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration || 250,
        useNativeDriver: true,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [keyboardOffset]);

  useEffect(() => {
    if (otpValue.length === 6 && view === 'otp') {
      handleVerifyOtp();
    }
  }, [otpValue]);

  const handleVerifyOtp = useCallback(async () => {
    setOtpLoading(true);
    try {
      const res = await verifyOtp(phoneIdentifier, otpValue);
      if (!res.success || !res.data) { setOtpError(res.error?.message ?? 'Incorrect code. Please try again.'); return; }
      const data = res.data;
      if (!data.isNewUser && data.user) {
        setResolvedUser(data.user);
        setResolvedToken(data.token);
        setView('profile-review');
      } else {
        setCreateForm((p) => ({ ...p, email: p.email || phoneIdentifier }));
        setView('create-account');
      }
    } catch {
      setOtpError('Something went wrong. Please try again.');
    } finally {
      setOtpLoading(false);
    }
  }, [phoneIdentifier, otpValue]);

  const handleProfileConfirm = async () => {
    if (!resolvedUser) return;
    await login(resolvedToken, resolvedUser);
    router.replace('/events');
  };

  const handleCreateAccount = useCallback(async () => {
    if (!createForm.name.trim() || !createForm.email.trim()) {
      setCreateError('Name and email are required.');
      return;
    }
    setCreateError('');
    setCreateLoading(true);
    try {
      const res = await register({ phone: '', ...createForm });
      if (!res.success || !res.data) { setCreateError(res.error?.message ?? 'Registration failed.'); return; }
      await login(res.data.token, res.data.user);
      router.replace('/events');
    } catch {
      setCreateError('Something went wrong. Please try again.');
    } finally {
      setCreateLoading(false);
    }
  }, [createForm, phoneIdentifier, login]);

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

      {activeTab === 'feeds' ? (
        <View style={styles.feedsContainer}>
          <View style={styles.subTabs}>
            <TouchableOpacity
              style={[styles.subTab, feedSubTab === 'podcast' && styles.subTabActive]}
              onPress={() => setFeedSubTab('podcast')}
            >
              <Text style={[styles.subTabText, feedSubTab === 'podcast' && styles.subTabTextActive]}>Podcast</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.subTab, feedSubTab === 'articles' && styles.subTabActive]}
              onPress={() => setFeedSubTab('articles')}
            >
              <Text style={[styles.subTabText, feedSubTab === 'articles' && styles.subTabTextActive]}>Articles</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
              <TouchableOpacity
                style={[styles.filterChip, (feedSubTab === 'podcast' ? !selectedVideoCat : !selectedArticleCat) && styles.filterChipActive]}
                onPress={() => feedSubTab === 'podcast' ? setSelectedVideoCat(null) : setSelectedArticleCat(null)}
              >
                <Text style={[styles.filterChipText, (feedSubTab === 'podcast' ? !selectedVideoCat : !selectedArticleCat) && styles.filterChipTextActive]}>All</Text>
              </TouchableOpacity>
              {(feedSubTab === 'podcast' ? videoCats : articleCats).map(cat => (
                <TouchableOpacity
                  key={cat.id}
                  style={[styles.filterChip, (feedSubTab === 'podcast' ? selectedVideoCat === cat.slug : selectedArticleCat === cat.slug) && styles.filterChipActive]}
                  onPress={() => feedSubTab === 'podcast' ? setSelectedVideoCat(cat.slug) : setSelectedArticleCat(cat.slug)}
                >
                  <Text style={[styles.filterChipText, (feedSubTab === 'podcast' ? selectedVideoCat === cat.slug : selectedArticleCat === cat.slug) && styles.filterChipTextActive]}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {feedsLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={(feedSubTab === 'podcast' ? videos : articles) as any[]}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.feedList}
              renderItem={({ item }) => (
                <View style={styles.feedCard}>
                  <Image source={{ uri: item.thumbnail }} style={styles.cardThumb} />
                  <View style={styles.cardContent}>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardCategory}>
                        <Text style={styles.cardCategoryText}>{item.category}</Text>
                      </View>
                      {item.duration && (
                        <Text style={styles.cardDuration}>{item.duration}</Text>
                      )}
                      {item.read_time && (
                        <Text style={styles.cardDuration}>{String(item.read_time)}</Text>
                      )}
                    </View>
                    <Text style={styles.cardTitle} numberOfLines={2}>{String(item.title)}</Text>
                    {item.excerpt && (
                      <Text style={styles.cardExcerpt} numberOfLines={2}>{String(item.excerpt)}</Text>
                    )}
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>No content found.</Text>
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

            {__DEV__ && (
              <View style={{ marginTop: spacing.lg, gap: spacing.xs }}>
                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textAlign: 'center', marginBottom: 4 }}>
                  DEV ONLY — Quick Login
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(124,58,237,0.25)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.5)', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center' }}
                  onPress={() => handleDevLogin('testuser@cxoinc.com', 'Test1234!')}
                  disabled={devLoading}
                  activeOpacity={0.75}
                >
                  {devLoading ? (
                    <ActivityIndicator color="#7c3aed" size="small" />
                  ) : (
                    <Text style={{ color: '#a78bfa', fontSize: 12, fontWeight: '600' }}>
                      Login as Attendee (testuser@cxoinc.com)
                    </Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={{ backgroundColor: 'rgba(6,182,212,0.15)', borderWidth: 1, borderColor: 'rgba(6,182,212,0.4)', borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 20, alignItems: 'center' }}
                  onPress={() => handleDevLogin('testsponsor@cxoinc.com', 'Test1234!')}
                  disabled={devLoading}
                  activeOpacity={0.75}
                >
                  {devLoading ? (
                    <ActivityIndicator color="#06b6d4" size="small" />
                  ) : (
                    <Text style={{ color: '#67e8f9', fontSize: 12, fontWeight: '600' }}>
                      Login as Sponsor (testsponsor@cxoinc.com)
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        </>
      )}

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
          { transform: [{ translateY: sheetTranslate }, { translateY: keyboardOffset }], paddingBottom: insets.bottom + spacing.lg },
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
              loginMode={loginMode}
              onSetLoginMode={(m) => { setLoginMode(m); setPhoneDigits(''); setEmailInput(''); setPhoneError(''); }}
              country={country}
              onOpenPicker={() => setPickerOpen(true)}
              phoneDigits={phoneDigits}
              setPhoneDigits={(v) => { setPhoneDigits(v); setPhoneError(''); }}
              emailInput={emailInput}
              setEmailInput={(v) => { setEmailInput(v); setPhoneError(''); }}
              phoneError={phoneError}
              phoneLoading={phoneLoading}
              onContinue={handlePhoneContinue}
              onDemoFill={(d) => { setPhoneDigits(d); setPhoneError(''); }}
              onDevLogin={handleDevLogin}
              devLoading={devLoading}
            />
          )}

          {view === 'otp' && (
            <OtpView
              displayPhone={loginMode === 'email' ? emailInput.trim() : `${country.dialCode} ${formatPhone(country, phoneDigits)}`}
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

      <CountryPickerModal
        visible={pickerOpen}
        selected={country}
        onSelect={(c) => { setCountry(c); setPhoneDigits(''); setPickerOpen(false); }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

function CountryPickerModal({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean;
  selected: Country;
  onSelect: (c: Country) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState('');
  const insets = useSafeAreaInsets();

  const filtered = search.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.dialCode.includes(search)
      )
    : COUNTRIES;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={pickerStyles.container}>
        <View style={[pickerStyles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={pickerStyles.title}>Select Country</Text>
          <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
            <Text style={pickerStyles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>

        <View style={pickerStyles.searchRow}>
          <Text style={pickerStyles.searchIcon}>🔍</Text>
          <TextInput
            style={pickerStyles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search country or code…"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => `${item.dialCode}-${item.name}`}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[pickerStyles.row, item.name === selected.name && pickerStyles.rowSelected]}
              onPress={() => { setSearch(''); onSelect(item); }}
              activeOpacity={0.7}
            >
              <Text style={pickerStyles.rowFlag}>{item.flag}</Text>
              <Text style={pickerStyles.rowName}>{item.name}</Text>
              <Text style={pickerStyles.rowCode}>{item.dialCode}</Text>
              {item.name === selected.name && (
                <Text style={pickerStyles.rowCheck}>✓</Text>
              )}
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={pickerStyles.separator} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        />
      </View>
    </Modal>
  );
}

function PhoneView({
  loginMode, onSetLoginMode, country, onOpenPicker, phoneDigits, setPhoneDigits,
  emailInput, setEmailInput, phoneError, phoneLoading, onContinue, onDemoFill,
  onDevLogin, devLoading,
}: {
  loginMode: LoginMode;
  onSetLoginMode: (m: LoginMode) => void;
  country: Country;
  onOpenPicker: () => void;
  phoneDigits: string;
  setPhoneDigits: (v: string) => void;
  emailInput: string;
  setEmailInput: (v: string) => void;
  phoneError: string;
  phoneLoading: boolean;
  onContinue: () => void;
  onDemoFill: (d: string) => void;
  onDevLogin: (e: string, p: string) => void;
  devLoading: boolean;
}) {
  return (
    <View style={sheetStyles.section}>
      <View style={sheetStyles.iconBox}>
        <Text style={{ fontSize: 24 }}>👋</Text>
      </View>
      <Text style={sheetStyles.title}>Welcome back</Text>
      <Text style={sheetStyles.subtitle}>Enter your details to join the event community.</Text>

      <View style={sheetStyles.modeToggle}>
        <TouchableOpacity
          style={[sheetStyles.modeTab, loginMode === 'email' && sheetStyles.modeTabActive]}
          onPress={() => onSetLoginMode('email')}
        >
          <Text style={[sheetStyles.modeTabText, loginMode === 'email' && sheetStyles.modeTabTextActive]}>Email</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[sheetStyles.modeTab, loginMode === 'phone' && sheetStyles.modeTabActive]}
          onPress={() => onSetLoginMode('phone')}
        >
          <Text style={[sheetStyles.modeTabText, loginMode === 'phone' && sheetStyles.modeTabTextActive]}>Phone</Text>
        </TouchableOpacity>
      </View>

      <Text style={sheetStyles.fieldLabel}>{loginMode === 'email' ? 'EMAIL ADDRESS' : 'PHONE NUMBER'}</Text>

      {loginMode === 'email' ? (
        <TextInput
          style={sheetStyles.textInput}
          value={emailInput}
          onChangeText={setEmailInput}
          placeholder="name@company.com"
          placeholderTextColor="rgba(255,255,255,0.2)"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
      ) : (
        <View style={sheetStyles.phoneRow}>
          <TouchableOpacity style={sheetStyles.countryCode} onPress={onOpenPicker}>
            <Text style={sheetStyles.flag}>{country.flag}</Text>
            <Text style={sheetStyles.countryNum}>{country.dialCode}</Text>
            <Text style={sheetStyles.countryChevron}>▼</Text>
          </TouchableOpacity>
          <TextInput
            style={sheetStyles.phoneInput}
            value={formatPhone(country, phoneDigits)}
            onChangeText={(v) => setPhoneDigits(cleanPhone(v))}
            placeholder="000 000 0000"
            placeholderTextColor="rgba(255,255,255,0.2)"
            keyboardType="phone-pad"
            maxLength={16}
          />
        </View>
      )}

      {!!phoneError && <Text style={sheetStyles.errorText}>{phoneError}</Text>}

      <TouchableOpacity
        style={[sheetStyles.btn, phoneLoading && sheetStyles.btnDisabled]}
        onPress={onContinue}
        disabled={phoneLoading}
      >
        {phoneLoading ? <ActivityIndicator color="#fff" /> : <Text style={sheetStyles.btnText}>Continue</Text>}
      </TouchableOpacity>

      {USE_MOCK_AUTH && (
        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10, textAlign: 'center' }}>DEMO ACCOUNTS (TAP TO FILL)</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, justifyContent: 'center' }}>
            {DEMO_PHONES.map((d) => (
              <TouchableOpacity key={d.label} style={sheetStyles.demoBtn} onPress={() => onDemoFill(d.phone)}>
                <Text style={sheetStyles.demoBtnText}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function OtpView({
  displayPhone, otpValue, setOtpValue, otpError, otpLoading, resendCountdown, onResend, onBack,
}: {
  displayPhone: string;
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
      <Text style={sheetStyles.title}>Verify it's you</Text>
      <Text style={sheetStyles.subtitle}>
        Enter the 6-digit code sent to{'\n'}
        <Text style={{ color: colors.textPrimary, fontWeight: '600' }}>{displayPhone}</Text>
      </Text>

      <View style={{ marginTop: spacing.xl }}>
        <OtpInput value={otpValue} onChange={setOtpValue} hasError={!!otpError} />
      </View>

      {!!otpError && <Text style={[sheetStyles.errorText, { textAlign: 'center' }]}>{otpError}</Text>}

      <TouchableOpacity
        style={[sheetStyles.btn, (otpValue.length < 6 || otpLoading) && sheetStyles.btnDisabled]}
        disabled={otpValue.length < 6 || otpLoading}
      >
        {otpLoading ? <ActivityIndicator color="#fff" /> : <Text style={sheetStyles.btnText}>Verify Code</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={{ marginTop: spacing.lg, alignSelf: 'center' }} onPress={onResend} disabled={resendCountdown > 0}>
        <Text style={{ color: resendCountdown > 0 ? colors.textMuted : colors.primary, fontSize: 13, fontWeight: '600' }}>
          {resendCountdown > 0 ? `Resend code in ${resendCountdown}s` : 'Resend code'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

function ProfileReview({ user, onConfirm, onBack }: { user: AuthUser, onConfirm: () => void, onBack: () => void }) {
  return (
    <View style={sheetStyles.section}>
      <TouchableOpacity style={sheetStyles.backBtn} onPress={onBack}>
        <Text style={sheetStyles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={sheetStyles.title}>Account Found</Text>
      <Text style={sheetStyles.subtitle}>Is this you? Confirm to continue to the events list.</Text>

      <View style={sheetStyles.profileCard}>
        <Image source={{ uri: user.avatar }} style={sheetStyles.profileAvatar} />
        <View style={sheetStyles.profileInfo}>
          <Text style={sheetStyles.profileName}>{user.name}</Text>
          <Text style={sheetStyles.profileRole}>{user.title} at {user.company}</Text>
          <View style={[sheetStyles.roleBadge, user.role === 'sponsor' && sheetStyles.roleBadgeSponsor]}>
            <Text style={sheetStyles.roleBadgeText}>{user.role.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={sheetStyles.btn} onPress={onConfirm}>
        <Text style={sheetStyles.btnText}>Yes, that's me</Text>
      </TouchableOpacity>
    </View>
  );
}

function CreateAccount({
  form, setForm, error, loading, onSubmit, onBack,
}: {
  form: { name: string; email: string; title: string; company: string };
  setForm: React.Dispatch<React.SetStateAction<{ name: string; email: string; title: string; company: string }>>;
  error: string;
  loading: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <View style={sheetStyles.section}>
      <TouchableOpacity style={sheetStyles.backBtn} onPress={onBack}>
        <Text style={sheetStyles.backBtnText}>← Back</Text>
      </TouchableOpacity>
      <Text style={sheetStyles.title}>Create Account</Text>
      <Text style={sheetStyles.subtitle}>Join our community to access events and features.</Text>

      <View style={{ gap: spacing.lg, marginTop: spacing.xl }}>
        <View>
          <Text style={sheetStyles.fieldLabel}>FULL NAME</Text>
          <TextInput
            style={sheetStyles.textInput}
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            placeholder="John Doe"
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
        </View>
        <View>
          <Text style={sheetStyles.fieldLabel}>JOB TITLE</Text>
          <TextInput
            style={sheetStyles.textInput}
            value={form.title}
            onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
            placeholder="Chief Executive Officer"
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
        </View>
        <View>
          <Text style={sheetStyles.fieldLabel}>COMPANY</Text>
          <TextInput
            style={sheetStyles.textInput}
            value={form.company}
            onChangeText={(v) => setForm((p) => ({ ...p, company: v }))}
            placeholder="Acme Inc."
            placeholderTextColor="rgba(255,255,255,0.2)"
          />
        </View>
      </View>

      {!!error && <Text style={sheetStyles.errorText}>{error}</Text>}

      <TouchableOpacity
        style={[sheetStyles.btn, loading && sheetStyles.btnDisabled]}
        onPress={onSubmit}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={sheetStyles.btnText}>Create & Continue</Text>}
      </TouchableOpacity>
    </View>
  );
}

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
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  countryCode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255,255,255,0.1)',
    minWidth: 80,
  },
  flag: {
    fontSize: 18,
  },
  countryNum: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  countryChevron: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    marginLeft: 2,
  },
  phoneInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  errorText: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 6,
  },
  btn: {
    height: 52,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  demoBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  demoBtnText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  backBtn: {
    marginBottom: spacing.md,
  },
  backBtnText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    color: colors.textPrimary,
    fontSize: 15,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginTop: spacing.lg,
    padding: 3,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modeTabActive: {
    backgroundColor: colors.primary,
  },
  modeTabText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
  },
  modeTabTextActive: {
    color: '#fff',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    padding: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(124,58,237,0.3)',
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  profileRole: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 6,
  },
  profileInfo: {
    flex: 1,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(124,58,237,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.5)',
  },
  roleBadgeSponsor: {
    backgroundColor: 'rgba(6,182,212,0.2)',
    borderColor: 'rgba(6,182,212,0.5)',
  },
  roleBadgeText: {
    color: colors.textPrimary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

const pickerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    margin: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
  },
  rowSelected: {
    backgroundColor: 'rgba(124,58,237,0.12)',
  },
  rowFlag: {
    fontSize: 22,
    width: 30,
    textAlign: 'center',
  },
  rowName: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  rowCode: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 48,
    textAlign: 'right',
  },
  rowCheck: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 4,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    zIndex: 10,
  },
  logo: {
    height: 32,
    width: 100,
  },
  topTabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.full,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  topTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  topTabActive: {
    backgroundColor: colors.primary,
  },
  topTabText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '700',
  },
  topTabTextActive: {
    color: '#fff',
  },
  feedsContainer: {
    flex: 1,
  },
  subTabs: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  subTab: {
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  subTabActive: {
    borderBottomColor: colors.primary,
  },
  subTabText: {
    color: colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: colors.primary,
  },
  filterContainer: {
    marginBottom: spacing.md,
  },
  filterScroll: {
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  feedList: {
    paddingHorizontal: spacing.xl,
    paddingBottom: 100,
  },
  feedCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardThumb: {
    width: '100%',
    height: 180,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cardContent: {
    padding: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardCategory: {
    backgroundColor: 'rgba(124,58,237,0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
  },
  cardCategoryText: {
    color: colors.primaryLight,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cardDuration: {
    color: colors.textMuted,
    fontSize: 11,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 6,
  },
  cardExcerpt: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxxl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
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
