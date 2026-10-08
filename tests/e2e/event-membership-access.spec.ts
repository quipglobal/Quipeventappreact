import { test, expect, type Page } from '@playwright/test';

const event = { id: 21, name: 'Membership Summit', code: 'MEM-26',
  starts_at: '2026-10-09T09:00:00Z', ends_at: '2026-10-10T18:00:00Z',
  status: 'upcoming', location: 'Chicago' };
const user = { id: 'member-42', name: 'Casey Member', first_name: 'Casey', last_name: 'Member',
  email: 'casey@example.test', company: 'Example Co', title: 'Director', role: 'attendee',
  email_verified: true, profile_complete: true, points: 0, interests: [] };
type Scenario = 'audience' | 'sponsor_rep' | 'has_access' | 'outsider' | 'revoked' | 'new_member'
  | 'membership_only' | 'nested_membership' | 'different_event' | 'mismatched_reference_registered'
  | 'scoped_duplicate_key';

async function setup(page: Page, scenario: Scenario) {
  let joins = 0;
  let registered = ['audience', 'sponsor_rep', 'has_access', 'revoked'].includes(scenario);
  await page.route('**/api/v1/**', async route => {
    const p = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const ok = (body: unknown, status = 200) => route.fulfill({
      status, contentType: 'application/json', body: JSON.stringify(body),
    });
    if (p === '/api/v1/auth/send-otp') return ok({ success: true, data: { expires_in: 600 } });
    if (p === '/api/v1/auth/verify-otp') return ok({ success: true,
      data: { token: 'mock-membership-token', account_exists: true, verified: true, user } });
    if (p === '/api/v1/me') return ok({ success: true, data: user });
    if (p.startsWith('/api/v1/me/')) return ok({ success: true, data: { points: 0, history: [] } });
    if (p === '/api/v1/events') return ok({ success: true, data: { data: [event] } });
    if (p === '/api/v1/events/join' && method === 'POST') {
      joins++;
      expect(route.request().postDataJSON()).toEqual({
        event_code: scenario === 'different_event' ? 'OTHER-26' : 'MEM-26',
        code: scenario === 'different_event' ? 'OTHER-26' : 'MEM-26',
        event_id: '21',
      });
      if (scenario === 'different_event') {
        return ok({ success: true, data: { event_id: 22, membership_id: 900 } }, 201);
      }
      if (scenario === 'mismatched_reference_registered') {
        registered = true;
        return ok({ success: true, data: { event_id: 22, membership_id: 900 } }, 201);
      }
      if (['new_member', 'membership_only', 'nested_membership', 'scoped_duplicate_key'].includes(scenario)) {
        registered = true;
        if (scenario === 'scoped_duplicate_key') {
          // This backend fixture has another event with the same key. It must
          // choose the requested event, not its first code-only match.
          return ok({ success: true, data: { event_id: route.request().postDataJSON().event_id,
            membership_id: 900, auto_checked_in: true } }, 201);
        }
        if (scenario === 'membership_only') return ok({ success: true,
          data: { id: 900, membership_id: 900, auto_checked_in: true } }, 201);
        if (scenario === 'nested_membership') return ok({ success: true,
          data: { id: 900, membership: { id: 900, event_id: 21 } } }, 201);
        return ok({ success: true, event_id: 21, data: { id: 900, membership_id: 900 }, auto_checked_in: true }, 201);
      }
      return ok({ success: false, error: { code: 'INVALID_CODE', message: 'Invalid event key' } }, 404);
    }
    if (p === '/api/v1/events/21') return ok({ success: true, data: event });
    if (p === '/api/v1/events/21/access') {
      if (scenario === 'sponsor_rep') return ok({ success: false, error: { code: '404', message: 'Missing route' } }, 404);
      if (scenario === 'has_access') return ok({ success: true,
        data: { is_member: false, has_access: true, role: 'sponsor_rep' } });
      return ok({ success: true, data: { is_member: 'false' } });
    }
    const role = scenario === 'sponsor_rep' || scenario === 'has_access' ? 'sponsor_rep' : 'audience';
    const member = {
      user_id: registered ? user.id : 'different-user',
      email: registered ? user.email : 'another@example.test',
      name: registered ? user.name : 'Another Person',
      membership_id: 900, roles: [role], status: scenario === 'revoked' ? 'revoked' : 'active',
    };
    if (p === '/api/v1/events/21/members' || p === '/api/v1/events/21/attendees') {
      return ok({ success: true, data: { data: [member], last_page: 1 } });
    }
    if (p.startsWith('/api/v1/events/')) return ok({ success: true, data: [] });
    return ok({ success: true, data: [] });
  });
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByPlaceholder('you@example.com').fill(user.email);
  await page.getByRole('button', { name: /^Continue$/i }).click();
  const otp = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otp.first()).toBeVisible();
  await otp.first().focus();
  await page.keyboard.type('123456', { delay: 20 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click();
  await page.getByRole('button', { name: /^Events$/i }).click();
  await page.getByText(event.name).first().click();
  return () => joins;
}

for (const scenario of ['audience', 'sponsor_rep', 'has_access'] as const) {
  test(`existing ${scenario} member enters without a key or join request`, async ({ page }) => {
    const joins = await setup(page, scenario);
    await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible();
    await expect(page.getByText('Access Required', { exact: true })).toHaveCount(0);
    expect(joins()).toBe(0);
    if (scenario !== 'audience') {
      await expect(page.getByRole('button', { name: /^Leads$/i })).toBeVisible();
      await page.getByRole('button', { name: /^More$/i }).click();
      await expect(page.getByRole('button', { name: /^Manage Giveaways$/i })).toBeVisible();
    }
  });
}

for (const scenario of ['outsider', 'revoked'] as const) {
  test(`${scenario} cannot bypass access using a listed event key`, async ({ page }) => {
    const joins = await setup(page, scenario);
    await expect(page.getByText('Access Required', { exact: true })).toBeVisible();
    await page.getByPlaceholder(event.code).fill(event.code);
    await page.getByRole('button', { name: /^Join Event$/i }).click();
    await expect(page.getByText('Invalid event key', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Home$/i })).toHaveCount(0);
    expect(joins()).toBe(1);
  });
}

