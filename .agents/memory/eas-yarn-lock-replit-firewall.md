---
name: EAS Yarn Lock Replit Firewall URLs + Android Prebuild Persistence
description: yarn.lock entries written inside Replit point to package-firewall.replit.local; EAS build workers can't resolve this hostname and fail at yarn install. Also covers why android/ edits must go through app.json + patch-gradle.js.
---

## Rule 1: yarn.lock Replit firewall URLs
Before every EAS build triggered from this Replit workspace, rewrite Replit-firewall URLs in the staged yarn.lock:

```bash
sed 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' \
  mobile/yarn.lock > /tmp/mobile-build/yarn.lock
```

**Why:** Replit routes all npm/yarn installs through an internal transparent proxy at `package-firewall.replit.local`. Any `yarn add` run inside Replit records that host as the `resolved` URL in yarn.lock. EAS cloud build workers have no route to that hostname → `getaddrinfo ENOTFOUND` → build fails at "Install dependencies". Only 14 entries were affected the first time but any subsequent `yarn add` in Replit adds more.

**How to apply:** Apply the `sed` in the `/tmp/mobile-build` staging step (after copying `yarn.lock` from `mobile/`, before running `eas build`). The package hashes remain valid — Replit's firewall is a transparent cache of the same tarballs on npmjs.org.

**Verification:** `grep -c "package-firewall.replit.local" /tmp/mobile-build/yarn.lock` must return 0 (grep exits 1 with 0 matches — that's correct).

## Rule 2: android/ edits NEVER survive EAS prebuild
EAS runs `expo prebuild` to regenerate the entire `android/` directory from scratch before building. Any direct edits to files under `mobile/android/` (build.gradle, AndroidManifest.xml, gradle.properties, etc.) are OVERWRITTEN on every EAS build.

**Why it matters:** A fix that edits `android/` directly will work locally but silently revert on EAS. This caused targetSdkVersion and AD_ID permission fixes to disappear between builds.

**Correct pattern for persistent android config:**
- Permissions → `app.json` `android.permissions` array (expo writes them to AndroidManifest.xml)
- SDK versions → `app.json` `android.targetSdkVersion` / `android.compileSdkVersion`
- Gradle file text patches → `mobile/scripts/patch-gradle.js` (runs as postinstall on EAS)
- `android/` edits are OK as a LOCAL reference copy but must be backed by app.json + patch-gradle.js

**Affected fixes that were done correctly:**
- `targetSdkVersion 35`: app.json + patch-gradle.js Fix 0-sdk + Fix 0-sdk-build
- `AD_ID permission`: app.json android.permissions (not just AndroidManifest.xml)
- `kotlinVersion 2.2.0`: patch-gradle.js Fix 0 (patches gradle.properties)
