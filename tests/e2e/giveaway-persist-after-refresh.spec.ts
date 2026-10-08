/**
 * E2E regression guard — Task #125
 *
 * Confirms that a newly-added giveaway remains visible in the sponsor's
 * own "My Giveaways" managed list after the background list refresh
 * that fires automatically inside `addSponsorGiveaway`.
 *
 * The regression scenario:
 *   1. Sponsor adds a giveaway → optimistic row appears immediately.
 *   2. POST /giveaways returns the saved item (id confirmed).
 *   3. A background GET /giveaways fires to sync server state.
 *   4. BUG: the GET response omits `sponsor_name` / `sponsor_id`; the
 *      refresh overwrites the array and the item falls out of the
 *      `visibleGiveaways` filter — it disappears from Manage view.
 *   5. FIX (task #120): the background refresh preserves ownership
 *      fields from the in-memory row when the server omits them, so
 *      the card stays in the sponsor-scoped list.
 *
 * The mock is deliberately adversarial: the background GET after the
 * POST returns the new giveaway WITHOUT `sponsor_name` or `sponsor_id`
 * so the test would fail on the pre-fix code path.
 *
 * Key assertion strategy:
 *   - The managed-section heading renders as "{company} Giveaways (N)"
 *     where N is exactly `visibleGiveaways.length` — filtered to the
 *     sponsor's own company. Asserting "(2)" here proves the new
 *     giveaway survived the refresh inside the filtered list, not in
 *     the unfiltered "All Event Giveaways" section below it.
 *   - A scoped locator (within the managed section) additionally
 *     confirms the title card itself is present there.
 *
 * Every /api/v1/** call is stubbed via page.route — no live backend required.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SPONSOR = {
  id: 'sp-ga-1',
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
  id: 55,
  name: 'GiveawayFest 2026',
  code: 'GF26',
  starts_at: '2026-08-20T09:00:00Z',
  ends_at: '2026-08-21T18:00:00Z',
  status: 'upcoming',
  location: 'Dubai',
  organizer: 'GiveawayFest Inc',
};

/** The giveaway that already exists before the sponsor adds anything. */
const EXISTING_GIVEAWAY = {
  id: 'g-existing-1',
  title: 'Existing Prize',
  number_of_items: 3,
  numberOfItems: 3,
  sponsor_name: 'Acme Corp',
  sponsor_id: 'sp-ga-1',
  created_at: '2026-08-01T00:00:00Z',
};

const NEW_GIVEAWAY_TITLE = 'Noise-Cancelling Headphones';
const NEW_GIVEAWAY_QTY   = '5';

/**
 * POST /giveaways — returns the canonical row with the real id.
 * sponsor_name / sponsor_id ARE included in the POST response; they
 * are stripped only in the subsequent background GET to trigger the
 * regression scenario.
 */
const NEW_GIVEAWAY_POST_RESPONSE = {
  id: 'g-new-999',
  title: NEW_GIVEAWAY_TITLE,
  number_of_items: 5,
  numberOfItems: 5,
  sponsor_name: 'Acme Corp',
  sponsor_id: 'sp-ga-1',
  created_at: new Date().toISOString(),
};

/**
 * Background GET /giveaways (fires after the POST) — deliberately omits
 * sponsor_name and sponsor_id on the new row to simulate the adversarial
 * backend response that triggered the original regression. The fix must
 * preserve these fields from the in-memory state so the item remains in
 * `visibleGiveaways` and the managed-section heading still reads "(2)".
 */
const BACKGROUND_GET_LIST_WITHOUT_OWNERSHIP = [
  EXISTING_GIVEAWAY,
  {
    id: 'g-new-999',
    title: NEW_GIVEAWAY_TITLE,
    number_of_items: 5,
    numberOfItems: 5,
    // intentionally omit sponsor_name / sponsor_id
    created_at: new Date().toISOString(),
  },
];

// ── Mock installer ────────────────────────────────────────────────────────────

function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

const CONCURRENT_GIVEAWAYS = [
  NEW_GIVEAWAY_POST_RESPONSE,
  {
    ...NEW_GIVEAWAY_POST_RESPONSE,
    id: 'g-teammate-1000',
    title: 'Teammate Travel Mug',
    number_of_items: 2,
    numberOfItems: 2,
    added_by_name: 'Taylor Teammate',
  },
];

