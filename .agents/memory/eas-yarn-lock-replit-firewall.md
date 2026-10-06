---
name: EAS Prebuild Persistence
description: Native directory edits do not survive cloud prebuild.
---

## Native directory edits do not survive EAS prebuild
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
