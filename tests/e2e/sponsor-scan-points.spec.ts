/**
 * E2E guard: the scanned ATTENDEE earns points; the scanner (sponsor) earns
 * nothing.
 *
 * Points are credited to the attendee server-side. The frontend confirms this
 * by showing a plain "Attendee earned N pts" toast when the backend response
 * includes `attendeePointsAwarded > 0`. The sponsor's own header points badge
 * must NOT change after any scan.
 *
 * Two paths through SponsorScannerPage are exercised:
 *
 *  Path A — backend resolves the badge at scan time and returns
 *    `attendeePointsAwarded` in the POST /leads/scan response. The attendee
 *    toast must appear immediately after the attendee profile is shown (before
 *    the user presses Save).
 *
 *  Path B — backend omits `attendeePointsAwarded` on the first call (badge
 *    not recognized). When the user presses Save the second /leads/scan call
 *    returns `attendeePointsAwarded: 25`, triggering the toast.
 *
 * Both tests use manual-entry mode (Type icon → "Find Attendee") because
 * camera-based QR scanning cannot be exercised in a headless Playwright run.
 *
 * Every /api/v1/** call is stubbed via page.route — no live backend required.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Shared fixtures ──────────────────────────────────────────────────────────

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

/** Attendee whose badge the sponsor will scan */
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Install the base route stubs shared between all tests.
 * `scanHandler` receives the POST /leads/scan route so each test can
 * return a different payload for it.
 */
