import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/context/AuthContext';
import { EventProvider } from '@/context/EventContext';
import { MessagesProvider } from '@/context/MessagesContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AppSplashScreen } from '@/components/AppSplashScreen';
import { useReconcilePendingLeadsBackground } from '@/hooks/useReconcilePendingLeadsBackground';
import { colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      // staleTime: 0 (default) means data is considered stale the
      // moment it lands. Combined with `useAuthedQuery`'s focus
      // listener, this makes "navigate back to a screen" always pull
      // the latest backend state without forcing the user to sign out
      // and back in. Per-hook overrides still apply if a specific
      // dataset truly is stable for longer.
      staleTime: 0,
      // Force a refetch every time a query consumer mounts. With
      // staleTime: 0 above this is the same effect, but being
      // explicit keeps the behaviour intentional even if a future
      // edit raises staleTime.
      refetchOnMount: 'always',
      refetchOnReconnect: 'always',
    },
    mutations: { retry: 0 },
  },
});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <AuthProvider>
                <EventProvider>
                <MessagesProvider>
                <BackgroundLeadSync />
                <StatusBar style="light" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: colors.bg },
                    animation: 'fade',
                  }}
                >
                  <Stack.Screen name="index" />
                  <Stack.Screen name="(auth)/welcome" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="profile" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="meetings" />
                  <Stack.Screen name="messages" />
                  <Stack.Screen name="leaderboard" />
                  <Stack.Screen name="qr-badge" />
                  <Stack.Screen name="events" options={{ animation: 'fade' }} />
                  <Stack.Screen name="switch-event" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="join" options={{ headerShown: false }} />
                  <Stack.Screen name="event-dashboard" />
                  <Stack.Screen name="lead-detail" options={{ animation: 'slide_from_right' }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                {!splashDone && (
                  <AppSplashScreen onFinish={() => setSplashDone(true)} />
                )}
                </MessagesProvider>
                </EventProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

// Mounted once inside the QueryClientProvider so the background reconciler
// can read/write the shared `['leads']` cache. Renders nothing.
function BackgroundLeadSync() {
  useReconcilePendingLeadsBackground();
  return null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
});
