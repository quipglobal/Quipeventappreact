---
name: EAS Build Kotlin/Swift Fixes
description: Hard-won fixes for Expo SDK 52 / RN 0.76 / Kotlin 2.2.0 / Swift EAS dev build errors; use createShim for complex multi-step patches.
---

## Core principle
Use `createShim()` (full file replacement) instead of chained `patch()` calls whenever:
- The patch `replace` text already exists in the **original** npm file (triggers false "already patched" skip on EAS).
- Multiple sequential patches risk leaving duplicates or partial states.

Affected files in this project (all under `mobile/scripts/patch-gradle.js`):
- `expo-dev-launcher NonFinalBridgeDevSupportManager.kt` → createShim
- `expo-dev-launcher NonFinalBridgelessDevSupportManager.kt` → createShim

## patch() function gotcha: deletion + "already patched"
When `replace === ''` the "already patched" check (`content.includes(replace)`) is always TRUE,
so the guard is intentionally skipped. Deletion patches must rely solely on `find` matching.
If the annotation/text to delete is a substring of something always in the file (e.g. a class name),
use createShim instead.

## patch() ordering vs. POST_INSTALL_HOOK double-run
EAS iOS builds run `postinstall` (full patch-gradle.js) in INSTALL_DEPENDENCIES, then `eas-build-post-install`
(same script) again in POST_INSTALL_HOOK. By POST_INSTALL_HOOK, all patches from INSTALL_DEPENDENCIES have
already been applied — so those patches show "WARNING (not found)" on the second pass. This is expected and
harmless. Verify patches by checking the INSTALL_DEPENDENCIES phase log, not POST_INSTALL_HOOK.

## Kotlin 2.2.0 K2 compiler: `@Suppress("ACCIDENTAL_OVERRIDE")` does NOT work
"Inherited platform declarations clash: same JVM signature" is a **hard error** in K2, not a suppressible warning.
The only real fix: add an explicit override method in the subclass:
```kotlin
override fun getJSBundleURLForRemoteDebugging(): String? = super.getJSBundleURLForRemoteDebugging()
```
This resolves ambiguity between a Kotlin property getter and the matching Java interface method.

## Kotlin: secondary constructors + superclass with no primary constructor
When a Kotlin class has no primary constructor and extends another class:
- Class header: `: SuperClass` (NO parentheses)
- Each secondary constructor: `: super()` delegation required
```kotlin
internal class Foo : Bar {           // no () after Bar
  constructor(x: Int) : super() {   // : super() required
    ...
  }
}
```
Pattern seen in `PersistentFileLogHandler.kt`.

## PersistentFileLog / PersistentFileLogHandler / LogHandlers (expo-modules-core)
expo-updates 0.29.x calls `LogHandlers.createPersistentFileLogHandler(filesDirectory: File, category)`.
expo-modules-core 2.2.3 API only has `createPersistentFileLogHandler(context: Context, category)`.
Fix: add a `File` overload to both `LogHandlers` and `PersistentFileLogHandler`, and add `File` import.

## DevSupportManagerFactory (expo-dev-launcher 56.0.20)
`DevLauncherDevSupportManagerFactory` has an 11-param `create()` that must do real work (not throw).
In RN 0.76 only the 11-param variant is called; the 12-param variant is gone.

## LegacyArchitecture annotations (expo-dev-launcher 56.0.20, Bridge variant)
`com.facebook.react.common.annotations.internal.*` (LegacyArchitecture, LegacyArchitectureLogLevel,
LegacyArchitectureLogger.assertLegacyArchitecture) do not exist in RN 0.76.
Import paths in original: `LegacyArchitectureLogger.assertLegacyArchitecture` (NOT `.internal.assertLegacyArchitecture`).
Class annotation: `@LegacyArchitecture` on its own line before `open class`.
Companion object with `assertLegacyArchitecture(...)` must also be removed.

## iOS non-interactive builds (no registered devices)
`distribution: "internal"` for iOS requires registered device UDIDs + Ad Hoc provisioning profile.
In non-interactive mode with no registered devices, use the `development-simulator` profile:
```json
"development-simulator": { "extends": "development", "ios": { "simulator": true } }
```
This produces a `.app` for iOS Simulator (no code signing needed).
Apple team: CXO Inc (KEU7M39L8C).

## iOS Swift: @available(iOS 26.0, *) does NOT protect compile-time type references
Swift's `@available(iOS 26.0, *)` attribute prevents runtime access, but the compiler still resolves
ALL types in the function's signature and body against the current SDK at compile time. If a type
(e.g. `TabViewBottomAccessoryPlacement`) only exists in iOS 26 SDK, building with iOS 18.2 SDK will
fail even if every usage is inside `@available(iOS 26.0, *)` guards. Same applies to
`@Environment(\.tabViewBottomAccessoryPlacement)` key paths.
Fix: remove or stub the functions/structs that reference the absent type. Use `#if compiler` or
`createShim`-style full-file replacement — `@available` alone is not enough.

Affected files in react-native-bottom-tabs@1.3.0:
- `ios/BottomAccessoryProvider.swift`: remove `emitPlacementChanged(_ placement: TabViewBottomAccessoryPlacement?)` method
- `ios/TabView/NewTabView.swift`: remove `BottomAccessoryRepresentableView` struct (uses `@Environment(\.tabViewBottomAccessoryPlacement)`)
- `ios/TabView/NewTabView.swift`: stub `renderBottomAccessoryView()` → `EmptyView()`
- `ios/TabView/NewTabView.swift`: stub `ConditionalBottomAccessoryModifier.body` → `content` (removes `.tabViewBottomAccessory{}` iOS 26 modifier call)

## iOS Swift: singular Constant(name, body) DSL missing from expo-modules-core@2.2.3
expo-av@16.x uses `Constant("name") { value }` in `VideoViewModule.swift`, but expo-modules-core@2.2.3
only ships `Constants(_ body: () -> [String: Any?])` (plural, dict). Fix: add a `Constant<T>` overload
to `expo-modules-core/ios/Api/Factories/ObjectFactories.swift`:
```swift
public func Constant<T>(_ name: String, @_implicitSelfCapture body: @escaping () -> T) -> AnyDefinition {
  return ConstantsDefinition(body: { [name: body()] })
}
```

## expo-updates (expo-updates 0.29.x in SDK 52)
- `UpdatesPackage`: `onDidCreateReactHost` and `getDelayLoadAppHandler` must NOT use `override` (no matching base in RN 0.76).
- `ReloadScreenConfiguration.kt`: had 3 `@OptimizedRecord` annotations — each `patch()` call with `find='@OptimizedRecord\n'` removes one occurrence. Needed 3 separate calls.
- `OptimizedRecord` type does not exist in expo-modules-core 2.2.3.

## expo-updates + expo-dev-launcher Gradle plugin KGP version mismatch
Both `expo-updates-gradle-plugin` and `expo-dev-launcher-gradle-plugin` pin `kotlin("jvm") version "1.9.25"` in their own `build.gradle.kts`. `@react-native/gradle-plugin` is compiled by KGP 2.2.0 (metadata 2.2.0). KGP 1.9.x can only read metadata ≤ 2.0.0, so `:compileKotlin` fails on EAS with "Class ReactExtension was compiled with an incompatible version of Kotlin".
Fix (patch-gradle.js Fixes 0f & 0g): bump both to `version "2.2.0"` + migrate `kotlinOptions {}` → `compilerOptions {}`.
Error signature: `"the compiler version 1.9.0 can read versions up to 2.0.0"` in RUN_GRADLEW phase.
