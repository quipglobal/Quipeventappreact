/**
 * E2E guard: scan points are awarded exactly once when the network is slow.
 *
 * Task #72 added:
 *   - A 10 s AbortController timeout on the /leads/scan fetch inside apiPost
 *   - A `pointsCreditedAtScan` flag on the fallback ScannedAttendee that fires
 *     when the scan returned a TIMEOUT error code, preventing Save from
 *     double-awarding local fallback points if the server processed the request
 *     before the client gave up.
 *
 * These tests simulate a slow backend by hanging the first /leads/scan route
 * indefinitely. The AbortController inside apiPost fires after 10 s, returning
 * `{ error: { code: 'TIMEOUT' } }`. handleCodeDetected then:
 *   1. Falls back to the audience-member lookup (mocked empty → Unknown Attendee)
 *   2. Sets `pointsCreditedAtScan: true` on the fallback scannedData
 *   3. Awards NO local points at scan time
 *
 * On Save (Path B) the component fires a second /leads/scan call (the retry):
 *   - Retry succeeds (pointsAwarded: 25) → server value used; no extra local points
 *   - Retry fails                        → pointsCreditedAtScan guard blocks local
 *                                          fallback; no double-award
 *
 * Navigation / auth helpers are copied from sponsor-scan-points.spec.ts so this
 * file is fully self-contained and can run independently.
 */

