import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function load(path, dependencies = {}) {
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', '__DEV__', code)(name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  }, module, module.exports, false);
  return module.exports;
}
const resolver = load('mobile/lib/eventMembership.ts');
const joinParser = load('mobile/lib/eventJoinResult.ts');
const identity = { id: '42', email: 'member@example.test' };
const ok = data => ({ success: true, data });
const unavailable = { success: false, error: { code: '404', message: 'Missing endpoint' } };
const roster = row => async () => ok({ data: [row] });

test('has_access admits sponsor reps even when is_member is false', async () => {
  const res = await resolver.resolveEventMembership(ok({ is_member: false, has_access: 'true', role: 'sponsor_rep' }),
    identity, () => { throw Error('No roster needed'); });
  assert.deepEqual(res.data, { is_member: true, role: 'sponsor' });
});

for (const role of ['audience', 'attendee', 'sponsor_rep', 'sponsor representative', 'exhibitor_rep']) {
  test(`confirmed roster membership admits ${role} despite an inconsistent access flag`, async () => {
    const res = await resolver.resolveEventMembership(ok({ is_member: false }), identity,
      roster({ user_id: 42, roles: [role], status: 'active' }));
    assert.deepEqual(res.data, { is_member: true, role: role === 'audience' || role === 'attendee' ? 'attendee' : 'sponsor' });
  });
}

test('supports nested user identities and Laravel nested pagination', async () => {
  const res = await resolver.resolveEventMembership(unavailable, identity, async () =>
    ok({ data: { data: [{ id: 999, user: { id: 42, email: identity.email }, roles: [{ name: 'sponsor_rep' }] }], last_page: 1 } }));
  assert.equal(res.data.role, 'sponsor');
  assert.equal(res.data.is_member, true);
});

test('searches beyond the first audience page', async () => {
  const pages = [];
  const res = await resolver.resolveEventMembership(unavailable, identity, async page => {
    pages.push(page);
    return ok({ data: page === 1 ? Array.from({ length: 100 }, (_, i) => ({ user_id: i + 1000 }))
      : [{ user_id: 42, roles: ['audience'] }], last_page: 2 });
  });
  assert.deepEqual(pages, [1, 2]);
  assert.equal(res.data.is_member, true);
});

test('uses the attendee directory if member lookup is restricted or excludes audience roles', async () => {
  for (const memberResponse of [unavailable, ok({ data: [] })]) {
    const res = await resolver.resolveEventMembership(ok({ is_member: false }), identity,
      async () => memberResponse, roster({ user_id: 42, roles: ['audience'], status: 'active' }));
    assert.deepEqual(res.data, { is_member: true, role: 'attendee' });
  }
});

test('an explicitly revoked member cannot be reauthorized by an alternate roster', async () => {
  const res = await resolver.resolveEventMembership(unavailable, identity,
    roster({ user_id: 42, status: 'revoked' }),
    () => { throw Error('Must not override revoked membership'); });
  assert.equal(res.data.is_member, false);
});

test('does not confuse a membership id with an explicit different user id', async () => {
  const res = await resolver.resolveEventMembership(ok({ is_member: 'false', role: 'sponsor_rep' }), identity,
    roster({ id: 42, user_id: 800, email: 'other@example.test', roles: ['sponsor_rep'] }));
  assert.equal(res.data.is_member, false);
});

test('inactive or revoked membership cannot bypass the key gate', async () => {
  for (const status of ['inactive', 'revoked', 'suspended', 'pending']) {
    const res = await resolver.resolveEventMembership(unavailable, identity,
      roster({ user_id: 42, status, roles: ['sponsor_rep'] }));
    assert.equal(res.data.is_member, false);
  }
  const res = await resolver.resolveEventMembership(ok({ has_access: true, status: 'revoked' }), identity,
    () => { throw Error('Explicit revoked access must stop'); });
  assert.equal(res.data.is_member, false);
});

