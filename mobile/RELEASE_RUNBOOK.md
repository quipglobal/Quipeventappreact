# CXO Events — Production Release Runbook

## EAS Project
- **Project ID**: `83d2b604-c6aa-45fe-a707-16f09d2c578c`
- **EAS Project**: `quipdevs-organization / cxoinc`
- **Bundle ID (iOS + Android)**: `com.apexevents.meet`
- **Play Store**: https://play.google.com/store/apps/details?id=com.apexevents.meet

---

## Status of EAS Credentials (all configured ✓)

### Secrets (set on EAS project)

| Secret | Status |
|---|---|
| `EAS_APPLE_ID` | ✓ Set |
| `EAS_APPLE_TEAM_ID` | ✓ Set |
| `EAS_APPLE_ASC_APP_ID` | ✓ Set |
| `EXPO_PUBLIC_API_BASE_URL` | ✓ Set (`https://api.cxoinc.com`) |
| `EXPO_PUBLIC_TENANT_ID` | ✓ Set (`3`) |

### Android Keystore (uploaded & linked ✓)

| Field | Value |
|---|---|
| EAS Keystore ID | `c6ff387d-069c-44d5-a0fe-f5055dc690dc` |
| EAS Build Creds ID | `59efbe8a-c0ce-4b69-914e-e438bceae42a` |
| Application ID | `com.apexevents.meet` |
| Key Alias | `key0` |
| Format | PKCS12 |
| SHA-1 Fingerprint | `29724529d89c33d285c6f045d298416236d02922` |
| MD5 Fingerprint | `1ed5b9bd6bb243661680b1dceca61313` |
| Is Default | ✓ Yes |

> Verify the SHA-1 fingerprint matches the one registered in Google Play Console
> under Setup → App integrity → App signing.

### iOS Credentials (uploaded & linked ✓)

| Field | Value |
|---|---|
| EAS iOS App Creds ID | `ed312c43-0775-44ed-982e-1edc48dddf72` |
| Apple App Identifier ID | `c841437b-28b3-4caf-998d-0e29a1eb5c88` |
| Bundle ID | `com.apexevents.meet` |
| ASC API Key EAS ID | `0dc89fb6-edcd-4b53-9446-e3eefc066f48` |
| ASC Key ID | `672Y52LSAY` |
| ASC Issuer ID | `69a6de87-987f-47e3-e053-5b8c7c11a4d1` |
| Linked for Builds | ✓ Yes |
| Linked for Submissions | ✓ Yes |

> EAS will use this ASC API key to auto-manage the distribution certificate and
> provisioning profile during the build. No manual cert/profile management needed.

---

## Prerequisites (one-time local setup)

```bash
npm install -g eas-cli
eas login   # log in with rukmin.trivedi@gmail.com (quipdevs-organization account)
```

---

## Building for Production

```bash
cd /path/to/project/mobile

# Build both platforms (queued in EAS cloud — takes ~15-30 min)
eas build --profile production --platform all

# Monitor builds
eas build:list --status=in-progress
```

You can also monitor at: https://expo.dev/accounts/quipdevs-organization/projects/cxoinc/builds

---

## Submitting to Stores

After both builds complete:

```bash
# Submit iOS to App Store Connect
eas submit --profile production --platform ios --latest

# Submit Android to Google Play production track
eas submit --profile production --platform android --latest
```

> For Android: Place the Google Play service account JSON at
> `mobile/google-play-service-account.json` before running submit.
> Download from: Google Play Console → Setup → API access → Service accounts

---

## OTA Updates (after initial build is live)

Once the production binary is installed on user devices, you can push
JavaScript-only updates without going through store review:

```bash
cd /path/to/project/mobile

# Push OTA update to all production users
eas update --channel production --message "Fix: sponsor tabs now show correctly"
```

OTA updates land on user devices within minutes of next app open.
They do NOT require store review as long as you haven't changed native code.

**What can be OTA updated:**
- All JavaScript / TypeScript business logic
- Screen layouts and UI
- API URLs and feature flags

**What requires a full store build:**
- Native modules (new Expo plugins)
- `app.json` changes (permissions, bundle ID, version)
- New camera/notification/location features

---

## Version Bumping Strategy

Before each new store submission, bump versions in `app.json`:

| Field | Current | Rule |
|---|---|---|
| `version` | `1.0.0` | Increment for every store submission |
| `ios.buildNumber` | `"1"` | Must always increase (auto-increments with `autoIncrement: true`) |
| `android.versionCode` | `1` | Must always increase (auto-increments with `autoIncrement: true`) |

`autoIncrement: true` in `eas.json` handles iOS buildNumber and Android versionCode automatically.

---

## Checklist for Every Release

- [ ] Code changes tested on device / Expo Go
- [ ] `version` in `app.json` bumped if new features
- [ ] `eas build --profile production --platform all` triggered
- [ ] Both builds succeeded in EAS dashboard
- [ ] `eas submit` run for both platforms
- [ ] App Store Connect shows new version "Waiting for Review"
- [ ] Google Play Console shows new version in Production track
