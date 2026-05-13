import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { useEvent } from '@/context/EventContext';
import {
  listChallenges, completeChallenge as apiCompleteChallenge,
  listPolls, votePoll,
  listSurveys, getSurveyDetail, submitSurvey,
  listGiveaways, enterGiveaway,
} from '@/lib/api/engage';

export function useChallenges() {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['challenges', currentEventId],
    queryFn: listChallenges,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
  });
}

export function useCompleteChallenge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (challengeId: string) => apiCompleteChallenge(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function usePolls() {
  // Scope the cache key by event id so switching events doesn't
  // serve the previous event's polls from cache. Without this,
  // Austin's empty poll list would leak into LA (and vice versa)
  // until the focus refetch completed.
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['polls', currentEventId],
    queryFn: listPolls,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
  });
}

export function useVotePoll() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ pollId, optionId }: { pollId: string; optionId: string }) =>
      votePoll(pollId, optionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['polls'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useSurveys() {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['surveys', currentEventId],
    queryFn: listSurveys,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
  });
}

export function useGetSurveyDetail(surveyId: string | null) {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['survey-detail', currentEventId, surveyId],
    queryFn: () => getSurveyDetail(surveyId!),
    select: (res) => res.data ?? null,
    enabled: !!currentEventId && !!surveyId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmitSurvey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ surveyId, answers }: { surveyId: string; answers: Record<string, string> }) =>
      submitSurvey(surveyId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surveys'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useGiveaways() {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['giveaways', currentEventId],
    queryFn: listGiveaways,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
  });
}

export function useEnterGiveaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (giveawayId: string) => enterGiveaway(giveawayId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['giveaways'] }),
  });
}
