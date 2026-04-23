import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius } from '@/constants/theme';

type Mode = 'scan' | 'manual';

interface Props {
  onCodeDetected: (code: string) => void;
  busy?: boolean;
}

function extractBadgeCode(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  // QR may encode either a plain badge code or a JSON envelope created by the
  // mobile My Badge screen: {id, name, badge, role}. Prefer the embedded
  // badge code when present, fall back to the id, otherwise use the raw value.
  if (trimmed.startsWith('{')) {
    try {
      const obj = JSON.parse(trimmed);
      const candidate = obj?.badge ?? obj?.badgeCode ?? obj?.code ?? obj?.id;
      if (candidate && typeof candidate === 'string') return candidate.trim();
    } catch {
      // not JSON — fall through
    }
  }
  return trimmed;
}

export function BadgeCameraScanner({ onCodeDetected, busy }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<Mode>('scan');
  const [manualCode, setManualCode] = useState('');
  const [torchOn, setTorchOn] = useState(false);
  const lockedRef = useRef(false);

  // Torch is a hardware feature only available on native platforms via
  // expo-camera. Hide the toggle on web where it isn't supported.
  const torchSupported = Platform.OS !== 'web';

  // Reset torch when leaving scan mode (manual entry / permission denied) so
  // it never lingers on after the camera is hidden. Unmount is handled by
  // CameraView itself — tearing down the view releases the torch.
  useEffect(() => {
    if (mode !== 'scan') setTorchOn(false);
  }, [mode]);

  // Reset the one-shot lock whenever the parent finishes processing a scan
  // so the next QR can be detected.
  useEffect(() => {
    if (!busy) lockedRef.current = false;
  }, [busy]);

  // Auto-prompt for permission once on first mount in scan mode.
  useEffect(() => {
    if (mode === 'scan' && permission && !permission.granted && permission.canAskAgain) {
      requestPermission();
    }
  }, [mode, permission, requestPermission]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (lockedRef.current || busy) return;
    const code = extractBadgeCode(data);
    if (!code) return;
    lockedRef.current = true;
    onCodeDetected(code);
  };

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code.length < 3 || busy) return;
    onCodeDetected(code.toUpperCase());
  };

  if (mode === 'manual') {
    return (
      <View style={styles.frame}>
        <View style={styles.manualPanel}>
          <View style={styles.manualIcon}>
            <Ionicons name="keypad" size={28} color={colors.primary} />
          </View>
          <Text style={styles.manualTitle}>Enter Badge Code</Text>
          <Text style={styles.manualSub}>Type the code shown on the attendee&apos;s badge.</Text>
          <TextInput
            value={manualCode}
            onChangeText={setManualCode}
            placeholder="e.g. ATT-8492"
            placeholderTextColor="rgba(255,255,255,0.3)"
            autoCapitalize="characters"
            autoCorrect={false}
            style={styles.manualInput}
            editable={!busy}
            onSubmitEditing={handleManualSubmit}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, (manualCode.length < 3 || busy) && styles.primaryBtnDisabled]}
            onPress={handleManualSubmit}
            disabled={manualCode.length < 3 || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Find Attendee</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkBtn} onPress={() => setMode('scan')}>
            <Ionicons name="scan" size={14} color={colors.accent} />
            <Text style={styles.linkText}>Use Camera Instead</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Permission still loading
  if (!permission) {
    return (
      <View style={styles.frame}>
        <View style={styles.statePanel}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateLabel}>Preparing camera…</Text>
        </View>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.frame}>
        <View style={styles.statePanel}>
          <Ionicons name="camera-outline" size={36} color="#fbbf24" />
          <Text style={styles.stateTitle}>Camera access required</Text>
          <Text style={styles.stateSub}>
            {permission.canAskAgain
              ? 'Allow camera access to scan attendee badge QR codes.'
              : `Enable camera access for CXO Events in ${Platform.OS === 'ios' ? 'Settings → Privacy → Camera' : 'Settings → Apps → CXO Events → Permissions'} to scan badges.`}
          </Text>
          <View style={styles.btnRow}>
            {permission.canAskAgain && (
              <TouchableOpacity style={styles.primaryBtn} onPress={requestPermission}>
                <Text style={styles.primaryBtnText}>Grant Access</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setMode('manual')}>
              <Ionicons name="keypad-outline" size={14} color="#fff" />
              <Text style={styles.secondaryBtnText}>Manual Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.frame}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        enableTorch={torchSupported && torchOn}
        onBarcodeScanned={busy ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      />
      {/* Scan overlay */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.qrCorners}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>
        <Text style={styles.hint}>{busy ? 'Looking up attendee…' : 'Align QR code within the frame'}</Text>
      </View>
      <TouchableOpacity style={styles.manualLinkOverlay} onPress={() => setMode('manual')}>
        <Ionicons name="keypad-outline" size={14} color="#fff" />
        <Text style={styles.manualLinkText}>Enter code manually</Text>
      </TouchableOpacity>
      {torchSupported && (
        <TouchableOpacity
          style={[styles.torchBtn, torchOn && styles.torchBtnOn]}
          onPress={() => setTorchOn(v => !v)}
          accessibilityRole="button"
          accessibilityLabel={torchOn ? 'Turn flashlight off' : 'Turn flashlight on'}
        >
          <Ionicons
            name={torchOn ? 'flashlight' : 'flashlight-outline'}
            size={18}
            color={torchOn ? '#0d0d18' : '#fff'}
          />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: '#0d0d18',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    position: 'relative',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  qrCorners: {
    position: 'absolute',
    top: 28,
    left: 28,
    right: 28,
    bottom: 60,
  },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: '#22c55e' },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  manualLinkOverlay: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  manualLinkText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  torchBtn: {
    position: 'absolute',
    top: spacing.md,
    left: spacing.md,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  torchBtnOn: {
    backgroundColor: '#fbbf24',
    borderColor: '#fbbf24',
  },

  statePanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  stateLabel: { color: colors.textSecondary, fontSize: 13 },
  stateTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  stateSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  btnRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },

  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 140,
  },
  primaryBtnDisabled: { opacity: 0.55 },
  primaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  secondaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  manualPanel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  manualIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(124,58,237,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  manualTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  manualSub: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center', marginBottom: spacing.md },
  manualInput: {
    width: '100%',
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: '#fff',
    paddingHorizontal: spacing.md,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    marginBottom: spacing.md,
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 8,
  },
  linkText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
});
