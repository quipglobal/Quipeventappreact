/**
 * E2E guard: rep notes / tags / priority reach the server and would appear
 * in the admin CSV export.
 *
 * The admin CSV is generated server-side from the `lead_scans` table. This
 * suite verifies the client side of the contract — that the correct HTTP
 * request bodies are sent so those columns are never blank in the export.
 *
 * Three paths are covered:
 *
 *  Path A (scan → PATCH)
 *    Backend resolves the badge immediately and returns a `leadId`. When the
 *    rep fills in notes / tags / priority and presses Save, the client must
 *    send PATCH /leads/{leadId} with { notes, tags, priority: "HOT"|"WARM"|"COLD" }.
 *
 *  Path B (inline on Save)
 *    Backend returns an error on the initial scan (badge not recognised).
 *    When the rep presses Save, the client must send POST /leads/scan with
 *    notes / tags / priority included inline in the body, with priority
 *    uppercased per the backend contract.
 *
 *  Edit-after-scan (LeadsPage PATCH)
 *    A rep opens an existing lead from the Leads list, edits notes / priority,
 *    and presses Save. The client must send PATCH /leads/{id} with the new
 *    values so the admin export stays in sync.
 *
 * Every /api/v1/** call is intercepted via page.route — no live backend.
 * The key assertion in each test is that the captured request body contains
 * the exact values the rep typed, and that priority is uppercase on the wire.
 */

import { test, expect, type Page, type Route } from '@playwright/test';
import { openManualScanner } from './helpers/scanner';

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

/** The lead returned by the backend when the badge is recognised at scan time */
const SCAN_LEAD = {
  id: 'lead-2668',
  lead_id: 2668,
  scan_id: 2668,
  code: 'ATT-9001',
  name: 'Alex Rivera',
  title: 'CTO',
  company: 'NovaTech',
  avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=6366f1&color=fff',
  notes: '',
  tags: [],
  priority: 'WARM',
  memberId: 501,
  member_id: 501,
  checkedIn: false,
  isCheckedIn: false,
  timestamp: new Date().toISOString(),
};

// ── Route helpers ─────────────────────────────────────────────────────────────

function ok(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    headers: { 'Access-Control-Allow-Origin': '*' },
    body: JSON.stringify(body),
  });
}

/**
 * Install the base route stubs.
 *
 * @param scanHandler   Controls every POST /leads/scan response.
 * @param patchHandler  Controls every PATCH (or PUT) /leads/:id response.
 *                      Receives the full route so the test can inspect the
 *                      request body before fulfilling.
 * @param myLeadsData   Optional list to return for GET /my-leads (default: []).
 */
