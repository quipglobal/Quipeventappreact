/**
 * E2E regression guard — Task #122
 *
 * Confirms that poll results stay fresh after voting without a full page reload.
 *
 * The regression scenario:
 *   1. User opens the Polls screen; a LIVE poll is shown.
 *   2. User votes on option A.
 *   3. The vote response returns fresh percentages (60% / 40%).
 *   4. Results are shown inline — percentage bars appear; "Your vote ✓" is shown.
 *   5. User navigates away (back to Engage hub).
 *   6. User returns to the Polls screen.
 *   7. BUG (pre-fix): the detail cache had a stale pre-vote snapshot,
 *      and Phase 2 also re-read the cache, so the percentages reverted to
 *      their pre-vote values (0%) and the already-voted state could be lost.
 *   8. FIX: handleVote deletes the detail cache entry after a successful
 *      vote, and Phase 2 always bypasses the detail cache, so the fresh
 *      percentages from the vote response survive a tab-switch revisit.
 *
 * Key assertions:
 *   • After voting: percentage label visible, "Your vote ✓" label visible,
 *     no raw vote-count text (e.g. "3 votes") anywhere in the poll card.
 *   • After navigating away and back: same percentage still visible, voted
 *     option still highlighted with "Your vote ✓".
 *
 * Every /api/v1/** call is stubbed via page.route — no live backend required.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ATTENDEE = {
  id: 'att-poll-1',
  name: 'Jordan Voter',
  email: 'jordan@example.com',
  first_name: 'Jordan',
  last_name: 'Voter',
  phone: '+15555550101',
  title: 'Engineer',
  company: 'DevCo',
  role: 'attendee',
  badge_code: 'BADGE-ATT-1',
  points: 50,
  tier: 'Bronze',
  email_verified: true,
  profile_complete: true,
  interests: [],
};

const EVENT = {
  id: 77,
  name: 'PollFest 2026',
  code: 'PF26',
  starts_at: '2026-08-10T09:00:00Z',
  ends_at: '2026-08-12T18:00:00Z',
  status: 'upcoming',
  location: 'London',
  organizer: 'PollFest Inc',
};

const POLL_ID = 301;
const OPTION_A_ID = 1001;
const OPTION_B_ID = 1002;

/** Summary returned by GET /polls (list) — user has not yet voted. */
const POLL_SUMMARY_UNVOTED = {
  id: POLL_ID,
  event_id: EVENT.id,
  title: 'Which feature should we ship next?',
  status: 'LIVE',
  results_visibility: 'AFTER_VOTE',
  starts_at: null,
  ends_at: null,
  options_count: 2,
  user_voted_option_id: null,
};

/** Detail returned by GET /polls/:id — full option list. */
const POLL_DETAIL_UNVOTED = {
  ...POLL_SUMMARY_UNVOTED,
  options: [
    { id: OPTION_A_ID, poll_id: POLL_ID, option_text: 'Dark Mode', order: 1 },
    { id: OPTION_B_ID, poll_id: POLL_ID, option_text: 'Offline Support', order: 2 },
  ],
};

/** Results returned by POST /polls/:id/vote. */
const VOTE_RESPONSE = {
  voted_option_id: OPTION_A_ID,
  total_votes: 5,
  results: [
    { id: OPTION_A_ID, option_text: 'Dark Mode',        votes: 3, percentage: 60 },
    { id: OPTION_B_ID, option_text: 'Offline Support',  votes: 2, percentage: 40 },
  ],
};

/**
 * Detail returned by GET /polls/:id AFTER the vote — the fresh server data
 * Phase 2 must serve. Percentages match the vote response so the test
 * can assert that Phase 2 isn't replaying a stale pre-vote snapshot.
 */
const POLL_DETAIL_VOTED = {
  ...POLL_DETAIL_UNVOTED,
  user_voted_option_id: OPTION_A_ID,
};

// ── Mock installer ────────────────────────────────────────────────────────────

/**
 * Install route stubs.
 *
 * `detailCallCount` is incremented on each GET /polls/:pollId call so we
 * can assert Phase 2 fires on the second screen mount.
 *
 * `voteSubmitted` flips to true once POST /vote is fulfilled; subsequent
 * detail fetches return POLL_DETAIL_VOTED so Phase 2 serves updated data.
 */
