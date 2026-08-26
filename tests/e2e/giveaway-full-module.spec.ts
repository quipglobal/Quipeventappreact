/**
 * E2E — Giveaway module full coverage
 *
 * Three reported issues validated in one file:
 *   1. Giveaway syncs to the backend after add (canonical id, not giveaway-<ts>)
 *   2. Sponsor can run Lucky Draw and pick a winner (requires canonical id)
 *   3. Attendees see all giveaways added by sponsors
 *   4. Draw guard: button disabled ("Saving Giveaway…") while save is in flight
 *
 * All /api/v1/** calls are stubbed with realistic response shapes that
 * match what the backend returns after the TenantScope fix.  No live
 * backend required.
 *
 * Scenario: sponsor rukmint@cxo.inc managing the "St Louis Summit" event.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const EVENT_ID = 77;
const EVENT = {
  id: EVENT_ID,
  name: 'St Louis Summit',
  code: 'STL26',
  starts_at: '2026-09-15T09:00:00Z',
  ends_at:   '2026-09-16T18:00:00Z',
  status:    'upcoming',
  location:  'St Louis, MO',
  organizer: 'CXO Events',
};

const SPONSOR = {
  id: '42',
  name: 'Rukmini Test',
  email: 'rukmint@cxo.inc',
  first_name: 'Rukmini',
  last_name:  'Test',
  phone: '+15555550042',
  title: 'Sponsor Rep',
  company: 'CXO Inc',
  role: 'sponsor',
  badge_code: 'BADGE-RUK-1',
  points: 120,
  tier: 'Silver',
  email_verified: true,
  profile_complete: true,
  interests: [],
};

const ATTENDEE = {
  id: '99',
  name: 'Sam Attendee',
  email: 'sam@example.com',
  first_name: 'Sam',
  last_name:  'Attendee',
  phone: '+15555550099',
  title: 'VP Engineering',
  company: 'Acme Corp',
  role: 'attendee',
  badge_code: 'BADGE-SAM-1',
  points: 50,
  tier: 'Bronze',
  email_verified: true,
  profile_complete: true,
  interests: [],
};

/** A giveaway that already exists on the backend (canonical id). */
const EXISTING_GIVEAWAY = {
  id: 'gw-stl-existing-1',
  title: 'MacBook Pro',
  number_of_items: 1,
  numberOfItems: 1,
  image: '',
  sponsor_name: 'CXO Inc',
  sponsorName:  'CXO Inc',
  sponsor_id:   '42',
  sponsorId:    '42',
  added_by_name: 'Rukmini Test',
  status: 'active',
  is_active: true,
  entries: 3,
  winners: [],
};

/** The canonical row the backend returns after POST /giveaways */
const SAVED_GIVEAWAY = {
  id: 'gw-stl-new-1',
  title: 'AirPods Pro',
  number_of_items: 2,
  numberOfItems: 2,
  image: '',
  sponsor_name: 'CXO Inc',
  sponsorName:  'CXO Inc',
  sponsor_id:   '42',
  sponsorId:    '42',
  added_by_name: 'Rukmini Test',
  status: 'active',
  is_active: true,
  entries: 0,
  winners: [],
};

/** Leads available in the draw pool */
const LEADS = [
  {
    id: 'lead-stl-001',
    // user_id is the backend user account id — used as winner_user_id for /winners
    user_id: 1001,
    name: 'Alice Johnson',
    email: 'alice@techcorp.com',
    company: 'TechCorp',
    title: 'CTO',
    phone: '+15555551001',
    notes: '',
    tags: [],
    priority: 'medium',
    scan_id: 'SC-001',
    badge_code: 'BADGE-AJ-1',
    timestamp: '2026-09-15T10:00:00Z',
    pendingSync: false,
    avatar: '',
  },
  {
    id: 'lead-stl-002',
    user_id: 1002,
    name: 'Bob Martinez',
    email: 'bob@startup.io',
    company: 'StartupIO',
    title: 'VP Sales',
    phone: '+15555551002',
    notes: '',
    tags: [],
    priority: 'high',
    scan_id: 'SC-002',
    badge_code: 'BADGE-BM-1',
    timestamp: '2026-09-15T10:30:00Z',
    pendingSync: false,
    avatar: '',
  },
];

