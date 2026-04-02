import { useEffect, useRef, useCallback } from 'react';
import { Animated, StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');
const LOGO_SIZE = Math.min(width * 0.45, 180);

interface Props {
  onFinish: () => void;
}

export function AppSplashScreen({ onFinish }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.75)).current;
  const containerOpacity = useRef(new Animated.Value(1)).current;
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (!finished.current) {
      finished.current = true;
      onFinish();
    }
  }, [onFinish]);

  const runAnimation = useCallback(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.spring(scale, {
          toValue: 1,
          tension: 60,
          friction: 7,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]),
      Animated.delay(1000),
      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => finish());
  }, [opacity, scale, containerOpacity, finish]);

  useEffect(() => {
    runAnimation();
    const fallback = setTimeout(finish, 3000);
    return () => clearTimeout(fallback);
  }, [runAnimation, finish]);

  return (
    <Animated.View style={[styles.container, { opacity: containerOpacity }]}>
      <Animated.Image
        source={require('@/assets/cxo-logo.png')}
        style={[styles.logo, { opacity, transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#07070F',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});
