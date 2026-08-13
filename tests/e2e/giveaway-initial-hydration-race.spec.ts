/**
 * E2E regression guard — initial hydration race condition
 *
 * Scenario:
 *   1. Sponsor opens Manage Giveaways — the initial GET /giveaways fires.
 *   2. The GET is *slow* (network latency): it hasn't resolved yet.
 *   3. Sponsor fills the form and clicks "Add Giveaway".
 *   4. POST /giveaways completes quickly → optimistic row appears.
 *   5. Background GET (from addSponsorGiveaway) resolves with the new item.
 *   6. The *delayed* initial GET finally resolves — but WITHOUT the new item
 *      (it was captured before the POST).
 *
 * Pre-fix behaviour (line 748 was a hard setSponsorGiveaways(normalized)):
 *   The stale initial GET replaces the array, wiping the newly-added row
 *   → the giveaway vanishes immediately after step 6.
 *
 * Post-fix behaviour (setSponsorGiveaways is now a merge that preserves
 *   in-memory rows whose ids aren't in the server list):
 *   The newly-added row survives step 6 and remains visible.
 *
 * Every /api/v1/** call is stubbed — no live backend required.
 */

import { test, expect, type Page, type Route } from '@playwright/test';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SPONSOR = {
  id: 'sp-hydrace-1',
  name: 'Hydra Sponsor',
  email: 'hydra@acme.com',
  first_name: 'Hydra',
  last_name: 'Sponsor',
  phone: '+15555550300',
  title: 'Sales Rep',
  company: 'Acme Corp',
  role: 'sponsor',
  badge_code: 'BADGE-HY-1',
  points: 50,
  tier: 'Bronze',
  email_verified: true,
  profile_complete: true,
  interests: [],
};

const EVENT = {
  id: 77,
  name: 'HydraFest 2026',
  code: 'HF26',
  starts_at: '2026-09-01T09:00:00Z',
  ends_at: '2026-09-02T18:00:00Z',
  status: 'upcoming',
  location: 'Sydney',
  organizer: 'HydraFest Inc',
};

const EXISTING_GIVEAWAY = {
  id: 'g-hy-existing-1',
  title: 'Existing Prize',
  number_of_items: 2,
  numberOfItems: 2,
  sponsor_name: 'Acme Corp',
  sponsor_id: 'sp-hydrace-1',
  created_at: '2026-08-01T00:00:00Z',
};

const NEW_GIVEAWAY_TITLE = 'Wireless Keyboard';
const NEW_GIVEAWAY_QTY   = '10';

const NEW_GIVEAWAY_POST_RESPONSE = {
  id: 'g-hy-new-888',
  title: NEW_GIVEAWAY_TITLE,
  number_of_items: 10,
  numberOfItems: 10,
  sponsor_name: 'Acme Corp',
  sponsor_id: 'sp-hydrace-1',
  created_at: new Date().toISOString(),
};

// ── Mock installer ────────────────────────────────────────────────────────────

