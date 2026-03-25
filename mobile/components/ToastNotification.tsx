import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/constants/theme';

interface ToastProps {
  message: string;
  points?: number;
}

export function ToastNotification({ message, points }: ToastProps) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18 }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + spacing.md, opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="none"
    >
      {points !== undefined && (
        <View style={styles.pointsBadge}>
          <Text style={styles.pointsText}>+{points}</Text>
        </View>
      )}
      <View style={styles.textBlock}>
        <Text style={styles.message}>{message}</Text>
        {points !== undefined && (
          <Text style={styles.pointsLabel}>Points earned!</Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    zIndex: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: 'rgba(17,17,32,0.97)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  pointsBadge: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  textBlock: { flex: 1 },
  message: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  pointsLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
