# Dependency security maintenance

Both apps use npm. Commit each app's `package.json` and `package-lock.json`
together. Do not add a mobile `yarn.lock`: EAS prefers it over the npm lockfile,
which previously let cloud builds install a different dependency tree.
Mobile npm omits registry-specific `resolved` URLs while retaining exact
versions and integrity hashes. This prevents local-only firewall hostnames
from breaking EAS installs; each environment still uses its configured
registry (including Replit's package firewall locally).

## Patched dependencies

The following minimum versions address the requested vulnerability set:

| Package | Minimum patched version |
| --- | --- |
| @xmldom/xmldom | 0.9.12 |
| ajv (8.x branch) | 8.18.0 |
| baseline-browser-mapping | 2.11.0 |
| brace-expansion (5.x branch) | 5.0.9 (mobile uses 5.0.12) |
| browserslist | 4.28.7 |
| decode-uri-component | 0.5.0 |
| fast-uri | 3.1.6 |
| image-size | 2.0.3 |
| js-yaml | 3.15.2 / 4.3.2 |
| nanoid (3.x branch) | 3.3.18 |
| postcss | 8.5.23 |
| qs | 6.16.0 |
| sharp | 0.35.4 |
| tar | 7.5.21 |
| uuid | 11.1.1 |

Overrides keep Expo SDK 52 / React Native 0.76 stable instead of forcing a
native SDK migration. YAML overrides preserve each consumer's major version.
The compatibility patch script fails explicitly if a dependency's source has
changed unexpectedly:

- Metro uses the named `imageSize` export and reads paths into byte buffers.
- query-string uses decode-uri-component's ESM default export.
- Expo CLI wraps tar's named exports instead of assuming a default export.

These patches run in both `postinstall` and `eas-build-post-install`, because
the EAS profiles disable npm lifecycle scripts. Mobile requires Node 20.19+
for synchronous ESM loading, and the EAS profiles specify Node 20.20.0.

## Checks

```sh
npm run test:dependencies
npm run build
cd mobile
npx expo export --platform all --output-dir /tmp/mobile-security-export
```

The tests cover every nested lockfile entry, patch idempotency, Metro buffer
and path-based image handling, URL decoding, Xcode UUIDs, and Expo's JS archive
extraction fallback. Bundle exports do not replace signed native EAS builds.
Four targeted browser tests (sign-out polling and poll freshness) also passed.

The mobile welcome-screen preview still crashes because `handleVerifyOtp` is
referenced before its initialization in `components/auth/WelcomeScreen.tsx`.
The same ordering is present in the baseline code, and this dependency-only
change leaves it untouched. The mobile sign-in UI therefore was not visually
verified. Initial full browser validation exposed stale scanner selectors and
an attendee giveaway fixture using the old endpoint. With approval, those
tests were updated to the current controls and API without changing production
UI or the notes, priority, synchronization, and points assertions.

The dependency audit on 2026-10-06 found none of the 56 requested findings
after remediation. It still reported 17 other findings: 1 critical, 11 high,
4 moderate, and 1 low. Those affect proxy-addr, braces, compression,
node-forge, shell-quote, sprintf-js, undici, older root brace-expansion
instances, and source-map-js; they are outside the requested advisory list.
