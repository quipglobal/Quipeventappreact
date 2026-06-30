---
name: EAS Android Compose Consistent Resolution Fix
description: Root cause and fix for EAS_BUILD_UNKNOWN_GRADLE_ERROR caused by Gradle consistent resolution conflict with androidx.compose in release builds.
---

## The Bug

`expo-dev-launcher` declares:
- `releaseCompileOnly "foundation-android:1.9.0"` (compile only, NOT runtime)
- `debugOnly "foundation-android:1.9.0"` — its `debugOnly` closure only adds `releaseImplementation` when `configureInRelease=true` (normally false), so this is debug-only

For **release builds**: the runtime classpath gets Compose transitively from `react-android` at ~1.7.x. Gradle's "consistent resolution" creates `{strictly 1.7.x}` for the release compile classpath, which conflicts with `releaseCompileOnly "foundation-android:1.9.0"` → `EAS_BUILD_UNKNOWN_GRADLE_ERROR`.

For **debug builds**: `debugOnly` adds to the debug runtime, so consistent resolution locks to `{strictly 1.9.0}` → no conflict.

`expo-dev-menu` was unaffected because its `debugOnly` closure unconditionally adds `releaseImplementation notation`, so its release runtime already had 1.9.0.

## The Fix (both applied for belt-and-suspenders)

1. **`android/build.gradle`** — `eachDependency` inside `allprojects { configurations.all { resolutionStrategy { ... } } }` forces all `androidx.compose.*` groups to `1.9.0`. Ensures runtime uses 1.9.0 before consistent resolution derives its `{strictly}` constraint.

2. **`scripts/patch-gradle.js` Fix 4c** — adds `releaseRuntimeOnly "foundation-android:$composeVersion"` to expo-dev-launcher's `build.gradle` alongside the existing `releaseCompileOnly`. Most direct fix: explicit runtime dep prevents the low-version lock.

**Why:** Consistent resolution is a Gradle 7+ feature that locks compile classpath versions to match runtime. The fix ensures the runtime uses 1.9.0, satisfying the derived constraint.

**How to apply:** Changes are in committed files. No manual steps needed — `patch-gradle.js` runs automatically via `postinstall` and `eas-build-post-install` hooks.
