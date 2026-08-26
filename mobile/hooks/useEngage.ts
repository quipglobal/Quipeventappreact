import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthedQuery } from '@/hooks/useAuthedQuery';
import { useEvent } from '@/context/EventContext';
import { useAuth } from '@/context/AuthContext';
import {
  listChallenges, completeChallenge as apiCompleteChallenge,
  listPolls, votePoll,
  listSurveys, getSurveyDetail, submitSurvey,
  listGiveaways, listAttendeeGiveaways, enterGiveaway,
  createGiveaway, updateGiveaway, removeGiveaway, saveGiveawayWinner,
  type CreateGiveawayPayload, type UpdateGiveawayPayload,
} from '@/lib/api/engage';
import {
  loadGiveawayWinners, appendGiveawayWinner,
} from '@/lib/giveawayWinnersStorage';
import type { ApiResponse, Giveaway, GiveawayWinner } from '@/lib/api/types';

export function useChallenges() {
  const { currentEventId } = useEvent();
  return useAuthedQuery({
    queryKey: ['challenges', currentEventId],
    queryFn: listChallenges,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
    // Challenges are authored by the organiser and don't change mid-event.
    // 2-minute cache stops the engage tab from re-fetching on every focus.
    staleTime: 2 * 60_000,
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
  const { seedVotedPolls } = useAuth();
  const query = useAuthedQuery({
    queryKey: ['polls', currentEventId],
    queryFn: listPolls,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
    // 60-second stale window matching the audience cache. Without an explicit
    // staleTime React Query defaults to 0, causing a refetch on every mount
    // and focus event — amplifying poll traffic under load.
    staleTime: 60_000,
  });

  const polls = query.data;
  useEffect(() => {
    if (!polls?.length) return;
    // Re-sync server-confirmed votes so a fresh install / logout-login
    // doesn't show polls the user already voted on as unanswered.
    const serverVoted: Record<string, string> = {};
    for (const p of polls) {
      if (p.userVotedOptionId) serverVoted[p.id] = p.userVotedOptionId;
    }
    if (Object.keys(serverVoted).length > 0) seedVotedPolls(serverVoted);
  }, [polls, seedVotedPolls]);

  return query;
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
  const { seedCompletedSurveys } = useAuth();
  const queryClient = useQueryClient();
  const query = useAuthedQuery({
    queryKey: ['surveys', currentEventId],
    queryFn: listSurveys,
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
    staleTime: 5 * 60 * 1000,
  });

  const surveys = query.data;
  useEffect(() => {
    if (!surveys?.length || !currentEventId) return;

    // Re-sync server-confirmed completions so a fresh install / logout-login
    // doesn't show surveys the user already submitted as incomplete.
    const serverDoneIds = surveys
      .filter((sv) => sv.is_completed)
      .map((sv) => sv.id);
    if (serverDoneIds.length > 0) {
      seedCompletedSurveys(serverDoneIds);
    }

    // Cap at 3: prefetching all 10 survey details fires up to 11 simultaneous
    // requests per mounted screen. With 100 concurrent users that's 1 100
    // requests just for surveys. The remaining entries load on-demand;
    // useGetSurveyDetail checks the cache first so a pre-warmed entry is
    // still instant — only the tail entries require an extra round-trip.
    for (const sv of surveys.slice(0, 3)) {
      queryClient.prefetchQuery({
        queryKey: ['survey-detail', currentEventId, sv.id],
        queryFn: () => getSurveyDetail(sv.id),
        staleTime: 5 * 60 * 1000,
      });
    }
  }, [surveys, currentEventId, queryClient, seedCompletedSurveys]);

  return query;
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

/** Union a giveaway's backend winners with overlay winners, deduped by id. */
function mergeWinners(
  backend: GiveawayWinner[] | undefined,
  overlay: GiveawayWinner[] | undefined,
): GiveawayWinner[] {
  const seen = new Set<string>();
  const out: GiveawayWinner[] = [];
  for (const w of [...(backend ?? []), ...(overlay ?? [])]) {
    if (!w || seen.has(w.id)) continue;
    seen.add(w.id);
    out.push(w);
  }
  return out;
}

export function useGiveaways() {
  const { currentEventId } = useEvent();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSponsor = user?.role === 'sponsor';
  const audience = isSponsor ? 'sponsor' : 'attendee';
  const key = ['giveaways', currentEventId, audience] as const;
  const query = useAuthedQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await (isSponsor ? listGiveaways() : listAttendeeGiveaways());
      if (!res.success) throw new Error(res.error?.message ?? 'Failed to load giveaways.');
      return res;
    },
    select: (res) => res.data ?? [],
    enabled: !!currentEventId,
    // Poll every 30 s so users already on the screen see new/updated
    // giveaways from other devices without needing a navigate-away.
    // 30 s is a comfortable upper bound for a live-event "just added"
    // expectation without hammering the backend.
    refetchInterval: 30_000,
    // Without a staleTime the 30-second timer AND refetchOnFocus fire
    // independently. If a user focuses the engage tab at second 28 of the
    // interval, both paths trigger within 2 seconds — doubling the load.
    // Setting staleTime to the poll period prevents the focus-refetch from
    // firing when a poll just ran.
    staleTime: 30_000,
  });

  // Merge the per-event AsyncStorage winners overlay into the cached
  // giveaways so lucky-draw winners survive reloads even when the
  // backend list endpoint doesn't return a `winners` array yet. Runs
  // whenever the backend data refreshes.
  const dataUpdatedAt = query.dataUpdatedAt;
  useEffect(() => {
    if (!currentEventId) return;
    let cancelled = false;
    loadGiveawayWinners(currentEventId).then((overlay) => {
      if (cancelled) return;
      if (Object.keys(overlay).length === 0) return;
      queryClient.setQueryData<ApiResponse<Giveaway[]>>(
        key,
        (prev) => {
          if (!prev?.data) return prev;
          let changed = false;
          const data = prev.data.map((g) => {
            const extra = overlay[g.id];
            if (!extra || extra.length === 0) return g;
            const merged = mergeWinners(g.winners, extra);
            if (merged.length === (g.winners?.length ?? 0)) return g;
            changed = true;
            return { ...g, winners: merged };
          });
          return changed ? { ...prev, data } : prev;
        },
      );
    });
    return () => { cancelled = true; };
  }, [currentEventId, audience, dataUpdatedAt, queryClient]);

  return query;
}

