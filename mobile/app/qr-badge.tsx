import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Dimensions,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/context/AuthContext';
import { colors, spacing, radius } from '@/constants/theme';

const { width: SW } = Dimensions.get('window');
const QR_SIZE = Math.min(SW - 80, 260);

const TIER_COLORS: Record<string, string> = {
  Bronze: '#cd7f32',
  Silver: '#c0c0c0',
  Gold: '#ffd700',
  Platinum: '#e5e4e2',
};

export default function QrBadgeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const tierColor = user?.tier ? TIER_COLORS[user.tier] ?? colors.primary : colors.primary;
  const qrData = JSON.stringify({
    id: user?.id ?? 'guest',
    name: user?.name ?? 'Guest',
    event: 'cxo-summit-2026',
    role: user?.role ?? 'attendee',
  });

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Connect with ${user?.name} at CXO Tech Summit 2026!\nBadge ID: ${user?.id}`,
        title: 'My CXO Badge',
      });
    } catch (_) {}
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Badge</Text>
        <TouchableOpacity onPress={handleShare} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="share-outline" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <View style={styles.center}>
        <LinearGradient
          colors={['#1a0d2e', '#0d1a2e', '#0e0e1a']}
          style={[styles.badgeCard, { borderColor: tierColor + '50' }]}
        >
          <View style={styles.badgeHeader}>
            <Text style={styles.eventName}>CXO Tech Summit 2026</Text>
            <View style={[styles.tierBadge, { backgroundColor: tierColor + '20', borderColor: tierColor + '60' }]}>
              <Text style={[styles.tierBadgeText, { color: tierColor }]}>{user?.tier ?? 'Bronze'}</Text>
            </View>
          </View>

          <View style={[styles.avatarRing, { borderColor: tierColor }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarInitial}>{user?.name?.[0] ?? '?'}</Text>
            </View>
          </View>

          <Text style={styles.badgeName}>{user?.name ?? 'Guest'}</Text>
          {user?.title && <Text style={styles.badgeTitle}>{user.title}</Text>}
          {user?.company && <Text style={styles.badgeCompany}>{user.company}</Text>}

          <View style={styles.rolePill}>
            <Ionicons name={user?.role === 'sponsor' ? 'briefcase' : 'people'} size={12} color={colors.primary} />
            <Text style={styles.roleText}>{user?.role === 'sponsor' ? 'SPONSOR' : 'ATTENDEE'}</Text>
          </View>

          <View style={styles.qrContainer}>
            <QRCode
              value={qrData}
              size={QR_SIZE}
              color="#ffffff"
              backgroundColor="transparent"
              quietZone={12}
            />
          </View>

          <Text style={styles.scanHint}>Scan to connect · Jan 16–18, 2026</Text>

          <View style={styles.badgeFooter}>
            <Text style={styles.badgeId}>ID: {(user?.id ?? 'guest').slice(0, 16)}</Text>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  badgeCard: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    padding: spacing.xl,
    overflow: 'hidden',
  },
  badgeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: '100%', marginBottom: spacing.xl },
  eventName: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  tierBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  tierBadgeText: { fontSize: 11, fontWeight: '800' },

  avatarRing: { width: 80, height: 80, borderRadius: 40, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(124,58,237,0.3)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 26, fontWeight: '800' },

  badgeName: { color: colors.textPrimary, fontSize: 22, fontWeight: '800', marginBottom: 4 },
  badgeTitle: { color: colors.textSecondary, fontSize: 13, marginBottom: 2 },
  badgeCompany: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },

  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: radius.full, backgroundColor: 'rgba(124,58,237,0.15)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', marginBottom: spacing.xl },
  roleText: { color: colors.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1 },

  qrContainer: { padding: 16, borderRadius: 16, backgroundColor: '#1a1a2e', marginBottom: spacing.lg },
  scanHint: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.md },
  badgeFooter: {},
  badgeId: { color: colors.textMuted, fontSize: 10, fontFamily: 'monospace' },
});
