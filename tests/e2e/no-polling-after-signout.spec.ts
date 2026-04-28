import { test, expect, type Request } from '@playwright/test';

/**
 * Regression guard for the polling-after-sign-out class of bug fixed in
 * tasks #22, #23, #24, #25 (and centralised behind `useAuthedInterval`
 * / `useAuthedEffect` in task #25).
 *
 * The invariant we lock in here:
 *
 *   After `setUser(null)` runs, no further request to an authenticated
 *   `/api/v1/**` endpoint should fire from the page within the next
 *   ~35 seconds — even if a periodic effect's tick interval would
 *   normally hit during that window.
 *
 * Why ~35s: the slowest poll in the codebase right now ticks every 30s
 * (MyBadgePage / MeetingsPage), so a 35s observation window guarantees
 * we'd see at least one tick from any naively-implemented poller that
 * forgot to gate on `userId`.
 *
 * Implementation notes:
 *
 *  1. We **cancel the post-sign-out `window.location.reload`** by
 *     installing a `beforeunload` handler whose confirmation dialog is
 *     auto-dismissed by Playwright. Both sign-out paths
 *     (`ProfilePage`, `EventJoinPage`) clear the token, null the user,
 *     and reload — that reload is itself a defence, but it also hides
 *     any provider-level pollers (e.g. the leads reconciler in
 *     `AppContext`) by tearing the whole tree down. By cancelling the
 *     reload we observe the pollers in their natural "user is null but
 *     the React tree is still mounted" state, which is exactly the
 *     state a future contributor's broken poller would leak in.
 *
 *  2. We stub every `/api/v1/**` route so the test is self-contained
 *     and doesn't depend on the real Laravel backend being reachable.
 *
 *  3. We classify each request by **URL path**, not by the presence
 *     of an `Authorization` header. This matters because
 *     `src/app/api/client.ts` reads the bearer token from
 *     `localStorage` *per request*, and sign-out clears that key
 *     *before* a leaked poller would tick — so a regressed poller
 *     would happily fire `GET /api/v1/me` (etc.) with no auth header
 *     at all, generating a stream of 401s on the real backend. A
 *     header-only check would silently pass on exactly the bug class
 *     we're trying to catch. Instead, the assertion treats every
 *     `/api/v1/**` path EXCEPT the small auth/public allow-list as
 *     authenticated, and supplements that with a header-based signal
 *     for traceability in the failure message.
 */

const AUTH_TOKEN = 'mock-auth-token-for-e2e-tests';

const TEST_USER = {
  id: 'user-1',
  name: 'Test User',
  email: 'test@example.com',
  first_name: 'Test',
  last_name: 'User',
  phone: '+15555550100',
  title: 'QA Engineer',
  company: 'CXO Inc',
  role: 'attendee',
  badge_code: 'BADGE-TEST-1',
  points: 100,
  tier: 'Bronze',
  email_verified: true,
  profile_complete: true,
  interests: [],
};

interface RecordedRequest {
  url: string;
  path: string;
  method: string;
  hadAuthHeader: boolean;
  msSinceMark: number;
}

/**
 * Public / unauthenticated `/api/v1/**` paths. Anything else under
 * `/api/v1/` is treated as authenticated for the purposes of this
 * regression test — i.e. it must NOT be hit after sign-out.
 *
 * Keep this list intentionally small and conservative: when in doubt,
 * a path is authenticated.
 */
const PUBLIC_API_PATTERNS: RegExp[] = [
  /^\/api\/v1\/auth\/send-otp$/,
  /^\/api\/v1\/auth\/verify-otp$/,
];

function isAuthenticatedApiPath(path: string): boolean {
  if (!path.startsWith('/api/v1/')) return false;
  return !PUBLIC_API_PATTERNS.some((re) => re.test(path));
}

