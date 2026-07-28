/**
 * QA — Attendee flow: login → join → all core pages.
 *
 * Key facts:
 *   • Bottom nav: Home | Audience | Engage | Partners | More
 *   • "Engage" tab → EngagePage (Surveys, Live Polls, Challenges — NOT Giveaways)
 *   • "Home"  tab → EventDashboardPage (has Giveaways tile, Agenda shortcut)
 *   • SideMenu (via More): Agenda | Speakers | My Badge | Scan Badge | My Connects |
 *                           Leaderboard | Giveaways & Draw | Settings | Switch Events
 *   • ProfilePage: "Edit Profile" and "Sign Out" buttons
 */

import { test, expect, type Page } from '@playwright/test';

const ATTENDEE = {
  id: 'u1', name: 'Alice Tester', email: 'alice@cxo.com',
  first_name: 'Alice', last_name: 'Tester', phone: '+15555550100',
  title: 'CTO', company: 'Acme Corp', role: 'attendee',
  badge_code: 'BADGE-QA-1', points: 250, tier: 'Silver',
  email_verified: true, profile_complete: true, interests: [],
};

const EVENT21 = {
  id: 21, name: 'CXO Summit 2026', code: 'CXO26',
  starts_at: '2026-07-20T09:00:00Z', ends_at: '2026-07-21T18:00:00Z',
  status: 'upcoming', location: 'Dubai', organizer: 'CXO Inc',
};

async function installMocks(page: Page) {
  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const m = route.request().method();
    const ok = (body: unknown, s = 200) =>
      route.fulfill({ status: s, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body) });

    if (p === '/api/v1/auth/send-otp')        return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp')       return ok({ success: true, data: { token: 'mock-qa', account_exists: true, verified: true, user: ATTENDEE } });
    if (p === '/api/v1/me')                    return ok({ success: true, data: ATTENDEE });
    if (p === '/api/v1/me/badge')               return ok({ success: true, badge_code: 'BADGE-QA-1', qr_image_url: '' });
    if (p.startsWith('/api/v1/me/'))            return ok({ success: true, data: { points: 250, history: [] } });
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?')) return ok({ success: true, data: { data: [EVENT21] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p)) return ok({ success: true, data: { event_id: 21, membership_id: 1, message: 'Joined!' } });
    if (p === '/api/v1/events/21')              return ok({ success: true, data: EVENT21 });
    if (p.startsWith('/api/v1/events/21/access')) return ok({ success: true, data: { has_access: true, is_member: true, membership_id: '1', role: 'attendee', status: 'active', joined_at: '2026-07-01T00:00:00Z' } });
    // Paginated format required by getEventSpeakersApi (no flat-array fallback)
    if (p.startsWith('/api/v1/events/21/attendees')) return ok({ success: true, data: { data: [
      { id: 'a1', membership_id: 101, name: 'Bob Smith',   company_name: 'TechCo',      title: 'Engineer', roles: ['attendee'], status: 'active', joined_at: '2026-07-14T09:00:00Z', email: 'bob@techco.com' },
      { id: 'a2', membership_id: 102, name: 'Carol Jones', company_name: 'StartupX',    title: 'Designer', roles: ['attendee'], status: 'active', joined_at: '2026-07-14T09:30:00Z', email: 'carol@startupx.com' },
      { id: 'sp1', membership_id: 103, name: 'Jane Doe',  company_name: 'Visionary Inc', title: 'CEO',     roles: ['speaker'],  status: 'active', joined_at: '2026-07-14T08:00:00Z', email: 'jane@visionary.com' },
    ], total: 3, per_page: 100, current_page: 1 } });
    if (p.startsWith('/api/v1/events/21/sponsors'))    return ok({ success: true, data: [{ id: 's1', name: 'Acme Corp', logo: '', description: 'Enterprise software', tier: 'Gold' }] });
    if (p.startsWith('/api/v1/events/21/companies'))   return ok({ success: true, data: [{ id: 'c1', name: 'Acme Corp', logo: '', description: 'Enterprise software', tier: 'Gold', website: 'https://acme.com' }] });
    if (p.startsWith('/api/v1/events/21/agenda'))      return ok({ success: true, data: [
      { id: 's1', title: 'Opening Keynote',   speaker: 'Jane Doe',   starts_at: '2026-07-20T09:00:00Z', ends_at: '2026-07-20T10:00:00Z', location: 'Main Hall', track: 'Keynote' },
      { id: 's2', title: 'AI in Enterprise', speaker: 'John Smith', starts_at: '2026-07-20T10:30:00Z', ends_at: '2026-07-20T11:30:00Z', location: 'Room A',    track: 'Tech' },
    ]});
    if (p.startsWith('/api/v1/events/21/speakers'))    return ok({ success: true, data: [{ id: 'sp1', name: 'Jane Doe', title: 'CEO', company: 'Visionary Inc', bio: 'Keynote speaker', photo: '' }] });
    if (p.startsWith('/api/v1/events/21/giveaways') && m === 'GET') return ok({ success: true, data: [{ id: 'g1', title: 'MacBook Pro Raffle', number_of_items: 3, numberOfItems: 3, sponsor_name: 'Acme Corp', sponsor_id: 's1' }] });
    if (p.startsWith('/api/v1/events/21/leaderboard')) return ok({ success: true, data: [
      { rank: 1, name: 'Alice Tester', points: 250, tier: 'Silver', id: 'u1' },
      { rank: 2, name: 'Bob Smith',    points: 180, tier: 'Bronze', id: 'a1' },
    ]});
    if (p.startsWith('/api/v1/events/21/challenges'))  return ok({ success: true, data: [{ id: 'ch1', title: 'Visit 3 booths', points: 50, completed: false }] });
    if (p.startsWith('/api/v1/events/21/members')) return ok({ success: true, data: { data: [
      { id: 'a1', membership_id: 101, name: 'Bob Smith',   company_name: 'TechCo',       title: 'Engineer', roles: ['attendee'], status: 'active', joined_at: '2026-07-14T09:00:00Z', email: 'bob@techco.com' },
      { id: 'a2', membership_id: 102, name: 'Carol Jones', company_name: 'StartupX',     title: 'Designer', roles: ['attendee'], status: 'active', joined_at: '2026-07-14T09:30:00Z', email: 'carol@startupx.com' },
      { id: 'sp1', membership_id: 103, name: 'Jane Doe',   company_name: 'Visionary Inc', title: 'CEO',     roles: ['speaker'],  status: 'active', joined_at: '2026-07-14T08:00:00Z', email: 'jane@visionary.com' },
    ], total: 3, per_page: 15, current_page: 1 } });
    if (p.startsWith('/api/v1/events/21/conversations')) return ok({ success: false }, 404);
    if (p.startsWith('/api/v1/events/21/'))             return ok({ success: true, data: [] });
    return ok({ success: true, data: null });
  });
}

