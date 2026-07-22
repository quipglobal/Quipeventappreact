/**
 * QA — Form validation, error states, edge cases.
 *
 * Key facts:
 *   • Giveaways tile is on the HOME page (EventDashboardPage), not Engage tab
 *   • ProfilePage: "Edit Profile" button, "Sign Out" button
 *   • Engage tab → EngagePage (Surveys, Live Polls, Challenges)
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

function baseRoute(page: Page, otpFail = false) {
  return page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const m = route.request().method();
    const ok = (body: unknown, s = 200) =>
      route.fulfill({ status: s, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });

    if (p === '/api/v1/auth/send-otp')  return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp') {
      if (otpFail) return ok({ success: false, error: { code: 'INVALID_OTP', message: 'Invalid or expired OTP code.' } }, 422);
      return ok({ success: true, data: { token: 'mock-qa', account_exists: true, verified: true, user: ATTENDEE } });
    }
    if (p === '/api/v1/me') return ok({ success: true, data: ATTENDEE });
    if (p.startsWith('/api/v1/me/')) return ok({ success: true, data: { points: 250, history: [], badge_code: 'BADGE-QA-1', qr_image_url: '' } });
    if (m === 'PUT' && p === '/api/v1/me')   return ok({ success: true, data: { ...ATTENDEE, last_name: 'Updated', name: 'Alice Updated' } });
    if (m === 'PATCH' && p === '/api/v1/me') return ok({ success: true, data: { ...ATTENDEE, last_name: 'Updated', name: 'Alice Updated' } });
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?')) return ok({ success: true, data: { data: [EVENT21] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p)) return ok({ success: true, data: { event_id: 21, membership_id: 1, message: 'Joined!' } });
    if (p === '/api/v1/events/21') return ok({ success: true, data: EVENT21 });
    if (p.startsWith('/api/v1/events/21/access')) return ok({ success: true, data: { has_access: true, is_member: true, membership_id: '1', role: 'attendee', status: 'active', joined_at: '2026-07-01T00:00:00Z' } });
    if (p.startsWith('/api/v1/events/21/attendees')) return ok({ success: true, data: [{ id: 'a1', membership_id: 101, name: 'Bob Smith', company_name: 'TechCo', title: 'Engineer', roles: ['attendee'], status: 'active', joined_at: '2026-07-14T09:00:00Z', email: 'bob@techco.com' }] });
    if (p.startsWith('/api/v1/events/21/agenda')) return ok({ success: true, data: [
      { id: 's1', title: 'Opening Keynote', speaker: 'Jane Doe', starts_at: '2026-07-20T09:00:00Z', ends_at: '2026-07-20T10:00:00Z', location: 'Main Hall', track: 'Keynote' },
    ]});
    if (p.startsWith('/api/v1/events/21/giveaways') && m === 'GET') return ok({ success: true, data: [] });
    if (p.startsWith('/api/v1/events/21/conversations')) return ok({ success: false }, 404);
    if (p.startsWith('/api/v1/events/21/')) return ok({ success: true, data: [] });
    return ok({ success: true, data: null });
  });
}

async function doLoginAndJoin(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('alice@cxo.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();
  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });
  // Events tab → click event card (mock returns is_member=true → enters directly, no code needed)
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('CXO Summit 2026').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });
}

// ─── C1: Empty email is blocked ───────────────────────────────────────────────
test('C1: Empty email submission is blocked', async ({ page }) => {
  test.setTimeout(30_000);
  await baseRoute(page);
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 12_000 });
  const continueBtn = page.getByRole('button', { name: /^Continue$/i });
  await expect(continueBtn).toBeVisible({ timeout: 8_000 });

  const isDisabled = await continueBtn.isDisabled();
  if (!isDisabled) {
    await continueBtn.click();
    // Should NOT navigate to OTP screen
    const onOtp = await page.locator('input[inputmode="numeric"]').isVisible({ timeout: 3_000 }).catch(() => false);
    expect(onOtp).toBe(false);
  } else {
    expect(isDisabled).toBe(true);
  }
});

// ─── C2: Wrong OTP shows error ────────────────────────────────────────────────
test('C2: Wrong OTP code shows error, stays on OTP screen', async ({ page }) => {
  test.setTimeout(45_000);
  await baseRoute(page, true);
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 12_000 });
  await page.getByPlaceholder('you@example.com').fill('alice@cxo.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();
  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('000000', { delay: 30 });
  await expect(page.getByText(/invalid|expired|incorrect|wrong/i).first()).toBeVisible({ timeout: 8_000 });
  await expect(otpInputs.first()).toBeVisible();
});

// ─── C3: Invalid event code shows error ──────────────────────────────────────
test('C3: Invalid event code shows error, stays on join page', async ({ page }) => {
  test.setTimeout(60_000);

  await page.route('**/api/v1/**', async (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const m = route.request().method();
    const ok = (body: unknown, s = 200) =>
      route.fulfill({ status: s, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });

    if (p === '/api/v1/auth/send-otp')  return ok({ success: true, data: { message: 'OTP sent', expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp') return ok({ success: true, data: { token: 'mock-qa', account_exists: true, verified: true, user: ATTENDEE } });
    if (p === '/api/v1/me') return ok({ success: true, data: ATTENDEE });
    if (p.startsWith('/api/v1/me/')) return ok({ success: true, data: { points: 250 } });
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?')) return ok({ success: true, data: { data: [EVENT21] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p)) {
      const body = route.request().postData();
      const parsed = body ? JSON.parse(body) : {};
      if (parsed.code === 'XXXXX' || parsed.event_code === 'XXXXX')
        return ok({ success: false, error: { code: 'INVALID_CODE', message: 'Event not found.' } }, 404);
      return ok({ success: true, data: { event_id: 21, membership_id: 1, message: 'Joined!' } });
    }
    if (p === '/api/v1/events/21') return ok({ success: true, data: EVENT21 });
    // is_member: false → gate modal shows when clicking the event card
    if (p.startsWith('/api/v1/events/21/access')) return ok({ success: true, data: { has_access: true, is_member: false, membership_id: null, role: null, status: null } });
    if (p.startsWith('/api/v1/events/21/')) return ok({ success: true, data: [] });
    return ok({ success: true, data: null });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 12_000 });
  await page.getByPlaceholder('you@example.com').fill('alice@cxo.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();
  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });

  // Click event card → gate modal appears (is_member=false)
  await page.getByText('CXO Summit 2026').first().click({ timeout: 10_000 });
  // Fill invalid code in gate modal and submit
  await page.getByPlaceholder(/e\.g\. CISO2026/i).fill('XXXXX');
  await page.getByRole('button', { name: /Join Event/i }).click();
  await expect(page.getByText(/not found|invalid|error/i).first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).not.toBeVisible({ timeout: 3_000 });
});

// ─── C4-C5: Profile + Agenda ──────────────────────────────────────────────────
test('C4-C5: Edit Profile button visible, Agenda shows sessions', async ({ page }) => {
  test.setTimeout(60_000);
  await baseRoute(page);
  await doLoginAndJoin(page);

  // C4: Profile has "Edit Profile" and "Sign Out" buttons
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Settings$/i }).click();
  await expect(page.getByText('Alice Tester').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole('button', { name: /Edit Profile/i })).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('button', { name: /Sign Out/i })).toBeVisible();

  // C5: Agenda shows sessions
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Agenda$/i }).click();
  await expect(page.getByText('Opening Keynote')).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('Jane Doe')).toBeVisible();
});

// ─── C6-C7: Giveaway empty state + Switch Events ──────────────────────────────
test('C6-C7: Giveaway empty state, Switch Events returns to join page', async ({ page }) => {
  test.setTimeout(60_000);
  await baseRoute(page); // giveaways returns []
  await doLoginAndJoin(page);

  // C6: Giveaways section is hidden from attendees — "View All" button absent on Home
  await page.getByRole('button', { name: /^Home$/i }).click();
  const viewAllBtn = page.getByRole('button', { name: /^View All$/i });
  await expect(viewAllBtn).toHaveCount(0);

  // C7: Switch Events → back to EventJoinPage
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Switch Events$/i }).click();
  await expect(page.getByText(/Welcome,?\s*Alice/i)).toBeVisible({ timeout: 10_000 });
});

// ─── C8: Responsive layout ────────────────────────────────────────────────────
test('C8: 1440px layout has no horizontal overflow', async ({ page }) => {
  test.setTimeout(60_000);
  await baseRoute(page);
  await doLoginAndJoin(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  const hasHScroll = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
  );
  expect(hasHScroll).toBe(false);
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible();
});
