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
import { listEventSurveysApi, getEventSurveyApi, listEventPollsApi, getEventPollApi, listEventChallengesApi } from '@/app/api/engageClient';
import { setCached } from '@/app/lib/pageCache';

// Static content (agenda, speakers, sponsors) rarely changes during an event
// — refresh every 15 minutes instead of 3.  Semi-dynamic content (members,
// surveys) also benefits from a longer window; users re-entering the app
// get fresh data via the focus-refetch path in each page component.
const REFRESH_MS = 15 * 60 * 1000;

// Jitter constants — spread 300 simultaneous joins across a 5-second window
// instead of hitting the backend (and Redis) in a single burst.
// The refresh cycle gets ±30 s of per-session jitter so ticks don't
// synchronize across sessions over time.
const PRELOAD_START_JITTER_MS = 5_000;
const REFRESH_JITTER_MS = 30_000;

// Survey detail fan-out: prefetch only the first few entries on join so the
// initial network burst stays manageable.  Remaining details are fetched
// on-demand when the user taps a survey row (each page checks the cache first
// so a cache-hit is still instant).
const SURVEY_DETAIL_PREFETCH_LIMIT = 3;
// Max poll details to prefetch per wave; mirrors the survey cap above.
// Remaining polls are fetched on-demand (cache-first) when the user taps a row.
const POLL_DETAIL_PREFETCH_LIMIT = 5;

export function usePreloader(
  eventId: string | number | undefined,
  enabled: boolean,
): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // Fetch checked-in attendees for the audience cache. We use
      // checked_in_only=true and trust the server's filter directly — the
      // listing endpoint does not return joined_at/status=ACTIVE so client-side
      // isCheckedIn derivation would incorrectly mark everyone as not checked in.
      getEventMembersApi(eid, true).then(r => {
        if (!r.success || !r.data) return;
        setCached('members:checkedIn', eid, r.data);
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
      // Polls list + details — pre-warm the list for EngagePage badge counts
      // AND prefetch the first N poll details so PollsListPage never has to
      // fire the full fan-out on page open. Capped to match the survey limit;
      // remaining poll details are fetched on-demand (cache-first) when the
      // user taps a row.
      listEventPollsApi(eid).then(async r => {
        if (!r.success || !r.data) return;
        setCached('polls', eid, r.data);
        const actionable = r.data
          .filter(p => p.status === 'LIVE' || p.status === 'CLOSED')
          .slice(0, POLL_DETAIL_PREFETCH_LIMIT);
        await Promise.allSettled(
          actionable.map(p =>
            getEventPollApi(eid, p.id).then(dr => {
              if (dr.success && dr.data) setCached(`poll-detail:${p.id}`, eid, dr.data);
            })
          )
        );
      }),
      // Challenges — pre-warm for EngagePage badge counts
      listEventChallengesApi(eid).then(r => {
        if (r.success && r.data) setCached('challenges', eid, r.data);
      }),
    ]);
  }, []);

  useEffect(() => {
    if (!enabled || !eventId) return;

    let cancelled = false;

    // Clear any prior timers from a previous event/enabled change.
    if (startTimerRef.current) { clearTimeout(startTimerRef.current); startTimerRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

    // Per-session jitter: spread 300 simultaneous event-joins across a 5-second
    // window so they don't all hit the backend in the same instant.
    const startDelay = Math.floor(Math.random() * PRELOAD_START_JITTER_MS);

    // Per-session refresh jitter: each session picks a slightly different cycle
    // length (±30 s) so ticks desynchronize over time.
    const refreshJitter = Math.floor(Math.random() * REFRESH_JITTER_MS * 2) - REFRESH_JITTER_MS;
    const effectiveRefreshMs = REFRESH_MS + refreshJitter;

    startTimerRef.current = setTimeout(() => {
      if (cancelled) return;
      void prefetch(eventId);
      timerRef.current = setInterval(() => {
        if (!cancelled) void prefetch(eventId);
      }, effectiveRefreshMs);
    }, startDelay);

    return () => {
      cancelled = true;
      if (startTimerRef.current) { clearTimeout(startTimerRef.current); startTimerRef.current = null; }
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    };
  }, [eventId, enabled, prefetch]);
}
