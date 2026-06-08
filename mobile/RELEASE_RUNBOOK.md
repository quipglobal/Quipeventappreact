# CXO Events — Production Release Runbook

## EAS Project
- **Project ID**: `83d2b604-c6aa-45fe-a707-16f09d2c578c`
- **EAS Project**: `quipdevs-organization / cxoinc`
- **Bundle ID (iOS + Android)**: `com.apexevents.meet`
- **Play Store**: https://play.google.com/store/apps/details?id=com.apexevents.meet

---

## Status of EAS Secrets (all set ✓)

The following secrets are already configured in the EAS dashboard:

| Secret | Status |
|---|---|
| `EAS_APPLE_ID` | ✓ Set |
| `EAS_APPLE_TEAM_ID` | ✓ Set |
| `EAS_APPLE_ASC_APP_ID` | ✓ Set |
| `EXPO_PUBLIC_API_BASE_URL` | ✓ Set (`https://api.cxoinc.com`) |
| `EXPO_PUBLIC_TENANT_ID` | ✓ Set (`3`) |

---

## One-Time Setup (run once from your local machine)

### Prerequisites
```bash
npm install -g eas-cli
eas login   # log in with rukmin.trivedi@gmail.com
```

### Step 1 — Upload Android Keystore

> ⚠️ This is the most critical step. The keystore must match the one used for the
> original com.apexevents.meet build on Google Play. Using a different keystore
> will cause the submission to be rejected.

```bash
cd /path/to/project/mobile
eas credentials --platform android
```

When prompted:
- Select profile: **production**
- Choose: **Upload a keystore**
- Keystore path: `/path/to/your/original.jks`  (or .keystore)
- Keystore password: `serpentcs`
- Key alias: `ciosynergy`
- Key password: `serpentcs`

### Step 2 — Set Up iOS Credentials

EAS can auto-manage iOS certs using an App Store Connect API Key.

1. Go to App Store Connect → Users & Access → Integrations → App Store Connect API
2. Click `+` → Name: `EAS Build` → Role: `App Manager`
3. Download the `.p8` file

Then register it:
```bash
eas credentials --platform ios
# Choose: Add an App Store Connect API Key
# Upload the .p8 file when prompted
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
