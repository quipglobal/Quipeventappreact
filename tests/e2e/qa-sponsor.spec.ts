/**
 * QA — Sponsor role: login → join → sponsor-specific pages.
 *
 * Key facts:
 *   • Sponsor bottom nav: Home | Audience | Engage | Leads | More
 *   • SideMenu: Manage Giveaways (sponsor only) → SponsorGiveawaysPage
 *   • SponsorGiveawaysPage add form: title placeholder "e.g., Win a MacBook Pro",
 *     quantity type="number" placeholder "e.g., 50", submit button "Add Giveaway"
 */

import { test, expect, type Page } from '@playwright/test';

const SPONSOR = {
  id: 'u2', name: 'Sam Sponsor', email: 'sam@acme.com',
  first_name: 'Sam', last_name: 'Sponsor', phone: '+15555550200',
  title: 'Sales Rep', company: 'Acme Corp', role: 'sponsor',
  badge_code: 'BADGE-SP-1', points: 100, tier: 'Bronze',
  email_verified: true, profile_complete: true, interests: [],
};

const EVENT21 = {
  id: 21, name: 'CXO Summit 2026', code: 'CXO26',
  starts_at: '2026-07-20T09:00:00Z', ends_at: '2026-07-21T18:00:00Z',
  status: 'upcoming', location: 'Dubai', organizer: 'CXO Inc',
};

async function installSponsorMocks(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const m = route.request().method();
    const ok = (body: unknown, s = 200) =>
      route.fulfill({ status: s, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body) });

    if (p === '/api/v1/auth/send-otp')         return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp')        return ok({ success: true, data: { token: 'mock-sp', account_exists: true, verified: true, user: SPONSOR } });
    if (p === '/api/v1/me')                     return ok({ success: true, data: SPONSOR });
    if (p === '/api/v1/me/badge')                return ok({ success: true, badge_code: 'BADGE-SP-1', qr_image_url: '' });
    if (p.startsWith('/api/v1/me/'))             return ok({ success: true, data: { points: 100, history: [] } });
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?')) return ok({ success: true, data: { data: [EVENT21] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p)) return ok({ success: true, data: { event_id: 21, membership_id: 2, message: 'Joined!' } });
    if (p === '/api/v1/events/21')               return ok({ success: true, data: EVENT21 });
    if (p.startsWith('/api/v1/events/21/access')) return ok({ success: true, data: { has_access: true, is_member: true, membership_id: '2', role: 'sponsor', status: 'active', joined_at: '2026-07-01T00:00:00Z' } });
    // Role lookup: getMyEventRoleApi calls /members (paginated) to find the user's per-event role
    if (p.startsWith('/api/v1/events/21/members')) return ok({ success: true, data: { data: [
      { id: 'u2', membership_id: 2,   name: 'Sam Sponsor', email: 'sam@acme.com',    roles: ['sponsor'],  status: 'active', joined_at: '2026-07-01T00:00:00Z' },
      { id: 'a1', membership_id: 101, name: 'Bob Smith',   email: 'bob@techco.com',  roles: ['attendee'], status: 'active', joined_at: '2026-07-14T09:00:00Z' },
    ], total: 2 }});
    if (p.startsWith('/api/v1/events/21/attendees')) return ok({ success: true, data: { data: [
      { id: 'a1', membership_id: 101, name: 'Bob Smith', company_name: 'TechCo', title: 'Engineer', roles: ['attendee'], status: 'active', joined_at: '2026-07-14T09:00:00Z', email: 'bob@techco.com' },
    ], total: 1 }});
    // Giveaway POST returns the new giveaway
    if (m === 'POST' && p.startsWith('/api/v1/events/21/giveaways')) return ok({ success: true, data: { id: 'g2', title: 'AirPods Prize', number_of_items: 10, numberOfItems: 10, sponsor_name: 'Acme Corp', sponsor_id: 'u2' } }, 201);
    if (p.startsWith('/api/v1/events/21/giveaways') && m === 'GET')  return ok({ success: true, data: [{ id: 'g1', title: 'iPad Giveaway', number_of_items: 5, numberOfItems: 5, sponsor_name: 'Acme Corp', sponsor_id: 'u2', created_at: '2026-07-01T00:00:00Z' }] });
    if (p.startsWith('/api/v1/events/21/my-leads') || p.startsWith('/api/v1/events/21/leads')) return ok({ success: true, data: [
      { id: 'lead1', name: 'Bob Smith',   company: 'TechCo',   title: 'Engineer', badge_code: 'BADGE-B1', notes: 'Interested', tags: ['hot'],  priority: 'high',   email: 'bob@techco.com',   scanned_at: '2026-07-14T09:30:00Z' },
      { id: 'lead2', name: 'Carol Jones', company: 'StartupX', title: 'Designer', badge_code: 'BADGE-C2', notes: '',           tags: [],       priority: 'normal', email: 'carol@startupx.com', scanned_at: '2026-07-14T10:00:00Z' },
    ]});
    if (p.startsWith('/api/v1/events/21/leaderboard')) return ok({ success: true, data: [{ rank: 1, name: 'Sam Sponsor', points: 100, tier: 'Bronze', id: 'u2' }] });
    if (p.startsWith('/api/v1/events/21/conversations')) return ok({ success: false }, 404);
    if (p.startsWith('/api/v1/events/21/'))             return ok({ success: true, data: [] });
    return ok({ success: true, data: null });
  });
}