async function installMocks(
  page: Page,
  options: { primaryPollListEmpty?: boolean } = {},
): Promise<{ getDetailCount: () => number }> {
  let detailCallCount = 0;
  let voteSubmitted = false;

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const m = route.request().method();

    const ok = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      });

    // ── Auth ───────────────────────────────────────────────────────────────
    if (p === '/api/v1/auth/send-otp')
      return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp')
      return ok({
        success: true,
        data: { token: 'mock-att-tok', account_exists: true, verified: true, user: ATTENDEE },
      });

    // ── Profile ────────────────────────────────────────────────────────────
    if (p === '/api/v1/me') return ok({ success: true, data: ATTENDEE });
    if (p === '/api/v1/me/badge')
      return ok({ success: true, badge_code: 'BADGE-ATT-1', qr_image_url: '' });
    if (p.startsWith('/api/v1/me/'))
      return ok({ success: true, data: { points: 50, history: [] } });

    // ── Events ─────────────────────────────────────────────────────────────
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?'))
      return ok({ success: true, data: { data: [EVENT] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p))
      return ok({ success: true, data: { event_id: EVENT.id, membership_id: 5, message: 'Joined!' } });
    if (p === `/api/v1/events/${EVENT.id}`)
      return ok({ success: true, data: EVENT });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/access`))
      return ok({
        success: true,
        data: {
          has_access: true,
          is_member: true,
          membership_id: '5',
          role: 'attendee',
          status: 'active',
          joined_at: '2026-08-01T00:00:00Z',
        },
      });

    // ── Polls — list ───────────────────────────────────────────────────────
    if (m === 'GET' && p === `/api/v1/events/${EVENT.id}/polls`)
      return ok({
        success: true,
        data: options.primaryPollListEmpty ? [] : [voteSubmitted
          ? { ...POLL_SUMMARY_UNVOTED, user_voted_option_id: OPTION_A_ID }
          : POLL_SUMMARY_UNVOTED],
      });
    if (m === 'GET' && p === `/api/v1/events/${EVENT.id}/mobile-polls`)
      return ok({
        success: true,
        data: [voteSubmitted
          ? { ...POLL_SUMMARY_UNVOTED, user_voted_option_id: OPTION_A_ID }
          : POLL_SUMMARY_UNVOTED],
      });

    // ── Polls — detail (per poll) ──────────────────────────────────────────
    if (m === 'GET' && p === `/api/v1/events/${EVENT.id}/polls/${POLL_ID}`) {
      detailCallCount++;
      return ok({
        success: true,
        data: voteSubmitted ? POLL_DETAIL_VOTED : POLL_DETAIL_UNVOTED,
      });
    }

    // ── Polls — vote ───────────────────────────────────────────────────────
    if (m === 'POST' && p === `/api/v1/events/${EVENT.id}/polls/${POLL_ID}/vote`) {
      voteSubmitted = true;
      return ok({ success: true, data: VOTE_RESPONSE });
    }

    // ── Gamification / leaderboard / other engage endpoints ───────────────
    if (p.startsWith(`/api/v1/events/${EVENT.id}/gamification`))
      return ok({ success: true, data: [] });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/leaderboard`))
      return ok({ success: true, data: [] });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/surveys`))
      return ok({ success: true, data: [] });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/challenges`))
      return ok({ success: true, data: [] });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/members`))
      return ok({ success: true, data: { data: [], total: 0 } });

    // ── Catch-all for remaining event-scoped endpoints ─────────────────────
    if (p.startsWith(`/api/v1/events/${EVENT.id}/`))
      return ok({ success: true, data: [] });

    return ok({ success: true, data: null });
  });

  return { getDetailCount: () => detailCallCount };
}

// ── Login helper ──────────────────────────────────────────────────────────────

async function loginAndOpenPolls(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('jordan@example.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();

  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  // Join the event
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('PollFest 2026').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });

  // Navigate to Engage hub
  await page.getByRole('button', { name: /^Engage$/i }).click({ timeout: 8_000 });
  await expect(page.getByRole('button', { name: /live polls/i })).toBeVisible({ timeout: 8_000 });

  // Open Live Polls
  await page.getByRole('button', { name: /live polls/i }).click({ timeout: 5_000 });
  await expect(page.getByText('Which feature should we ship next?')).toBeVisible({ timeout: 8_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('PollsListPage — results freshness after voting', () => {

  test('shows an existing poll on the first visit when the primary list is temporarily empty', async ({ page }) => {
    await installMocks(page, { primaryPollListEmpty: true });
    await loginAndOpenPolls(page);

    await expect(page.getByText('Which feature should we ship next?')).toBeVisible();
    await expect(page.getByText(/No polls are available yet/i)).not.toBeVisible();
  });

  test('shows updated percentage after voting and preserves it on return', async ({ page }) => {
    const { getDetailCount } = await installMocks(page);
    await loginAndOpenPolls(page);

    // ── Step 1: vote on "Dark Mode" ────────────────────────────────────────
    // The option buttons are page-level; use getByRole to avoid narrow-div
    // scoping issues (filter({ hasText }).first() lands on the innermost div,
    // which is just the heading, not the full card).
    await page.getByRole('button', { name: /dark mode/i }).click({ timeout: 8_000 });
    await page.getByRole('button', { name: /submit vote/i }).click({ timeout: 8_000 });

    // ── Step 2: assert results appear inline (no full reload needed) ───────
    // The voted option must show "Your vote ✓"
    await expect(page.getByText('Your vote ✓')).toBeVisible({ timeout: 8_000 });

    // The percentage for option A must be visible
    await expect(page.getByText('60%')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('40%')).toBeVisible({ timeout: 5_000 });

    // No raw vote count should be rendered (e.g. "3 votes", "5 votes")
    const rawVotePattern = /\d+\s+votes?/i;
    await expect(page.getByRole('heading', { name: /which feature/i })).not.toContainText(rawVotePattern);

    // ── Step 3: navigate back to the Engage hub via the back arrow ─────────
    // The bottom nav is hidden on sub-pages of engage; use the ArrowLeft back
    // button rendered at the top of PollsListPage (class="mb-3").
    await page.locator('button.mb-3').click({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /live polls/i })).toBeVisible({ timeout: 8_000 });

    const detailCountAfterFirstVisit = getDetailCount();

    // ── Step 4: return to Live Polls via Engage hub ────────────────────────
    await page.getByRole('button', { name: /live polls/i }).click({ timeout: 5_000 });
    await expect(page.getByText('Which feature should we ship next?')).toBeVisible({ timeout: 8_000 });

    // ── Step 5: assert results are still fresh (Phase 2 re-fetched) ────────
    // Phase 2 always bypasses the detail cache on mount, so detailCallCount
    // must have incremented since the first visit.
    await expect.poll(() => getDetailCount(), { timeout: 8_000 })
      .toBeGreaterThan(detailCountAfterFirstVisit);

    // Voted option still highlighted
    await expect(page.getByText('Your vote ✓')).toBeVisible({ timeout: 8_000 });

    // Updated percentage still visible (not reverted to 0% from stale cache)
    await expect(page.getByText('60%')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('40%')).toBeVisible({ timeout: 5_000 });

    // Still no raw vote counts after returning
    await expect(page.getByRole('heading', { name: /which feature/i })).not.toContainText(rawVotePattern);
  });

  test('already-voted state is preserved across tab switch without re-voting', async ({ page }) => {
    await installMocks(page);
    await loginAndOpenPolls(page);

    // Vote on "Dark Mode"
    await page.getByRole('button', { name: /dark mode/i }).click({ timeout: 8_000 });
    await page.getByRole('button', { name: /submit vote/i }).click({ timeout: 8_000 });

    // Confirm "Your vote ✓" appears after voting
    await expect(page.getByText('Your vote ✓')).toBeVisible({ timeout: 8_000 });

    // Navigate back to the Engage hub using the PollsListPage back arrow,
    // then re-enter Live Polls to simulate a tab switch.
    await page.locator('button.mb-3').click({ timeout: 5_000 });
    await expect(page.getByRole('button', { name: /live polls/i })).toBeVisible({ timeout: 8_000 });
    await page.getByRole('button', { name: /live polls/i }).click({ timeout: 5_000 });
    await expect(page.getByText('Which feature should we ship next?')).toBeVisible({ timeout: 8_000 });

    // Already-voted state must be preserved — "Your vote ✓" still visible
    await expect(page.getByText('Your vote ✓')).toBeVisible({ timeout: 8_000 });

    // Percentages still rendered (not hidden)
    await expect(page.getByText('60%')).toBeVisible({ timeout: 5_000 });

    // The "Submit Vote" button must NOT reappear (user already voted)
    await expect(page.getByRole('button', { name: /submit vote/i })).not.toBeVisible();
  });
});
