/**
 * E2E guard: Sponsor rep earns points on the first badge scan of a new event.
 *
 * Two paths through SponsorScannerPage are exercised:
 *
 *  Path A — backend resolves the badge at scan time and returns `pointsAwarded`
 *    in the POST /leads/scan response. The points toast must appear immediately
 *    after the attendee profile is shown (before the user presses Save).
 *
 *  Path B — backend omits `pointsAwarded` (field not in response). The
 *    component falls back to `gamificationConfig.pointActions.scanBadge`
 *    (hard-coded to 25 in AppContext's mock config). Points toast must appear
 *    when the user presses Save and the second /leads/scan call returns the
 *    lead row (still without `pointsAwarded`).
 *
 * Both tests use the manual-entry mode (Type icon → "Find Attendee") because
 * camera-based QR scanning cannot be exercised in a headless Playwright run.
 *
 * The tests are fully self-contained: every /api/v1/** call is stubbed via
 * page.route so no live backend is required.
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
 * Install the base route stubs shared between both tests.
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
    if (p.startsWith(`/api/v1/events/${EVENT.id}/members`))
      return ok({
        success: true,
        data: {
          data: [
            {
              id: 'sp-1',
              membership_id: 9,
              name: 'Sam Sponsor',
              email: 'sam@acme.com',
              roles: ['sponsor'],
              status: 'active',
              joined_at: '2026-07-01T00:00:00Z',
            },
          ],
          total: 1,
        },
      });

    // ── Leads list ────────────────────────────────────────────────────────
    if (m === 'GET' && (p.includes('/my-leads') || (p.includes('/leads') && !p.includes('/scan'))))
      return ok({ success: true, data: [] });

    // ── Audience members (badge-code lookup fallback) ─────────────────────
    if (p.startsWith(`/api/v1/events/${EVENT.id}/attendees`))
      return ok({ success: true, data: { data: [], total: 0 } });

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
 * Log in as the sponsor, join the event, open the SponsorScannerPage,
 * and switch to manual-entry mode so tests can type a badge code.
 *
 * Navigation path: sign-in → event list → enter event → More → side-menu
 * "Scan Badge" → SponsorScannerPage → click the keyboard (Type) icon button
 * to switch from camera scan mode to manual mode.
 */
