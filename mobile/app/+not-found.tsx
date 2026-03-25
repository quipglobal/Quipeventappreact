import { View, Text, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { colors, spacing } from '@/constants/theme';

export default function NotFound() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>🔍</Text>
      <Text style={styles.title}>Page not found</Text>
      <Link href="/" style={styles.link}>Go home</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
});
