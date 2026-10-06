/**
 * E2E guard: slow-network / timeout behaviour of SponsorScannerPage.
 *
 * Key behaviour under test:
 *   - Scanner (sponsor) earns NO points, even when the retry succeeds.
 *   - Scanned attendee earns points server-side; `attendeePointsAwarded > 0`
 *     in the retry response shows "Attendee earned N pts" plain toast.
 *   - When both the initial scan AND the Save-time retry fail, no points toast
 *     fires at all (no attendee toast, no scanner toast).
 *   - The scanner's header points badge must stay unchanged throughout.
 *
 * These tests simulate a slow backend by hanging the first /leads/scan route
 * indefinitely. The AbortController inside apiPost fires after 10 s, returning
 * `{ error: { code: 'TIMEOUT' } }`. handleCodeDetected then:
 *   1. Falls back to the audience-member lookup (mocked empty → Unknown Attendee)
 *   2. Awards NO points to the scanner at scan time
 *
 * On Save (Path B) the component fires a second /leads/scan call (the retry):
 *   - Retry succeeds (attendeePointsAwarded: 25) → "Attendee earned 25 pts" toast
 *   - Retry fails                                → no toast at all
 *
 * Navigation / auth helpers mirror sponsor-scan-points.spec.ts so this file
 * is fully self-contained and can run independently.
 */

import { test, expect, type Page } from '@playwright/test';
import { openManualScanner, scannerPointsBadge } from './helpers/scanner';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const SPONSOR = {
  id: 'sp-1',
  name: 'Sam Sponsor',
  email: 'sam@acme.com',
  first_name: 'Sam',
  last_name: 'Sponsor',
  phone: '+15555550200',
  title: 'Sales Rep',
  company: 'Acme Corp',
  role: 'sponsor',
  badge_code: 'BADGE-SP-1',
  points: 100,
  tier: 'Bronze',
  email_verified: true,
  profile_complete: true,
  interests: [],
};

const EVENT = {
  id: 42,
  name: 'TechSummit 2026',
  code: 'TS26',
  starts_at: '2026-08-10T09:00:00Z',
  ends_at: '2026-08-11T18:00:00Z',
  status: 'upcoming',
  location: 'Dubai',
  organizer: 'TechSummit Inc',
};

