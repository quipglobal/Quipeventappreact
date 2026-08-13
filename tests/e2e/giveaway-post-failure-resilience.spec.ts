/**
 * E2E regression guard — giveaway survives backend POST failures
 *
 * Before this fix, ANY non-NOT_IMPLEMENTED failure from the backend POST
 * caused the optimistic giveaway row to be rolled back (flash-and-disappear).
 * This happened for:
 *   - HTTP 405  (endpoint registered but POST verb not mapped)
 *   - HTTP 500  (server error)
 *   - { success: true } with no `data` body (backend accepted but returned no id)
 *   - Network / timeout errors
 *
 * After the fix:
 *   - 405 → treated as NOT_IMPLEMENTED → local row kept silently
 *   - { success: true } + no data → treated as NOT_IMPLEMENTED → local row kept
 *   - 500 / network error → local row kept, warning toast shown
 *
 * In every case the giveaway must remain visible in "My Giveaways" so the
 * sponsor isn't left staring at a blank list with no explanation.
 *
 * Every /api/v1/** call is stubbed — no live backend required.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Shared fixtures ───────────────────────────────────────────────────────────

const SPONSOR = {
  id: 'sp-resil-1',
  name: 'Resil Sponsor',
  email: 'resil@acme.com',
  first_name: 'Resil',
  last_name: 'Sponsor',
  phone: '+15555550400',
  title: 'Sales Rep',
  company: 'Acme Corp',
  role: 'sponsor',
  badge_code: 'BADGE-RS-1',
  points: 75,
  tier: 'Bronze',
  email_verified: true,
  profile_complete: true,
  interests: [],
};

const EVENT = {
  id: 88,
  name: 'ResilientFest 2026',
  code: 'RF26',
  starts_at: '2026-10-01T09:00:00Z',
  ends_at: '2026-10-02T18:00:00Z',
  status: 'upcoming',
  location: 'Tokyo',
  organizer: 'ResilientFest Inc',
};

const GIVEAWAY_TITLE = 'Mechanical Keyboard';
const GIVEAWAY_QTY   = '3';

// ── Mock helper ───────────────────────────────────────────────────────────────

type PostBehaviour =
  | { kind: 'status'; code: number }        // respond with HTTP status, no data
  | { kind: 'emptySuccess' }                // { success: true } with no data key
  | { kind: 'networkDrop' };                // abort the request (simulates offline)

async function installMocksWithPostBehaviour(
  page: Page,
  postBehaviour: PostBehaviour,
) {
  await page.route('**/api/v1/**', async route => {
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
      return ok({ success: true, data: { token: 'mock-tok-rs', account_exists: true, verified: true, user: SPONSOR } });

    // Profile
    if (p === '/api/v1/me') return ok({ success: true, data: SPONSOR });
    if (p === '/api/v1/me/badge') return ok({ success: true, badge_code: 'BADGE-RS-1', qr_image_url: '' });
    if (p.startsWith('/api/v1/me/')) return ok({ success: true, data: { points: 75, history: [] } });

    // Events
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?'))
      return ok({ success: true, data: { data: [EVENT] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p))
      return ok({ success: true, data: { event_id: EVENT.id, membership_id: 15, message: 'Joined!' } });
    if (p === `/api/v1/events/${EVENT.id}`)
      return ok({ success: true, data: EVENT });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/access`))
      return ok({ success: true, data: { has_access: true, is_member: true, membership_id: '15', role: 'sponsor', status: 'active', joined_at: '2026-07-01T00:00:00Z' } });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/members`))
      return ok({ success: true, data: { data: [
        { id: 'sp-resil-1', membership_id: 15, name: 'Resil Sponsor', email: 'resil@acme.com', roles: ['sponsor'], status: 'active', joined_at: '2026-07-01T00:00:00Z' },
      ], total: 1 } });

    // Giveaways
    if (p.startsWith(`/api/v1/events/${EVENT.id}/giveaways`)) {
      if (m === 'POST') {
        if (postBehaviour.kind === 'networkDrop') {
          return route.abort('failed');
        }
        if (postBehaviour.kind === 'emptySuccess') {
          return ok({ success: true /* no data key */ });
        }
        if (postBehaviour.kind === 'status') {
          return route.fulfill({
            status: postBehaviour.code,
            contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ message: `Simulated ${postBehaviour.code}` }),
          });
        }
      }
      if (m === 'GET') {
        // Return empty list — no pre-existing giveaways
        return ok({ success: true, data: [] });
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

// ── Shared login + navigate helper ────────────────────────────────────────────

async function loginAndNavigateToManageGiveaways(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('resil@acme.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();

  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('ResilientFest 2026').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });

  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();

  const titleInput = page.getByPlaceholder(/Win a MacBook/i);
  await expect(titleInput).toBeVisible({ timeout: 10_000 });
  return titleInput;
}