test('no authenticated requests fire after sign-out (polling regression guard)', async ({
  page,
}) => {
  // ── 1. Disable the post-sign-out reload ────────────────────────────
  // See file header for why this matters. We expose a counter so the
  // assertion at the end can confirm the sign-out path actually tried
  // to reload (otherwise the test would silently no-op if the button
  // selector ever broke).
  // Chrome's `window.location.reload` is a non-configurable host method
  // — `Object.defineProperty` rejects any attempt to override it. We
  // instead use a `beforeunload` handler combined with Playwright's
  // automatic dialog dismissal. Once a user gesture has occurred (the
  // sign-out button click counts), Chrome routes the JS-initiated
  // reload through `beforeunload` → confirmation dialog →
  // Playwright's `dialog` handler dismisses it → navigation is
  // cancelled. The handler also bumps a counter so the assertion
  // below can prove the sign-out path actually fired the reload.
  await page.addInitScript(() => {
    (window as unknown as { __reloadCalled: number }).__reloadCalled = 0;
    window.addEventListener('beforeunload', (e) => {
      (window as unknown as { __reloadCalled: number }).__reloadCalled++;
      e.preventDefault();
      // Required by some browsers to actually trigger the prompt.
      (e as unknown as { returnValue: string }).returnValue = '';
    });
  });
  page.on('dialog', (dialog) => {
    if (dialog.type() === 'beforeunload') {
      // "dismiss" on a beforeunload dialog means "stay on the page",
      // i.e. cancel the reload. That's exactly what we want.
      void dialog.dismiss();
    } else {
      void dialog.accept();
    }
  });

  // ── 2. Stub the backend ────────────────────────────────────────────
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();

    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(body),
      });

    // ── Auth ────────────────────────────────────────────────────────
    if (path === '/api/v1/auth/send-otp') {
      // expires_in present → backend says "account exists, OTP sent"
      return json({
        success: true,
        data: { message: 'OTP sent successfully.', expires_in: 600 },
      });
    }
    if (path === '/api/v1/auth/verify-otp') {
      return json({
        success: true,
        data: {
          token: AUTH_TOKEN,
          account_exists: true,
          verified: true,
          user: TEST_USER,
        },
      });
    }

    // ── Authenticated lookups (only ever called with a token) ───────
    if (path === '/api/v1/me') {
      return json({ success: true, data: TEST_USER });
    }
    if (path === '/api/v1/me/badge') {
      return json({
        success: true,
        data: {
          badge_code: TEST_USER.badge_code,
          qr_image_url: '',
        },
      });
    }
    if (path.startsWith('/api/v1/me/points') || path === '/api/v1/me/points-history') {
      return json({ success: true, data: { points: TEST_USER.points, history: [] } });
    }
    if (path.startsWith('/api/v1/me/meeting') || path.startsWith('/api/v1/meetings')) {
      return json({ success: true, data: [] });
    }

    // ── Event-scoped data ───────────────────────────────────────────
    if (path === '/api/v1/events' || path.startsWith('/api/v1/events?')) {
      return json({
        success: true,
        data: {
          data: [
            {
              id: 1,
              name: 'Test Event',
              code: 'TEST',
              starts_at: new Date().toISOString(),
              ends_at: new Date(Date.now() + 86400_000).toISOString(),
            },
          ],
        },
      });
    }
    if (/^\/api\/v1\/events\/[^/]+\/access$/.test(path)) {
      return json({ success: true, data: { has_access: true } });
    }
    if (/^\/api\/v1\/events\/[^/]+\/leads(\/.*)?$/.test(path) && method === 'GET') {
      return json({ success: true, data: [] });
    }
    if (/^\/api\/v1\/events\/[^/]+\/sponsors$/.test(path)) {
      return json({ success: true, data: [] });
    }
    if (/^\/api\/v1\/events\/[^/]+\/feed/.test(path)) {
      return json({ success: true, data: { items: [], has_more: false } });
    }
    if (/^\/api\/v1\/events\/[^/]+\/members/.test(path)) {
      return json({ success: true, data: [] });
    }

    // ── Catch-all so no request hits the real backend ───────────────
    return json({ success: true, data: null });
  });

  // ── 3. Record every request the page makes to an authenticated
  // `/api/v1/**` endpoint. We classify by URL path (see file header
  // for the rationale — the auth header is added per-request from
  // localStorage and is gone the moment sign-out clears the token,
  // so any leaked poller would fire WITHOUT an Authorization header).
  let signOutMark: number | null = null;
  const recorded: RecordedRequest[] = [];
  page.on('request', (request: Request) => {
    let path: string;
    try {
      path = new URL(request.url()).pathname;
    } catch {
      return;
    }
    if (!isAuthenticatedApiPath(path)) return;
    recorded.push({
      url: request.url(),
      path,
      method: request.method(),
      hadAuthHeader: Boolean(request.headers()['authorization']),
      msSinceMark: signOutMark == null ? -1 : Date.now() - signOutMark,
    });
  });

  // ── 4. Drive the sign-in flow ──────────────────────────────────────
  await page.goto('/');

  // Splash auto-completes after ~2.4s, then welcome screen renders the
  // "Start Networking" CTA which opens the sign-in sheet.
  const startBtn = page.getByRole('button', { name: /start networking/i });
  await startBtn.click({ timeout: 15_000 });

  await page.getByPlaceholder('you@example.com').fill('test@example.com');
  await page.getByRole('button', { name: /^Continue$/ }).click();

  // OTP screen — type the 6 digits across the per-digit inputs. The
  // verify happens automatically once 6 digits are entered.
  const otpInputs = page.locator('div[aria-label="Sign in"] input[inputmode="numeric"]');
  await expect(otpInputs.first()).toBeVisible({ timeout: 10_000 });
  // Focus the first box, then type 6 digits — the OtpInput component
  // auto-advances focus on each keystroke.
  await otpInputs.first().focus();
  await page.keyboard.type('123456', { delay: 30 });

  // Profile-review step: confirm and proceed into the app.
  const confirmBtn = page.getByRole('button', { name: /looks good,\s*continue/i });
  await confirmBtn.click({ timeout: 15_000 });

  // We should now be on the EventJoinPage which exposes the "Log off"
  // control we'll click in step 5.
  const logOff = page.getByRole('button', { name: /log off/i });
  await expect(logOff).toBeVisible({ timeout: 15_000 });

  // Sanity check — we should have made at least one authenticated
  // request during the sign-in flow (e.g. GET /api/v1/me). Without
  // this the rest of the assertion is vacuous.
  expect(recorded.length).toBeGreaterThan(0);

  // ── 5. Sign out and start observing ────────────────────────────────
  signOutMark = Date.now();
  // Drop everything captured during sign-in — the assertion only cares
  // about requests that fire AFTER the sign-out moment.
  recorded.length = 0;

  await logOff.click();

  // Confirm that the app's sign-out path actually ran (it should have
  // invoked the no-op reload shim we installed in step 1). Without
  // this guard, a future refactor that breaks the click target would
  // make the test trivially pass.
  await expect
    .poll(
      async () =>
        page.evaluate(
          () => (window as unknown as { __reloadCalled: number }).__reloadCalled,
        ),
      { timeout: 10_000, message: 'sign-out path did not call window.location.reload' },
    )
    .toBeGreaterThan(0);

  // ── 6. Watch for ~35s and assert no authed requests slipped through
  // 35s > the slowest in-app poll interval (30s) so any naive poller
  // that forgot to gate on `userId` would have ticked at least once.
  const observationWindowMs = 35_000;
  await page.waitForTimeout(observationWindowMs);

  const offenders = recorded.filter((r) => r.msSinceMark >= 0);
  if (offenders.length > 0) {
    // Build a readable failure message — paths + timing + whether the
    // bearer token was still attached are the most useful signals
    // for whoever debugs the regression.
    const lines = offenders
      .map(
        (r) =>
          `  · ${r.method} ${r.path}  (+${(r.msSinceMark / 1000).toFixed(1)}s)` +
          `${r.hadAuthHeader ? '  [Authorization: present]' : '  [Authorization: absent]'}`,
      )
      .join('\n');
    throw new Error(
      `Detected ${offenders.length} authenticated request(s) after sign-out:\n${lines}\n\n` +
        `Every periodic / background fetch must be gated on the signed-in user — ` +
        `use \`useAuthedInterval\` / \`useAuthedEffect\` (web) or ` +
        `\`useAuthedQuery\` / \`useAuthedEffect\` (mobile). ` +
        `See src/app/hooks/useAuthedInterval.ts for the canonical pattern.`,
    );
  }
});
