/**
 * Preloads the most-visited page data right after the user joins an event,
 * then silently refreshes every 3 minutes in the background.
 *
 * Also triggers a one-shot download of every lazy JS chunk ~3 s after join
 * so navigation to any page feels instant (no chunk-download pause).
 *
 * Call this once in the top-level AppContent component.
 */
import { useEffect, useRef, useCallback } from 'react';
import { listSessionsApi } from '@/app/api/agendaClient';
import { getEventSpeakersApi, getEventMembersApi } from '@/app/api/audienceClient';
import { getEventCompaniesApi } from '@/app/api/companiesClient';
import { listLeaderboard } from '@/app/api/leaderboardClient';
import { listLeads } from '@/app/api/leadsClient';
import { listGiveaways } from '@/app/api/giveawaysClient';
import { setCached } from '@/app/lib/pageCache';

const REFRESH_MS = 3 * 60 * 1000;

export function usePreloader(
  eventId: string | number | undefined,
  enabled: boolean,
): void {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksPreloadedRef = useRef(false);

  const prefetch = useCallback(async (eid: string | number) => {
    await Promise.allSettled([
      // ── Attendee pages ──────────────────────────────────────────────────
      // Sessions — shared by AgendaPage + HomePage
      listSessionsApi(eid).then(r => {
        if (r.success && r.data) setCached('sessions', eid, r.data);
      }),
      // Speakers (full 200-item set) — shared by SpeakersPage + HomePage
      getEventSpeakersApi(eid, 200).then(r => {
        if (r.success && r.data) setCached('speakers', eid, r.data);
      }),
      // Audience members list (all + checked-in) — AudiencePage / LeadsPage
      getEventMembersApi(eid, false).then(r => {
        if (r.success && r.data) setCached('members', eid, r.data);
      }),
      getEventMembersApi(eid, true).then(r => {
        if (r.success && r.data) setCached('members:checkedIn', eid, r.data);
      }),
      // Sponsors / partners list — SponsorsListPage
      getEventCompaniesApi(eid).then(r => {
        if (r.success && r.data) setCached('companies', eid, r.data);
      }),

      // ── Previously un-cached pages (the "slow" ones) ────────────────────
      // LeaderboardPage — reads from AppContext.leaderboard; AppContext seeds
      // from this cache key on event join so the page renders instantly.
      listLeaderboard(eid, 'overall').then(r => {
        if (r.success && r.data) setCached('leaderboard', eid, r.data);
      }),
      // LeadsPage — initialises apiLeads from this key on mount (no spinner).
      // Safe for non-sponsors: returns [] or 403, which we ignore.
      listLeads(eid).then(r => {
        if (r.success && r.data) setCached('leads', eid, r.data);
      }),
      // GiveawaysPage / SponsorGiveawaysPage — AppContext seeds sponsorGiveaways
      // from this cache key on event join.
      listGiveaways(eid).then(r => {
        if (r.success && r.data) setCached('giveaways', eid, r.data);
      }),
    ]);
  }, []);

  // ── Data prefetch (initial + periodic refresh) ─────────────────────────
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

  // ── One-shot JS chunk preload (fires once per session after join) ───────
  // Triggers dynamic import() for every lazy page so Vite downloads and
  // parses the JS bundles in the background. Navigation then picks up the
  // cached module with no network round-trip.
  useEffect(() => {
    if (!enabled || !eventId) return;
    if (chunksPreloadedRef.current) return;
    chunksPreloadedRef.current = true;

    const timer = setTimeout(() => {
      void Promise.allSettled([
        import('@/app/components/LeaderboardPage'),
        import('@/app/components/LeadsPage'),
        import('@/app/components/GiveawaysPage'),
        import('@/app/components/SponsorGiveawaysPage'),
        import('@/app/components/SponsorScannerPage'),
        import('@/app/components/ProfilePage'),
        import('@/app/components/SponsorDrawPage'),
        import('@/app/components/MeetingsPage'),
        import('@/app/components/SpeakersPage'),
        import('@/app/components/SponsorsListPage'),
        import('@/app/components/AudiencePage'),
        import('@/app/components/EventDashboardPage'),
        import('@/app/components/SponsorEventPage'),
        import('@/app/components/EditProfilePage'),
        import('@/app/components/MyBadgePage'),
        import('@/app/components/SurveysListPage'),
        import('@/app/components/PollsListPage'),
        import('@/app/components/ChallengesPage'),
      ]);
    }, 3000); // Let critical-path first render settle before downloading chunks

    return () => clearTimeout(timer);
  }, [enabled, eventId]);
}