import { test, expect, type Page } from '@playwright/test';

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
 * Install route stubs.  `scanHandler` receives every POST /leads/scan route
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
    if (p.startsWith(`/api/v1/events/${EVENT.id}/members`))
      return ok({
        success: true,
        data: {
          data: [{
            id: 'sp-1', membership_id: 9, name: 'Sam Sponsor',
            email: 'sam@acme.com', roles: ['sponsor'], status: 'active',
            joined_at: '2026-07-01T00:00:00Z',
          }],
          total: 1,
        },
      });

    // ── Leads list ────────────────────────────────────────────────────────
    if (m === 'GET' && (p.includes('/my-leads') || (p.includes('/leads') && !p.includes('/scan'))))
      return ok({ success: true, data: [] });

    // ── Audience members — return empty so code falls to "Unknown Attendee" ─
    if (p.startsWith(`/api/v1/events/${EVENT.id}/attendees`))
      return ok({ success: true, data: { data: [], total: 0 } });

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

  const scannerHeader = page.locator('div.sticky, [class*="sticky"]').filter({
    hasText: /badges scanned.*earn points per scan/,
  });
  await expect(scannerHeader).toBeVisible({ timeout: 8_000 });

  // Switch to manual-entry mode (the last icon button in the header toggle)
  await scannerHeader.locator('button').last().click();
  await expect(page.getByPlaceholder(/ATT-/i)).toBeVisible({ timeout: 5_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('SponsorScannerPage — slow network / timeout guard', () => {
  /**
   * Timeout path: first /leads/scan hangs → AbortController fires after 10 s →
   * handleCodeDetected sets pointsCreditedAtScan: true on the Unknown Attendee
   * fallback. Save fires the Path B retry which succeeds with pointsAwarded: 25.
   * The points toast must show +25 (server value), and addPoints must NOT have
   * been called before Save (no scan-time award).
   *
   * This test needs ~10–12 s for the real AbortController to fire, so the
   * timeout is set to 90 s.
   */
  test(
    'timeout at scan time → pointsCreditedAtScan set → Save retry uses server pointsAwarded',
    async ({ page }) => {
      test.setTimeout(90_000);

      await installMocks(page, async (route, callNumber) => {
        if (callNumber === 1) {
          // First call: hang indefinitely — the 10 s AbortController in
          // apiPost will fire and reject the fetch with an AbortError, which
          // apiPost maps to { error: { code: 'TIMEOUT' } }.
          // Do NOT call route.fulfill / route.abort / route.continue here.
          return;
        }
        // Second call (Save-time retry): succeed with pointsAwarded: 25
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, data: { ...ATTENDEE_LEAD, pointsAwarded: 25 } }),
        });
      });

      await loginAndOpenScanner(page);

      // ── Snapshot header points before any scan ────────────────────────────
      const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
      await expect(headerBadge).toBeVisible({ timeout: 8_000 });
      const beforeText = await headerBadge.textContent();
      const beforePoints = parseInt(beforeText!.trim(), 10);

      // ── Trigger the scan — first call will hang for 10 s ─────────────────
      await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
      await page.getByRole('button', { name: /find attendee/i }).click();

      // After the 10 s timeout fires, handleCodeDetected falls through to the
      // audience-member lookup (empty → Unknown Attendee) with
      // pointsCreditedAtScan: true. Give it 20 s to appear.
      await expect(page.getByText('Unknown Attendee')).toBeVisible({ timeout: 20_000 });

      // No points must have been awarded at scan time — addPoints is guarded by
      // `if (pts > 0)` and the timeout path never calls addPoints.
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_500 });
      await expect(page.locator('text=/^\\+\\d+$/')).not.toBeVisible({ timeout: 1_000 });

      // Header total must be unchanged before Save
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 3_000 });

      // ── Press Save — triggers the Path B retry ─────────────────────────────
      await page.getByRole('button', { name: /save lead/i }).click();

      // Server returns pointsAwarded: 25 — that value must be used in addPoints.
      // The toast renders "+25" and "Points earned!" only when pts > 0.
      await expect(page.getByText('+25')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText(/points earned/i)).toBeVisible({ timeout: 6_000 });

      // Header badge must reflect exactly beforePoints + 25 (no double-count).
      await expect(headerBadge).toHaveText(`${beforePoints + 25} pts`, { timeout: 8_000 });
    },
  );

  /**
   * Timeout path + Save-time retry also fails:
   * First /leads/scan hangs → timeout → pointsCreditedAtScan: true on fallback.
   * Second /leads/scan (Save) also fails. handleSave falls into the local-only
   * save branch, but the `pointsCreditedAtScan` guard prevents addPoints from
   * being called a second time. No points toast must appear.
   *
   * This confirms the double-award protection works even when the retry fails.
   */
  test(
    'timeout at scan time → Save retry also fails → no double-award of local points',
    async ({ page }) => {
      test.setTimeout(90_000);

      await installMocks(page, async (route, callNumber) => {
        if (callNumber === 1) {
          // First call: hang → AbortController fires after 10 s → TIMEOUT
          return;
        }
        // Second call (Save): also fail (backend still unreachable)
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

      // Snapshot header points
      const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
      await expect(headerBadge).toBeVisible({ timeout: 8_000 });
      const beforeText = await headerBadge.textContent();
      const beforePoints = parseInt(beforeText!.trim(), 10);

      // Trigger the scan — first call hangs for 10 s
      await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
      await page.getByRole('button', { name: /find attendee/i }).click();

      // After timeout + empty audience lookup → Unknown Attendee with
      // pointsCreditedAtScan: true
      await expect(page.getByText('Unknown Attendee')).toBeVisible({ timeout: 20_000 });

      // No points yet
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_500 });

      // Header unchanged
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 3_000 });

      // Press Save — retry also fails
      await page.getByRole('button', { name: /save lead/i }).click();

      // The local-only fallback path runs, BUT pointsCreditedAtScan: true
      // prevents addPoints from being called. No "+N" badge or "Points earned!"
      // toast must appear.
      await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 3_000 });
      await expect(page.locator('text=/^\\+\\d+$/')).not.toBeVisible({ timeout: 2_000 });

      // Header total must remain unchanged — addPoints was never called
      await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 5_000 });
    },
  );

  /**
   * Sanity / contrast test: a scan that completes within the timeout is NOT
   * affected by the pointsCreditedAtScan guard. The attendee is resolved by
   * the backend, pointsAwarded: 25 is returned, addPoints fires immediately
   * (before Save), and the header reflects the increment.
   *
   * This confirms the timeout guard doesn't accidentally suppress points on a
   * normal fast scan.
   */
  test(
    'fast scan (within timeout) — points awarded immediately, not suppressed',
    async ({ page }) => {
      test.setTimeout(120_000);

      await installMocks(page, async (route) => {
        // Scan resolves immediately with pointsAwarded: 25
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ success: true, data: { ...ATTENDEE_LEAD, pointsAwarded: 25 } }),
        });
      });

      await loginAndOpenScanner(page);

      const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
      await expect(headerBadge).toBeVisible({ timeout: 8_000 });
      const beforeText = await headerBadge.textContent();
      const beforePoints = parseInt(beforeText!.trim(), 10);

      await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
      await page.getByRole('button', { name: /find attendee/i }).click();

      // Attendee resolves fast — profile card appears
      await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 });

      // Points toast fires immediately (before Save) — Path A behavior
      await expect(page.getByText('+25')).toBeVisible({ timeout: 6_000 });
      await expect(page.getByText(/points earned/i)).toBeVisible({ timeout: 6_000 });

      // Header reflects the increment
      await expect(headerBadge).toHaveText(`${beforePoints + 25} pts`, { timeout: 8_000 });
    },
  );
});
