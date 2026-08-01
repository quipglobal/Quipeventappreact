// @ts-check
import { createRequire } from 'node:module';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

const require = createRequire(import.meta.url);
const noRawTimersRule = require('./eslint-rules/no-raw-timers.cjs');

/** @type {import('eslint').Linter.Config[]} */
export default [
  // ── Global ignores ───────────────────────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'mobile/**',
      'tests/**',
      // The hook implementations are the *safe* call-sites — they contain
      // the raw timers by design and are already tested to sign-out-guard
      // every caller.
      'src/app/hooks/useAuthedInterval.ts',
      'src/app/hooks/useAuthedEffect.ts',
    ],
  },

  // ── no-raw-timers: components + context only ─────────────────────────────
  //
  // Flags any bare setInterval / setTimeout (including window.* / globalThis.*)
  // inside the component and context layers. These layers must use:
  //   • useAuthedInterval  — for regular polling (fires only while signed in)
  //   • useAuthedEffect    — for custom timer logic (setTimeout chains, backoff)
  //
  // Suppress a legitimate UI-only timer (animation, toast dismiss, focus
  // delay) with an inline disable comment that explains *why* no auth gate
  // is needed:
  //
  //   // eslint-disable-next-line local/no-raw-timers -- UI animation, no auth
  //   setTimeout(() => setShowAnim(false), 400);
  //
  {
    files: [
      'src/app/components/**/*.{ts,tsx}',
      'src/app/context/**/*.{ts,tsx}',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    linterOptions: {
      // Disable the "unused disable directive" report so that existing
      // // eslint-disable-next-line comments for rules whose violations happen
      // to be absent in a given file don't fail CI.
      reportUnusedDisableDirectives: 'off',
    },
    plugins: {
      // Register @typescript-eslint and react-hooks so that existing
      // // eslint-disable-next-line comments referencing these plugins are
      // recognised by ESLint 9 and don't produce "rule not found" errors.
      // No rules from these plugins are enabled here — this config is
      // intentionally scoped to the no-raw-timers check only.
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
      local: {
        rules: {
          'no-raw-timers': noRawTimersRule,
        },
      },
    },
    rules: {
      // ── The rule this config introduces ───────────────────────────────────
      'local/no-raw-timers': 'error',
    },
  },
];
