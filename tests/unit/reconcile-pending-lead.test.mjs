/**
 * Unit test: reconcilePendingLead forwards notes / tags / priority to
 * submitScan when retrying an offline lead after reconnect.
 *
 * Run with: node tests/unit/reconcile-pending-lead.test.mjs
 *
 * No test framework required — plain Node.js assert module is used so this
 * file runs in CI without additional tooling.
 */

import assert from 'node:assert/strict';

// ---------------------------------------------------------------------------
// Inline the reconcilePendingLead function under test so we can inject a
// mock submitScan without needing module aliasing or transpilation.
// This mirrors the production logic at mobile/lib/api/leads.ts exactly;
// any drift there must be reflected here.
// ---------------------------------------------------------------------------

/**
 * @param {Function} submitScanFn  Injectable mock for submitScan.
 * @param {{ id: string, code?: string, pendingSync?: boolean,
 *           name?: string, company?: string, title?: string,
 *           notes?: string, tags?: string[], priority?: string }} local
 * @returns {Promise<object|null>}
 */
async function reconcilePendingLead(submitScanFn, local) {
  if (!local.pendingSync) return null;
  const code = local.code ?? '';
  if (!code) return null;
  const res = await submitScanFn({
    badgeData: code,
    name: local.name,
    company: local.company,
    title: local.title,
    notes: local.notes,
    tags: local.tags,
    priority: local.priority,
  });
  if (!res.success || !res.data) return null;
  if (res.data.pendingSync) return null;
  return res.data;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result.then(
        () => { console.log(`  ✓ ${name}`); passed++; },
        (err) => { console.error(`  ✗ ${name}\n    ${err.message}`); failed++; },
      );
    }
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const serverLead = {
  id: 'server-lead-42',
  name: 'Alex Rivera',
  company: 'NovaTech',
  title: 'CTO',
  code: 'ATT-9001',
  notes: '',
  tags: [],
  priority: 'warm',
  pendingSync: false,
};

const tests = [
  test('passes notes to submitScan when lead has notes', async () => {
    const captured = [];
    const mockSubmitScan = async (payload) => {
      captured.push(payload);
      return { success: true, data: serverLead };
    };

    const local = {
      id: 'local-1',
      code: 'ATT-9001',
      pendingSync: true,
      name: 'Alex Rivera',
      company: 'NovaTech',
      title: 'CTO',
      notes: 'great prospect — follow up next week',
      tags: ['vip', 'warm'],
      priority: 'hot',
    };

    const result = await reconcilePendingLead(mockSubmitScan, local);

    assert.ok(result, 'should return the server lead on success');
    assert.equal(captured.length, 1, 'submitScan called exactly once');
    assert.equal(captured[0].notes, 'great prospect — follow up next week', 'notes forwarded');
    assert.deepEqual(captured[0].tags, ['vip', 'warm'], 'tags forwarded');
    assert.equal(captured[0].priority, 'hot', 'priority forwarded');
  }),

  test('passes empty string notes when lead has empty notes', async () => {
    const captured = [];
    const mockSubmitScan = async (payload) => {
      captured.push(payload);
      return { success: true, data: serverLead };
    };

    const local = {
      id: 'local-2',
      code: 'ATT-9002',
      pendingSync: true,
      name: 'Jordan Lee',
      company: 'Acme',
      title: 'VP',
      notes: '',
      tags: [],
      priority: 'warm',
    };

    await reconcilePendingLead(mockSubmitScan, local);

    assert.equal(captured[0].notes, '', 'empty notes forwarded (not undefined)');
    assert.deepEqual(captured[0].tags, [], 'empty tags forwarded');
    assert.equal(captured[0].priority, 'warm', 'warm priority forwarded');
  }),

  test('passes undefined notes when lead has no notes field', async () => {
    const captured = [];
    const mockSubmitScan = async (payload) => {
      captured.push(payload);
      return { success: true, data: serverLead };
    };

    // Lead created before notes/tags/priority fields existed
    const local = {
      id: 'local-3',
      code: 'ATT-9003',
      pendingSync: true,
      name: 'Dana Kim',
      company: 'Beta Corp',
      title: 'Engineer',
    };

    await reconcilePendingLead(mockSubmitScan, local);

    assert.equal(captured[0].notes, undefined, 'notes is undefined when not set on lead');
    assert.equal(captured[0].tags, undefined, 'tags is undefined when not set on lead');
    assert.equal(captured[0].priority, undefined, 'priority is undefined when not set on lead');
  }),

  test('still forwards badge code, name, company, and title', async () => {
    const captured = [];
    const mockSubmitScan = async (payload) => {
      captured.push(payload);
      return { success: true, data: serverLead };
    };

    const local = {
      id: 'local-4',
      code: 'ATT-9004',
      pendingSync: true,
      name: 'Sam Sponsor',
      company: 'TechCo',
      title: 'Director',
      notes: 'note',
      tags: ['cold'],
      priority: 'cold',
    };

    await reconcilePendingLead(mockSubmitScan, local);

    assert.equal(captured[0].badgeData, 'ATT-9004', 'badge code forwarded');
    assert.equal(captured[0].name, 'Sam Sponsor', 'name forwarded');
    assert.equal(captured[0].company, 'TechCo', 'company forwarded');
    assert.equal(captured[0].title, 'Director', 'title forwarded');
  }),

  test('returns null without calling submitScan when pendingSync is false', async () => {
    let called = false;
    const mockSubmitScan = async () => { called = true; return { success: true, data: serverLead }; };

    const local = { id: 'local-5', code: 'ATT-9005', pendingSync: false, notes: 'note' };
    const result = await reconcilePendingLead(mockSubmitScan, local);

    assert.equal(result, null, 'returns null for non-pending lead');
    assert.equal(called, false, 'submitScan not called');
  }),

  test('returns null without calling submitScan when code is missing', async () => {
    let called = false;
    const mockSubmitScan = async () => { called = true; return { success: true, data: serverLead }; };

    const local = { id: 'local-6', pendingSync: true, notes: 'note', tags: ['vip'], priority: 'hot' };
    const result = await reconcilePendingLead(mockSubmitScan, local);

    assert.equal(result, null, 'returns null when no badge code');
    assert.equal(called, false, 'submitScan not called');
  }),

  test('returns null when submitScan still returns pendingSync (server still unreachable)', async () => {
    const mockSubmitScan = async () => ({
      success: true,
      data: { ...serverLead, pendingSync: true },
    });

    const local = {
      id: 'local-7',
      code: 'ATT-9007',
      pendingSync: true,
      notes: 'note',
    };
    const result = await reconcilePendingLead(mockSubmitScan, local);
    assert.equal(result, null, 'returns null when server path still returns pendingSync');
  }),
];

// Run all tests sequentially
Promise.all(tests).then(() => {
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
});
