import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

export default function JoinRedirect() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    router.replace('/events');
  }, [code]);

  return null;
}