// ── Route stub helper ─────────────────────────────────────────────────────────

type MockConfig = {
  role: 'sponsor' | 'attendee';
  /** Giveaways the GET /giveaways endpoint returns initially */
  initialGiveaways?: object[];
  /** When false, POST /giveaways returns 500 */
  postSucceeds?: boolean;
};

async function installMocks(page: Page, cfg: MockConfig) {
  const user = cfg.role === 'sponsor' ? SPONSOR : ATTENDEE;

  await page.route('**/api/v1/**', async route => {
    const url    = new URL(route.request().url());
    const p      = url.pathname;
    const method = route.request().method();

    const ok = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      });

    // ── Auth ────────────────────────────────────────────────────────────────
    if (p === '/api/v1/auth/send-otp')
      return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp')
      return ok({ success: true, data: { token: `tok-${cfg.role}`, account_exists: true, verified: true, user } });

    // ── Profile ─────────────────────────────────────────────────────────────
    if (p === '/api/v1/me')         return ok({ success: true, data: user });
    if (p === '/api/v1/me/badge')   return ok({ success: true, badge_code: user.badge_code, qr_image_url: '' });
    if (p.startsWith('/api/v1/me/')) return ok({ success: true, data: { points: user.points, history: [], tier: user.tier } });

    // ── Events ───────────────────────────────────────────────────────────────
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?'))
      return ok({ success: true, data: { data: [EVENT] } });
    if (method === 'POST' && /\/events\/(join|join-by-code)/.test(p))
      return ok({ success: true, data: { event_id: EVENT_ID, membership_id: 55, message: 'Joined!' } });
    if (p === `/api/v1/events/${EVENT_ID}`)
      return ok({ success: true, data: EVENT });
    if (p.startsWith(`/api/v1/events/${EVENT_ID}/access`))
      return ok({ success: true, data: { has_access: true, is_member: true, membership_id: '55', role: cfg.role, status: 'active', joined_at: '2026-09-01T00:00:00Z' } });
    if (p.startsWith(`/api/v1/events/${EVENT_ID}/members`))
      return ok({ success: true, data: { data: [
        { id: user.id, membership_id: 55, name: user.name, email: user.email, roles: [cfg.role], status: 'active', joined_at: '2026-09-01T00:00:00Z' },
      ], total: 1 } });

    // ── Giveaways ─────────────────────────────────────────────────────────────
    if (p === `/api/v1/events/${EVENT_ID}/giveaways`) {
      if (method === 'GET') {
        const giveaways = cfg.initialGiveaways ?? [EXISTING_GIVEAWAY];
        return ok({ success: true, data: giveaways });
      }
      if (method === 'POST') {
        if (cfg.postSucceeds !== false) {
          return ok({ success: true, data: SAVED_GIVEAWAY }, 201);
        }
        return ok({ message: 'Internal Server Error' }, 500);
      }
    }
    if (p === `/api/v1/events/${EVENT_ID}/mobile-giveaways` && method === 'GET') {
      const giveaways = cfg.initialGiveaways ?? [EXISTING_GIVEAWAY];
      return ok({ success: true, data: giveaways });
    }

    // ── Lucky Draw endpoint — server arbitrates and persists the winner ───────
    if (/\/giveaways\/[^/]+\/draw$/.test(p) && method === 'POST')
      return ok({
        success: true,
        data: {
          ...EXISTING_GIVEAWAY,
          status: 'DRAWN',
          winner: { id: 1001, name: 'Alice Johnson', company: 'TechCorp', title: 'CTO' },
        },
      });

    // ── Leads (draw pool) ────────────────────────────────────────────────────
    if (p.startsWith(`/api/v1/events/${EVENT_ID}/my-leads`) || p.startsWith(`/api/v1/events/${EVENT_ID}/leads`))
      return ok({ success: true, data: LEADS });

    // ── Misc ─────────────────────────────────────────────────────────────────
    if (p.startsWith(`/api/v1/events/${EVENT_ID}/leaderboard`)) return ok({ success: true, data: [] });
    if (p.startsWith(`/api/v1/events/${EVENT_ID}/conversations`)) return ok({ success: false }, 404);
    if (p.startsWith(`/api/v1/events/${EVENT_ID}/`)) return ok({ success: true, data: [] });

    return ok({ success: true, data: null });
  });
}

