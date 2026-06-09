---
name: EAS iOS Credentials Setup
description: How iOS credentials are configured for com.apexevents.meet in EAS (IDs and approach)
---

## Rule
iOS credentials for `com.apexevents.meet` are fully managed via the EAS GraphQL API.
EAS auto-manages the distribution cert and provisioning profile using the ASC API key — no manual cert/profile upload needed.

**Key IDs (as of June 2026):**
- EAS iOS App Creds: `ed312c43-0775-44ed-982e-1edc48dddf72`
- Apple App Identifier (EAS entity): `c841437b-28b3-4caf-998d-0e29a1eb5c88`
- ASC API Key (EAS entity): `0dc89fb6-edcd-4b53-9446-e3eefc066f48`
- ASC Key Identifier: `672Y52LSAY`
- ASC Issuer ID: `69a6de87-987f-47e3-e053-5b8c7c11a4d1`

**Why:** EAS uses the ASC API key to auto-request/renew certs and profiles on Apple's side.
The same key is linked for both builds AND submissions.

**How to apply:** If credentials need re-linking, use `IosAppCredentialsMutation.setAppStoreConnectApiKeyForSubmissions` and `updateIosAppCredentials` with `appStoreConnectApiKeyForBuildsId`.
