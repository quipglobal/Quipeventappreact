// Run: node --test tests/unit/mobile-leaderboard-freshness.test.mjs
// Execute the production hooks with a small navigation/React harness and real
// TanStack Query observers. No native emulator or new test dependencies needed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import vm from 'node:vm';

const require = createRequire(new URL('../../mobile/package.json', import.meta.url));
const ts = require('typescript');
const { QueryClient, QueryObserver } = require('@tanstack/react-query');

function load(relativePath, modules) {
  const source = readFileSync(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected dependency: ${name}`);
      return modules[name];
    },
  }, { filename: relativePath });
  return exports;
}

const sameDeps = (a, b) => a && a.length === b.length && a.every((v, i) => v === b[i]);

function harness() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let eventId = 'event-a';
  let auth = { token: 'test-session', user: { id: 'me' } };
  let slots = [];
  let cursor = 0;
  let focused = true;
  let effect;
  let observer;
  let unsubscribe;
  const pending = [];
  const calls = [];
  const react = {
    useMemo(fn, deps) {
      const i = cursor++;
      if (!sameDeps(slots[i]?.deps, deps)) slots[i] = { deps, value: fn() };
      return slots[i].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useRef(value) {
      const i = cursor++;
      slots[i] ??= { current: value };
      return slots[i];
    },
    createElement(type, props, ...children) { return { type, props: { ...props, children } }; },
  };
  const { useAuthedQuery } = load('mobile/hooks/useAuthedQuery.ts', {
    react,
    'expo-router': {
      useFocusEffect(callback) {
        if (callback !== effect) {
          effect = callback;
          if (focused) effect();
        }
      },
    },
    '@tanstack/react-query': {
      useQueryClient: () => client,
      useQuery(options) {
        if (!observer) {
          observer = new QueryObserver(client, options);
          unsubscribe = observer.subscribe(() => {});
        } else {
          observer.setOptions(options);
        }
        return observer.getCurrentResult();
      },
    },
    '@/context/AuthContext': { useAuth: () => auth },
  });
  const { useLeaderboard } = load('mobile/hooks/useAudience.ts', {
    react,
    '@/context/EventContext': { useEvent: () => ({ currentEventId: eventId }) },
    '@/hooks/useAuthedQuery': { useAuthedQuery },
    '@/lib/api/users': {
      getLeaderboard: () => {
        calls.push(eventId);
        return new Promise((resolve, reject) => pending.push({ resolve, reject }));
      },
    },
  });
  const DataState = () => {};
  const { default: Screen } = load('mobile/app/leaderboard.tsx', {
    react,
    'react-native': {
      View: 'View', Text: 'Text', ScrollView: 'ScrollView',
      TouchableOpacity: 'TouchableOpacity', StyleSheet: { create: (s) => s },
    },
    '@expo/vector-icons': { Ionicons: 'Ionicons' },
    'expo-linear-gradient': { LinearGradient: 'LinearGradient' },
    'expo-router': { router: { back() {} } },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '@/context/AuthContext': { useAuth: () => auth },
    '@/hooks/useAudience': { useLeaderboard },
    '@/components/DataState': { DataState },
    '@/constants/theme': { colors: { tiers: { Bronze: '#888' } }, spacing: {}, radius: {}, typography: {} },
  });
  return {
    client, calls,
    render() { cursor = 0; return Screen(); },
    renderPreview() { cursor = 0; return useLeaderboard(); },
    blur() { focused = false; },
    focus() { focused = true; effect(); },
    event(id) { eventId = id; },
    signOut() { auth = { token: null, user: null }; },
    unmount() {
      unsubscribe?.();
      observer = undefined;
      slots = [];
      effect = undefined;
      focused = true;
    },
    async resolve(points = 100) {
      assert.ok(pending.length, 'A request should be pending');
      pending.shift().resolve({
        success: true,
        data: [{ userId: 'me', name: 'Alex', rank: 1, points, tier: 'Bronze' }],
      });
      await new Promise((r) => setImmediate(r));
    },
    async fail() {
      pending.shift().reject(new Error('Network unavailable'));
      await new Promise((r) => setImmediate(r));
    },
    dispose() { unsubscribe?.(); client.clear(); },
    dataState(tree) { return walk(tree).find((node) => node.type === DataState).props; },
  };
}

function walk(node) {
  if (!node || typeof node !== 'object') return [];
  return [node, ...node.props.children.flat(Infinity).flatMap(walk)];
}

function containsText(tree, text) {
  return walk(tree).some((node) => node.props.children.flat(Infinity).includes(text));
}

test('initial load is a single fetch, with loading followed by scores', async () => {
  const h = harness();
  try {
    assert.equal(h.dataState(h.render()).loading, true);
    assert.equal(h.calls.length, 1);
    await h.resolve(100);
    const tree = h.render();
    assert.equal(h.dataState(tree).loading, false);
    assert.ok(containsText(tree, 100));
    h.render();
    assert.equal(h.calls.length, 1, 'Result renders must not trigger focus invalidation loops');
  } finally { h.dispose(); }
});

test('returning to a mounted screen bypasses the fresh cache and shows loading', async () => {
  const h = harness();
  try {
    h.render();
    await h.resolve(100);
    h.render();
    h.blur();
    h.focus();
    const refreshing = h.render();
    assert.equal(h.calls.length, 2);
    assert.equal(h.dataState(refreshing).loading, true);
    assert.ok(containsText(refreshing, 100), 'Keep cached rankings visible while refreshing');
    await h.resolve(250);
    const updated = h.render();
    assert.equal(h.dataState(updated).loading, false);
    assert.ok(containsText(updated, 250));
    assert.equal(h.calls.length, 2);
  } finally { h.dispose(); }
});

test('remounting within sixty seconds fetches again, even with cached data', async () => {
  const h = harness();
  try {
    h.render();
    await h.resolve();
    h.unmount();
    assert.equal(h.dataState(h.render()).loading, true);
    assert.equal(h.calls.length, 2);
    await h.resolve(300);
    assert.ok(containsText(h.render(), 300));
  } finally { h.dispose(); }
});

test('event switches use a separate key and never show the old event scores', async () => {
  const h = harness();
  try {
    h.render();
    await h.resolve(100);
    h.render();
    h.event('event-b');
    const switching = h.render();
    assert.equal(h.dataState(switching).loading, true);
    assert.ok(!containsText(switching, 100));
    assert.deepEqual(h.calls, ['event-a', 'event-b']);
    await h.resolve(500);
    assert.ok(containsText(h.render(), 500));
    h.event('event-a');
    // Focus invalidation runs after useQuery reads its result. React then
    // renders again from the observer notification; mirror that here.
    h.render();
    assert.equal(h.dataState(h.render()).loading, true);
    assert.deepEqual(h.calls, ['event-a', 'event-b', 'event-a']);
    await h.resolve(150);
    assert.ok(containsText(h.render(), 150));
  } finally { h.dispose(); }
});

test('previews keep their cache on remount, unlike the full screen', async () => {
  const h = harness();
  try {
    h.renderPreview();
    await h.resolve();
    h.unmount();
    assert.equal(h.renderPreview().isFetching, false);
    assert.equal(h.calls.length, 1);
  } finally { h.dispose(); }
});

test('a failed revisit stops loading and offers retry without dropping cached scores', async () => {
  const h = harness();
  try {
    h.render();
    await h.resolve();
    h.render();
    h.blur();
    h.focus();
    await h.fail();
    const failed = h.render();
    assert.equal(h.dataState(failed).loading, false);
    assert.equal(h.dataState(failed).error, 'Failed to load leaderboard.');
    assert.ok(containsText(failed, 100));
    const retry = h.dataState(failed).onRetry();
    assert.equal(h.dataState(h.render()).loading, true);
    await h.resolve(200);
    await retry;
    assert.ok(containsText(h.render(), 200));
  } finally { h.dispose(); }
});

test('focus refresh is disabled after sign-out or without an event', async () => {
  for (const disable of [(h) => h.signOut(), (h) => h.event(null)]) {
    const h = harness();
    try {
      h.render();
      await h.resolve();
      h.render();
      h.blur();
      disable(h);
      h.render();
      h.focus();
      h.render();
      assert.equal(h.calls.length, 1);
    } finally { h.dispose(); }
  }
});
