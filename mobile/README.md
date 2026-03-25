# CXO Events — Mobile App

React Native (Expo SDK 52) companion app for CXO Inc. events.

## Prerequisites

- Node.js 20+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Active [Expo](https://expo.dev) account

## Setup

```bash
cd mobile
npm install --legacy-peer-deps
cp .env.example .env
# Set EXPO_PUBLIC_API_BASE_URL in .env to your backend URL
```

## Running Locally

```bash
# Start Metro (Expo Go — scan QR from the Expo Go app)
npx expo start

# Web preview (browser)
npx expo start --web --port 8080
```

## EAS Build Setup (one-time per Expo account)

Before building, register the project with EAS and update `app.json`:

```bash
eas login                    # Log in with your Expo account
eas build:configure          # Creates/updates the projectId in app.json
```

This will set the real `extra.eas.projectId` in `app.json`. The current placeholder `cxo-events-placeholder` **must** be replaced before builds will succeed.

## Building with EAS

### Development Build (Expo Dev Client)

```bash
# iOS (internal TestFlight-style)
eas build --profile development --platform ios

# Android APK (internal testing)
eas build --profile development --platform android
```

### Preview Build (real devices, live API)

```bash
eas build --profile preview --platform all
```

### Production Build (App Store / Google Play)

```bash
# Build both platforms
eas build --profile production --platform all

# iOS only → produces a signed .ipa
eas build --profile production --platform ios

# Android only → produces a signed .aab
eas build --profile production --platform android
```

### Submit to Stores

After a production build completes:

```bash
# Submit iOS to App Store Connect
eas submit --profile production --platform ios

# Submit Android to Google Play
eas submit --profile production --platform android
```

> Update `eas.json` `submit.production` with your Apple Team ID, ASC App ID, and Google Play service account key path before submitting.

## Deep Linking

The app handles the following deep link schemes:

| URL | Action |
|-----|--------|
| `cxoevents://join?code=EVENT123` | Opens switch-event screen with code pre-filled |
| `cxoevents://switch-event?code=EVENT123` | Same — direct route |
| `https://cxoinc.com/join?code=EVENT123` | Universal link (iOS) / App Link (Android) — opens switch-event |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `EXPO_PUBLIC_API_BASE_URL` | `''` | Backend API base URL (e.g. `https://api.cxoinc.com`) |
| `EXPO_PUBLIC_USE_MOCK_API` | `'false'` | Set to `'true'` to use local mock data |

## Tech Stack

- **Navigation**: Expo Router v4 (file-based)
- **State / Data**: TanStack Query v5
- **Auth**: Phone OTP via backend API, token stored in AsyncStorage
- **Camera**: expo-camera (QR scanning for sponsor lead capture)
- **Fonts**: Google Fonts / Inter via expo-font
- **Icons**: @expo/vector-icons (Ionicons)

## Project Structure

```
mobile/
  app/
    _layout.tsx           Root layout — providers, fonts, splash
    index.tsx             Auth gate
    join.tsx              Deep link redirect → switch-event
    switch-event.tsx      Join event by code
    profile.tsx           Profile modal
    meetings.tsx          Meeting requests
    qr-badge.tsx          Attendee QR badge
    event-dashboard.tsx   Event overview
    (auth)/welcome.tsx    Phone OTP login
    (tabs)/               Role-aware bottom tabs
  components/             Shared UI components
  constants/theme.ts      Colors, spacing, typography
  hooks/                  TanStack Query hooks (API integration)
  lib/apiClient.ts        Fetch wrapper with mock layer
  assets/                 Icon (1024×1024), adaptive-icon, splash
  app.json                Expo config (bundle ID, permissions, deep links)
  eas.json                EAS Build profiles
  STORE_METADATA.md       App Store + Google Play metadata draft
```

## App Store Info

- **iOS Bundle ID**: `com.cxoinc.events`
- **Android Package**: `com.cxoinc.events`
- **Version**: 1.0.0 (build 1)
- **Supported OS**: iOS 13+ / Android 8+
