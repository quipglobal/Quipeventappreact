import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import {
  listChallenges, completeChallenge as apiCompleteChallenge,
  listPolls, votePoll,
  listSurveys, submitSurvey,
  listGiveaways, enterGiveaway,
} from '@/lib/api/engage';

export function useChallenges() {
  return useAuthedQuery({
    queryKey: ['challenges'],
    queryFn: listChallenges,
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 5,
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
  return useAuthedQuery({
    queryKey: ['polls'],
    queryFn: listPolls,
    select: (res) => res.data ?? [],
    staleTime: 1000 * 30,
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
  return useAuthedQuery({
    queryKey: ['surveys'],
    queryFn: listSurveys,
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60 * 5,
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
  return useAuthedQuery({
    queryKey: ['giveaways'],
    queryFn: listGiveaways,
    select: (res) => res.data ?? [],
    staleTime: 1000 * 60,
  });
}

export function useEnterGiveaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (giveawayId: string) => enterGiveaway(giveawayId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['giveaways'] }),
  });
}