/** Attendee returned on the Save-time retry */
const ATTENDEE_LEAD = {
  id: 'lead-new-1',
  code: 'ATT-9001',
  name: 'Alex Rivera',
  title: 'CTO',
  company: 'NovaTech',
  avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=6366f1&color=fff',
  notes: '',
  tags: [],
  priority: 'warm',
  memberId: 501,
  checkedIn: false,
  isCheckedIn: false,
  timestamp: new Date().toISOString(),
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Install route stubs. `scanHandler` receives every POST /leads/scan route
 * so each test can control what happens per call.
 */
async function installMocks(
  page: Page,
  scanHandler: (route: import('@playwright/test').Route, callNumber: number) => Promise<void> | void,
) {
  let scanCallCount = 0;

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

    // ── Auth ──────────────────────────────────────────────────────────────
    if (p === '/api/v1/auth/send-otp')
      return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp')
      return ok({
        success: true,
        data: { token: 'mock-sp-tok', account_exists: true, verified: true, user: SPONSOR },
      });

    // ── Profile / badge ───────────────────────────────────────────────────
    if (p === '/api/v1/me') return ok({ success: true, data: SPONSOR });
    if (p === '/api/v1/me/badge')
      return ok({ success: true, badge_code: 'BADGE-SP-1', qr_image_url: '' });
    if (p.startsWith('/api/v1/me/'))
      return ok({ success: true, data: { points: 100, history: [] } });

    // ── Events ────────────────────────────────────────────────────────────
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?'))
      return ok({ success: true, data: { data: [EVENT] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p))
      return ok({ success: true, data: { event_id: EVENT.id, membership_id: 9, message: 'Joined!' } });
    if (p === `/api/v1/events/${EVENT.id}`)
      return ok({ success: true, data: EVENT });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/access`))
      return ok({
        success: true,
        data: {
          has_access: true, is_member: true, membership_id: '9',
          role: 'sponsor', status: 'active', joined_at: '2026-07-01T00:00:00Z',
        },
      });
    // Members list — return empty so the audience badge-code lookup falls
    // through to the "Unknown Attendee" placeholder in handleCodeDetected.
    if (p.startsWith(`/api/v1/events/${EVENT.id}/members`))
      return ok({ success: true, data: { data: [], total: 0 } });

    // ── Leads list ────────────────────────────────────────────────────────
    if (m === 'GET' && (p.includes('/my-leads') || (p.includes('/leads') && !p.includes('/scan'))))
      return ok({ success: true, data: [] });

    // ── Leads scan endpoint — delegated to caller ─────────────────────────
    if (m === 'POST' && p.includes('/leads/scan')) {
      scanCallCount++;
      return scanHandler(route, scanCallCount);
    }

    // ── Lead update (PATCH/PUT) ────────────────────────────────────────────
    if ((m === 'PATCH' || m === 'PUT') && p.includes('/leads/'))
      return ok({ success: true, data: ATTENDEE_LEAD });

    // ── Check-in ──────────────────────────────────────────────────────────
    if (m === 'POST' && p.includes('/check-in'))
      return ok({ success: true });

    // ── Everything else ───────────────────────────────────────────────────
    if (p.startsWith(`/api/v1/events/${EVENT.id}/`))
      return ok({ success: true, data: [] });
    return ok({ success: true, data: null });
  });
}

/**
 * Sign in as sponsor, enter the event, open SponsorScannerPage and switch to
 * manual-entry mode.
 */
async function loginAndOpenScanner(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('sam@acme.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();

  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('TechSummit 2026').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /^More$/i }).click({ timeout: 8_000 });
  const sideMenuDrawer = page.locator('[class*="z-\\[61\\]"]');
  await expect(sideMenuDrawer.getByRole('button', { name: /^Scan Badge$/i })).toBeVisible({ timeout: 8_000 });
  await sideMenuDrawer.getByRole('button', { name: /^Scan Badge$/i }).click();

  await openManualScanner(page);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('SponsorScannerPage — slow network / timeout guard', () => {
  /**
   * Timeout path: first /leads/scan hangs → AbortController fires after 10 s →
   * handleCodeDetected falls back to the audience-member lookup (empty →
   * Unknown Attendee). No points are awarded at scan time.
   *
   * Save fires the Path B retry, which succeeds with attendeePointsAwarded: 25.
   * The "Attendee earned 25 pts" toast must appear. The scanner's header badge
   * must stay unchanged (scanner earns nothing).
   *
   * This test needs ~10–12 s for the real AbortController to fire.
   */
  test(
    'timeout at scan time → Save retry succeeds → attendee earns points, scanner earns nothing',
    async ({ page }) => {
      test.setTimeout(90_000);

      await installMocks(page, async (route, callNumber) => {
        if (callNumber === 1) {
          // First call: hang indefinitely — the 10 s AbortController fires and
          // resolves to { error: { code: 'TIMEOUT' } }.
          return;
        }
        // Second call (Save-time retry): succeed with attendeePointsAwarded: 25
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            success: true,
            data: {
              ...ATTENDEE_LEAD,
              pointsAwarded: 25,           // backend value; scanner must NOT earn this
              attendeePointsAwarded: 25,   // attendee earns; shown as plain toast
            },
          }),
        });
      });

      await loginAndOpenScanner(page);

      const headerBadge = scannerPointsBadge(page);
      await expect(headerBadge).toBeVisible({ timeout: 8_000 });
      const beforeText = await headerBadge.textContent();
      const beforePoints = parseInt(beforeText!.trim(), 10);

      await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
      await page.getByRole('button', { name: /find attendee/i }).click();

      // After the 10 s timeout, audience lookup is empty → Unknown Attendee.
      await expect(page.getByText('Unknown Attendee')).toBeVisible({ timeout: 20_000 });

      // No points toast at scan time (scanner earns nothing; attendee toast
      // only fires when the backend confirms attendeePointsAwarded > 0).
      await expect(page.getByText(/attendee earned/i)).not.toBeVisible({ timeout: 1_500 });
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 500 });

      // Header unchanged before Save.
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 3_000 });

      // Press Save — triggers the Path B retry.
      await page.getByRole('button', { name: /save lead/i }).click();

      // Attendee toast must appear (server confirmed attendeePointsAwarded: 25).
      await expect(page.getByText(/attendee earned 25 pts/i)).toBeVisible({ timeout: 10_000 });

      // Scanner header must remain unchanged — addPoints was never called.
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 8_000 });

      // No scanner "Points earned!" label.
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_000 });
    },
  );

  /**
   * Timeout path + Save-time retry also fails:
   * First /leads/scan hangs → timeout → Unknown Attendee shown.
   * Second /leads/scan (Save) also fails. No attendee toast fires and no
   * scanner points toast fires. Header stays unchanged.
   *
   * This confirms the failure path is clean — no double-award, no stale toast.
   */
  test(
    'timeout at scan time → Save retry also fails → no points toast at all',
    async ({ page }) => {
      test.setTimeout(90_000);

      await installMocks(page, async (route, callNumber) => {
        if (callNumber === 1) {
          // First call: hang → TIMEOUT
          return;
        }
        // Second call (Save): also fail
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            success: false,
            error: { code: 'SCAN_FAILED', message: 'Backend still unreachable.' },
          }),
        });
      });

      await loginAndOpenScanner(page);

      const headerBadge = scannerPointsBadge(page);
      await expect(headerBadge).toBeVisible({ timeout: 8_000 });
      const beforeText = await headerBadge.textContent();
      const beforePoints = parseInt(beforeText!.trim(), 10);

      await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
      await page.getByRole('button', { name: /find attendee/i }).click();

      // After timeout + empty audience lookup → Unknown Attendee.
      await expect(page.getByText('Unknown Attendee')).toBeVisible({ timeout: 20_000 });

      // No points toast at scan time.
      await expect(page.getByText(/attendee earned/i)).not.toBeVisible({ timeout: 1_500 });
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 500 });

      // Header unchanged.
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 3_000 });

      // Press Save — retry also fails.
      await page.getByRole('button', { name: /save lead/i }).click();

      // Local-only save path runs (lead saved to context), but no attendee
      // toast fires because no attendeePointsAwarded was ever returned.
      await expect(page.getByText(/attendee earned/i)).not.toBeVisible({ timeout: 3_000 });
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 500 });
      await expect(page.locator('text=/^\\+\\d+$/')).not.toBeVisible({ timeout: 500 });

      // Header total must remain unchanged — addPoints was never called.
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 5_000 });
    },
  );

  /**
   * Parallel-fallback regression: scan POST resolves fast with a full profile
   * while the BADGE-CODE member GET hangs indefinitely (simulating a stalled
   * backend). Only the badge_code lookup is stalled; audience-listing GETs
   * (used during login/tab loads) respond normally so the login flow works.
   *
   * Expected behaviour:
   *   1. The attendee card appears promptly — within 5 s — proving the happy
   *      path is NOT blocked by the slow/stalled member badge-code lookup.
   *   2. No "Unknown Attendee" placeholder ever appears.
   *   3. The attendee earns points immediately (attendeePointsAwarded: 25).
   *   4. The scanner earns no points (pointsAwarded: 0 / no badge change).
   */
  test(
    'fast scan with stalling member GET — attendee card renders promptly, render not blocked',
    async ({ page }) => {
      test.setTimeout(30_000);

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

        // ── Auth ──────────────────────────────────────────────────────────
        if (p === '/api/v1/auth/send-otp')
          return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
        if (p === '/api/v1/auth/verify-otp')
          return ok({
            success: true,
            data: { token: 'mock-sp-tok', account_exists: true, verified: true, user: SPONSOR },
          });

        // ── Profile / badge ───────────────────────────────────────────────
        if (p === '/api/v1/me') return ok({ success: true, data: SPONSOR });
        if (p === '/api/v1/me/badge')
          return ok({ success: true, badge_code: 'BADGE-SP-1', qr_image_url: '' });
        if (p.startsWith('/api/v1/me/'))
          return ok({ success: true, data: { points: 100, history: [] } });

        // ── Events ────────────────────────────────────────────────────────
        if (p === '/api/v1/events' || p.startsWith('/api/v1/events?'))
          return ok({ success: true, data: { data: [EVENT] } });
        if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p))
          return ok({ success: true, data: { event_id: EVENT.id, membership_id: 9, message: 'Joined!' } });
        if (p === `/api/v1/events/${EVENT.id}`)
          return ok({ success: true, data: EVENT });
        if (p.startsWith(`/api/v1/events/${EVENT.id}/access`))
          return ok({
            success: true,
            data: {
              has_access: true, is_member: true, membership_id: '9',
              role: 'sponsor', status: 'active', joined_at: '2026-07-01T00:00:00Z',
            },
          });

        // ── Members list ──────────────────────────────────────────────────
        if (p.startsWith(`/api/v1/events/${EVENT.id}/members`)) {
          // Stall ONLY the badge-code lookup fired by findMemberByBadgeCodeApi.
          // Regular audience-listing requests (no badge_code param) during
          // login/tab-load must respond normally so navigation isn't blocked.
          if (url.searchParams.has('badge_code')) {
            // Never fulfill — our AbortController aborts this within 5 s.
            // Playwright will discard the pending route when the browser
            // cancels the request via the abort signal.
            return;
          }
          return ok({ success: true, data: { data: [], total: 0 } });
        }

        // ── Leads scan — fast, successful response with attendeePoints ─────
        if (m === 'POST' && p.includes('/leads/scan'))
          return ok({
            success: true,
            data: {
              ...ATTENDEE_LEAD,
              pointsAwarded: 0,            // scanner earns nothing
              attendeePointsAwarded: 25,   // attendee earns 25
            },
          });

        // ── Lead update (PATCH/PUT) ────────────────────────────────────────
        if ((m === 'PATCH' || m === 'PUT') && p.includes('/leads/'))
          return ok({ success: true, data: ATTENDEE_LEAD });

        // ── Check-in ──────────────────────────────────────────────────────
        if (m === 'POST' && p.includes('/check-in'))
          return ok({ success: true });

        // ── Leads list ────────────────────────────────────────────────────
        if (m === 'GET' && (p.includes('/my-leads') || (p.includes('/leads') && !p.includes('/scan'))))
          return ok({ success: true, data: [] });

        // ── Everything else ───────────────────────────────────────────────
        if (p.startsWith(`/api/v1/events/${EVENT.id}/`))
          return ok({ success: true, data: [] });
        return ok({ success: true, data: null });
      });

      await loginAndOpenScanner(page);

      const headerBadge = scannerPointsBadge(page);
      await expect(headerBadge).toBeVisible({ timeout: 8_000 });
      const beforeText = await headerBadge.textContent();
      const beforePoints = parseInt(beforeText!.trim(), 10);

      // Trigger the scan — POST resolves immediately; badge-code member GET stalls.
      await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
      const scanStart = Date.now();
      await page.getByRole('button', { name: /find attendee/i }).click();

      // 1. Attendee card must appear promptly (well within the 5 s member bound),
      //    proving the happy path is NOT blocked by the stalled member lookup.
      await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 5_000 });
      const elapsed = Date.now() - scanStart;
      expect(elapsed).toBeLessThan(5_000);

      // 2. "Unknown Attendee" placeholder must never have appeared.
      await expect(page.getByText(/unknown attendee/i)).not.toBeVisible({ timeout: 500 });

      // 3. Attendee earns points immediately (Path A — scan resolved fast).
      await expect(page.getByText(/attendee earned 25 pts/i)).toBeVisible({ timeout: 4_000 });

      // 4. Scanner earns nothing — no "+N" badge, no "Points earned!" label,
      //    and the header points badge stays at its pre-scan value.
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_000 });
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 5_000 });
    },
  );

  /**
   * Sanity / contrast test: a scan that completes within the timeout is NOT
   * affected by any guards. Backend returns attendeePointsAwarded: 25;
   * the "Attendee earned 25 pts" toast fires immediately (before Save).
   * The scanner's header badge stays unchanged.
   */
  test(
    'fast scan (within timeout) — attendee earns points immediately, scanner earns nothing',
    async ({ page }) => {
      test.setTimeout(120_000);

      await installMocks(page, async (route) => {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            success: true,
            data: {
              ...ATTENDEE_LEAD,
              pointsAwarded: 25,           // scanner must ignore this for its own total
              attendeePointsAwarded: 25,   // attendee earns; shown immediately
            },
          }),
        });
      });

      await loginAndOpenScanner(page);

      const headerBadge = scannerPointsBadge(page);
      await expect(headerBadge).toBeVisible({ timeout: 8_000 });
      const beforeText = await headerBadge.textContent();
      const beforePoints = parseInt(beforeText!.trim(), 10);

      await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
      await page.getByRole('button', { name: /find attendee/i }).click();

      // Attendee resolves fast — profile card appears.
      await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 });

      // Attendee toast fires immediately (before Save) — Path A behavior.
      await expect(page.getByText(/attendee earned 25 pts/i)).toBeVisible({ timeout: 6_000 });

      // Scanner earns nothing — no "+N" badge, no "Points earned!" label.
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_000 });
      await expect(page.locator('text=/^\\+\\d+$/')).not.toBeVisible({ timeout: 500 });

      // Header must stay at the pre-scan value.
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 8_000 });
    },
  );
});
