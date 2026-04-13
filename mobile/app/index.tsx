import { View, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';
import { colors } from '@/constants/theme';

export default function Index() {
  const { user, isLoading } = useAuth();
  const { currentEventId } = useEvent();

  if (isLoading) {
    return <View style={styles.container} />;
  }

  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (currentEventId) {
    return <Redirect href="/(tabs)/feed" />;
  }

  return <Redirect href="/events" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
