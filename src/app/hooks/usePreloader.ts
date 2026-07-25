/**
 * Preloads the most-visited page data right after the user joins an event,
 * then silently refreshes every 3 minutes in the background.
 *
 * Call this once in the top-level AppContent component.
 */
import { useEffect, useRef, useCallback } from 'react';
import { listSessionsApi } from '@/app/api/agendaClient';
import { getEventSpeakersApi, getEventMembersApi } from '@/app/api/audienceClient';
import { getEventCompaniesApi } from '@/app/api/companiesClient';
import { listEventSurveysApi, getEventSurveyApi, listEventPollsApi, listEventChallengesApi } from '@/app/api/engageClient';
import { setCached } from '@/app/lib/pageCache';

// Static content (agenda, speakers, sponsors) rarely changes during an event
// — refresh every 15 minutes instead of 3.  Semi-dynamic content (members,
// surveys) also benefits from a longer window; users re-entering the app
// get fresh data via the focus-refetch path in each page component.
const REFRESH_MS = 15 * 60 * 1000;

// Survey detail fan-out: prefetch only the first few entries on join so the
// initial network burst stays manageable.  Remaining details are fetched
// on-demand when the user taps a survey row (each page checks the cache first
// so a cache-hit is still instant).
const SURVEY_DETAIL_PREFETCH_LIMIT = 3;

export function usePreloader(
  eventId: string | number | undefined,
  enabled: boolean,
): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const prefetch = useCallback(async (eid: string | number) => {
    await Promise.allSettled([
      // Sessions — shared by AgendaPage + HomePage
      listSessionsApi(eid).then(r => {
        if (r.success && r.data) setCached('sessions', eid, r.data);
      }),
      // Speakers (full 200-item set) — shared by SpeakersPage + HomePage
      getEventSpeakersApi(eid, 200).then(r => {
        if (r.success && r.data) setCached('speakers', eid, r.data);
      }),
      // Audience members list (not filtered to checked-in only)
      getEventMembersApi(eid, false).then(r => {
        if (r.success && r.data) setCached('members', eid, r.data);
      }),
      // Checked-in members (separate endpoint call)
      getEventMembersApi(eid, true).then(r => {
        if (r.success && r.data) setCached('members:checkedIn', eid, r.data);
      }),
      // Sponsors / partners list
      getEventCompaniesApi(eid).then(r => {
        if (r.success && r.data) setCached('companies', eid, r.data);
      }),
      // Surveys list — prefetch so SurveysListPage renders instantly
      listEventSurveysApi(eid).then(async r => {
        if (!r.success || !r.data) return;
        setCached('surveys', eid, r.data);
        // Prefetch only the first few survey details on join — the rest are
        // fetched on-demand (cache-hit is still instant for pre-cached ones).
        await Promise.allSettled(
          r.data.slice(0, SURVEY_DETAIL_PREFETCH_LIMIT).map(sv =>
            getEventSurveyApi(eid, sv.id).then(dr => {
              if (dr.success && dr.data) setCached(`survey-detail:${sv.id}`, eid, dr.data);
            })
          )
        );
      }),
      // Polls list — pre-warm so PollsListPage and EngagePage badge counts
      // are served from cache on every tab visit instead of hitting the API.
      listEventPollsApi(eid).then(r => {
        if (r.success && r.data) setCached('polls', eid, r.data);
      }),
      // Challenges — pre-warm for EngagePage badge counts
      listEventChallengesApi(eid).then(r => {
        if (r.success && r.data) setCached('challenges', eid, r.data);
      }),
    ]);
  }, []);

  useEffect(() => {
    if (!enabled || !eventId) return;

    void prefetch(eventId);

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      void prefetch(eventId);
    }, REFRESH_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [eventId, enabled, prefetch]);
}