async function installMocks(page: Page) {
  /** Holds the resolve function for the initial-mount GET so we can
   *  release it after the POST has completed. */
  let releaseInitialGet!: () => void;
  const initialGetGate = new Promise<void>(res => { releaseInitialGet = res; });

  let postFired = false;
  let initialGetHandled = false; // true once the delayed GET has been served

  await page.route('**/api/v1/**', async (route: Route) => {
    const url = new URL(route.request().url());
    const p   = url.pathname;
    const m   = route.request().method();

    const ok = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      });

    // Auth
    if (p === '/api/v1/auth/send-otp')
      return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp')
      return ok({ success: true, data: { token: 'mock-tok-hy', account_exists: true, verified: true, user: SPONSOR } });

    // Profile
    if (p === '/api/v1/me') return ok({ success: true, data: SPONSOR });
    if (p === '/api/v1/me/badge') return ok({ success: true, badge_code: 'BADGE-HY-1', qr_image_url: '' });
    if (p.startsWith('/api/v1/me/')) return ok({ success: true, data: { points: 50, history: [] } });

    // Events
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?'))
      return ok({ success: true, data: { data: [EVENT] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p))
      return ok({ success: true, data: { event_id: EVENT.id, membership_id: 12, message: 'Joined!' } });
    if (p === `/api/v1/events/${EVENT.id}`)
      return ok({ success: true, data: EVENT });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/access`))
      return ok({ success: true, data: { has_access: true, is_member: true, membership_id: '12', role: 'sponsor', status: 'active', joined_at: '2026-07-01T00:00:00Z' } });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/members`))
      return ok({ success: true, data: { data: [
        { id: 'sp-hydrace-1', membership_id: 12, name: 'Hydra Sponsor', email: 'hydra@acme.com', roles: ['sponsor'], status: 'active', joined_at: '2026-07-01T00:00:00Z' },
      ], total: 1 } });

    // ── Giveaways — the critical stub ──────────────────────────────────────
    if (p.startsWith(`/api/v1/events/${EVENT.id}/giveaways`)) {
      if (m === 'POST') {
        postFired = true;
        // Release the delayed initial GET now that the POST has completed.
        releaseInitialGet();
        return ok({ success: true, data: NEW_GIVEAWAY_POST_RESPONSE }, 201);
      }
      if (m === 'GET') {
        if (!initialGetHandled) {
          // This is the initial-mount GET. Hold it until after the POST.
          initialGetHandled = true;
          await initialGetGate;
          // Respond with ONLY the existing giveaway — simulating that the
          // GET was captured before the POST and doesn't know about the new
          // item. The merge fix must keep the newly-added row visible.
          return ok({ success: true, data: [EXISTING_GIVEAWAY] });
        }
        // Subsequent GETs (background refresh after POST): include both.
        const list = postFired
          ? [EXISTING_GIVEAWAY, {
              id: 'g-hy-new-888',
              title: NEW_GIVEAWAY_TITLE,
              number_of_items: 10,
              numberOfItems: 10,
              sponsor_name: 'Acme Corp',
              sponsor_id: 'sp-hydrace-1',
              created_at: new Date().toISOString(),
            }]
          : [EXISTING_GIVEAWAY];
        return ok({ success: true, data: list });
      }
    }

    // Misc
    if (p.startsWith(`/api/v1/events/${EVENT.id}/my-leads`) || p.startsWith(`/api/v1/events/${EVENT.id}/leads`))
      return ok({ success: true, data: [] });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/leaderboard`))
      return ok({ success: true, data: [] });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/conversations`))
      return ok({ success: false }, 404);
    if (p.startsWith(`/api/v1/events/${EVENT.id}/`))
      return ok({ success: true, data: [] });

    return ok({ success: true, data: null });
  });
}

// ── Test ──────────────────────────────────────────────────────────────────────

test('newly-added giveaway survives a slow initial hydration GET that resolves after the POST', async ({ page }) => {
  test.setTimeout(120_000);

  await installMocks(page);

  // ── Login ─────────────────────────────────────────────────────────────
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('hydra@acme.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();

  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  // ── Join event ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('HydraFest 2026').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });

  // ── Navigate to Manage Giveaways ──────────────────────────────────────
  // The initial GET fires here. It will be held until after the POST.
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();

  // While the initial GET is still pending, the "Existing Prize" card may
  // or may not be visible yet (depends on how fast the GET resolves).
  // We just wait for the form to be ready.
  const titleInput = page.getByPlaceholder(/Win a MacBook/i);
  await expect(titleInput).toBeVisible({ timeout: 10_000 });

  // ── Add the new giveaway ──────────────────────────────────────────────
  await titleInput.fill(NEW_GIVEAWAY_TITLE);
  const quantityInput = page.locator('input[type="number"]').first();
  await quantityInput.fill(NEW_GIVEAWAY_QTY);

  // Capture the response for the delayed initial GET so we can wait for it.
  const initialGetResponsePromise = page.waitForResponse(
    resp =>
      resp.url().includes(`/api/v1/events/${EVENT.id}/giveaways`) &&
      resp.request().method() === 'GET',
    { timeout: 20_000 },
  );

  await page.getByRole('button', { name: /^Add Giveaway$/i }).click();

  // ── Optimistic insert: new giveaway appears immediately ───────────────
  await expect(page.getByText(/Acme Corp Giveaways\s*\(2\)/i)).toBeVisible({ timeout: 8_000 });

  // ── Wait for the delayed initial GET to resolve ───────────────────────
  // The initial GET was gated on the POST completing; it now resolves
  // with ONLY the existing giveaway. The merge fix must keep both rows.
  await initialGetResponsePromise;

  // Allow a full render cycle to settle.
  await page.waitForTimeout(600);

  // ── CRITICAL: both giveaways must still be visible ────────────────────
  // Without the merge fix, the stale initial GET would replace the array
  // with [EXISTING_GIVEAWAY] only, dropping the newly-added item.
  await expect(
    page.getByText(/Acme Corp Giveaways\s*\(2\)/i),
  ).toBeVisible({ timeout: 5_000 });

  const managedSection = page
    .locator('div')
    .filter({ hasText: /Acme Corp Giveaways\s*\(2\)/i })
    .first();
  await expect(managedSection.getByText(NEW_GIVEAWAY_TITLE).first()).toBeVisible({ timeout: 5_000 });
});