async function addGiveaway(page: Page, titleInput: ReturnType<Page['getByPlaceholder']>) {
  await titleInput.fill(GIVEAWAY_TITLE);
  const quantityInput = page.locator('input[type="number"]').first();
  await quantityInput.fill(GIVEAWAY_QTY);
  await page.getByRole('button', { name: /^Add Giveaway$/i }).click();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('giveaway stays visible when backend POST returns 405 (wrong verb)', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocksWithPostBehaviour(page, { kind: 'status', code: 405 });
  const titleInput = await loginAndNavigateToManageGiveaways(page);
  await addGiveaway(page, titleInput);

  // Optimistic insert — giveaway appears immediately
  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 8_000 });

  // Allow time for POST response to settle
  await page.waitForTimeout(1_500);

  // Giveaway must still be visible (pre-fix: 405 caused rollback)
  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 5_000 });
  const section = page.locator('div').filter({ hasText: /Acme Corp Giveaways\s*\(1\)/i }).first();
  await expect(section.getByText(GIVEAWAY_TITLE).first()).toBeVisible();
});

test('giveaway stays visible when backend POST returns { success: true } with no data body', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocksWithPostBehaviour(page, { kind: 'emptySuccess' });
  const titleInput = await loginAndNavigateToManageGiveaways(page);
  await addGiveaway(page, titleInput);

  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 8_000 });
  await page.waitForTimeout(1_500);

  // Giveaway must still be visible (pre-fix: empty body caused rollback)
  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 5_000 });
  const section = page.locator('div').filter({ hasText: /Acme Corp Giveaways\s*\(1\)/i }).first();
  await expect(section.getByText(GIVEAWAY_TITLE).first()).toBeVisible();
});

test('giveaway stays visible when backend POST returns 500', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocksWithPostBehaviour(page, { kind: 'status', code: 500 });
  const titleInput = await loginAndNavigateToManageGiveaways(page);
  await addGiveaway(page, titleInput);

  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 8_000 });
  await page.waitForTimeout(1_500);

  // Giveaway must still be visible (pre-fix: 500 caused rollback)
  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 5_000 });
  const section = page.locator('div').filter({ hasText: /Acme Corp Giveaways\s*\(1\)/i }).first();
  await expect(section.getByText(GIVEAWAY_TITLE).first()).toBeVisible();
});

test('giveaway stays visible when backend POST is dropped (network error)', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocksWithPostBehaviour(page, { kind: 'networkDrop' });
  const titleInput = await loginAndNavigateToManageGiveaways(page);
  await addGiveaway(page, titleInput);

  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 8_000 });
  // Network drops may trigger retries — allow a bit more time
  await page.waitForTimeout(3_000);

  // Giveaway must still be visible (pre-fix: network error caused rollback)
  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 5_000 });
  const section = page.locator('div').filter({ hasText: /Acme Corp Giveaways\s*\(1\)/i }).first();
  await expect(section.getByText(GIVEAWAY_TITLE).first()).toBeVisible();
});
