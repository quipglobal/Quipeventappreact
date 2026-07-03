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

## CRITICAL: always set `builderEnvironment.image` explicitly (root cause of UNKNOWN_ERROR crashes)
If `builderEnvironment.image` is omitted, the API defaults GENERIC android jobs to the ancient `ubuntu-22.04-jdk-11-ndk-r21e` image, whose worker crashes silently with a generic `UNKNOWN_ERROR` immediately after `INSTALL_CUSTOM_TOOLS` succeeds and before `PREPARE_PROJECT` starts (zero error lines in the worker log — log just ends).
- **Fix**: set `job.builderEnvironment.image: "ubuntu-22.04-jdk-17-ndk-r26b"` (the image CLI-triggered builds use). Also set `mode: "BUILD"`, `experimental: {}`, `environment: "PRODUCTION"` to match the CLI job shape.
- **Debugging technique that found this**: the worker dumps the FULL resolved job JSON at `SPIN_UP_BUILDER` phase in the log file. Diff the job dump of a known-good (CLI-triggered) build against the failing build's dump — that's how the image mismatch was spotted. Log files are brotli-compressed `.txt` from `logFiles` on the build object (re-query GraphQL for fresh signed URLs, they expire in 900s).
- `retryAndroidBuild(buildId)` replays the stored job verbatim (including the bad defaulted image), so retries fail identically — a retry failing does NOT prove infrastructure outage. It only retries `errored`/`canceled` builds and fails `EAS_BUILD_NOT_RETRIABLE` on `finished` or expired builds.
- Successful build with this fix: `47fb2766-31c5-4e06-a38d-ac1b0d592736` (versionCode 25, v2.6) → `https://expo.dev/artifacts/eas/xakPb8P1M-NK8fSES_yIECjTjMFlVk5w24TY8ElT-LM.aab`

## CRITICAL: Tarball structure (--strip-components 1)
The EAS worker extracts with:
```bash
tar -C $EAS_BUILD_WORKINGDIR --strip-components 1 -zxf project.tar.gz
```
`--strip-components 1` strips the FIRST path component. If files are at tarball root (e.g., `package.json`, `android/...`), everything is lost:
- Single-component paths (`package.json`) → stripped to empty → skipped
- Two-component paths (`android/build.gradle`) → `android` stripped → `build.gradle` at root (wrong)

**ALSO REQUIRED when staging**: sanitize Replit firewall URLs in BOTH lockfiles before tarring, or the build fails at INSTALL_DEPENDENCIES with `getaddrinfo ENOTFOUND package-firewall.replit.local` (see eas-yarn-lock-replit-firewall.md):
```bash
sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g; s|https://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' \
  /tmp/wrap/project/yarn.lock /tmp/wrap/project/package-lock.json
```
EAS runs `yarn install` (yarn.lock takes precedence), but sanitize package-lock.json too.

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
