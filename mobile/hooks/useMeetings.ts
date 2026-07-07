import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { listMeetings, sendMeetingRequest, respondToMeeting } from '@/lib/api/meetings';
import type { SendMeetingRequest } from '@/lib/api/meetings';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { useAuth } from '@/context/AuthContext';
import { useEvent } from '@/context/EventContext';

export function useMeetings() {
  // Auth-gated by `useAuthedQuery` — the wrapper AND-merges its
  // `enabled` flag with `!!token && !!user?.id`, and React Query pauses
  // `refetchInterval` whenever the query is disabled. So both the
  // initial fetch and the 30s poll automatically stop after sign-out
  // and resume after sign-in, without each caller having to remember
  // to wire the gate by hand.
  //
  // Foreground-gated by an `AppState` listener — pause the 30s poll
  // whenever the app is backgrounded so a user who leaves the app open
  // with the Meetings tab mounted doesn't keep firing `GET /meetings`
  // every 30s from the background, burning mobile data / battery for
  // results they aren't looking at. We pass `enabled: appActive` to
  // `useAuthedQuery`, which ANDs it with the auth gate; React Query
  // tears the `refetchInterval` timer down whenever the query becomes
  // disabled. On return to the foreground we invalidate `['meetings']`
  // so the user immediately sees fresh data on resume. Mirrors the
  // foreground-gating pattern in `useReconcilePendingLeadsBackground`.
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { currentEventId } = useEvent();
  const currentUserId = user?.id != null ? String(user.id) : undefined;
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      const isActive = state === 'active';
      setAppActive((prev) => {
        if (!prev && isActive) {
          // Returning to foreground — refresh now so the list isn't stale.
          // `useAuthedQuery` will no-op the invalidation refetch if the
          // user is signed out (the query is disabled in that case).
          queryClient.invalidateQueries({ queryKey: ['meetings'] });
        }
        return isActive;
      });
    });
    return () => sub.remove();
  }, [queryClient]);

  return useAuthedQuery({
    // Event-scoped key: without `currentEventId` here, React Query serves
    // Event A's accepted meetings to Event B on switch, which the messaging
    // seed path would then persist under the wrong event (cross-event leak).
    queryKey: ['meetings', currentEventId],
    queryFn: () => listMeetings(currentUserId),
    select: (res) => res.data ?? [],
    staleTime: 0,
    refetchInterval: 30_000,
    enabled: appActive && !!currentEventId,
  });
}

export function useSendMeetingRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SendMeetingRequest) => sendMeetingRequest(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });
}

export function useRespondToMeeting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ meetingId, action }: { meetingId: string; action: 'accept' | 'decline' }) =>
      respondToMeeting(meetingId, action),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['meetings'] }),
  });
}
