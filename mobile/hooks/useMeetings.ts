import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMeetings, sendMeetingRequest, respondToMeeting } from '@/lib/api/meetings';
import type { SendMeetingRequest } from '@/lib/api/meetings';
import { useAuth } from '@/context/AuthContext';

export function useMeetings() {
  // Gate both the initial fetch and the 30s `refetchInterval` on having an
  // authenticated session. Without `enabled`, the polling would keep firing
  // `GET /meetings` every 30s after sign-out (until the screen unmounted),
  // every one of which 401s and counts against any unauthenticated rate
  // limit. React Query also pauses the interval automatically when the
  // query is disabled, so the timer is fully torn down — not just gated
  // at the request layer.
  const { token, user } = useAuth();
  const enabled = !!token && !!user?.id;
  return useQuery({
    queryKey: ['meetings'],
    queryFn: listMeetings,
    select: (res) => res.data ?? [],
    staleTime: 0,
    refetchInterval: enabled ? 30_000 : false,
    enabled,
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
