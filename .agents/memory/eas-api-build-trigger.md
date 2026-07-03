---
name: EAS API Build Trigger
description: How to trigger EAS Android builds via GraphQL API when EAS CLI hangs; correct tarball structure and GCS upload pattern.
---

## Problem context
`npx eas-cli` and `git push` both hang indefinitely in the Replit sandbox. Builds must be triggered via the EAS GraphQL API directly.

## Working pattern (GCS upload → API trigger)

### 1. Get upload session
```graphql
mutation {
  uploadSession {
    createUploadSession(type: EAS_BUILD_GCS_PROJECT_SOURCES)
  }
}
```
Returns a JSONObject (no subfields) with `{ url, bucketKey, headers }`.

### 2. Upload tarball to GCS
```bash
curl -X PUT "$url" \
  -H "x-goog-content-length-range: 0,2147483648" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @/tmp/mobile-wrapped.tar.gz
```
Expect HTTP 200.

### 3. Trigger build via GraphQL
Mutation: `build { createAndroidBuild(appId, job, metadata, secrets) { build { id status } } }` — note the mutation also needs a top-level `secrets: {}` variable/arg alongside `metadata: {}` (see below), even though GraphQL marks both nullable.
- `job.type`: `"GENERIC"`
- `job.projectArchive.type`: `"GCS"`, `job.projectArchive.bucketKey`: from step 1
- `job.projectRootDirectory`: `"."`  ← IMPORTANT: must be dot, not "mobile"
- `job.buildType`: `"APP_BUNDLE"`
- `job.gradleCommand`: `":app:bundleRelease"`
- `job.secrets`: `{}` (required object, even empty — omitting it entirely causes a `"$": Required` Zod validation error server-side despite the GraphQL schema marking it optional)
- `metadata`: `{}` (same — required empty object, not omittable)
- Upload endpoint is `createUploadSession(type: EAS_BUILD_GCS_PROJECT_SOURCES)`, NOT `createAssetUploadURLAsync` (that mutation does not exist for this purpose).

## Known systemic failure mode (as of 2026-07-03): UNKNOWN_ERROR right after INSTALL_CUSTOM_TOOLS
Multiple API-triggered Android builds (5+, with varied job payloads: with/without `cache`, `updates.channel`, `developmentClient`) all ERRORED with a generic `UNKNOWN_ERROR` ("See logs for more information"), crashing immediately after the `INSTALL_CUSTOM_TOOLS` phase succeeds and *before* `PREPARE_PROJECT` even starts (no archive-download log lines appear at all).
- Ruled out payload correctness as the cause: even `retryAndroidBuild(buildId)` — which replays EAS's own server-stored job verbatim, not a manually-reconstructed payload — failed identically at the same phase boundary.
- `retryAndroidBuild` can only retry builds in `errored`/`canceled` state (not `finished`), and fails with `EAS_BUILD_NOT_RETRIABLE` if the build has expired (old builds can't be replayed after some retention window).
- Conclusion: this looks like a transient EAS build infrastructure issue (PREPARE_PROJECT / archive-fetch stage) unrelated to project/job configuration. If encountered again, don't waste time permuting job fields — check EAS status or retry later instead.

## CRITICAL: Tarball structure (--strip-components 1)
The EAS worker extracts with:
```bash
tar -C $EAS_BUILD_WORKINGDIR --strip-components 1 -zxf project.tar.gz
```
`--strip-components 1` strips the FIRST path component. If files are at tarball root (e.g., `package.json`, `android/...`), everything is lost:
- Single-component paths (`package.json`) → stripped to empty → skipped
- Two-component paths (`android/build.gradle`) → `android` stripped → `build.gradle` at root (wrong)

**Fix**: Wrap all files under a single top-level directory before creating the tarball:
```bash
mkdir -p /tmp/wrap/project
cp -rp /path/to/mobile/. /tmp/wrap/project/
tar -czf mobile-wrapped.tar.gz -C /tmp/wrap project/
```
Result: `project/package.json`, `project/android/build.gradle` → after strip → `package.json`, `android/build.gradle` ✓

## CRITICAL: Do NOT serve via Vite for type:URL
Vite adds `Content-Encoding: gzip` when serving `.tar.gz` files. curl auto-decompresses on download, so the EAS worker saves a plain `.tar` and `tar -zxf` fails with "not in gzip format". GCS upload avoids this entirely.

## type:GIT pitfall
Worker reads an internal field (not `gitRef`) for branch name, resulting in `git clone ... undefined`, always failing. Do not use `type: GIT` for API-triggered builds.

## Successful build evidence
Build `52e57b56-5df5-4d73-8012-b45eb8e8d9f0` → FINISHED
Artifact: `https://expo.dev/artifacts/eas/X5EGSq4FBE90LIbuejGkEeykBXmUrLk3S1KG9o8wUT8.aab`
