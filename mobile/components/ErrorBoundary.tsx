import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { reloadAppAsync } from 'expo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, radius } from '@/constants/theme';

interface State { hasError: boolean; error?: Error }

function ErrorFallback({ error, onReload }: { error?: Error; onReload: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xxl }]}>
      <Text style={styles.emoji}>⚠️</Text>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.message}>{error?.message ?? 'An unexpected error occurred.'}</Text>
      <TouchableOpacity style={styles.btn} onPress={onReload}>
        <Text style={styles.btnText}>Restart App</Text>
      </TouchableOpacity>
    </View>
  );
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReload={() => reloadAppAsync()}
        />
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emoji: { fontSize: 48, marginBottom: spacing.lg },
  title: { color: colors.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: spacing.md, textAlign: 'center' },
  message: { color: colors.textSecondary, fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: spacing.xxl },
  btn: { paddingHorizontal: spacing.xxl, paddingVertical: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.primary },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