export function useEnterGiveaway() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (giveawayId: string) => enterGiveaway(giveawayId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['giveaways'] }),
  });
}

/**
 * Create a giveaway with an optimistic temp row. On success the temp
 * id is swapped for the canonical server id (and any overlay winners
 * migrated); on NOT_IMPLEMENTED the local row is kept so the sponsor
 * can still run draws against it; on a hard failure the temp row is
 * rolled back. Mirrors the web `addSponsorGiveaway` posture.
 */
export function useCreateGiveaway() {
  const { currentEventId } = useEvent();
  const queryClient = useQueryClient();
  const key = ['giveaways', currentEventId, 'sponsor'];
  return useMutation({
    mutationFn: (payload: CreateGiveawayPayload) => createGiveaway(payload),
    onSuccess: async (res, payload) => {
      if (res.success && res.data) {
        const saved = res.data;
        queryClient.setQueryData<ApiResponse<Giveaway[]>>(key, (prev) => ({
          success: true,
          data: [{
            ...saved,
            sponsorId: saved.sponsorId || payload.sponsorId,
            sponsor: saved.sponsor || payload.sponsorName,
          }, ...(prev?.data ?? []).filter(g => g.id !== saved.id)],
        }));
      }
    },
  });
}

export function useUpdateGiveaway() {
  const { currentEventId } = useEvent();
  const queryClient = useQueryClient();
  const key = ['giveaways', currentEventId];
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: UpdateGiveawayPayload }) =>
      updateGiveaway(id, updates),
    onMutate: async ({ id, updates }: { id: string; updates: UpdateGiveawayPayload }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ApiResponse<Giveaway[]>>(key);
      queryClient.setQueryData<ApiResponse<Giveaway[]>>(key, (prev) => ({
        success: true,
        data: (prev?.data ?? []).map((g) => (g.id === id ? { ...g, ...updates } : g)),
      }));
      return { previous, id };
    },
    onSuccess: (res, { id }, ctx) => {
      if (!ctx) return;
      if (res.success && res.data) {
        const saved = res.data;
        queryClient.setQueryData<ApiResponse<Giveaway[]>>(key, (prev) => ({
          success: true,
          data: (prev?.data ?? []).map((g) =>
            g.id === id ? { ...saved, winners: g.winners ?? saved.winners } : g,
          ),
        }));
        // Background refetch so other devices pick up the edit immediately.
        // Update invalidation is safe — the canonical id already exists on the
        // server, so the refetch will include the updated row rather than
        // omitting it (unlike create, where the row may not be indexed yet).
        queryClient.invalidateQueries({ queryKey: key });
        return;
      }
      // ── Fix A ──────────────────────────────────────────────────────────────
      // Keep the optimistic edit for all non-success outcomes (NOT_IMPLEMENTED,
      // network errors, server errors). The 30 s polling interval will
      // reconcile with the server's state; rolling back here would immediately
      // discard the sponsor's edit with no indication of what happened.
    },
    onError: (_err, _vars, _ctx) => {
      // ── Fix A ──────────────────────────────────────────────────────────────
      // Do NOT restore ctx.previous. A transport failure doesn't tell us
      // whether the server applied the update; keeping the optimistic edit
      // avoids silently discarding the sponsor's changes.
    },
  });
}

