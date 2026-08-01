/**
 * ESLint rule: no-raw-timers
 *
 * Flags bare `setInterval` / `setTimeout` calls (including the
 * `window.*` / `globalThis.*` variants) inside
 *   src/app/components/**
 *   src/app/context/**
 *
 * These directories must use `useAuthedInterval` or `useAuthedEffect`
 * so that periodic / deferred work is automatically torn down on
 * sign-out and never fires unauthenticated requests.
 *
 * Suppress a legitimate UI-only use (animation, focus delay, toast
 * dismiss, etc.) with an inline disable comment that explains *why*
 * no auth gate is needed:
 *
 *   // eslint-disable-next-line local/no-raw-timers -- UI animation, no auth
 *   setTimeout(() => setShowAnim(false), 400);
 *
 * See: src/app/hooks/useAuthedInterval.ts
 *      src/app/hooks/useAuthedEffect.ts
 */

'use strict';

/** Bare names that are always timer functions */
const TIMER_NAMES = new Set(['setTimeout', 'setInterval']);

/** Member-expression hosts whose `.setTimeout` / `.setInterval` we also flag */
const TIMER_HOSTS = new Set(['window', 'globalThis', 'self']);

/**
 * Return true when the CallExpression callee resolves to one of the
 * timer globals we want to flag.
 */
function isTimerCall(node) {
  const { callee } = node;

  // setTimeout(…) / setInterval(…)
  if (callee.type === 'Identifier' && TIMER_NAMES.has(callee.name)) {
    return true;
  }

  // window.setTimeout(…) / globalThis.setInterval(…) / self.setTimeout(…)
  if (
    callee.type === 'MemberExpression' &&
    !callee.computed &&
    callee.object.type === 'Identifier' &&
    TIMER_HOSTS.has(callee.object.name) &&
    callee.property.type === 'Identifier' &&
    TIMER_NAMES.has(callee.property.name)
  ) {
    return true;
  }

  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow raw setInterval/setTimeout in components and context; use useAuthedInterval or useAuthedEffect instead.',
      url: 'src/app/hooks/useAuthedInterval.ts',
    },
    messages: {
      noRawTimers:
        'Raw {{name}}() is not allowed here. ' +
        'Use useAuthedInterval (for regular polling) or useAuthedEffect ' +
        '(for custom timer logic) so the timer is automatically torn down ' +
        'on sign-out. ' +
        'If this is a UI-only delay with no auth dependency, suppress with ' +
        '// eslint-disable-next-line local/no-raw-timers -- <reason>',
    },
    schema: [],
  },

  create(context) {
    return {
      CallExpression(node) {
        if (!isTimerCall(node)) return;

        // Determine the display name for the message (e.g. "setTimeout"
        // or "window.setInterval").
        const { callee } = node;
        const name =
          callee.type === 'Identifier'
            ? callee.name
            : `${callee.object.name}.${callee.property.name}`;

        context.report({
          node,
          messageId: 'noRawTimers',
          data: { name },
        });
      },
    };
  },
};