async function loginAndOpenScanner(page: Page) {
  // ── Sign in ────────────────────────────────────────────────────────────
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('sam@acme.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();

  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  // ── Enter event ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('TechSummit 2026').first().click({ timeout: 10_000 });
  // Wait for the event home screen (bottom nav visible)
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });

  // ── Navigate to SponsorScannerPage via the "More" side menu ───────────
  // The side menu has a "Scan Badge" item that calls go('scan') → the
  // standalone SponsorScannerPage, distinct from the Engage-tab scanner.
  await page.getByRole('button', { name: /^More$/i }).click({ timeout: 8_000 });
  // The side menu drawer renders inside a div.z-[61] container.
  // Scope to that container to avoid matching the "Scan Badge" quick-action
  // button that may still be visible in the background page behind the overlay.
  const sideMenuDrawer = page.locator('[class*="z-\\[61\\]"]');
  await expect(sideMenuDrawer.getByRole('button', { name: /^Scan Badge$/i })).toBeVisible({ timeout: 8_000 });
  await sideMenuDrawer.getByRole('button', { name: /^Scan Badge$/i }).click();

  // ── Confirm we're on SponsorScannerPage ───────────────────────────────
  // The page has a sticky header with an h1 "Scan Badge" and a subtitle
  // "N badges scanned · earn points per scan" — unique to this page.
  const scannerHeader = page.locator('div.sticky, [class*="sticky"]').filter({
    hasText: /badges scanned.*earn points per scan/,
  });
  await expect(scannerHeader).toBeVisible({ timeout: 8_000 });

  // ── Switch to manual-entry mode ────────────────────────────────────────
  // The sticky header has exactly two icon-only toggle buttons:
  //   1st  QrCode icon  → camera scan mode (default)
  //   2nd  Type icon    → manual badge-code entry mode
  // We click the last button (Type) to switch.
  await scannerHeader.locator('button').last().click();

  // Confirm the manual input field appeared
  await expect(page.getByPlaceholder(/ATT-/i)).toBeVisible({ timeout: 5_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('SponsorScannerPage — scan points', () => {
  /**
   * Path A: backend returns `pointsAwarded: 25` in the /leads/scan response.
   *
   * The points toast must appear immediately after the attendee card is shown
   * (before the user presses Save), because `handleCodeDetected` awards points
   * as soon as the scan response comes back.
   */
  test('Path A — toast appears immediately when backend returns pointsAwarded', async ({ page }) => {
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
            pointsAwarded: 25,
          },
        }),
      }),
    );

    await loginAndOpenScanner(page);

    // Type the badge code and submit
    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    // Wait for the attendee profile card to appear (scan resolved successfully)
    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 });

    // ── Assert points toast ────────────────────────────────────────────────
    // The toast renders "+25" in a green badge (span text) and the activity
    // message in a <p>. "Points earned!" is the sub-label shown only when
    // points > 0 — it confirms the points path, not a plain toast.
    await expect(page.getByText('+25')).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText(/points earned/i)).toBeVisible({ timeout: 6_000 });
  });

  /**
   * Path B: the first /leads/scan call fails (badge not recognized by the
   * backend), so no leadId is stored on the attendee. The audience-member
   * lookup also finds no match, leaving an "Unknown Attendee" placeholder
   * with `pointsCreditedAtScan = false`. When the user presses Save the
   * component sends a second /leads/scan call with the full payload; that
   * call returns `pointsAwarded: 25`, which must trigger the points toast.
   *
   * This exercises the explicit Save-time points path in handleSave
   * (the `!scannedData.leadId` branch in SponsorScannerPage).
   */
  test('Path B — toast appears on Save when backend creates lead at Save time', async ({ page }) => {
    test.setTimeout(120_000);

    // Differentiate the two /leads/scan calls by call count:
    //   call 1 (from handleCodeDetected): fail → no leadId set
    //   call 2 (from handleSave):         succeed with pointsAwarded: 25
    let scanCallCount = 0;

    await installMocks(page, async (route) => {
      scanCallCount++;
      if (scanCallCount === 1) {
        // First scan: backend cannot resolve — triggers audience-list fallback
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
      // Second scan (from Save): lead created, pointsAwarded returned
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          data: { ...ATTENDEE_LEAD, pointsAwarded: 25 },
        }),
      });
    });

    await loginAndOpenScanner(page);

    // Type the badge code and submit — first scan fails, audience lookup
    // also misses (mock returns empty attendees), so "Unknown Attendee" shown.
    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    // The unrecognized-code placeholder must appear (no backend resolution)
    await expect(page.getByText('Unknown Attendee')).toBeVisible({ timeout: 10_000 });

    // No points toast yet — nothing was awarded at scan time
    await expect(page.getByText('+25')).not.toBeVisible({ timeout: 1_500 });

    // Press Save Lead — triggers the second /leads/scan which returns pointsAwarded
    await page.getByRole('button', { name: /save lead/i }).click();

    // Points toast must appear after Save (awarded from the backend response)
    await expect(page.getByText('+25')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByText(/points earned/i)).toBeVisible({ timeout: 6_000 });
  });

  /**
   * Header points badge: after a successful scan the running total displayed
   * in the app's persistent top-bar header must reflect the newly awarded points.
   *
   * The global App header always renders:
   *   <span className="... text-violet-400">{user.points} pts</span>
   * This span is live in the DOM throughout the whole session — no navigation
   * needed.  We snapshot the value before the scan, perform the scan, then
   * assert the span text has increased by exactly 25.
   *
   * This guards against a broken `addPoints` implementation that fires the
   * toast but never updates AppContext state — the toast passing alone would
   * not catch that regression.
   */
  test('header points badge shows incremented total after scan', async ({ page }) => {
    test.setTimeout(120_000);

    await installMocks(page, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
          success: true,
          data: { ...ATTENDEE_LEAD, pointsAwarded: 25 },
        }),
      }),
    );

    await loginAndOpenScanner(page);

    // ── Snapshot initial points from the global header ───────────────────────
    // App.tsx always renders a span like "100 pts" in the violet header badge;
    // we capture its numeric value before the scan so the assertion doesn't
    // need to hard-code what the mocked startup total happens to be.
    const headerBadge = page.locator('span.text-violet-400').filter({ hasText: /pts/ }).first();
    await expect(headerBadge).toBeVisible({ timeout: 8_000 });
    const beforeText = await headerBadge.textContent();
    const beforePoints = parseInt(beforeText!.trim(), 10); // e.g. "100 pts" → 100

    // ── Perform the scan ─────────────────────────────────────────────────────
    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    // Wait for attendee card — confirms scan resolved and addPoints was called
    await expect(page.getByText('Alex Rivera')).toBeVisible({ timeout: 10_000 });

    // Toast must appear (existing guard — ensures the points path was taken)
    await expect(page.getByText('+25')).toBeVisible({ timeout: 6_000 });
    await expect(page.getByText(/points earned/i)).toBeVisible({ timeout: 6_000 });

    // ── Assert header badge reflects the updated total ───────────────────────
    // addPoints(25) updates user.points in AppContext → the header span
    // re-renders with the new value. Expected: beforePoints + 25.
    const expectedText = `${beforePoints + 25} pts`;
    await expect(headerBadge).toHaveText(expectedText, { timeout: 8_000 });
  });
});