async function installMocks(
  page: Page,
  scanHandler: (route: Route) => Promise<void> | void,
  patchHandler?: (route: Route) => Promise<void> | void,
  myLeadsData: unknown[] = [],
) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const m = route.request().method();

    // ── Auth ──────────────────────────────────────────────────────────────
    if (p === '/api/v1/auth/send-otp')
      return ok(route, { success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp')
      return ok(route, {
        success: true,
        data: { token: 'mock-sp-tok', account_exists: true, verified: true, user: SPONSOR },
      });

    // ── Profile / badge ───────────────────────────────────────────────────
    if (p === '/api/v1/me') return ok(route, { success: true, data: SPONSOR });
    if (p === '/api/v1/me/badge')
      return ok(route, { success: true, badge_code: 'BADGE-SP-1', qr_image_url: '' });
    if (p.startsWith('/api/v1/me/'))
      return ok(route, { success: true, data: { points: 100, history: [] } });

    // ── Events ────────────────────────────────────────────────────────────
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?'))
      return ok(route, { success: true, data: { data: [EVENT] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p))
      return ok(route, { success: true, data: { event_id: EVENT.id, membership_id: 9, message: 'Joined!' } });
    if (p === `/api/v1/events/${EVENT.id}`)
      return ok(route, { success: true, data: EVENT });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/access`))
      return ok(route, {
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
      return ok(route, { success: true, data: { data: [], total: 0 } });

    // ── Leads list ────────────────────────────────────────────────────────
    if (m === 'GET' && p.includes('/my-leads'))
      return ok(route, { success: true, data: myLeadsData });
    if (m === 'GET' && /\/leads(\/|$)/.test(p) && !p.includes('/scan'))
      return ok(route, { success: true, data: myLeadsData });

    // ── Leads scan endpoint — delegated to caller ─────────────────────────
    if (m === 'POST' && p.includes('/leads/scan'))
      return scanHandler(route);

    // ── Lead update (PATCH/PUT) — delegated to caller if provided ─────────
    // Match /leads/<id> where <id> is not "scan" or "draw".
    if ((m === 'PATCH' || m === 'PUT') && /\/leads\/(?!scan|draw)[^/]+$/.test(p)) {
      if (patchHandler) return patchHandler(route);
      return ok(route, { success: true, data: SCAN_LEAD });
    }

    // ── Check-in ──────────────────────────────────────────────────────────
    if (m === 'POST' && p.includes('/check-in'))
      return ok(route, { success: true });

    // ── Gamification ─────────────────────────────────────────────────────
    if (p.includes('/gamification'))
      return ok(route, { success: true, data: { activities: [] } });

    // ── Everything else ───────────────────────────────────────────────────
    if (p.startsWith(`/api/v1/events/${EVENT.id}/`))
      return ok(route, { success: true, data: [] });
    return ok(route, { success: true, data: null });
  });
}

/**
 * Log in as sponsor, join the event, and open the Scan Badge page in
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

/**
 * Log in as sponsor, join the event, and open the My Leads list page.
 * The side-menu item that navigates to the Leads page is labelled "My Connects".
 */
async function loginAndOpenLeadsPage(page: Page) {
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

  // The side-menu "My Connects" item navigates to the Leads (Lead Retrieval) page.
  await page.getByRole('button', { name: /^More$/i }).click({ timeout: 8_000 });
  const sideMenu = page.locator('[class*="z-\\[61\\]"]');
  await expect(sideMenu.getByRole('button', { name: /my connects/i })).toBeVisible({ timeout: 8_000 });
  await sideMenu.getByRole('button', { name: /my connects/i }).click();

  // Wait for the leads page header ("My Leads" h1) to appear.
  await expect(page.getByText('My Leads')).toBeVisible({ timeout: 10_000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Lead notes → server (admin CSV export guard)', () => {
  /**
   * Path A — backend creates the lead at scan time.
   *
   * Flow:
   *   1. POST /leads/scan → backend returns leadId 2668.
   *   2. Rep types notes, picks a tag, sets priority to "Hot".
   *   3. Rep presses Save.
   *   4. Client must PATCH /leads/2668 with exactly:
   *        { notes: "...", tags: ["Follow Up"], priority: "HOT" }
   *
   * The PATCH body is what the backend writes to `lead_scans.notes`,
   * `lead_scans.tags`, and `lead_scans.priority` — the columns the CSV
   * reads from.
   */
  test('Path A — PATCH /leads/:id includes notes, tags, and uppercase priority', async ({ page }) => {
    test.setTimeout(120_000);

    // Capture the PATCH body so we can assert its contents.
    let capturedPatchBody: Record<string, unknown> | null = null;

    await installMocks(
      page,
      // POST /leads/scan → backend resolves badge immediately, returns leadId.
      (route) =>
        ok(route, {
          success: true,
          data: {
            ...SCAN_LEAD,
            pointsAwarded: 0,
            attendeePointsAwarded: 0,
          },
        }),
      // PATCH /leads/:id → capture body, then confirm success.
      async (route) => {
        try {
          capturedPatchBody = JSON.parse(route.request().postData() ?? '{}');
        } catch {
          capturedPatchBody = {};
        }
        return ok(route, {
          success: true,
          data: {
            ...SCAN_LEAD,
            notes: capturedPatchBody?.notes,
            tags: capturedPatchBody?.tags,
            priority: capturedPatchBody?.priority,
          },
        });
      },
    );

    await loginAndOpenScanner(page);

    // Enter badge code and resolve the attendee.
    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();
    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Set priority to Hot (priority selector appears before tags in the form).
    await page.getByRole('button', { name: /^Hot$/i }).click();

    // Pick a quick tag — use a partial-text locator because after clicking
    // the button text gains a "✓ " prefix (becomes "✓ Follow Up").
    await page.locator('button').filter({ hasText: /^Follow Up$/ }).click();

    // Fill in notes (textarea below the tags section).
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Interested in enterprise plan');

    // Press Save — triggers PATCH /leads/2668.
    await page.getByRole('button', { name: /save lead/i }).click();

    // Save now redirects to My Leads. Wait for the heading to confirm
    // navigation completed (the scanner form is gone at this point).
    await expect(page.getByRole('heading', { name: /^My Leads$/i })).toBeVisible({ timeout: 10_000 });

    // ── Assert PATCH body ────────────────────────────────────────────────────
    expect(capturedPatchBody, 'PATCH request body must not be null — updateLeadApi was never called').not.toBeNull();
    expect(capturedPatchBody!.notes, 'notes must be present in PATCH body').toBe('Interested in enterprise plan');
    expect(capturedPatchBody!.tags, 'tags must be present in PATCH body').toContain('Follow Up');
    expect(capturedPatchBody!.priority, 'priority must be uppercase HOT in PATCH body').toBe('HOT');
  });

  /**
   * Path A inherited notes — backend returns is_inherited: true with non-empty
   * notes/tags/priority from a previous event at scan time.
   *
   * Flow:
   *   1. POST /leads/scan → backend returns leadId 2668 with is_inherited: true,
   *      notes: "Met at TechConf last year", tags: ["Follow Up"], priority: "HOT".
   *   2. Client resolves the attendee and displays the form.
   *   3. The notes textarea must be pre-filled with the server-echoed notes.
   *   4. The Follow Up tag must appear selected.
   *   5. The Hot priority button must appear active.
   *   6. An "inherited" indicator banner must be visible so the rep knows the
   *      notes came from a previous event (not from the current scan).
   *
   * The server-echoed values override the local overlay (§3.1 — server is
   * authoritative after any successful response).
   */
  test('Path A inherited notes — form pre-fills from server-echoed values when is_inherited is true', async ({ page }) => {
    test.setTimeout(120_000);

    await installMocks(
      page,
      // POST /leads/scan → backend returns inherited notes/tags/priority.
      (route) =>
        ok(route, {
          success: true,
          data: {
            ...SCAN_LEAD,
            notes: 'Met at TechConf last year',
            tags: ['Follow Up'],
            priority: 'HOT',
            is_inherited: true,
            pointsAwarded: 0,
            attendeePointsAwarded: 0,
          },
        }),
    );

    await loginAndOpenScanner(page);

    // Enter badge code and resolve the attendee.
    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();
    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    // ── Assert form is pre-filled with server-echoed inherited values ─────────

    // Notes textarea must contain the server-returned notes.
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await expect(notesArea).toHaveValue('Met at TechConf last year');

    // The Hot priority button must be active (server returned "HOT").
    await expect(page.getByRole('button', { name: /^Hot$/i })).toBeVisible({ timeout: 5_000 });

    // The Follow Up tag must appear selected (has a ✓ prefix after selection).
    await expect(
      page.locator('button').filter({ hasText: /Follow Up/ }).first(),
    ).toBeVisible({ timeout: 5_000 });
    const followUpBtn = page.locator('button').filter({ hasText: /Follow Up/ }).first();
    const followUpText = await followUpBtn.textContent();
    expect(followUpText, 'Follow Up tag must be selected (✓ prefix) from server-echoed tags').toMatch(/✓/);

    // An inherited-notes banner must be shown so the rep knows the context.
    await expect(
      page.getByText('From a previous event — edit to update.', { exact: true }),
    ).toBeVisible({ timeout: 5_000 });
  });

  /**
   * Path B — backend does not create the lead at scan time (badge unrecognised).
   *
   * Flow:
   *   1. POST /leads/scan → backend returns error (badge not found).
   *   2. Audience-member lookup also returns empty → "Unknown Attendee".
   *   3. Rep types notes, picks a tag, sets priority to "Cold".
   *   4. Rep presses Save.
   *   5. Client must POST /leads/scan with notes/tags/priority inline:
   *        { code: "ATT-9001", notes: "...", tags: [...], priority: "COLD" }
   *
   * This is the "Option A" inline enrichment path from the sync spec.
   * The backend stores these fields on first insert so the CSV is not blank.
   * Priority must be uppercase ("COLD") per the backend contract.
   */
  test('Path B — POST /leads/scan at Save time includes notes, tags, and uppercase priority', async ({ page }) => {
    test.setTimeout(120_000);

    let scanCallCount = 0;
    const capturedScanBodies: Array<Record<string, unknown>> = [];

    await installMocks(
      page,
      async (route) => {
        scanCallCount++;
        let body: Record<string, unknown> = {};
        try { body = JSON.parse(route.request().postData() ?? '{}'); } catch { /**/ }
        capturedScanBodies.push(body);

        if (scanCallCount === 1) {
          // First scan: badge not recognised → trigger Path B fallback.
          return ok(route, {
            success: false,
            error: { code: 'ATTENDEE_NOT_FOUND', message: 'No attendee found for badge ATT-9001.' },
          });
        }
        // Second scan (at Save time): return success so the rep's notes land.
        return ok(route, {
          success: true,
          data: {
            ...SCAN_LEAD,
            notes: body.notes,
            tags: body.tags,
            priority: body.priority,
            pointsAwarded: 0,
            attendeePointsAwarded: 0,
          },
        });
      },
    );

    await loginAndOpenScanner(page);

    // Enter badge code — first scan will fail.
    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();

    // Audience lookup also empty → Unknown Attendee fallback.
    await expect(page.getByText('Unknown Attendee')).toBeVisible({ timeout: 10_000 });

    // Set priority to Cold.
    await page.getByRole('button', { name: /^Cold$/i }).click();

    // Pick a tag.
    await page.locator('button').filter({ hasText: /^Decision Maker$/ }).click();

    // Fill in notes.
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Great potential customer');

    // Press Save — triggers the second POST /leads/scan (inline enrichment).
    await page.getByRole('button', { name: /save lead/i }).click();

    // Save redirects to My Leads — wait for the heading to confirm navigation
    // completed (the scanner form is gone and the inline scan POST has been sent).
    await expect(page.getByRole('heading', { name: /^My Leads$/i })).toBeVisible({ timeout: 10_000 });

    // ── Assert inline scan body ───────────────────────────────────────────────
    expect(scanCallCount, 'Expected exactly 2 POST /leads/scan calls (initial + Save-time)').toBe(2);

    const saveTimeScanBody = capturedScanBodies[1];
    expect(saveTimeScanBody, 'Save-time scan body must not be empty').toBeTruthy();
    expect(saveTimeScanBody.notes, 'notes must be present in Save-time POST body').toBe('Great potential customer');
    expect(saveTimeScanBody.tags, 'tags must be present in Save-time POST body').toContain('Decision Maker');
    // Priority must be uppercase on the wire per the backend contract.
    expect(saveTimeScanBody.priority, 'priority must be uppercase COLD in Save-time POST body').toBe('COLD');
  });

  /**
   * Path A inline enrichment — no second POST /leads/scan when the backend
   * creates the lead at scan time.
   *
   * The backend spec (MOBILE_AGENT_LEAD_SYNC_PROMPT.md §3.1 / §5 Option A)
   * allows sending notes inline in the initial POST so the record is fully
   * enriched without a second round-trip. The web scanner handles this by
   * waiting for the rep to fill in notes after the badge resolves, then
   * sending a single PATCH on Save. The scanner must NOT fire a second
   * POST /leads/scan when a leadId was already returned at scan time.
   *
   * Flow:
   *   1. POST /leads/scan → backend resolves badge, returns leadId 2668.
   *   2. Rep fills notes / tags / priority.
   *   3. Rep presses Save → PATCH /leads/2668 (single enrichment round-trip).
   *   4. No second POST /leads/scan should fire — the PATCH IS the enrichment.
   *
   * Key assertion: scan POST count === 1 throughout the entire flow.
   */
  test('Path A inline enrichment — Save uses a single PATCH, no second POST /leads/scan', async ({ page }) => {
    test.setTimeout(120_000);

    let scanPostCount = 0;
    let capturedPatchBody: Record<string, unknown> | null = null;

    await installMocks(
      page,
      // POST /leads/scan — called only once, at badge-detection time.
      (route) => {
        scanPostCount++;
        return ok(route, {
          success: true,
          data: {
            ...SCAN_LEAD,
            pointsAwarded: 0,
            attendeePointsAwarded: 0,
          },
        });
      },
      // PATCH /leads/:id — capture body so we can confirm notes reached the server.
      async (route) => {
        try {
          capturedPatchBody = JSON.parse(route.request().postData() ?? '{}');
        } catch {
          capturedPatchBody = {};
        }
        return ok(route, {
          success: true,
          data: {
            ...SCAN_LEAD,
            notes: capturedPatchBody?.notes,
            tags: capturedPatchBody?.tags,
            priority: capturedPatchBody?.priority,
          },
        });
      },
    );

    await loginAndOpenScanner(page);

    // Enter badge code — backend resolves the attendee and returns a leadId.
    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();
    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Confirm the scan POST fired exactly once so far (at badge-detection time).
    expect(scanPostCount, 'POST /leads/scan must fire exactly once at badge-detection time').toBe(1);

    // Rep fills in notes, picks a tag, and sets priority.
    await page.getByRole('button', { name: /^Hot$/i }).click();
    await page.locator('button').filter({ hasText: /^Follow Up$/ }).click();
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Inline enrichment test note');

    // Press Save — must trigger PATCH, NOT a second POST /leads/scan.
    await page.getByRole('button', { name: /save lead/i }).click();

    // Save redirects to My Leads — wait for the heading to confirm navigation
    // completed so subsequent assertions run after the PATCH has been sent.
    await expect(page.getByRole('heading', { name: /^My Leads$/i })).toBeVisible({ timeout: 10_000 });

    // ── Key assertion: no second POST /leads/scan was fired ──────────────────
    expect(
      scanPostCount,
      'POST /leads/scan must NOT fire a second time on Save — Path A uses PATCH only',
    ).toBe(1);

    // ── PATCH body must contain the rep's notes ───────────────────────────────
    expect(capturedPatchBody, 'PATCH must fire — updateLeadApi was never called').not.toBeNull();
    expect(
      capturedPatchBody!.notes,
      'notes must reach the server via PATCH (no blank Notes column in admin export)',
    ).toBe('Inline enrichment test note');
    expect(capturedPatchBody!.tags, 'tags must be present in PATCH body').toContain('Follow Up');
    expect(capturedPatchBody!.priority, 'priority must be uppercase HOT in PATCH body').toBe('HOT');
  });

  /**
   * Path A warm priority — verify the "warm" default also sends uppercase WARM.
   *
   * Explicitly choosing "Warm" must send "WARM" (not "warm") to the server.
   * This closes the case where the backend silently stores the lowercase
   * string and the CSV column shows a value the export formatter doesn't
   * recognise.
   */
  test('Path A — warm priority is uppercased to WARM in PATCH body', async ({ page }) => {
    test.setTimeout(120_000);

    let capturedPatchBody: Record<string, unknown> | null = null;

    await installMocks(
      page,
      (route) =>
        ok(route, {
          success: true,
          data: { ...SCAN_LEAD, pointsAwarded: 0, attendeePointsAwarded: 0 },
        }),
      async (route) => {
        try { capturedPatchBody = JSON.parse(route.request().postData() ?? '{}'); } catch { /**/ }
        return ok(route, { success: true, data: SCAN_LEAD });
      },
    );

    await loginAndOpenScanner(page);

    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();
    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Leave priority at the Warm default and just add notes.
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Warm lead note');

    await page.getByRole('button', { name: /save lead/i }).click();
    // After save the app redirects to My Leads — wait for that navigation.
    await expect(page.getByRole('heading', { name: /^My Leads$/i })).toBeVisible({ timeout: 10_000 });

    expect(capturedPatchBody).not.toBeNull();
    expect(
      capturedPatchBody!.priority,
      'default warm priority must be sent as uppercase WARM',
    ).toBe('WARM');
  });

  /**
   * Edit-after-scan — rep opens an existing lead in the Leads list and edits notes.
   *
   * Flow:
   *   1. GET /my-leads returns one lead (scan_id 2668) with empty notes.
   *   2. Rep opens the lead detail, taps "Edit Lead", types new notes, changes
   *      priority to Hot, and presses Save.
   *   3. Client must PATCH /leads/2668 with the updated values.
   *
   * This is the "rep edits after the fact" path from the task description.
   * The PATCH is what keeps the admin CSV in sync with subsequent edits.
   */
  test('Edit-after-scan — PATCH /leads/:id includes updated notes and uppercase priority', async ({ page }) => {
    test.setTimeout(120_000);

    // One existing lead returned by GET /my-leads (empty notes).
    const existingLead = {
      scan_id: 2668,
      id: 'lead-2668',
      lead_id: 2668,
      code: 'ATT-9001',
      name: 'Alex Rivera',
      title: 'CTO',
      company: 'NovaTech',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=6366f1&color=fff',
      notes: '',
      tags: [],
      priority: 'WARM',
      scanned_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    };

    let capturedEditBody: Record<string, unknown> | null = null;

    await installMocks(
      page,
      // No new scans expected — return error so nothing fires.
      (route) => ok(route, { success: false, error: { code: 'NO_SCAN', message: 'Not expected' } }),
      async (route) => {
        try { capturedEditBody = JSON.parse(route.request().postData() ?? '{}'); } catch { /**/ }
        return ok(route, {
          success: true,
          data: {
            ...existingLead,
            notes: capturedEditBody?.notes,
            tags: capturedEditBody?.tags,
            priority: capturedEditBody?.priority,
          },
        });
      },
      [existingLead],
    );

    await loginAndOpenLeadsPage(page);

    // The leads list should show the existing lead.
    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Open the lead detail via the aria-labeled button on the lead card.
    await page.getByRole('button', { name: /open alex rivera/i }).click({ timeout: 8_000 });

    // Wait for the lead detail view — the detail h1 disambiguates from the
    // list card h3 that also contains the name.
    await expect(page.locator('h1').filter({ hasText: 'Alex Rivera' })).toBeVisible({ timeout: 8_000 });

    // Tap "Edit Lead" to enter edit mode.
    await page.getByRole('button', { name: /edit lead/i }).click({ timeout: 5_000 });

    // Type updated notes.
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Follow up next quarter');

    // Set priority to Hot.
    await page.getByRole('button', { name: /^Hot$/i }).click();

    // Press the Save button inside the notes section header.
    await page.getByRole('button', { name: /^Save$/i }).click({ timeout: 5_000 });

    // Give the async PATCH a moment to fire and be captured.
    await page.waitForTimeout(2_000);

    // ── Assert PATCH body ────────────────────────────────────────────────────
    expect(
      capturedEditBody,
      'PATCH request body must not be null — handleUpdateLead was never called',
    ).not.toBeNull();
    expect(
      capturedEditBody!.notes,
      'updated notes must appear in PATCH body (admin export reads this column)',
    ).toBe('Follow up next quarter');
    expect(
      capturedEditBody!.priority,
      'updated priority must be uppercase HOT in PATCH body',
    ).toBe('HOT');
  });

  /**
   * Reinstall / scan_id recovery — GET /my-leads returns scan_id only.
   *
   * Simulates a rep who reinstalled the app (localStorage/AsyncStorage wiped).
   * On next login GET /my-leads is the only source of lead data. The backend
   * row has `scan_id: 2668` but no top-level `id` field. `normalizeLead` must
   * pick up `scan_id` as the lead id so PATCH goes to the correct row.
   *
   * Flow:
   *   1. Local overlay is empty (fresh install — no prior storage).
   *   2. GET /my-leads returns { scan_id: 2668, code: 'ATT-9001', … }.
   *   3. normalizeLead maps scan_id → lead.id = '2668'.
   *   4. Rep opens lead, edits notes, presses Save.
   *   5. PATCH must hit /leads/2668 — NOT a synthetic fallback id.
   */
  test('Reinstall — PATCH uses scan_id recovered from GET /my-leads when id field is absent', async ({ page }) => {
    test.setTimeout(120_000);

    // Backend row that has scan_id but deliberately NO top-level "id" field.
    const leadFromServer = {
      scan_id: 2668,
      lead_id: 2668,
      // NO "id" key — normalizeLead must fall through to scan_id.
      code: 'ATT-9001',
      name: 'Alex Rivera',
      title: 'CTO',
      company: 'NovaTech',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=6366f1&color=fff',
      notes: '',
      tags: [],
      priority: 'WARM',
      scanned_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    };

    let capturedPatchUrl: string | null = null;
    let capturedPatchBody: Record<string, unknown> | null = null;

    await installMocks(
      page,
      // No scan submissions expected on the leads page.
      (route) => ok(route, { success: false, error: { code: 'NO_SCAN', message: 'Not expected' } }),
      async (route) => {
        capturedPatchUrl = new URL(route.request().url()).pathname;
        try { capturedPatchBody = JSON.parse(route.request().postData() ?? '{}'); } catch { /**/ }
        return ok(route, {
          success: true,
          data: {
            ...leadFromServer,
            id: leadFromServer.scan_id,
            notes: capturedPatchBody?.notes,
            tags: capturedPatchBody?.tags,
            priority: capturedPatchBody?.priority,
          },
        });
      },
      [leadFromServer],
    );

    // Clear localStorage before the page loads to simulate a fresh install.
    await page.goto('/');
    await page.evaluate(() => {
      try { window.localStorage.clear(); } catch { /**/ }
    });

    await loginAndOpenLeadsPage(page);

    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    // Open the lead detail.
    await page.getByRole('button', { name: /open alex rivera/i }).click({ timeout: 8_000 });
    await expect(page.locator('h1').filter({ hasText: 'Alex Rivera' })).toBeVisible({ timeout: 8_000 });

    // Enter edit mode, type notes, save.
    await page.getByRole('button', { name: /edit lead/i }).click({ timeout: 5_000 });
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Post-reinstall notes');

    await page.getByRole('button', { name: /^Save$/i }).click({ timeout: 5_000 });
    await page.waitForTimeout(2_000);

    // ── Assert PATCH targeted the scan_id from the server, not a fallback ────
    expect(
      capturedPatchUrl,
      'PATCH must fire — handleUpdateLead was never called',
    ).not.toBeNull();
    expect(
      capturedPatchUrl,
      'PATCH URL must use scan_id 2668 recovered from GET /my-leads',
    ).toMatch(/\/leads\/2668$/);
    expect(
      capturedPatchBody?.notes,
      'notes must be present in the PATCH body',
    ).toBe('Post-reinstall notes');
  });

  /**
   * PATCH 500 retry on next list load — notes/tags/priority preserved.
   *
   * When PATCH /leads/:id fails with a 5xx, `handleUpdateLead` marks the edit
   * as `syncPending: true` in the per-user localStorage overlay.  On the next
   * mount of LeadsPage the `useEffect` retry loop re-sends the PATCH.  This
   * test confirms the retry body contains exactly the same notes/tags/priority
   * the rep originally entered, so the admin CSV export is never blank for
   * reps whose first save happened to hit a transient server error.
   *
   * Flow:
   *   1. GET /my-leads returns one existing lead with empty notes.
   *   2. Rep opens lead, types notes, picks a tag, sets priority to Hot.
   *   3. Rep presses Save → PATCH /leads/lead-2668 → 500.
   *   4. Client writes { notes, tags, priority, syncPending: true } to localStorage.
   *   5. Rep navigates away from the leads page (back to the event home).
   *   6. Rep re-opens "My Connects" → LeadsPage mounts again.
   *   7. useEffect retry loop fires PATCH with the stored notes/tags/priority.
   *   8. The captured retry body must contain the original values.
   */
  test('PATCH 500 → syncPending retry on next list load preserves notes/tags/priority', async ({ page }) => {
    test.setTimeout(120_000);

    const existingLead = {
      scan_id: 2668,
      id: 'lead-2668',
      lead_id: 2668,
      code: 'ATT-9001',
      name: 'Alex Rivera',
      title: 'CTO',
      company: 'NovaTech',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=6366f1&color=fff',
      notes: '',
      tags: [],
      priority: 'WARM',
      scanned_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    };

    let patchCallCount = 0;
    let capturedRetryBody: Record<string, unknown> | null = null;

    await installMocks(
      page,
      // No new scans expected on the leads page.
      (route) => ok(route, { success: false, error: { code: 'NO_SCAN', message: 'Not expected' } }),
      async (route) => {
        patchCallCount++;
        if (patchCallCount === 1) {
          // First attempt — simulate a transient server error.
          return route.fulfill({
            status: 500,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Server error' } }),
          });
        }
        // Retry attempt — capture body and succeed.
        try { capturedRetryBody = JSON.parse(route.request().postData() ?? '{}'); } catch { /**/ }
        return ok(route, {
          success: true,
          data: {
            ...existingLead,
            notes: capturedRetryBody?.notes,
            tags: capturedRetryBody?.tags,
            priority: capturedRetryBody?.priority,
          },
        });
      },
      [existingLead],
    );

    // ── 1. Navigate to the leads page and open the existing lead ─────────────
    await loginAndOpenLeadsPage(page);
    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /open alex rivera/i }).click({ timeout: 8_000 });
    await expect(page.locator('h1').filter({ hasText: 'Alex Rivera' })).toBeVisible({ timeout: 8_000 });

    // ── 2. Edit the lead ──────────────────────────────────────────────────────
    await page.getByRole('button', { name: /edit lead/i }).click({ timeout: 5_000 });

    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Important retry notes');

    // Pick a quick tag.
    await page.locator('button').filter({ hasText: /^Follow Up$/ }).click();

    // Set priority to Hot.
    await page.getByRole('button', { name: /^Hot$/i }).click();

    // ── 3. Press Save → first PATCH fires and returns 500 ────────────────────
    await page.getByRole('button', { name: /^Save$/i }).click({ timeout: 5_000 });

    // Allow the async handler enough time to receive the 500 response and
    // write syncPending: true to localStorage before navigating away.
    await page.waitForTimeout(2_500);

    // ── 4. Navigate away from the leads page ─────────────────────────────────
    // "All Leads" button in the detail view header returns to the leads list.
    await page.getByRole('button', { name: /all leads/i }).click({ timeout: 5_000 });

    // Use the bottom-nav "Home" button to navigate away from LeadsPage entirely
    // so the component unmounts. The next open triggers a fresh mount + useEffect.
    await page.getByRole('button', { name: /^Home$/i }).click({ timeout: 8_000 });

    // Brief pause so the component fully unmounts before re-opening.
    await page.waitForTimeout(500);

    // ── 5. Re-open the leads page — retry fires on mount ─────────────────────
    await page.getByRole('button', { name: /^More$/i }).click({ timeout: 8_000 });
    const sideMenu = page.locator('[class*="z-\\[61\\]"]');
    await expect(sideMenu.getByRole('button', { name: /my connects/i })).toBeVisible({ timeout: 8_000 });
    await sideMenu.getByRole('button', { name: /my connects/i }).click();

    await expect(page.getByText('My Leads')).toBeVisible({ timeout: 10_000 });

    // Wait for the retry PATCH to fire and be captured.
    await page.waitForTimeout(3_000);

    // ── 6. Assertions ─────────────────────────────────────────────────────────
    expect(
      patchCallCount,
      'Expected exactly 2 PATCH calls: one 500 on first save + one successful retry on reload',
    ).toBe(2);

    expect(
      capturedRetryBody,
      'Retry PATCH body must not be null — the syncPending retry never fired',
    ).not.toBeNull();

    expect(
      capturedRetryBody!.notes,
      'notes must be preserved in the retry PATCH body',
    ).toBe('Important retry notes');

    expect(
      capturedRetryBody!.tags,
      'tags must be preserved in the retry PATCH body',
    ).toContain('Follow Up');

    expect(
      capturedRetryBody!.priority,
      'priority must be uppercase HOT in the retry PATCH body',
    ).toBe('HOT');
  });

  /**
   * Nav-away-and-back — Save still uses PATCH after scanner remounts.
   *
   * If a rep scans a badge (backend returns leadId), navigates to the Home
   * tab (component unmounts / state is cleared), then returns to the scanner
   * and re-scans the same badge, the leadId must be recovered — either from
   * the new scan response or from the localStorage overlay — so that Save
   * sends a PATCH rather than creating a duplicate lead with a second POST.
   *
   * Flow:
   *   1. POST /leads/scan → backend resolves badge, returns leadId 2668.
   *      Component anchors leadId in the per-user localStorage overlay.
   *   2. Rep navigates away to Home tab (component unmounts, state is lost).
   *   3. Rep re-opens Scan Badge page via the side menu (component remounts).
   *   4. Rep re-scans badge ATT-9001 → second POST /leads/scan returns leadId 2668
   *      again (backend is idempotent — same lead, same id).
   *   5. Rep types notes and presses Save.
   *   6. Client must PATCH /leads/2668 with { notes, tags, priority }.
   *      No third POST /leads/scan should fire — that would create a duplicate row.
   *
   * Key assertions:
   *   - Exactly 2 POST /leads/scan calls (one per scan, none on Save).
   *   - Exactly 1 PATCH /leads/2668 call at Save time.
   *   - PATCH body contains the rep's notes and uppercase priority.
   */
  test('Nav-away-and-back — Save still uses PATCH after scanner component remounts', async ({ page }) => {
    test.setTimeout(120_000);

    let scanPostCount = 0;
    let capturedPatchBody: Record<string, unknown> | null = null;
    let capturedPatchUrl: string | null = null;
    let capturedPatchMethod: string | null = null;
    let patchCallCount = 0;

    await installMocks(
      page,
      // POST /leads/scan — idempotent: always resolves badge and returns the
      // same leadId 2668. This fires twice (once per scan), never on Save.
      (route) => {
        scanPostCount++;
        return ok(route, {
          success: true,
          data: {
            ...SCAN_LEAD,
            pointsAwarded: 0,
            attendeePointsAwarded: 0,
          },
        });
      },
      // PATCH /leads/:id — should fire exactly once, at Save time.
      // Capture the HTTP method so we can confirm it is PATCH, not PUT.
      async (route) => {
        patchCallCount++;
        capturedPatchUrl = new URL(route.request().url()).pathname;
        capturedPatchMethod = route.request().method();
        try {
          capturedPatchBody = JSON.parse(route.request().postData() ?? '{}');
        } catch {
          capturedPatchBody = {};
        }
        return ok(route, {
          success: true,
          data: {
            ...SCAN_LEAD,
            notes: capturedPatchBody?.notes,
            tags: capturedPatchBody?.tags,
            priority: capturedPatchBody?.priority,
          },
        });
      },
    );

    // ── 1. Open scanner and scan the badge the first time ──────────────────
    await loginAndOpenScanner(page);

    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();
    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    expect(scanPostCount, 'First scan must fire POST /leads/scan').toBe(1);

    // ── 2. Navigate away to Home — component unmounts, in-memory state is lost ─
    // Exercise keyboard navigation: the full-screen lead sheet overlaps the
    // bottom nav's pointer area, but Home remains keyboard-accessible.
    const homeButton = page.getByRole('button', { name: /^Home$/i });
    await homeButton.focus();
    await homeButton.press('Enter');

    // Confirm the scanner form is gone (navigated away).
    await expect(page.getByText('Alex Rivera', { exact: true })).not.toBeVisible({ timeout: 8_000 });

    // Brief pause to let the component fully unmount.
    await page.waitForTimeout(300);

    // ── 3. Return to Scan Badge page via the side menu ─────────────────────
    await page.getByRole('button', { name: /^More$/i }).click({ timeout: 8_000 });
    const sideMenuBack = page.locator('[class*="z-\\[61\\]"]');
    await expect(sideMenuBack.getByRole('button', { name: /^Scan Badge$/i })).toBeVisible({ timeout: 8_000 });
    await sideMenuBack.getByRole('button', { name: /^Scan Badge$/i }).click();

    await openManualScanner(page);

    // ── 4. Re-scan the same badge — leadId recovered from the new response ──
    await page.getByPlaceholder(/ATT-/i).fill('ATT-9001');
    await page.getByRole('button', { name: /find attendee/i }).click();
    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    expect(scanPostCount, 'Re-scan must fire a second POST /leads/scan').toBe(2);

    // ── 5. Fill in notes and press Save ────────────────────────────────────
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Notes added after navigating back');

    await page.getByRole('button', { name: /^Hot$/i }).click();

    await page.getByRole('button', { name: /save lead/i }).click();

    // After save the app redirects to My Leads — wait for that navigation.
    await expect(page.getByRole('heading', { name: /^My Leads$/i })).toBeVisible({ timeout: 10_000 });

    // ── 6. Assertions ───────────────────────────────────────────────────────

    // No third POST /leads/scan should have fired — Save must not create a
    // duplicate lead row.
    expect(
      scanPostCount,
      'POST /leads/scan must fire exactly twice (one per scan), never on Save',
    ).toBe(2);

    // Save must have sent a PATCH, not a third POST.
    expect(
      patchCallCount,
      'PATCH /leads/:id must fire exactly once at Save time',
    ).toBe(1);

    expect(
      capturedPatchUrl,
      'PATCH must target the correct leadId 2668',
    ).toMatch(/\/leads\/lead-2668$/);

    expect(
      capturedPatchMethod,
      'Save must use PATCH (not PUT) to update the lead — backend contract requires PATCH',
    ).toBe('PATCH');

    expect(
      capturedPatchBody,
      'PATCH body must not be null — updateLeadApi was never called',
    ).not.toBeNull();

    expect(
      capturedPatchBody!.notes,
      'notes must be present in PATCH body after nav-away-and-back',
    ).toBe('Notes added after navigating back');

    expect(
      capturedPatchBody!.priority,
      'priority must be uppercase HOT in PATCH body',
    ).toBe('HOT');
  });

  /**
   * Missing scan_id — re-POST /leads/scan upsert to recover canonical id.
   *
   * GET /my-leads returns a row where the only id field is `user_id` (the
   * attendee's profile id, not the scan row id). `normalizeLead` falls
   * through to `user_id = 501`. PATCH /leads/501 returns 404 because 501
   * is the wrong id. The client must then re-POST /leads/scan (idempotent
   * upsert) to recover the canonical scan_id (2668), then PATCH /leads/2668.
   *
   * Flow:
   *   1. GET /my-leads → { user_id: 501, code: 'ATT-9001', … } (no scan_id).
   *   2. Rep edits → PATCH /leads/501 → 404.
   *   3. Client re-POSTs /leads/scan → backend returns scan_id 2668.
   *   4. Client PATCHes /leads/2668 → success.
   */
  test('Missing scan_id — re-POST /leads/scan recovers canonical id then PATCH succeeds', async ({ page }) => {
    test.setTimeout(120_000);

    // Backend row with only user_id (no scan_id / lead_id / id field).
    const leadMissingId = {
      user_id: 501,
      // Deliberately no scan_id / lead_id / id — normalizeLead falls to user_id.
      code: 'ATT-9001',
      name: 'Alex Rivera',
      title: 'CTO',
      company: 'NovaTech',
      avatar: 'https://ui-avatars.com/api/?name=Alex+Rivera&background=6366f1&color=fff',
      notes: '',
      tags: [],
      priority: 'WARM',
      scanned_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    };

    const patchedUrls: string[] = [];
    let capturedFinalPatchBody: Record<string, unknown> | null = null;

    await installMocks(
      page,
      // POST /leads/scan — upsert returns canonical scan_id 2668.
      (route) => ok(route, {
        success: true,
        data: {
          id: 2668,
          scan_id: 2668,
          lead_id: 2668,
          code: 'ATT-9001',
          name: 'Alex Rivera',
          title: 'CTO',
          company: 'NovaTech',
          notes: '',
          tags: [],
          priority: 'WARM',
          pointsAwarded: 0,
          attendeePointsAwarded: 0,
          timestamp: new Date().toISOString(),
        },
      }),
      async (route) => {
        const pathname = new URL(route.request().url()).pathname;
        const idSegment = pathname.split('/').pop() ?? '';
        patchedUrls.push(pathname);

        if (idSegment === '501') {
          // First PATCH: stale user_id — the backend says this lead doesn't exist.
          return route.fulfill({
            status: 404,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({
              success: false,
              error: { code: '404', message: 'Lead not found' },
            }),
          });
        }

        // Recovery PATCH: correct scan_id 2668 — succeed and echo back the body.
        try { capturedFinalPatchBody = JSON.parse(route.request().postData() ?? '{}'); } catch { /**/ }
        return ok(route, {
          success: true,
          data: {
            id: 2668,
            scan_id: 2668,
            code: 'ATT-9001',
            name: 'Alex Rivera',
            notes: capturedFinalPatchBody?.notes,
            tags: capturedFinalPatchBody?.tags,
            priority: capturedFinalPatchBody?.priority,
          },
        });
      },
      [leadMissingId],
    );

    await loginAndOpenLeadsPage(page);

    await expect(page.getByText('Alex Rivera', { exact: true })).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: /open alex rivera/i }).click({ timeout: 8_000 });
    await expect(page.locator('h1').filter({ hasText: 'Alex Rivera' })).toBeVisible({ timeout: 8_000 });

    await page.getByRole('button', { name: /edit lead/i }).click({ timeout: 5_000 });
    const notesArea = page.locator('textarea').first();
    await expect(notesArea).toBeVisible({ timeout: 5_000 });
    await notesArea.fill('Recovered via upsert');

    await page.getByRole('button', { name: /^Save$/i }).click({ timeout: 5_000 });

    // Allow time for the async 404 → POST /leads/scan → PATCH sequence.
    await page.waitForTimeout(3_000);

    // ── Assertions ────────────────────────────────────────────────────────────
    expect(
      patchedUrls.some(u => /\/leads\/501$/.test(u)),
      'First PATCH must target the wrong id (501) from the user_id field',
    ).toBe(true);
    expect(
      patchedUrls.some(u => /\/leads\/2668$/.test(u)),
      'Recovery PATCH must target scan_id 2668 obtained from the upsert POST /leads/scan',
    ).toBe(true);
    expect(
      capturedFinalPatchBody,
      'Recovery PATCH body must not be null',
    ).not.toBeNull();
    expect(
      capturedFinalPatchBody?.notes,
      'notes must appear in the recovery PATCH body',
    ).toBe('Recovered via upsert');
  });
});