test('a valid key registers a new member and preserves punctuation in the key', async ({ page }) => {
  const joins = await setup(page, 'new_member');
  await expect(page.getByText('Access Required', { exact: true })).toBeVisible();
  await page.getByPlaceholder(event.code).fill(' mem-26 ');
  await page.getByRole('button', { name: /^Join Event$/i }).click();
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible();
  expect(joins()).toBe(1);
  await page.getByRole('button', { name: /^Audience$/i }).click();
  await expect(page.getByText(user.name).first()).toBeVisible();
});

for (const scenario of ['membership_only', 'nested_membership', 'mismatched_reference_registered', 'scoped_duplicate_key'] as const) {
  test(`correct key joins and adds attendee when the response contains ${scenario}`, async ({ page }) => {
    const joins = await setup(page, scenario);
    await expect(page.getByText('Access Required', { exact: true })).toBeVisible();
    await page.getByPlaceholder(event.code).fill(event.code);
    await page.getByRole('button', { name: /^Join Event$/i }).click();
    await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible();
    await expect(page.getByText('That key belongs to a different event.', { exact: false })).toHaveCount(0);
    expect(joins()).toBe(1);
    await page.getByRole('button', { name: /^Audience$/i }).click();
    await expect(page.getByText(user.name).first()).toBeVisible();
  });
}

test('a key explicitly belonging to another event remains blocked', async ({ page }) => {
  await setup(page, 'different_event');
  await page.getByPlaceholder(event.code).fill('OTHER-26');
  await page.getByRole('button', { name: /^Join Event$/i }).click();
  await expect(page.getByText('The join response references a different event, and access to this event could not be confirmed. Selected event ID: 21; returned event ID: 22.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Home$/i })).toHaveCount(0);
});