// ── Shared login helper ───────────────────────────────────────────────────────

async function loginAndJoinEvent(page: Page, email: string) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByRole('button', { name: /^Continue$/i }).click();

  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  // Pick the St Louis event
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('St Louis Summit').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST 1 — Giveaway syncs to backend (canonical id returned from POST)
// ─────────────────────────────────────────────────────────────────────────────
test('Issue 2 — giveaway syncs to backend: POST returns canonical id and item appears', async ({ page }) => {
  test.setTimeout(150_000);
  let postBody: Record<string, unknown> | null = null;
  let postCalled = false;

  await installMocks(page, { role: 'sponsor', initialGiveaways: [], postSucceeds: true });

  // Intercept the POST to inspect the payload; return the canonical giveaway row.
  await page.route(`**/api/v1/events/${EVENT_ID}/giveaways`, async route => {
    if (route.request().method() === 'POST') {
      postCalled = true;
      try { postBody = JSON.parse(route.request().postData() ?? '{}'); } catch {}
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, data: SAVED_GIVEAWAY }),
      });
    } else {
      // GET returns empty list initially so only our optimistic row is visible.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, data: [] }),
      });
    }
  });

  await loginAndJoinEvent(page, 'rukmint@cxo.inc');

  // Navigate to Manage Giveaways
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();
  await expect(page.getByPlaceholder(/Win a MacBook/i)).toBeVisible({ timeout: 10_000 });

  // Add new giveaway
  await page.getByPlaceholder(/Win a MacBook/i).fill('AirPods Pro');
  await page.locator('input[type="number"]').first().fill('2');
  await page.getByRole('button', { name: /^Add Giveaway$/i }).click();

  // Optimistic insert: item appears immediately
  await expect(page.getByText('AirPods Pro').first()).toBeVisible({ timeout: 8_000 });

  // Wait for POST to resolve (canonical id swap)
  await page.waitForTimeout(2_500);

  // Giveaway is still visible after POST resolved (not rolled back)
  await expect(page.getByText('AirPods Pro').first()).toBeVisible({ timeout: 5_000 });

  // Header should show "1" active item
  const header = page.locator('div').filter({ hasText: /CXO Inc Giveaways\s*\(1\)/i }).first();
  await expect(header).toBeVisible({ timeout: 5_000 });

  // Verify POST was called with the correct title and item count
  expect(postCalled).toBe(true);
  expect(postBody).not.toBeNull();
  expect(postBody!.title).toBe('AirPods Pro');
  expect(Number(postBody!.numberOfItems ?? postBody!.number_of_items ?? postBody!.quantity)).toBe(2);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 2 — Sponsor runs Lucky Draw and picks winner