test('Attendee: login → join → all core pages', async ({ page }) => {
  test.setTimeout(120_000);
  await installMocks(page);

  // ── Login ────────────────────────────────────────────────────────────
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('alice@cxo.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();
  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  // ── EventJoinPage: Events tab → click event card (is_member=true → enters directly)
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('CXO Summit 2026').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });

  // ── A1: Home renders (greeting + points) ────────────────────────────
  await expect(page.getByText(/Hi,\s*Alice/i)).toBeVisible({ timeout: 8_000 });
  // Points displayed may include join bonus; just confirm a pts badge is present
  await expect(page.getByText(/\d+\s*pts/i).first()).toBeVisible();

  // ── A2: Audience tab — member list + search ──────────────────────────
  await page.getByRole('button', { name: /^Audience$/i }).click();
  await expect(page.getByText('Bob Smith')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('Carol Jones')).toBeVisible();
  const searchBox = page.getByPlaceholder(/search/i);
  await expect(searchBox).toBeVisible();
  await searchBox.fill('Bob');
  await expect(page.getByText('Bob Smith')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Carol Jones')).not.toBeVisible({ timeout: 4_000 });
  await searchBox.clear();
  await expect(page.getByText('Carol Jones')).toBeVisible({ timeout: 5_000 });

  // ── A3: Engage tab — shows Surveys / Live Polls / Challenges ─────────
  await page.getByRole('button', { name: /^Engage$/i }).click();
  // At least one of the engage tiles visible
  const engageTile = page.locator('button').filter({ hasText: /Surveys|Live Polls|Challenges/i });
  await expect(engageTile.first()).toBeVisible({ timeout: 8_000 });

  // ── A4: Giveaways — via "View All" button in the Featured Giveaway section
  await page.getByRole('button', { name: /^Home$/i }).click();
  // Home page "Featured Giveaway" section has a "View All" button → engage-giveaways
  const viewAllBtn = page.getByRole('button', { name: /^View All$/i });
  await expect(viewAllBtn.first()).toBeVisible({ timeout: 8_000 });
  await viewAllBtn.first().click();
  await expect(page.getByText('MacBook Pro Raffle')).toBeVisible({ timeout: 8_000 });

  // ── A5: Back → Partners tab ──────────────────────────────────────────
  // GiveawaysPage has no bottom nav; navigate back first
  await page.getByRole('button', { name: /^Back$/i }).click();
  await expect(page.getByRole('button', { name: /^More$/i })).toBeVisible({ timeout: 6_000 });
  await page.getByRole('button', { name: /^Partners$/i }).click();
  await expect(page.getByText('Acme Corp')).toBeVisible({ timeout: 8_000 });

  // ── A6: More → SideMenu opens with navigation items ─────────────────
  await page.getByRole('button', { name: /^More$/i }).click();
  // Check SideMenu-unique items only (My Badge/Scan Badge also appear in header)
  await expect(page.getByRole('button', { name: /^Leaderboard$/i })).toBeVisible({ timeout: 6_000 });
  await expect(page.getByRole('button', { name: /^Agenda$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^My Connects$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Giveaways & Draw$/i })).toBeVisible();

  // ── A7: Leaderboard ──────────────────────────────────────────────────
  await page.getByRole('button', { name: /^Leaderboard$/i }).click();
  await expect(page.getByText('Alice Tester').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('Bob Smith').first()).toBeVisible();

  // ── A8: Speakers ─────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Speakers$/i }).click();
  await expect(page.getByText('Jane Doe').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText(/Visionary Inc/i).first()).toBeVisible();

  // ── A9: My Badge — header quick-access button (same nav target as SideMenu)
  // "My Badge" exists in BOTH header and SideMenu; use .first() to avoid strict mode
  await page.getByRole('button', { name: /^My Badge$/i }).first().click();
  await expect(page.getByText(/BADGE-QA-1/)).toBeVisible({ timeout: 8_000 });

  // ── A10: Profile (Settings) — shows info + "Edit Profile" button ──────
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Settings$/i }).click();
  await expect(page.getByText('Alice Tester').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('alice@cxo.com').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /Edit Profile/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible();

  // ── A11: Agenda ──────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Agenda$/i }).click();
  await expect(page.getByText('Opening Keynote')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('AI in Enterprise')).toBeVisible();

  // ── A12: Sign Out → Welcome screen ───────────────────────────────────
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Settings$/i }).click();
  await page.getByRole('button', { name: /Sign Out/i }).click();
  await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });
});