test('Sponsor: login → join → sponsor-specific features', async ({ page }) => {
  test.setTimeout(120_000);
  await installSponsorMocks(page);

  // ── Login ────────────────────────────────────────────────────────────
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('sam@acme.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();
  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  // ── EventJoinPage → click event card (is_member=true → enters directly) ────
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('CXO Summit 2026').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });

  // ── B1: Sponsor nav shows Leads (not Partners) ───────────────────────
  await expect(page.getByRole('button', { name: /^Leads$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Partners$/i })).not.toBeVisible({ timeout: 3_000 });
  await expect(page.getByText(/Hi,\s*Sam/i)).toBeVisible();
  await expect(page.getByText(/\d+\s*pts/i).first()).toBeVisible();

  // ── B2: Leads tab shows scanned leads ────────────────────────────────
  await page.getByRole('button', { name: /^Leads$/i }).click();
  await expect(page.getByText('Bob Smith')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('Carol Jones')).toBeVisible();
  await expect(page.getByText('TechCo')).toBeVisible();
  await expect(page.getByText('StartupX')).toBeVisible();

  // ── B3: Manage Giveaways → existing giveaway visible ─────────────────
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();
  await expect(page.getByText('iPad Giveaway')).toBeVisible({ timeout: 8_000 });
  // Quantity shows 5 items
  await expect(page.getByText(/5 item/i)).toBeVisible();

  // ── B4: Add giveaway — quantity must NOT be 0 ─────────────────────────
  const titleInput = page.getByPlaceholder(/Win a MacBook/i);
  await expect(titleInput).toBeVisible({ timeout: 5_000 });
  await titleInput.fill('AirPods Prize');

  const quantityInput = page.locator('input[type="number"]').first();
  await expect(quantityInput).toBeVisible({ timeout: 5_000 });
  await quantityInput.fill('10');

  const addBtn = page.getByRole('button', { name: /^Add Giveaway$/i });
  await expect(addBtn).toBeVisible({ timeout: 5_000 });
  await addBtn.click();

  // New giveaway should appear
  await expect(page.getByText('AirPods Prize').first()).toBeVisible({ timeout: 8_000 });
  // CRITICAL: quantity must NOT be 0
  // The normalized giveaway should show 10 items
  await expect(page.getByText(/10 item/i).first()).toBeVisible();

  // ── B5: Audience visible for sponsor ─────────────────────────────────
  await page.getByRole('button', { name: /^Audience$/i }).click();
  await expect(page.getByText('Bob Smith')).toBeVisible({ timeout: 8_000 });
});