async function installMocks(
  page: Page,
  scanHandler: (route: import('@playwright/test').Route) => Promise<void> | void,
) {
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
          has_access: true,
          is_member: true,
          membership_id: '9',
          role: 'sponsor',
          status: 'active',
          joined_at: '2026-07-01T00:00:00Z',
        },
      });
    // Members list — return only the sponsor; badge-code lookups for the
    // attendee badge return empty so the app falls back to "Unknown Attendee".
    if (p.startsWith(`/api/v1/events/${EVENT.id}/members`))
      return ok({ success: true, data: { data: [], total: 0 } });

    // ── Leads list ────────────────────────────────────────────────────────
    if (m === 'GET' && (p.includes('/my-leads') || (p.includes('/leads') && !p.includes('/scan'))))
      return ok({ success: true, data: [] });

    // ── Leads scan endpoint — delegated to caller ─────────────────────────
    if (m === 'POST' && p.includes('/leads/scan'))
      return scanHandler(route);

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
 * Log in as sponsor, join the event, open SponsorScannerPage, switch to
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
    hasText: /badges scanned/,
  });
  await expect(scannerHeader).toBeVisible({ timeout: 8_000 });

  await scannerHeader.locator('button').last().click();
  await expect(page.getByPlaceholder(/ATT-/i)).toBeVisible({ timeout: 5_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('SponsorScannerPage — scan points', () => {
  /**
   * Path A: backend returns `attendeePointsAwarded: 25` in the /leads/scan
   * response. The attendee toast "Attendee earned 25 pts" must appear
   * immediately after the attendee profile card is shown (before Save).
   * The scanner's own header points badge must NOT change.
   */
  test('Path A — attendee earns points when backend returns attendeePointsAwarded', async ({ page }) => {
    test.setTimeout(120_000);

    await installMocks(page, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          data: {
            ...ATTENDEE_LEAD,
            pointsAwarded: 0,            // scanner earns nothing
            attendeePointsAwarded: 25,   // attendee earns 25
          },
        }),
      }),
    );

    await loginAndOpenScanner(page);

    // Snapshot the scanner's header points — must stay unchanged after scan.
    const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
    await expect(headerBadge).toBeVisible({ timeout: 8_000 });
    const beforeText = await headerBadge.textContent();
    const beforePoints = parseInt(beforeText!.trim(), 10);

    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    // Attendee profile card appears.
    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 });

    // ── Assert attendee points toast ───────────────────────────────────────
    // showToast("Attendee earned 25 pts") renders a plain text toast — no
    // "+N" badge, no "Points earned!" label (those come from addPoints only).
    await expect(page.getByText(/attendee earned 25 pts/i)).toBeVisible({ timeout: 6_000 });

    // ── Assert scanner earns nothing ───────────────────────────────────────
    await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_500 });
    await expect(page.locator('text=/^\\+\\d+$/')).not.toBeVisible({ timeout: 1_000 });
    await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 3_000 });
  });

  /**
   * Path B: the first /leads/scan call fails (badge not recognized), leaving
   * an "Unknown Attendee" placeholder. When the user presses Save, the second
   * /leads/scan call returns `attendeePointsAwarded: 25`, triggering the
   * attendee toast. The scanner's header badge stays unchanged throughout.
   */
  test('Path B — attendee earns points on Save when backend returns attendeePointsAwarded', async ({ page }) => {
    test.setTimeout(120_000);

    let scanCallCount = 0;

    await installMocks(page, async (route) => {
      scanCallCount++;
      if (scanCallCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            success: false,
            error: { code: 'SCAN_FAILED', message: 'Badge not recognized.' },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          data: {
            ...ATTENDEE_LEAD,
            pointsAwarded: 0,
            attendeePointsAwarded: 25,
          },
        }),
      });
    });

    await loginAndOpenScanner(page);

    const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
    await expect(headerBadge).toBeVisible({ timeout: 8_000 });
    const beforeText = await headerBadge.textContent();
    const beforePoints = parseInt(beforeText!.trim(), 10);

    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    // First scan failed — audience lookup also empty → Unknown Attendee.
    await expect(page.getByText('Unknown Attendee')).toBeVisible({ timeout: 10_000 });

    // The join-event toast ("Joined the event! · Points earned!") auto-dismisses
    // after a few seconds. Wait for it to clear before asserting no scan toast.
    await expect(page.getByText(/joined the event/i)).not.toBeVisible({ timeout: 8_000 });

    // No scan-related toast before Save.
    await expect(page.getByText(/attendee earned/i)).not.toBeVisible({ timeout: 1_500 });
    await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_000 });

    // Press Save — triggers the second /leads/scan.
    await page.getByRole('button', { name: /save lead/i }).click();

    // Attendee toast must appear after Save.
    await expect(page.getByText(/attendee earned 25 pts/i)).toBeVisible({ timeout: 8_000 });

    // Scanner header unchanged throughout.
    await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 5_000 });
    await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_000 });
  });

  /**
   * No attendee toast when `attendeePointsAwarded` is absent or 0 (backend
   * signals a duplicate scan or intentionally awards nothing). Neither the
   * attendee toast nor any scanner points toast should appear; the header
   * must remain unchanged.
   */
  test('no toast when backend returns no attendeePointsAwarded (or 0)', async ({ page }) => {
    test.setTimeout(120_000);

    await installMocks(page, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          data: {
            ...ATTENDEE_LEAD,
            pointsAwarded: 0,
            attendeePointsAwarded: 0,  // duplicate / no award
          },
        }),
      }),
    );

    await loginAndOpenScanner(page);

    const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
    await expect(headerBadge).toBeVisible({ timeout: 8_000 });
    const beforeText = await headerBadge.textContent();
    const beforePoints = parseInt(beforeText!.trim(), 10);

    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 });

    // No toasts.
    await expect(page.getByText(/attendee earned/i)).not.toBeVisible({ timeout: 2_000 });
    await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 500 });
    await expect(page.locator('text=/^\\+\\d+$/')).not.toBeVisible({ timeout: 500 });

    // Header unchanged.
    await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 3_000 });
  });

  /**
   * Path B duplicate guard: first scan fails (badge not recognized), user
   * presses Save, and the second /leads/scan returns `attendeePointsAwarded: 0`
   * — signalling a duplicate. No attendee toast and no scanner toast must fire.
   */
  test('Path B — no toast when Save-time scan returns attendeePointsAwarded: 0', async ({ page }) => {
    test.setTimeout(120_000);

    let scanCallCount = 0;

    await installMocks(page, async (route) => {
      scanCallCount++;
      if (scanCallCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            success: false,
            error: { code: 'SCAN_FAILED', message: 'Badge not recognized.' },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          data: {
            ...ATTENDEE_LEAD,
            pointsAwarded: 0,
            attendeePointsAwarded: 0,
          },
        }),
      });
    });

    await loginAndOpenScanner(page);

    const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
    await expect(headerBadge).toBeVisible({ timeout: 8_000 });
    const beforeText = await headerBadge.textContent();
    const beforePoints = parseInt(beforeText!.trim(), 10);

    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    await expect(page.getByText('Unknown Attendee')).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /save lead/i }).click();

    await expect(page.getByText(/attendee earned/i)).not.toBeVisible({ timeout: 2_000 });
    await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 500 });
    await expect(page.locator('text=/^\\+\\d+$/')).not.toBeVisible({ timeout: 500 });
    await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 3_000 });
  });

  /**
   * Scanner header badge must stay unchanged after every scan regardless of
   * what the backend returns in `pointsAwarded` — the scanner earns nothing.
   * The attendee earns points server-side; `attendeePointsAwarded: 25` in the
   * response shows the confirmation toast without touching the sponsor's total.
   */
  test('scanner header badge stays unchanged — scanner earns no points', async ({ page }) => {
    test.setTimeout(120_000);

    await installMocks(page, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          data: {
            ...ATTENDEE_LEAD,
            pointsAwarded: 25,           // server-side value; frontend must ignore for scanner
            attendeePointsAwarded: 25,   // attendee earns; toast confirms this
          },
        }),
      }),
    );

    await loginAndOpenScanner(page);

    const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
    await expect(headerBadge).toBeVisible({ timeout: 8_000 });
    const beforeText = await headerBadge.textContent();
    const beforePoints = parseInt(beforeText!.trim(), 10);

    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 });

    // Attendee toast confirms the attendee earned points.
    await expect(page.getByText(/attendee earned 25 pts/i)).toBeVisible({ timeout: 6_000 });

    // Scanner's own header MUST NOT change — addPoints was never called.
    await expect(headerBadge).toHaveText(`${beforePoints} pts`, { timeout: 8_000 });

    // No "+N" badge or "Points earned!" label for the scanner.
    await expect(page.getByText(/points earned/i)).not.toBeVisible({ timeout: 1_000 });
  });
});
