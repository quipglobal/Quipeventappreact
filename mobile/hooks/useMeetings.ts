import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listMeetings, sendMeetingRequest, respondToMeeting } from '@/lib/api/meetings';
import type { SendMeetingRequest } from '@/lib/api/meetings';

export function useMeetings() {
  return useQuery({
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