test('an unavailable access check and roster cannot grant access or claim the key is invalid', async () => {
  const res = await resolver.resolveEventMembership(unavailable, identity, async () => unavailable);
  assert.equal(res.success, false);
  assert.equal(res.error.code, 'ACCESS_UNAVAILABLE');
  assert.match(res.error.message, /key may still be valid/);
});

for (const app of ['web', 'mobile']) {
  test(`${app} access adapter verifies this account through the event roster`, async () => {
    const calls = [];
    const request = async path => {
      calls.push(path);
      return path.endsWith('/access') ? unavailable : ok({ data: [{ user_id: 42, roles: ['sponsor_rep'] }] });
    };
    const api = app === 'web'
      ? load('src/app/api/eventsClient.ts', {
        './client': { apiGet: request },
        '../../../mobile/lib/eventMembership': resolver,
        '../../../mobile/lib/eventJoinResult': joinParser,
      })
      : load('mobile/lib/api/events.ts', {
        '@/lib/apiClient': { request },
        '@/lib/eventStore': {},
        '@/lib/eventMembership': resolver,
        '@/lib/eventJoinResult': joinParser,
      });
    const res = await api.checkEventAccess('21', identity);
    assert.equal(res.data.is_member, true);
    assert.equal(res.data.role, 'sponsor');
    assert.deepEqual(calls, ['/api/v1/events/21/access',
      '/api/v1/events/21/members?per_page=100&page=1&checked_in_only=false']);
  });
}

test('a membership resource id is never interpreted as an event id', () => {
  const joined = joinParser.normalizeEventJoinResponse({ success: true, data: { id: 900, membership_id: 900 } });
  assert.equal(joined.eventId, '');
  assert.equal(joined.membershipId, 900);
});

test('explicit event identity survives nested membership resources and outer envelope fields', () => {
  for (const response of [
    { success: true, data: { id: 900, membership: { id: 900, event_id: 21 } } },
    { success: true, event_id: 21, data: { id: 900, membership_id: 900 } },
    { success: true, data: { data: { id: 900, eventId: '21', membership_id: '900' } } },
    { success: true, data: { membership: { id: 900, event: { id: 21 } } } },
  ]) {
    const joined = joinParser.normalizeEventJoinResponse(response);
    assert.equal(joined.eventId, '21');
    assert.equal(joined.membershipId, 900);
  }
});

test('the web join adapter does not reject a correct key because the response id belongs to membership', async () => {
  const api = load('src/app/api/eventsClient.ts', {
    './client': { apiPost: async () => ({ success: true, data: { id: 900, membership_id: 900 } }) },
    '../../../mobile/lib/eventMembership': resolver,
    '../../../mobile/lib/eventJoinResult': joinParser,
  });
  const joined = await api.joinEventWithCode('MEM-26');
  assert.equal(joined.success, true);
  assert.equal(joined.data.eventId, '');
  assert.equal(joined.data.membershipId, 900);
});

test('mobile resolves the event reference inside a membership instead of fetching the membership as an event', async () => {
  const calls = [];
  const api = load('mobile/lib/api/events.ts', {
    '@/lib/apiClient': { request: async path => {
      calls.push(path);
      if (path === '/api/v1/events/join') return { success: true,
        data: { id: 900, membership: { id: 900, event_id: 21 } } };
      assert.equal(path, '/api/v1/events/21');
      return { success: true, data: { id: 21, name: 'Membership Summit' } };
    } },
    '@/lib/eventStore': {},
    '@/lib/eventMembership': resolver,
    '@/lib/eventJoinResult': joinParser,
  });
  const joined = await api.joinByCode('MEM-26');
  assert.equal(joined.success, true);
  assert.equal(joined.data.id, '21');
  assert.equal(joined.data.membershipId, 900);
  assert.deepEqual(calls, ['/api/v1/events/join', '/api/v1/events/21']);
});
