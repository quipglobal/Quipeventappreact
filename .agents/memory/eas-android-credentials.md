---
name: EAS Android Credentials Setup
description: Android keystore details for com.apexevents.meet production builds in EAS
---

## Rule
Android keystore for `com.apexevents.meet` is a PKCS12 file (not JKS despite .jks extension).
Alias is `key0`, keystore password `event123`, key password `serpentcs`.

**Key IDs (as of June 2026):**
- EAS Keystore ID: `c6ff387d-069c-44d5-a0fe-f5055dc690dc`
- EAS Build Creds ID: `59efbe8a-c0ce-4b69-914e-e438bceae42a`
- SHA-1: `29724529d89c33d285c6f045d298416236d02922`

**Why:** The keystore must match the Google Play signing key exactly. The format is PKCS12 not JKS.

**How to apply:** Verify SHA-1 matches Google Play Console → Setup → App integrity → App signing before submitting.
