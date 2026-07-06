---
name: EAS Android Credentials Setup
description: Android keystore details for com.apexevents.meet production builds in EAS
---

## Rule
Android keystore for `com.apexevents.meet` is a PKCS12 file (not JKS despite .jks extension).
Alias is `key0`; key password is EMPTY (use the keystore/store password as fallback).
The keystore/store password is NOT stored here — never commit credentials to memory. Ask the user for it, or read it from a secret, at build time.
Keystore file lives in the repo at `attached_assets/ciosynergykeystore_*.jks` (CN=CXO Inc Events, O=Apex Events). Verify with `openssl pkcs12 -in <file> -passin pass:<STORE_PASSWORD> -nokeys -clcerts | openssl x509 -noout -fingerprint -sha1` (no keytool/Java in sandbox) — SHA-1 must equal the value below.

**Key IDs (as of June 2026):**
- EAS Keystore ID: `c6ff387d-069c-44d5-a0fe-f5055dc690dc`
- EAS Build Creds ID: `59efbe8a-c0ce-4b69-914e-e438bceae42a`
- SHA-1: `29724529d89c33d285c6f045d298416236d02922`

**Why:** The keystore must match the Google Play signing key exactly. The format is PKCS12 not JKS.

**How to apply:** Verify SHA-1 matches Google Play Console → Setup → App integrity → App signing before submitting.

## Signing approach (CONFIRMED WORKING — build 913e3cfe, July 2026)

**DO NOT use `secrets.buildCredentials`** — EAS injects into `build.gradle` and its rewriting
breaks complex Groovy expressions (causes "Value is null" at signingConfigs evaluation time).

**INSTEAD:** pass keystore via `builderEnvironment.env` (GENERIC build type, GraphQL trigger):
- `KEYSTORE_B64` — base64-encoded .keystore file contents
- `KEYSTORE_PASSWORD` — keystore/store password
- `KEY_ALIAS` — key alias (key0)
- `KEY_PASSWORD` — key password (pass keystorePassword since keyPassword is empty)

**patch-gradle.js** (runs in both `postinstall` and `eas-build-post-install`) decodes
`KEYSTORE_B64` → `android/app/release.keystore` and writes `android/keystore.properties`.

**build.gradle** loads `keystore.properties` at PROJECT SCOPE (before `android {}` block)
into `def keystoreProps`, then references it in `signingConfigs.release` via
`rootProject.file(keystoreProps['storeFile'])`. This avoids Groovy delegate-scope ambiguity
(`projectDir` is null inside SigningConfig closure delegate).