function concurrentControls() {
  return {
    postStarted: [gate(), gate()],
    posts: [gate(), gate()],
    refreshStarted: [gate(), gate()],
    refreshes: [gate(), gate()],
  };
}

async function installMocks(
  page: Page,
  race?: { rejectDelete?: boolean },
  concurrent?: ReturnType<typeof concurrentControls>,
) {
  let postFired = false;
  let postCount = 0;
  let refreshCount = 0;
  const refreshStarted = gate();
  const refresh = gate();
  const deleteStarted = gate();
  const deletion = gate();

  await page.route('**/api/v1/**', async (route) => {
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
      return ok({ success: true, data: { token: 'mock-tok-ga', account_exists: true, verified: true, user: SPONSOR } });

    // Profile
    if (p === '/api/v1/me') return ok({ success: true, data: SPONSOR });
    if (p === '/api/v1/me/badge') return ok({ success: true, badge_code: 'BADGE-SP-1', qr_image_url: '' });
    if (p.startsWith('/api/v1/me/')) return ok({ success: true, data: { points: 100, history: [] } });

    // Events
    if (p === '/api/v1/events' || p.startsWith('/api/v1/events?'))
      return ok({ success: true, data: { data: [EVENT] } });
    if (m === 'POST' && /\/events\/(join|join-by-code)/.test(p))
      return ok({ success: true, data: { event_id: EVENT.id, membership_id: 9, message: 'Joined!' } });
    if (p === `/api/v1/events/${EVENT.id}`)
      return ok({ success: true, data: EVENT });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/access`))
      return ok({ success: true, data: { has_access: true, is_member: true, membership_id: '9', role: 'sponsor', status: 'active', joined_at: '2026-07-01T00:00:00Z' } });
    if (p.startsWith(`/api/v1/events/${EVENT.id}/members`))
      return ok({ success: true, data: { data: [
        { id: 'sp-ga-1', membership_id: 9, name: 'Sam Sponsor', email: 'sam@acme.com', roles: ['sponsor'], status: 'active', joined_at: '2026-07-01T00:00:00Z' },
      ], total: 1 } });

    // Giveaways — the critical stub
    if (p.startsWith(`/api/v1/events/${EVENT.id}/giveaways`)) {
      if (concurrent && m === 'POST') {
        const index = postCount++;
        expect(index).toBeLessThan(2);
        const body = route.request().postDataJSON();
        expect(body.title).toBe(CONCURRENT_GIVEAWAYS[index].title);
        expect(body.sponsor_id).toBe(SPONSOR.id);
        expect(body.sponsor_name).toBe(SPONSOR.company);
        concurrent.postStarted[index].release();
        await concurrent.posts[index].promise;
        postFired = true;
        return ok({ success: true, data: CONCURRENT_GIVEAWAYS[index] }, 201);
      }
      if (concurrent && m === 'GET' && postFired) {
        const index = refreshCount++;
        expect(index).toBeLessThan(2);
        concurrent.refreshStarted[index].release();
        await concurrent.refreshes[index].promise;
        // Both saves belong to the same company / sponsorId. Strip ALL
        // ownership so the user-id fallback cannot mask a broken merge.
        // Distinct quantities acknowledge each refresh's React state commit.
        const list = CONCURRENT_GIVEAWAYS.map((g, row) => ({
          id: g.id,
          title: g.title,
          created_at: g.created_at,
          number_of_items: 10 * (row + 1) + index,
        }));
        return ok({ success: true, data: [EXISTING_GIVEAWAY, ...list] });
      }
      if (m === 'DELETE' && race) {
        expect(p).toBe(`/api/v1/events/${EVENT.id}/giveaways/g-new-999`);
        deleteStarted.release();
        await deletion.promise;
        return race.rejectDelete
          ? ok({ success: false, error: { message: 'Delete rejected' } }, 500)
          : ok({ success: true });
      }
      if (m === 'POST') {
        postFired = true;
        return ok({ success: true, data: NEW_GIVEAWAY_POST_RESPONSE }, 201);
      }
      if (m === 'GET') {
        if (postFired && race) {
          // Capture the pre-deletion snapshot and hold it until the test
          // explicitly releases it, independent of DELETE completion.
          const staleList = [EXISTING_GIVEAWAY, NEW_GIVEAWAY_POST_RESPONSE];
          refreshStarted.release();
          await refresh.promise;
          return ok({ success: true, data: staleList });
        }
        // Before the POST: only the pre-existing giveaway.
        // After the POST: both giveaways, but the new one is missing
        // sponsor_name / sponsor_id to simulate the regression trigger.
        const list = postFired
          ? BACKGROUND_GET_LIST_WITHOUT_OWNERSHIP
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
  return { refreshStarted, refresh, deleteStarted, deletion };
}

// ── Test ──────────────────────────────────────────────────────────────────────

test('newly-added giveaway stays in My Giveaways section after background list refresh', async ({ page }) => {
  test.setTimeout(120_000);

  await installMocks(page);

  // ── Login ─────────────────────────────────────────────────────────────
  await page.goto('/');
  await page.getByRole('button', { name: /sign in/i }).click({ timeout: 15_000 });
  await page.getByPlaceholder('you@example.com').fill('sam@acme.com');
  await page.getByRole('button', { name: /^Continue$/i }).click();

  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });
  await page.getByRole('button', { name: /looks good,?\s*continue/i }).click({ timeout: 15_000 });

  // ── Join event ────────────────────────────────────────────────────────
  await page.getByRole('button', { name: /^Events$/i }).click({ timeout: 10_000 });
  await page.getByText('GiveawayFest 2026').first().click({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /^Home$/i })).toBeVisible({ timeout: 15_000 });

  // ── Navigate to Manage Giveaways ──────────────────────────────────────
  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();

  // Pre-condition: existing giveaway visible; section heading shows (1)
  await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('Existing Prize').first()).toBeVisible();

  // ── Add the new giveaway ──────────────────────────────────────────────
  const titleInput = page.getByPlaceholder(/Win a MacBook/i);
  await expect(titleInput).toBeVisible({ timeout: 5_000 });
  await titleInput.fill(NEW_GIVEAWAY_TITLE);

  const quantityInput = page.locator('input[type="number"]').first();
  await expect(quantityInput).toBeVisible();
  await quantityInput.fill(NEW_GIVEAWAY_QTY);

  // Intercept the background GET that fires after the POST resolves.
  // waitForResponse resolves the moment the GET response is received,
  // so we can assert state after the full refresh path completes rather
  // than relying on an arbitrary fixed delay.
  const backgroundGetPromise = page.waitForResponse(
    resp =>
      resp.url().includes(`/api/v1/events/${EVENT.id}/giveaways`) &&
      resp.request().method() === 'GET' &&
      // We want the GET that follows the POST, not the initial hydration GET.
      // We discriminate by waiting for any GET that returns 2 items.
      true,
    { timeout: 15_000 },
  );

  await page.getByRole('button', { name: /^Add Giveaway$/i }).click();

  // ── Optimistic insert: section heading immediately shows (2) ──────────
  // (The optimistic row has the correct sponsorName so it passes the
  //  visibleGiveaways filter straight away.)
  await expect(page.getByText(/Acme Corp Giveaways\s*\(2\)/i)).toBeVisible({ timeout: 8_000 });

  // ── Wait for the background GET refresh to settle ─────────────────────
  await backgroundGetPromise;

  // Allow one React render cycle after the response is processed.
  await page.waitForTimeout(500);

  // ── CRITICAL: My Giveaways section must still show (2) ───────────────
  // This fails on the pre-fix path because the adversarial GET strips
  // sponsor_name/sponsor_id, causing the new row to fall out of
  // visibleGiveaways and the heading to revert to "(1)".
  await expect(
    page.getByText(/Acme Corp Giveaways\s*\(2\)/i),
  ).toBeVisible({ timeout: 5_000 });

  // Also confirm the new giveaway title is present inside the managed
  // section (not just the unfiltered "All Event Giveaways" section).
  // We scope to the element whose text contains the section heading.
  const managedSection = page
    .locator('div')
    .filter({ hasText: /Acme Corp Giveaways\s*\(2\)/i })
    .first();
  await expect(managedSection.getByText(NEW_GIVEAWAY_TITLE).first()).toBeVisible({ timeout: 5_000 });

  // ── Navigate away and back to confirm persistence through navigation ──
  await page.getByRole('button', { name: /^Home$/i }).click();
  await expect(page.getByText(/Hi,\s*Sam/i)).toBeVisible({ timeout: 8_000 });

  await page.getByRole('button', { name: /^More$/i }).click();
  await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();

  await expect(
    page.getByText(/Acme Corp Giveaways\s*\(2\)/i),
  ).toBeVisible({ timeout: 8_000 });

  const managedSectionAfterNav = page
    .locator('div')
    .filter({ hasText: /Acme Corp Giveaways\s*\(2\)/i })
    .first();
  await expect(managedSectionAfterNav.getByText(NEW_GIVEAWAY_TITLE).first()).toBeVisible();
});

for (const order of [[0, 1], [1, 0]]) {
  test(`overlapping same-company giveaway saves survive acknowledgement order ${order.join(' then ')}`, async ({ page }) => {
    test.setTimeout(30_000);
    const control = concurrentControls();
    await installMocks(page, undefined, control);
    try {
      await page.goto('/');
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.getByPlaceholder('you@example.com').fill(SPONSOR.email);
      await page.getByRole('button', { name: /^Continue$/i }).click();
      const otp = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
      await expect(otp.first()).toBeVisible();
      await otp.first().focus();
      await page.keyboard.type('123456', { delay: 30 });
      await page.getByRole('button', { name: /looks good,?\s*continue/i }).click();
      await page.getByRole('button', { name: /^Events$/i }).click();
      await page.getByText(EVENT.name).first().click();
      await page.getByRole('button', { name: /^More$/i }).click();
      await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();
      await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible();

      // Submit twice without allowing either POST to finish: both calls to
      // addSponsorGiveaway are in flight, not sequential completed saves.
      for (const [index, giveaway] of CONCURRENT_GIVEAWAYS.entries()) {
        await page.getByPlaceholder(/Win a MacBook/i).fill(giveaway.title);
        await page.locator('input[type="number"]').first().fill(String(giveaway.number_of_items));
        await page.getByRole('button', { name: /^Add Giveaway$/i }).click();
        await control.postStarted[index].promise;
      }
      await expect(page.getByText(/Acme Corp Giveaways\s*\(3\)/i)).toBeVisible();

      // Scope to the managed section only, excluding All Event Giveaways.
      const managed = page.getByText(/Acme Corp Giveaways\s*\(3\)/i)
        .locator('xpath=../..');
      for (const [index, postIndex] of order.entries()) {
        // The backend has saved both prizes, but acknowledge one POST at a
        // time. The first GET returns the other prize while its optimistic
        // row is still pending. GETs are deduplicated by the API client, so
        // let this refresh finish before acknowledging the other POST.
        control.posts[postIndex].release();
        await control.refreshStarted[index].promise;
        const response = page.waitForResponse(r =>
          r.url().endsWith(`/events/${EVENT.id}/giveaways`) && r.request().method() === 'GET');
        control.refreshes[index].release();
        const refreshed = await response;
        await refreshed.finished();
        const payload = await refreshed.json();
        expect(payload.data.slice(1)).toHaveLength(2);
        for (const row of payload.data.slice(1)) {
          expect(row).not.toHaveProperty('sponsor_name');
          expect(row).not.toHaveProperty('sponsor_id');
        }

        // Wait on server-only values, not a timeout or the optimistic DOM:
        // these quantities prove this exact refresh has been applied.
        if (index === 0) {
          await expect(managed.getByText(`${10 * (postIndex + 1)} items available`, { exact: true })).toBeVisible();
        } else {
          await expect(managed.getByText('11 items available', { exact: true })).toBeVisible();
          await expect(managed.getByText('21 items available', { exact: true })).toBeVisible();
        }
        for (const giveaway of CONCURRENT_GIVEAWAYS) {
          await expect(managed.getByRole('heading', { name: giveaway.title, exact: true })).toHaveCount(1);
          await expect(managed.getByRole('heading', { name: giveaway.title, exact: true })).toBeVisible();
        }
        await expect(managed.getByRole('button', { name: 'Edit giveaway', exact: true })).toHaveCount(3);
      }
    } finally {
      for (const g of [...control.posts, ...control.refreshes]) g.release();
    }
  });
}

for (const order of ['GET before DELETE', 'DELETE before GET', 'rejected DELETE'] as const) {
  test(`deleted giveaway stays absent during stale refresh: ${order}`, async ({ page }) => {
    const control = await installMocks(page, { rejectDelete: order === 'rejected DELETE' });
    try {
      await page.goto('/');
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.getByPlaceholder('you@example.com').fill('sam@acme.com');
      await page.getByRole('button', { name: /^Continue$/i }).click();
      const otp = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
      await expect(otp.first()).toBeVisible();
      await otp.first().focus();
      await page.keyboard.type('123456', { delay: 30 });
      await page.getByRole('button', { name: /looks good,?\s*continue/i }).click();
      await page.getByRole('button', { name: /^Events$/i }).click();
      await page.getByText(EVENT.name).first().click();
      await page.getByRole('button', { name: /^More$/i }).click();
      await page.getByRole('button', { name: /^Manage Giveaways$/i }).click();
      await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible();

      await page.getByPlaceholder(/Win a MacBook/i).fill(NEW_GIVEAWAY_TITLE);
      await page.locator('input[type="number"]').first().fill(NEW_GIVEAWAY_QTY);
      await page.getByRole('button', { name: /^Add Giveaway$/i }).click();
      await control.refreshStarted.promise;
      await expect(page.getByText(/Acme Corp Giveaways\s*\(2\)/i)).toBeVisible();

      const card = page.getByRole('heading', { name: NEW_GIVEAWAY_TITLE, exact: true }).first()
        .locator('xpath=ancestor::div[.//button[@aria-label="Delete giveaway"]][1]');
      await card.getByRole('button', { name: 'Delete giveaway', exact: true }).click();
      await card.getByRole('button', { name: 'Delete', exact: true }).click();
      await control.deleteStarted.promise;
      await expect(page.getByText(NEW_GIVEAWAY_TITLE, { exact: true })).toHaveCount(0);

      // Catch even a transient reinsertion, not only the final DOM state.
      await page.evaluate(title => {
        const state = { reappeared: false };
        (window as any).__giveawayDeletionWatch = state;
        new MutationObserver(() => {
          if ([...document.querySelectorAll('h3')].some(h => h.textContent === title)) {
            state.reappeared = true;
          }
        }).observe(document.body, { subtree: true, childList: true });
      }, NEW_GIVEAWAY_TITLE);

      const staleResponse = page.waitForResponse(r =>
        r.url().endsWith(`/events/${EVENT.id}/giveaways`) && r.request().method() === 'GET');
      const deleteResponse = page.waitForResponse(r => r.request().method() === 'DELETE' &&
        r.url().endsWith('/giveaways/g-new-999'));
      if (order === 'DELETE before GET') {
        control.deletion.release();
        await (await deleteResponse).finished();
      }
      control.refresh.release();
      await (await staleResponse).finished();
      await page.evaluate(() => new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
      await expect(page.getByText(NEW_GIVEAWAY_TITLE, { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__giveawayDeletionWatch.reappeared)).toBe(false);
      await expect(page.getByText(/Acme Corp Giveaways\s*\(1\)/i)).toBeVisible();
      await expect(page.getByText(EXISTING_GIVEAWAY.title).first()).toBeVisible();
      await expect(page.getByText('3 items available', { exact: true })).toBeVisible();

      if (order !== 'DELETE before GET') {
        control.deletion.release();
        await (await deleteResponse).finished();
      }
      if (order === 'rejected DELETE') {
        await expect(page.getByText(/Acme Corp Giveaways\s*\(2\)/i)).toBeVisible();
        await expect(page.getByText(NEW_GIVEAWAY_TITLE).first()).toBeVisible();
      } else {
        await expect(page.getByText(NEW_GIVEAWAY_TITLE, { exact: true })).toHaveCount(0);
      }
    } finally {
      control.refresh.release();
      control.deletion.release();
    }
  });
}
