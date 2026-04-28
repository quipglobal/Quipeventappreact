import { useMutation, useQueryClient } from '@tanstack/react-query';
import { listMeetings, sendMeetingRequest, respondToMeeting } from '@/lib/api/meetings';
import type { SendMeetingRequest } from '@/lib/api/meetings';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';

export function useMeetings() {
  // Auth-gated by `useAuthedQuery` — the wrapper AND-merges its
  // `enabled` flag with `!!token && !!user?.id`, and React Query pauses
  // `refetchInterval` whenever the query is disabled. So both the
  // initial fetch and the 30s poll automatically stop after sign-out
  // and resume after sign-in, without each caller having to remember
  // to wire the gate by hand.
  return useAuthedQuery({
    queryKey: ['meetings'],
    queryFn: listMeetings,
    select: (res) => res.data ?? [],
    staleTime: 0,
    refetchInterval: 30_000,
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
