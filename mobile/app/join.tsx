import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';

export default function JoinRedirect() {
  const { code } = useLocalSearchParams<{ code?: string }>();

  useEffect(() => {
    router.replace({ pathname: '/switch-event', params: { code: code ?? '' } });
  }, [code]);

  return null;
}
