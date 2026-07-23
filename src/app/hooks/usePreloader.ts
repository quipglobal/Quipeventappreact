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
import { listEventSurveysApi, getEventSurveyApi } from '@/app/api/engageClient';
import { setCached } from '@/app/lib/pageCache';

const REFRESH_MS = 3 * 60 * 1000;

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
        // Prefetch the first 10 survey details in the background so tapping
        // a survey is instant rather than triggering a second round-trip.
        await Promise.allSettled(
          r.data.slice(0, 10).map(sv =>
            getEventSurveyApi(eid, sv.id).then(dr => {
              if (dr.success && dr.data) setCached(`survey-detail:${sv.id}`, eid, dr.data);
            })
          )
        );
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