export function useRemoveGiveaway() {
  const { currentEventId } = useEvent();
  const queryClient = useQueryClient();
  const key = ['giveaways', currentEventId];
  return useMutation({
    mutationFn: (giveawayId: string) => removeGiveaway(giveawayId),
    onMutate: async (giveawayId: string) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ApiResponse<Giveaway[]>>(key);
      queryClient.setQueryData<ApiResponse<Giveaway[]>>(key, (prev) => ({
        success: true,
        data: (prev?.data ?? []).filter((g) => g.id !== giveawayId),
      }));
      return { previous };
    },
    onSuccess: (res, _giveawayId, ctx) => {
      if (!ctx) return;
      if (res.success) {
        // Background refetch so other devices see the deletion immediately.
        queryClient.invalidateQueries({ queryKey: key });
        return;
      }
      if (res.error?.code === 'NOT_IMPLEMENTED') return; // keep optimistic removal
      if (ctx.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onError: (_err, _giveawayId, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
  });
}

/**
 * Record a lucky-draw winner against a giveaway: write-through to the
 * per-event AsyncStorage overlay first (source of truth for this
 * device), append to the cached giveaways list for an immediate UI
 * update, then fire-and-forget the backend save so it persists
 * cross-device. Backend failures are swallowed — the overlay already
 * carries the win.
 */
export function useRecordGiveawayWinner() {
  const { currentEventId } = useEvent();
  const queryClient = useQueryClient();
  return async (giveawayId: string, winner: GiveawayWinner): Promise<ApiResponse<true>> => {
    if (!giveawayId) return { success: false, error: { code: 'NO_GIVEAWAY', message: 'No giveaway selected.' } };
    const key = ['giveaways', currentEventId];
    const res = await saveGiveawayWinner(giveawayId, {
      userId: winner.userId ?? winner.id,
      name: winner.name,
      company: winner.company,
      title: winner.title,
      avatar: winner.avatar,
      drawnAt: winner.drawnAt,
    });
    if (!res.success) return res;
    await appendGiveawayWinner(currentEventId, giveawayId, winner);
    queryClient.setQueryData<ApiResponse<Giveaway[]>>(key, (prev) => {
      if (!prev?.data) return prev;
      return {
        ...prev,
        data: prev.data.map((g) =>
          g.id === giveawayId
            ? { ...g, winners: mergeWinners(g.winners, [winner]) }
            : g,
        ),
      };
    });
    return res;
  };
}
