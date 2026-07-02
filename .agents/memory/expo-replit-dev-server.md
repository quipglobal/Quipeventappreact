---
name: Expo Replit Dev Server Setup
description: How to configure the Expo Metro workflow in Replit for emulator and QR code testing
---

## Rule
The "Start Mobile" workflow must use:
```
cd mobile && REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN npx expo start --go --port 8080
```

## Why
- `--web` causes Metro to get stuck at 98.8% web bundling indefinitely (1271/1279 modules, never resolves)
- Without `REACT_NATIVE_PACKAGER_HOSTNAME`, Metro advertises `http://172.24.0.2:8080` (internal container IP unreachable from outside)
- Without `--go`, Metro serves a `expo-development-client://` deep-link URL; Replit's Android/iOS emulator buttons use Expo Go internally and respond with "could not determine Expo version" when it gets a dev-client URL
- With `--go`, Metro uses Expo Go mode → correct `exp://` URL → Replit emulator connects; web bundle also compiles in ~1.6s

## How to apply
Any time the "Start Mobile" workflow command needs to be recreated or updated, use the exact command above. Never add `--web`. Always include `REACT_NATIVE_PACKAGER_HOSTNAME=$REPLIT_DEV_DOMAIN`.

## Package version note (SDK 52)
expo-dev-client, expo-updates, and react-native-webview were found at SDK 56-era versions alongside SDK 52. Fix with:
```
cd mobile && npx expo install expo-dev-client expo-updates react-native-webview
```
Correct SDK 52 versions: expo-dev-client ~5.0.20, expo-updates ~0.27.5, react-native-webview 13.12.5

## Replit Simulator SDK Limitation
Replit's built-in iOS/Android simulator ("Simulate on iOS/Android" button and `artifact:v3:default-expo` canvas shape) only ships Expo Go binaries for specific SDK versions. **Expo SDK 52 is NOT available** — clicking simulate shows "Expo Go 52 not available." This is a Replit infrastructure constraint; no code change can fix it.

**Working alternatives for SDK 52 testing:**
1. Metro web preview (port 8080) — shows full app UI; add a canvas iframe at `https://REPLIT_DEV_DOMAIN:8080` in 450×910 mobile dimensions
2. Physical device via Expo Go: scan `exp://REPLIT_DEV_DOMAIN:8080` QR code shown in "Start Mobile" console
3. EAS development build + internal distribution for full native parity

**Cannot delete** `artifact:v3:default-expo` canvas shape — artifact frames are Replit-managed and immutable.