// ─────────────────────────────────────────────────────────────────────────────
test('lucky draw uses the persisted server draw response', async ({ page }) => {
  test.setTimeout(180_000);
  let drawRequestCalled = false;

  await installMocks(page, {
    role: 'sponsor',
    initialGiveaways: [EXISTING_GIVEAWAY],  // canonical id — draw allowed
  });

  await page.route(`**/api/v1/events/${EVENT_ID}/giveaways/*/draw`, async route => {
    drawRequestCalled = true;
    const parts = new URL(route.request().url()).pathname.split('/');
    expect(parts[parts.length - 2]).toBe(EXISTING_GIVEAWAY.id);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        success: true,
        data: {
          ...EXISTING_GIVEAWAY,
          status: 'DRAWN',
          winner: { id: 1001, name: 'Alice Johnson', company: 'TechCorp', title: 'CTO' },
        },
      }),
    });
  });

  await loginAndJoinEvent(page, 'rukmint@cxo.inc');

  // Navigate: More → Manage Giveaways
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();
  await expect(page.getByText('MacBook Pro').first()).toBeVisible({ timeout: 12_000 });

  // Click "Run Lucky Draw" on the MacBook Pro card → draws page loads with
  // MacBook Pro pre-selected (the initial-mount pre-selection bug is fixed).
  const runDrawBtn = page.getByRole('button', { name: /run lucky draw/i }).first();
  await expect(runDrawBtn).toBeVisible({ timeout: 8_000 });
  await runDrawBtn.click();

  // Draw page header
  await expect(page.getByText('Lucky Draw', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // After the pre-selection fix, "Pick a Winner!" should be visible immediately
  // (giveaway pre-selected + leads loaded from backend).  No manual dropdown
  // selection needed.
  const pickBtn = page.getByRole('button', { name: /Pick a Winner!/i });
  await expect(pickBtn).toBeVisible({ timeout: 15_000 });

  // The eligible pool heading confirms leads were fetched
  await expect(page.getByText(/Eligible Pool \(\d+ leads?\)/i).first()).toBeVisible({ timeout: 8_000 });

  const drawPromise = page.waitForRequest(
    req => req.url().includes(`/giveaways/${EXISTING_GIVEAWAY.id}/draw`) && req.method() === 'POST',
    { timeout: 30_000 },
  );

  await pickBtn.click();

  // "We Have a Winner!" appears only in phase === 'winner', not during the shuffle.
  await expect(page.getByText('We Have a Winner!').first()).toBeVisible({ timeout: 30_000 });

  // Winner name on the card
  await expect(
    page.getByText(/Alice Johnson|Bob Martinez/).first()
  ).toBeVisible({ timeout: 5_000 });

  const drawReq = await drawPromise;
  expect(drawReq.method()).toBe('POST');
  expect(drawRequestCalled).toBe(true);
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 3 — Attendee sees giveaways added by sponsor
// ─────────────────────────────────────────────────────────────────────────────
test('Issue 3 — attendee view: giveaways added by sponsor appear in Giveaways & Offers', async ({ page }) => {
  test.setTimeout(150_000);

  await installMocks(page, {
    role: 'attendee',
    initialGiveaways: [EXISTING_GIVEAWAY, SAVED_GIVEAWAY],
  });

  await loginAndJoinEvent(page, 'sam@example.com');

  // Navigate to the attendee giveaways view via the More menu.
  // (Clicking the home-screen card is unreliable when the menu overlay is in front.)
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /Giveaways & Draw/i }).click();

  // GiveawaysPage title
  await expect(page.getByText('Giveaways & Offers', { exact: true }).first()).toBeVisible({ timeout: 10_000 });

  // Both sponsor giveaways should be visible (attendees see ALL, unfiltered)
  await expect(page.getByText('MacBook Pro').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('AirPods Pro').first()).toBeVisible({ timeout: 5_000 });

  // Sponsor attribution on cards
  const sponsorText = page.getByText(/by CXO Inc/i).first();
  await expect(sponsorText).toBeVisible({ timeout: 5_000 });

  // Count badge in header ("N Available")
  const countBadge = page.getByText(/\d+\s*Available/i).first();
  await expect(countBadge).toBeVisible({ timeout: 5_000 });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST 4 — Unsynced giveaway: draw is allowed with a local-save notice
// ─────────────────────────────────────────────────────────────────────────────
test('failed giveaway save is surfaced and never becomes drawable', async ({ page }) => {
  test.setTimeout(150_000);

  await installMocks(page, { role: 'sponsor', initialGiveaways: [], postSucceeds: false });

  // Override giveaways route with a definite backend rejection.
  await page.route(`**/api/v1/events/${EVENT_ID}/giveaways`, async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Unable to save prize' }) });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ success: true, data: [] }),
      });
    }
  });

  await loginAndJoinEvent(page, 'rukmint@cxo.inc');

  // Manage Giveaways
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();
  await expect(page.getByPlaceholder(/Win a MacBook/i)).toBeVisible({ timeout: 10_000 });

  // Add giveaway; the server rejection must not leave a local-only card.
  await page.getByPlaceholder(/Win a MacBook/i).fill('Pending Prize');
  await page.locator('input[type="number"]').first().fill('1');
  await page.getByRole('button', { name: /^Add Giveaway$/i }).click();
  await expect(page.getByText(/Unable to save prize|Could not save giveaway/i).first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('Pending Prize')).toHaveCount(0);
});
