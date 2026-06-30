const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nodeModulesDir = path.join(root, 'node_modules');

function createShim(relPath, description, content) {
  const abs = path.join(root, relPath);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8') === content) {
    console.log(`[patch-gradle] Already shimmed: ${description}`);
    return;
  }
  fs.writeFileSync(abs, content, 'utf8');
  console.log(`[patch-gradle] Created shim: ${description}`);
}

function patch(filePath, description, find, replace) {
  const abs = path.join(root, filePath);
  if (!fs.existsSync(abs)) {
    console.log(`[patch-gradle] SKIP (not found): ${filePath}`);
    return false;
  }
  let content = fs.readFileSync(abs, 'utf8');
  // Check replace first: if the target text is already present, skip.
  // This prevents re-applying a patch that was already applied (even if `find`
  // still appears elsewhere in the file — the old "find-only" check caused
  // duplicate blocks to be inserted on repeated runs).
  // SPECIAL CASE: when replace === '' (deletion patch), content.includes('') is always true
  // so we skip the replace-check and fall through to the find-check instead.
  if (replace !== '' && content.includes(replace)) {
    console.log(`[patch-gradle] Already patched: ${description}`);
    return false;
  }
  if (content.includes(find)) {
    content = content.replace(find, replace);
    fs.writeFileSync(abs, content, 'utf8');
    console.log(`[patch-gradle] Patched: ${description}`);
    return true;
  }
  console.log(`[patch-gradle] WARNING (not found): ${description} — neither find nor replace text present in ${filePath}`);
  return false;
}

// Fix 0: android/gradle.properties — expo prebuild regenerates android/gradle.properties with
// android.kotlinVersion=1.9.24 which feeds into buildscript.ext via
// `findProperty('android.kotlinVersion') ?: '1.9.25'`. Since findProperty() returns '1.9.24'
// the fallback default '2.2.0' is never used. Patching gradle.properties directly is the
// canonical fix: findProperty returns '2.2.0', buildscript.ext.kotlinVersion='2.2.0', and
// ExpoModulesCorePlugin.kotlinVersion() (which reads rootProject.ext.kotlinVersion) also
// returns '2.2.0'. kotlin-compose-compiler-plugin-embeddable:2.2.0 exists on Maven Central.
patch(
  'android/gradle.properties',
  'android/gradle.properties: set android.kotlinVersion=2.2.0 so Kotlin 2.x compose plugin resolves correctly',
  `android.kotlinVersion=1.9.24`,
  `android.kotlinVersion=2.2.0`
);

// Fix 0 (build.gradle belt-and-suspenders): expo prebuild also puts
// `kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'` in android/build.gradle.
// Since the gradle.properties patch above sets android.kotlinVersion=2.2.0, findProperty will
// return '2.2.0' and the ?: fallback is moot. But if gradle.properties does not include that
// line (older prebuild template), the fallback default ensures '2.2.0' is used.
patch(
  'android/build.gradle',
  'android/build.gradle: upgrade kotlinVersion to 2.2.0 (SDK 56 packages require Kotlin 2.x metadata)',
  `kotlinVersion = findProperty('android.kotlinVersion') ?: '1.9.25'`,
  `kotlinVersion = findProperty('android.kotlinVersion') ?: '2.2.0'`
);

// Fix 0d: android/build.gradle — add project-level ext.kotlinVersion so that
// ExpoModulesCorePlugin.kotlinVersion() returns '2.2.0' instead of its hardcoded default '1.9.24'.
// ExpoModulesCorePlugin reads rootProject.ext.get("kotlinVersion") — the project-level
// ExtraPropertiesExtension — which is SEPARATE from buildscript.ext in Gradle 8.x.
// buildscript { ext { kotlinVersion = '...' } } only sets buildscript.ext; rootProject.ext
// remains unset, so rootProject.ext.has("kotlinVersion") returns false and the fallback
// "1.9.24" is used. This causes kotlin-compose-compiler-plugin-embeddable:1.9.24 to be
// requested (doesn't exist — compose embeddable was introduced in Kotlin 2.0.0). Adding an
// explicit project-level ext { kotlinVersion = '2.2.0' } after the apply plugin line ensures
// rootProject.ext.has("kotlinVersion") returns true and the correct version is used.
patch(
  'android/build.gradle',
  'android/build.gradle: add project-level ext.kotlinVersion=2.2.0 for ExpoModulesCorePlugin',
  `apply plugin: "com.facebook.react.rootproject"

allprojects {`,
  `apply plugin: "com.facebook.react.rootproject"

// Project-level ext so that ExpoModulesCorePlugin.kotlinVersion() returns '2.2.0'.
// ExpoModulesCorePlugin reads rootProject.ext.get("kotlinVersion") — the project-level
// ExtraPropertiesExtension — which is SEPARATE from buildscript.ext in Gradle 8.x.
// Without this block, rootProject.ext.has("kotlinVersion") returns false and the plugin
// falls back to its hardcoded default "1.9.24", causing kotlin-compose-compiler-plugin-embeddable
// resolution to fail (that artifact doesn't exist at 1.9.24; it was introduced in Kotlin 2.0.0).
ext {
    kotlinVersion = '2.2.0'
}

allprojects {`
);

// Fix 0e: android/build.gradle — force kotlin-gradle-plugin to 2.2.0 inside the buildscript
// configurations.all block.  The @react-native/gradle-plugin composite build (includeBuild) uses
// `implementation(libs.kotlin.gradle.plugin)` where libs.versions.kotlin="1.9.24", which places
// kotlin-gradle-plugin:1.9.24 on the parent build's buildscript classpath.  The Compose plugin
// 2.2.0 queries the KGP version via the kotlin extension; if KGP 1.9.24 wins the classpath race
// it reports "1.9.24" and the compose plugin requests kotlin-compose-compiler-plugin-
// embeddable:1.9.24 which doesn't exist (introduced in Kotlin 2.0.0).  Forcing the KGP to 2.2.0
// in the buildscript classpath ensures the compose plugin always reads version 2.2.0.
patch(
  'android/build.gradle',
  'android/build.gradle: force kotlin-gradle-plugin 2.2.0 in buildscript classpath (composite build brings 1.9.24)',
  `    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath('com.android.tools.build:gradle')
        classpath('com.facebook.react:react-native-gradle-plugin')`,
  `    // Force KGP to 2.2.0 in the buildscript classpath.
    // The @react-native/gradle-plugin composite build (includeBuild) declares
    // \`implementation(libs.kotlin.gradle.plugin)\` where libs.versions.kotlin = "1.9.24".
    // Using \`implementation\` (not \`compileOnly\`) causes kotlin-gradle-plugin:1.9.24 to land on the
    // parent build's buildscript classpath alongside our 2.2.0. The compose plugin 2.2.0 queries
    // the KGP version via the kotlin extension object; if KGP 1.9.24 wins the classpath race it
    // reports version "1.9.24", and the compose plugin requests kotlin-compose-compiler-plugin-
    // embeddable:1.9.24 which does not exist (introduced in Kotlin 2.0.0).
    // Forcing all kotlin-gradle-plugin requests to 2.2.0 in the buildscript classpath ensures
    // the compose plugin always reads version 2.2.0.
    configurations.all {
        resolutionStrategy {
            force "org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.0"
            force "org.jetbrains.kotlin:kotlin-gradle-plugin-api:2.2.0"
        }
    }
    repositories {
        google()
        mavenCentral()
    }
    dependencies {
        classpath('com.android.tools.build:gradle')
        classpath('com.facebook.react:react-native-gradle-plugin')`
);

// Fix 0c: android/build.gradle — add org.jetbrains.kotlin.plugin.compose classpath so that
// subprojects (expo-dev-launcher, expo-dev-menu) can `apply plugin: 'org.jetbrains.kotlin.plugin.compose'`.
// In Kotlin 2.x the compose plugin is a SEPARATE artifact from kotlin-gradle-plugin and must
// be on the classpath before it can be applied. This patch is idempotent: old_string includes
// the closing `}` of the dependencies block, which is absent after patching (compose classpath sits
// between kotlin-gradle-plugin and the closing brace).
patch(
  'android/build.gradle',
  'android/build.gradle: add org.jetbrains.kotlin.plugin.compose classpath for Kotlin 2.x',
  `        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\${kotlinVersion}")
    }
}`,
  `        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:\${kotlinVersion}")
        classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:\${kotlinVersion}")
    }
}`
);

// Fix 0b: android/build.gradle — add resolutionStrategy force to cap newer AndroidX
// dependencies (androidx.browser:1.9.0, androidx.core:1.17.0) that require compileSdk 36
// and AGP 8.9.1+, while the EAS image is locked to AGP 8.6.0 / compileSdk 35.
patch(
  'android/build.gradle',
  'android/build.gradle: cap androidx.browser and androidx.core to AGP 8.6.0 compatible versions',
  `allprojects {
    repositories {`,
  `allprojects {
    configurations.all {
        resolutionStrategy {
            force 'androidx.browser:browser:1.8.0'
            force 'androidx.core:core:1.15.0'
            force 'androidx.core:core-ktx:1.15.0'
            // Kotlin 2.x: kotlin-gradle-plugin/compose-plugin auto-adds kotlin-compose-compiler-plugin-embeddable
            // to the kotlin-extension configuration. If ExpoModulesCorePlugin.kotlinVersion() resolves to
            // 1.9.24 (the fallback), it requests an embeddable at 1.9.24 which doesn't exist (introduced in
            // Kotlin 2.0.0). Force 2.2.0 so that whatever version is requested, 2.2.0 is used.
            force 'org.jetbrains.kotlin:kotlin-compose-compiler-plugin-embeddable:2.2.0'
        }
    }
    repositories {`
);

const EXPO_MODULES_CORE_PLUGIN = `new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")`;
const EXPO_MODULES_CORE_SETUP = `
def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useDefaultAndroidSdkVersions()
useCoreDependencies()

def expoModule = { Object... args -> }`;

// Fix 1: stub useExpoPublishing() in ExpoModulesCorePlugin.gradle to prevent
// "SoftwareComponent with name 'release' not found" errors in Gradle 8.x regardless
// of which module calls it.
patch(
  'node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle',
  'expo-modules-core: stub useExpoPublishing() to no-op',
  `ext.useExpoPublishing = {
  if (!project.plugins.hasPlugin('maven-publish')) {
    apply plugin: 'maven-publish'
  }

  project.android {
    publishing {
      singleVariant("release") {
        withSourcesJar()
      }
    }
  }

  project.afterEvaluate {
    publishing {
      publications {
        release(MavenPublication) {
          from components.release
        }
      }
      repositories {
        maven {
          url = mavenLocal().url
        }
      }
    }
  }
}`,
  `ext.useExpoPublishing = {
  // no-op: Maven publishing disabled for app APK builds (SoftwareComponent unavailable in Gradle 8.x)
}`
);

// Fix 2: expo-modules-core build.gradle — also comment out the call site as belt-and-suspenders
patch(
  'node_modules/expo-modules-core/android/build.gradle',
  'expo-modules-core: disable useExpoPublishing() call',
  'useExpoPublishing()',
  '// useExpoPublishing() disabled - SoftwareComponent not available in Gradle 8.x'
);

// Shim A: expo/config/paths — subpath export added in expo 53+; expo 52 has no exports field.
// expo-updates 56.x imports resolveEntryPoint from this path; @expo/config already has it.
createShim(
  'node_modules/expo/config/paths.js',
  'expo shim: config/paths → @expo/config/build/paths/paths',
  `// Shim: expo/config/paths → @expo/config/build/paths/paths\n// expo-updates 56.x expects expo to export this subpath; expo 52.x doesn't have it.\nmodule.exports = require('@expo/config/build/paths/paths');\n`
);

// Shim B: expo/internal/unstable-expo-updates-cli-exports — subpath export added in expo 53+.
// expo-updates 56.x imports drawableFileTypes, createMetroServerAndBundleRequestAsync,
// and exportEmbedAssetsAsync from this path; all live in @expo/cli.
createShim(
  'node_modules/expo/internal/unstable-expo-updates-cli-exports.js',
  'expo shim: internal/unstable-expo-updates-cli-exports → @expo/cli export embed',
  `// Shim: expo/internal/unstable-expo-updates-cli-exports\n// expo-updates 56.x expects expo to export this subpath; expo 52.x doesn't have it.\nconst { drawableFileTypes } = require('@expo/cli/build/src/export/metroAssetLocalPath');\nconst { createMetroServerAndBundleRequestAsync, exportEmbedAssetsAsync } = require('@expo/cli/build/src/export/embed/exportEmbedAsync');\nmodule.exports = { drawableFileTypes, createMetroServerAndBundleRequestAsync, exportEmbedAssetsAsync };\n`
);

// Fix 1b: ExpoModulesCorePlugin.gradle — add KSP 2.2.0 mapping.
// kspVersionsMap only goes up to "2.0.21". With KGP 2.2.0 the map falls back to "1.9.25-1.0.20"
// which is incompatible: ksp-1.9.x is too old for kotlin-2.2.0.
// Fix: add "2.2.0" → "2.2.0-2.0.2" (the KSP release for Kotlin 2.2.0 on Maven Central).
patch(
  'node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle',
  'expo-modules-core ExpoModulesCorePlugin: add KSP 2.2.0-2.0.2 mapping to kspVersionsMap',
  `"1.9.24": "1.9.24-1.0.20",\n          "1.9.25": "1.9.25-1.0.20",\n          "2.0.21": "2.0.21-1.0.28"`,
  `"1.9.24": "1.9.24-1.0.20",\n          "1.9.25": "1.9.25-1.0.20",\n          "2.0.21": "2.0.21-1.0.28",\n          "2.2.0": "2.2.0-2.0.2"`
);

// Fix 1c: expo-updates/android/build.gradle — add KSP 2.2.0 mapping to getKspVersion().
// The getKspVersion() closure checks for "2.1.20" and "2.0.21" but not "2.2.0", so it falls back
// to "1.9.24-1.0.20" which is incompatible with KGP 2.2.0.
patch(
  'node_modules/expo-updates/android/build.gradle',
  'expo-updates: add KSP 2.2.0-2.0.2 case to getKspVersion()',
  `if (kotlinVersion == "2.1.20") {\n        return "2.1.20-2.0.1"\n      } else if (kotlinVersion == "2.0.21") {`,
  `if (kotlinVersion == "2.2.0") {\n        return "2.2.0-2.0.2"\n      } else if (kotlinVersion == "2.1.20") {\n        return "2.1.20-2.0.1"\n      } else if (kotlinVersion == "2.0.21") {`
);

// Fix 2b: expo-modules-core/android/build.gradle — hardcode the buildscript block so that
// KOTLIN_MAJOR_VERSION and the compose classpath version are NEVER looked up from a variable.
// Root cause: `kotlinVersion` inside expo-modules-core's buildscript {} may resolve to the
// project.ext.kotlinVersion CLOSURE set by ExpoModulesCorePlugin (which returns '2.2.0' when
// called, but is a Closure object when accessed as a property). The `.split()` call on a Closure
// would throw or return garbage, causing KOTLIN_MAJOR_VERSION to default to 1 (or throw), which
// then skips the compose classpath OR uses a garbage version string. Hardcoding bypasses all
// variable resolution ambiguity in the buildscript evaluation phase.
patch(
  'node_modules/expo-modules-core/android/build.gradle',
  'expo-modules-core: hardcode KOTLIN_MAJOR_VERSION=2 and compose classpath 2.2.0 in buildscript',
  `buildscript {
  ext.KOTLIN_MAJOR_VERSION = kotlinVersion.split("\\\\.")[0].toInteger()

  if (KOTLIN_MAJOR_VERSION >= 2) {
    repositories {
      mavenCentral()
    }

    dependencies {
      classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:\${kotlinVersion}")
    }
  }
}`,
  `buildscript {
  // Hardcoded for Kotlin 2.2.0: KOTLIN_MAJOR_VERSION=2, compose classpath at 2.2.0.
  // The original code looked up \`kotlinVersion\` from the Gradle property chain; in Gradle 8.x
  // that lookup can resolve to the project.ext.kotlinVersion *Closure* (set by
  // ExpoModulesCorePlugin) instead of a String, causing .split() to throw / return garbage and
  // KOTLIN_MAJOR_VERSION to fall back to 1. Hardcoding ensures the compose classpath is always
  // added and the compose plugin is always applied.
  ext.KOTLIN_MAJOR_VERSION = 2

  repositories {
    mavenCentral()
  }

  dependencies {
    classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:2.2.0")
  }
}`
);

// Fix 2c: ExpoModulesCorePlugin.gradle — hardcode the kotlinVersion closure to return '2.2.0'
// so that every call site (kotlin-stdlib-jdk7, kotlin-reflect, composeOptions map lookup, etc.)
// always resolves to the correct version instead of depending on rootProject.ext.has("kotlinVersion").
// The original closure checked rootProject.ext.has("kotlinVersion") which returns false if
// android/build.gradle's project-level ext block hasn't been evaluated yet (Gradle evaluates
// buildscript blocks before project build scripts, so rootProject.ext may be unset at the
// moment ExpoModulesCorePlugin's KotlinExpoModulesCorePlugin.apply() runs).
patch(
  'node_modules/expo-modules-core/android/ExpoModulesCorePlugin.gradle',
  'expo-modules-core: hardcode kotlinVersion closure to 2.2.0',
  `    project.ext.kotlinVersion = {
        project.rootProject.ext.has("kotlinVersion")
            ? project.rootProject.ext.get("kotlinVersion")
            : "1.9.24"
      }`,
  `    project.ext.kotlinVersion = {
        // Hardcoded to 2.2.0: the original lookup checks rootProject.ext.has("kotlinVersion")
        // but that ext may be unset during buildscript evaluation phase in Gradle 8.x.
        "2.2.0"
      }`
);

// Fix 3: expo-av — replace expo-module-gradle-plugin (new-style plugins block)
patch(
  'node_modules/expo-av/android/build.gradle',
  'expo-av: replace expo-module-gradle-plugin with ExpoModulesCorePlugin approach',
  `import expo.modules.plugin.gradle.ExpoModuleExtension

plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}

def getReactNativeDir = {
  return project.extensions.getByType(ExpoModuleExtension).reactNativeDir
}

def REACT_NATIVE_DIR = getReactNativeDir()`,
  `apply plugin: 'com.android.library'

def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useDefaultAndroidSdkVersions()
useCoreDependencies()

def REACT_NATIVE_BUILD_FROM_SOURCE = findProject(":packages:react-native:ReactAndroid") != null
def REACT_NATIVE_DIR = REACT_NATIVE_BUILD_FROM_SOURCE
  ? findProject(":packages:react-native:ReactAndroid").getProjectDir().parent
  : file(providers.exec {
      workingDir(rootDir)
      commandLine("node", "--print", "require.resolve('react-native/package.json')")
    }.standardOutput.asText.get().trim()).parentFile`
);

// Fix 4: expo-dev-launcher — complex patch:
//   a) Remove module-level buildscript compose classpath (now bundled in kotlin-gradle-plugin 2.x)
//   b) Replace old-style expo-module-gradle-plugin with ExpoModulesCorePlugin
//   c) Apply org.jetbrains.kotlin.plugin.compose AFTER applyKotlinExpoModulesCorePlugin()
//      (which applies kotlin-android). With Kotlin 2.2.0 the compose plugin is bundled in
//      kotlin-gradle-plugin — no separate classpath or composeOptions needed.
patch(
  'node_modules/expo-dev-launcher/android/build.gradle',
  'expo-dev-launcher: remove Kotlin 2.x compose plugin, replace expo-module-gradle-plugin',
  `buildscript {
  repositories {
    mavenCentral()
  }
  dependencies {
    classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:\${kotlinVersion}")
    classpath("org.jetbrains.kotlin.plugin.serialization:org.jetbrains.kotlin.plugin.serialization.gradle.plugin:\${kotlinVersion}")
    classpath("com.apollographql.apollo:apollo-gradle-plugin:4.4.2")
  }
}

apply plugin: 'com.android.library'
apply plugin: 'expo-module-gradle-plugin'
apply plugin: 'org.jetbrains.kotlin.plugin.compose'
apply plugin: 'org.jetbrains.kotlin.plugin.serialization'
apply plugin: 'com.apollographql.apollo'`,
  `buildscript {
  repositories {
    mavenCentral()
  }
  dependencies {
    classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:\${kotlinVersion}")
    classpath("org.jetbrains.kotlin.plugin.serialization:org.jetbrains.kotlin.plugin.serialization.gradle.plugin:\${kotlinVersion}")
    classpath("com.apollographql.apollo:apollo-gradle-plugin:4.4.2")
  }
}

apply plugin: 'com.android.library'

def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useDefaultAndroidSdkVersions()
useCoreDependencies()

def expoModule = { Object... args -> }

apply plugin: 'org.jetbrains.kotlin.plugin.serialization'
apply plugin: 'com.apollographql.apollo'
apply plugin: 'org.jetbrains.kotlin.plugin.compose'

android {
  buildFeatures {
    compose true
  }
}`
);

// Fix 4b: expo-dev-launcher — downgrade core-ktx 1.17.0 (requires compileSdk 36) → 1.15.0
patch(
  'node_modules/expo-dev-launcher/android/build.gradle',
  'expo-dev-launcher: downgrade core-ktx 1.17.0 → 1.15.0 (compileSdk 35 / AGP 8.6.0 compat)',
  `implementation 'androidx.core:core-ktx:1.17.0'`,
  `implementation 'androidx.core:core-ktx:1.15.0'`
);

// Fix 4c: expo-dev-launcher — release runtime compose consistent-resolution conflict.
// expo-dev-launcher declares releaseCompileOnly "foundation-android:1.9.0" but its debugOnly
// closure only adds releaseImplementation when configureInRelease=true (normally false).
// So the release RUNTIME classpath gets compose transitively from react-android at ~1.7.x.
// Gradle's consistent resolution then creates {strictly 1.7.x} for the release compile
// classpath, which rejects the compileOnly dep at 1.9.0 → EAS_BUILD_UNKNOWN_GRADLE_ERROR.
// Fix: explicitly add releaseRuntimeOnly for foundation-android so the runtime also has
// 1.9.0, making consistent resolution derive {strictly 1.9.0} for compile (satisfied). ✓
patch(
  'node_modules/expo-dev-launcher/android/build.gradle',
  'expo-dev-launcher: add releaseRuntimeOnly foundation-android:1.9.0 to fix consistent resolution conflict',
  `  releaseCompileOnly "androidx.compose.foundation:foundation-android:$composeVersion"`,
  `  releaseCompileOnly "androidx.compose.foundation:foundation-android:$composeVersion"
  releaseRuntimeOnly "androidx.compose.foundation:foundation-android:$composeVersion" // consistent resolution fix: runtime must match compileOnly version`
);

// Fix 5: expo-dev-menu — same issue as expo-dev-launcher. With Kotlin 2.2.0 the compose
// plugin is bundled in kotlin-gradle-plugin; apply it after applyKotlinExpoModulesCorePlugin().
patch(
  'node_modules/expo-dev-menu/android/build.gradle',
  'expo-dev-menu: remove Kotlin 2.x compose plugin, replace expo-module-gradle-plugin',
  `buildscript {
  repositories {
    mavenCentral()
  }
  dependencies {
    classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:\${kotlinVersion}")
  }
}

apply plugin: 'com.android.library'
apply plugin: 'expo-module-gradle-plugin'
apply plugin: 'org.jetbrains.kotlin.plugin.compose'`,
  `buildscript {
  repositories {
    mavenCentral()
  }
  dependencies {
    classpath("org.jetbrains.kotlin.plugin.compose:org.jetbrains.kotlin.plugin.compose.gradle.plugin:\${kotlinVersion}")
  }
}

apply plugin: 'com.android.library'

def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useDefaultAndroidSdkVersions()
useCoreDependencies()

def expoModule = { Object... args -> }

apply plugin: 'org.jetbrains.kotlin.plugin.compose'

android {
  buildFeatures {
    compose true
  }
}`
);

// Fix 5b: expo-dev-menu — downgrade browser 1.9.0 (requires compileSdk 36) → 1.8.0
patch(
  'node_modules/expo-dev-menu/android/build.gradle',
  'expo-dev-menu: downgrade browser 1.9.0 → 1.8.0 (compileSdk 35 / AGP 8.6.0 compat)',
  `debugOnlyApi "androidx.browser:browser:1.9.0"`,
  `debugOnlyApi "androidx.browser:browser:1.8.0"`
);

// Fix 5b-i: expo-dev-menu — remove VRUtilities from DevMenuState.kt.
// expo.modules.core.utilities.VRUtilities does not exist in expo-modules-core 2.2.3;
// it was added in a later version. Replace isQuest() with false (non-Quest device assumption).
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/compose/DevMenuState.kt',
  'expo-dev-menu DevMenuState: remove VRUtilities import, replace isQuest() with false',
  `import expo.modules.core.utilities.VRUtilities\n`,
  ``
);
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/compose/DevMenuState.kt',
  'expo-dev-menu DevMenuState: replace VRUtilities.isQuest() with false literal',
  `val showFab: Boolean = VRUtilities.isQuest(),`,
  `val showFab: Boolean = false, // VRUtilities not in expo-modules-core 2.2.3`
);

// Fix 5b-ii: expo-dev-menu — remove VRUtilities from ToolsSection.kt.
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/compose/ui/ToolsSection.kt',
  'expo-dev-menu ToolsSection: remove VRUtilities import',
  `import expo.modules.core.utilities.VRUtilities\n`,
  ``
);
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/compose/ui/ToolsSection.kt',
  'expo-dev-menu ToolsSection: replace VRUtilities.isQuest() with true (non-Quest)',
  `if (!VRUtilities.isQuest()) {`,
  `if (true) { // VRUtilities.isQuest() not available; assume non-Quest`
);

// Fix 5b-iii: expo-dev-menu — remove 'override' from onDidCreateReactActivityDelegateNotification.
// ReactActivityHandler in expo-modules-core 2.2.3 does not have this method; it was added later.
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/DevMenuPackage.kt',
  'expo-dev-menu DevMenuPackage: remove override keyword from onDidCreateReactActivityDelegateNotification',
  `        override fun onDidCreateReactActivityDelegateNotification(activity: ReactActivity?, delegate: ReactActivityDelegate?) {`,
  `        fun onDidCreateReactActivityDelegateNotification(activity: ReactActivity?, delegate: ReactActivityDelegate?) { // override removed — not in ReactActivityHandler 2.2.3`
);

// Fix 5b-iv: expo-dev-menu — remove DevSupportManager.currentReactContext usage.
// DevSupportManager in RN 0.76 does not expose currentReactContext as a property.
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/devtools/DevMenuDevToolsDelegate.kt',
  'expo-dev-menu DevMenuDevToolsDelegate: replace currentReactContext ?: currentActivity with currentActivity',
  `get() = devSupportManager?.currentReactContext ?: currentActivity`,
  `get() = currentActivity // currentReactContext not in DevSupportManager RN 0.76`
);
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/devtools/DevMenuDevToolsDelegate.kt',
  'expo-dev-menu DevMenuDevToolsDelegate: replace currentReactContext with null',
  `get() = devSupportManager?.currentReactContext`,
  `get() = null // currentReactContext not in DevSupportManager RN 0.76`
);

// Fix 5b-v: expo-dev-menu — remove OptimizedRecord import and annotation from DevMenuModule.kt.
// expo.modules.kotlin.types.OptimizedRecord does not exist in expo-modules-core 2.2.3.
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/modules/DevMenuModule.kt',
  'expo-dev-menu DevMenuModule: remove OptimizedRecord import',
  `import expo.modules.kotlin.types.OptimizedRecord\n`,
  ``
);
patch(
  'node_modules/expo-dev-menu/android/src/debug/java/expo/modules/devmenu/modules/DevMenuModule.kt',
  'expo-dev-menu DevMenuModule: remove @OptimizedRecord annotation',
  `@OptimizedRecord\n`,
  ``
);

// Fix 5c-i: expo-dev-launcher — NonFinalBridgelessDevSupportManager.kt
// Using createShim (full replacement) because:
//   - Kotlin 2.2.0 raises "Inherited platform declarations clash: getJSBundleURLForRemoteDebugging()"
//     at the class-declaration level — requires @Suppress("ACCIDENTAL_OVERRIDE").
//   - Previous patch chain accidentally produced a duplicate loadSplitBundleFromServer override.
//   - uniqueTag val → getUniqueTag() fun (Kotlin 2.2.0 + Java abstract method).
//   - reload() removed in RN 0.76 → onJSBundleLoadedFromServer().
createShim(
  'node_modules/expo-dev-launcher/android/src/debug/java/com/facebook/react/devsupport/NonFinalBridgelessDevSupportManager.kt',
  'expo-dev-launcher NonFinalBridgelessDevSupportManager: full replacement (RN 0.76 + Kotlin 2.2.0 compat)',
  `/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.react.devsupport

import android.content.Context
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.SurfaceDelegateFactory
import com.facebook.react.devsupport.interfaces.DevBundleDownloadListener
import com.facebook.react.devsupport.interfaces.DevLoadingViewManager
import com.facebook.react.devsupport.interfaces.DevSupportManager
import com.facebook.react.devsupport.interfaces.PausedInDebuggerOverlayManager
import com.facebook.react.devsupport.interfaces.DevSplitBundleCallback
import com.facebook.react.devsupport.interfaces.RedBoxHandler
import com.facebook.react.packagerconnection.RequestHandler

//
// Expo: This is a copy of react-native's {@link com.facebook.react.devsupport.BridgelessDevSupportManager}
// just removing the "final" modifier that we can inherit and reuse.
// From time to time for react-native upgrade, just follow the steps to update the code
//   1. Copy the contents from BridgelessDevSupportManager to this file.
//   2. Rename the class to NonFinalBridgelessDevSupportManager.
//   3. Change "public" modifier -> "open"
//   4. Revert the comment
//

/**
 * An implementation of [DevSupportManager] that extends the functionality in
 * [DevSupportManagerBase] with some additional, more flexible APIs for asynchronously loading the
 * JS bundle.
 *
 * @constructor The primary constructor mirrors the same constructor we have for
 *   [BridgeDevSupportManager] and
 *     * is kept for backward compatibility.
 */
@Suppress("ACCIDENTAL_OVERRIDE")
open class NonFinalBridgelessDevSupportManager(
  applicationContext: Context,
  reactInstanceManagerHelper: ReactInstanceDevHelper,
  packagerPathForJSBundleName: String?,
  enableOnCreate: Boolean,
  redBoxHandler: RedBoxHandler?,
  devBundleDownloadListener: DevBundleDownloadListener?,
  minNumShakes: Int,
  customPackagerCommandHandlers: Map<String, RequestHandler>?,
  surfaceDelegateFactory: SurfaceDelegateFactory?,
  devLoadingViewManager: DevLoadingViewManager?,
  pausedInDebuggerOverlayManager: PausedInDebuggerOverlayManager?
) :
  DevSupportManagerBase(
    applicationContext,
    reactInstanceManagerHelper,
    packagerPathForJSBundleName,
    enableOnCreate,
    redBoxHandler,
    devBundleDownloadListener,
    minNumShakes,
    customPackagerCommandHandlers,
    surfaceDelegateFactory,
    devLoadingViewManager,
    pausedInDebuggerOverlayManager
  ) {

  constructor(
    context: Context,
    reactInstanceManagerHelper: ReactInstanceDevHelper,
    packagerPathForJSBundleName: String?
  ) : this(
    applicationContext = context.applicationContext,
    reactInstanceManagerHelper = reactInstanceManagerHelper,
    packagerPathForJSBundleName = packagerPathForJSBundleName,
    enableOnCreate = true,
    redBoxHandler = null,
    devBundleDownloadListener = null,
    minNumShakes = 2,
    customPackagerCommandHandlers = null,
    surfaceDelegateFactory = null,
    devLoadingViewManager = null,
    pausedInDebuggerOverlayManager = null
  )

  override fun getUniqueTag(): String = "Bridgeless" // RN 0.76: Java abstract method, must use fun override not val

  // Kotlin 2.2.0 K2: resolve "Inherited platform declarations clash" for getJSBundleURLForRemoteDebugging.
  // DevSupportManagerBase (Java) and DevSupportManager (Java interface) both declare this method,
  // causing a JVM signature clash. Explicit override selects the base-class implementation.
  override fun getJSBundleURLForRemoteDebugging(): String? = super.getJSBundleURLForRemoteDebugging()

  override fun loadSplitBundleFromServer(bundlePath: String, callback: DevSplitBundleCallback): Unit {} // RN 0.76 interface requirement

  override fun handleReloadJS() {
    UiThreadUtil.assertOnUiThread()
    // dismiss redbox if exists
    hideRedboxDialog()
    reactInstanceDevHelper.onJSBundleLoadedFromServer() // reload() not in ReactInstanceDevHelper RN 0.76
  }
}
`
);

// Fix 5c-ii: expo-dev-launcher — DevLauncherBridgelessDevSupportManager.kt
patch(
  'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/react/DevLauncherBridgelessDevSupportManager.kt',
  'expo-dev-launcher DevLauncherBridgelessDevSupportManager: add DevSplitBundleCallback import',
  `import com.facebook.react.devsupport.interfaces.RedBoxHandler\n`,
  `import com.facebook.react.devsupport.interfaces.DevSplitBundleCallback\nimport com.facebook.react.devsupport.interfaces.RedBoxHandler\n`
);
patch(
  'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/react/DevLauncherBridgelessDevSupportManager.kt',
  'expo-dev-launcher DevLauncherBridgelessDevSupportManager: replace uniqueTag val with getUniqueTag() fun (Kotlin 2.2.0 + Java abstract method)',
  `  override val uniqueTag: String\n    get() = "DevLauncherApp-Bridgeless"`,
  `  override fun getUniqueTag(): String = "DevLauncherApp-Bridgeless" // RN 0.76: Java abstract method, must use fun override`
);
patch(
  'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/react/DevLauncherBridgelessDevSupportManager.kt',
  'expo-dev-launcher DevLauncherBridgelessDevSupportManager: fix showNewJavaError Throwable → Throwable? (interface nullability)',
  `override fun showNewJavaError(message: String?, e: Throwable) {`,
  `override fun showNewJavaError(message: String?, e: Throwable?) {`
);
patch(
  'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/react/DevLauncherBridgelessDevSupportManager.kt',
  'expo-dev-launcher DevLauncherBridgelessDevSupportManager: add loadSplitBundleFromServer no-op before companion object',
  `\n  companion object {`,
  `\n  override fun loadSplitBundleFromServer(bundlePath: String, callback: DevSplitBundleCallback): Unit {} // RN 0.76 interface requirement\n\n  companion object {`
);

// Fix 5c-iii: expo-dev-launcher — DevLauncherPackageDelegate.kt
// ReactActivityHandler in expo-modules-core 2.2.3 does not have onDidCreateReactActivityDelegateNotification.
patch(
  'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/DevLauncherPackageDelegate.kt',
  'expo-dev-launcher DevLauncherPackageDelegate: remove override from onDidCreateReactActivityDelegateNotification',
  `        override fun onDidCreateReactActivityDelegateNotification(activity: ReactActivity?, delegate: ReactActivityDelegate?) {`,
  `        fun onDidCreateReactActivityDelegateNotification(activity: ReactActivity?, delegate: ReactActivityDelegate?) { // override removed — not in ReactActivityHandler 2.2.3`
);

// Fix 5c-iv: expo-dev-launcher — DevLauncherEdgeToEdgeHelper.kt
// WindowCompat.enableEdgeToEdge(Window) does not exist in androidx.core 1.15.0.
// Use setDecorFitsSystemWindows(window, false) instead (equivalent for edge-to-edge layout).
patch(
  'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/helpers/DevLauncherEdgeToEdgeHelper.kt',
  'expo-dev-launcher DevLauncherEdgeToEdgeHelper: replace WindowCompat.enableEdgeToEdge with setDecorFitsSystemWindows (not in core 1.15.0)',
  `WindowCompat.enableEdgeToEdge(this)`,
  `WindowCompat.setDecorFitsSystemWindows(this, false) // enableEdgeToEdge(Window) not in core 1.15.0`
);

// Fix 5c-v: expo-dev-launcher — DevLauncherDevSupportManagerFactory.kt
// RN 0.76 DevSupportManagerFactory interface has only ONE create() with 11 params.
// The 12-param create (with useDevSupport: Boolean) was added in RN 0.78 — remove 'override'.
// Also fix the 11-param create to actually instantiate DevLauncherBridgelessDevSupportManager
// instead of throwing, since that's the only create() RN 0.76 will ever call.
patch(
  'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/react/DevLauncherDevSupportManagerFactory.kt',
  'expo-dev-launcher DevLauncherDevSupportManagerFactory: 11-param create → instantiate manager (throw removed, RN 0.76 only calls 11-param)',
  `    throw IllegalStateException("Legacy architecture is not longer supported.")`,
  `    // RN 0.76 only has 11-param create; instantiate manager here
    return if (!enableOnCreate) {
      ReleaseDevSupportManager()
    } else {
      DevLauncherBridgelessDevSupportManager(
        applicationContext,
        reactInstanceManagerHelper,
        packagerPathForJSBundleName,
        enableOnCreate,
        redBoxHandler,
        devBundleDownloadListener,
        minNumShakes,
        customPackagerCommandHandlers?.toMutableMap()
      )
    }`
);
patch(
  'node_modules/expo-dev-launcher/android/src/debug/java/expo/modules/devlauncher/react/DevLauncherDevSupportManagerFactory.kt',
  'expo-dev-launcher DevLauncherDevSupportManagerFactory: remove override from 12-param create (not in RN 0.76 interface)',
  `  override fun create(
    applicationContext: Context,
    reactInstanceManagerHelper: ReactInstanceDevHelper,
    packagerPathForJSBundleName: String?,
    enableOnCreate: Boolean,
    redBoxHandler: RedBoxHandler?,
    devBundleDownloadListener: DevBundleDownloadListener?,
    minNumShakes: Int,
    customPackagerCommandHandlers: Map<String, RequestHandler>?,
    surfaceDelegateFactory: SurfaceDelegateFactory?,
    devLoadingViewManager: DevLoadingViewManager?,
    pausedInDebuggerOverlayManager: PausedInDebuggerOverlayManager?,
    useDevSupport: Boolean`,
  `  fun create( // override removed — RN 0.76 DevSupportManagerFactory has no 12-param create
    applicationContext: Context,
    reactInstanceManagerHelper: ReactInstanceDevHelper,
    packagerPathForJSBundleName: String?,
    enableOnCreate: Boolean,
    redBoxHandler: RedBoxHandler?,
    devBundleDownloadListener: DevBundleDownloadListener?,
    minNumShakes: Int,
    customPackagerCommandHandlers: Map<String, RequestHandler>?,
    surfaceDelegateFactory: SurfaceDelegateFactory?,
    devLoadingViewManager: DevLoadingViewManager?,
    pausedInDebuggerOverlayManager: PausedInDebuggerOverlayManager?,
    useDevSupport: Boolean`
);

// Fix 5c: @react-native/gradle-plugin composite build — upgrade kotlin version to 2.2.0.
// The composite build (includeBuild) declares `implementation(libs.kotlin.gradle.plugin)` where
// libs.versions.kotlin = "1.9.24". Using `implementation` (not `compileOnly`) means KGP 1.9.24
// lands on the parent build's buildscript classpath. Two consequences:
//  1. The compose plugin 2.2.0 queries the KGP version and gets "1.9.24", so it requests
//     kotlin-compose-compiler-plugin-embeddable:1.9.24 which doesn't exist on Maven Central
//     (introduced in Kotlin 2.0.0).
//  2. JdkConfiguratorUtils.kt (inside the react-native gradle plugin) uses
//     KotlinTopLevelExtension which was a class in KGP 1.9.24 but became an interface in KGP 2.x.
//     Compiled against 1.9.24 (class) but running with 2.2.0 (interface) → IncompatibleClassChangeError.
// Patching the composite build's version catalog to kotlin = "2.2.0" causes it to recompile
// against KGP 2.2.0, resolving BOTH issues: embeddable version becomes 2.2.0, and the
// KotlinTopLevelExtension interface contract is matched at both compile and runtime.
patch(
  'node_modules/@react-native/gradle-plugin/gradle/libs.versions.toml',
  '@react-native/gradle-plugin composite build: upgrade kotlin 1.9.24 → 2.2.0 (fixes compose embeddable + KotlinTopLevelExtension class/interface mismatch)',
  `kotlin = "1.9.24"`,
  `kotlin = "2.2.0"`
);

// Fix 5d: @react-native/gradle-plugin composite build — replace kotlinOptions {} with
// compilerOptions {} in all three build.gradle.kts files.
// In KGP 2.x, kotlinOptions() was deprecated (warning in 1.8, error in 2.1+). Since Fix 5c
// upgrades the composite build's KGP to 2.2.0, these files now fail to compile with:
//   "Using 'kotlinOptions(...)' is an error. Please migrate to the compilerOptions DSL."
// Fix: replace the deprecated kotlinOptions block with the equivalent compilerOptions block.
// kotlinOptions {} is a hard error in KGP 2.1+ (deprecated in 1.8).
// The replacement compilerOptions {} block drops apiVersion.set() entirely because
// KotlinVersion.KOTLIN_1_6 is explicitly unsupported in KGP 2.2.0 (minimum is KOTLIN_1_9),
// and the original apiVersion was only a strictness guard, not needed for compilation.
const KOTLIN_OPTIONS_BLOCK_WITH_COMMENT = `  kotlinOptions {
    apiVersion = "1.6"
    // See comment above on JDK 11 support
    jvmTarget = "11"
    allWarningsAsErrors =
        project.properties["enableWarningsAsErrors"]?.toString()?.toBoolean() ?: false
  }`;
const COMPILER_OPTIONS_BLOCK_WITH_COMMENT = `  compilerOptions {
    // See comment above on JDK 11 support
    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    allWarningsAsErrors.set(
        project.properties["enableWarningsAsErrors"]?.toString()?.toBoolean() ?: false
    )
  }`;
const KOTLIN_OPTIONS_BLOCK_NO_COMMENT = `  kotlinOptions {
    apiVersion = "1.6"
    jvmTarget = "11"
    allWarningsAsErrors =
        project.properties["enableWarningsAsErrors"]?.toString()?.toBoolean() ?: false
  }`;
const COMPILER_OPTIONS_BLOCK_NO_COMMENT = `  compilerOptions {
    jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_11)
    allWarningsAsErrors.set(
        project.properties["enableWarningsAsErrors"]?.toString()?.toBoolean() ?: false
    )
  }`;

patch(
  'node_modules/@react-native/gradle-plugin/react-native-gradle-plugin/build.gradle.kts',
  '@react-native/gradle-plugin react-native-gradle-plugin: replace kotlinOptions with compilerOptions (KGP 2.2.0 error)',
  KOTLIN_OPTIONS_BLOCK_WITH_COMMENT,
  COMPILER_OPTIONS_BLOCK_WITH_COMMENT
);
patch(
  'node_modules/@react-native/gradle-plugin/shared/build.gradle.kts',
  '@react-native/gradle-plugin shared: replace kotlinOptions with compilerOptions (KGP 2.2.0 error)',
  KOTLIN_OPTIONS_BLOCK_NO_COMMENT,
  COMPILER_OPTIONS_BLOCK_NO_COMMENT
);
patch(
  'node_modules/@react-native/gradle-plugin/shared-testutil/build.gradle.kts',
  '@react-native/gradle-plugin shared-testutil: replace kotlinOptions with compilerOptions (KGP 2.2.0 error)',
  KOTLIN_OPTIONS_BLOCK_NO_COMMENT,
  COMPILER_OPTIONS_BLOCK_NO_COMMENT
);
patch(
  'node_modules/@react-native/gradle-plugin/settings-plugin/build.gradle.kts',
  '@react-native/gradle-plugin settings-plugin: replace kotlinOptions with compilerOptions (KGP 2.2.0 error)',
  KOTLIN_OPTIONS_BLOCK_WITH_COMMENT,
  COMPILER_OPTIONS_BLOCK_WITH_COMMENT
);

// Fix 6: expo-updates — replace old-style expo-module-gradle-plugin
patch(
  'node_modules/expo-updates/android/build.gradle',
  'expo-updates: replace expo-module-gradle-plugin with ExpoModulesCorePlugin approach',
  `apply plugin: 'expo-module-gradle-plugin'`,
  `def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useDefaultAndroidSdkVersions()
useCoreDependencies()

def expoModule = { Object... args -> }`
);

// Fix 7b: expo-modules-core ObjectDefinitionBuilder.kt — add missing singular `Constant(name) { value }`
// DSL function. expo-av@16.x uses Constant("ScaleNone") { ... } but expo-modules-core@2.2.3
// only has the plural Constants() variants. Without this, expo-av:compileDebugKotlin fails
// with "Unresolved reference: Constant".
// old_string spans Constants(vararg) → Function( boundary so that after the first
// patch run the old_string is NO LONGER present (Constant is now between them),
// making the second PREBUILD run see "Already patched" instead of double-inserting.
patch(
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/kotlin/objects/ObjectDefinitionBuilder.kt',
  'expo-modules-core: add singular Constant(name, body) DSL used by expo-av@16.x',
  `  fun Constants(vararg constants: Pair<String, Any?>) {
    constantsProvider = { constants.toMap() }
  }

  fun Function(
    name: String
  ) = FunctionBuilder(name).also { syncFunctionBuilder[name] = it }`,
  `  fun Constants(vararg constants: Pair<String, Any?>) {
    constantsProvider = { constants.toMap() }
  }

  @Suppress("FunctionName")
  fun Constant(name: String, body: () -> Any?) {
    val prev = constantsProvider
    constantsProvider = { prev() + mapOf(name to body()) }
  }

  fun Function(
    name: String
  ) = FunctionBuilder(name).also { syncFunctionBuilder[name] = it }`
);

// Fix 8: expo-updates createUpdatesResources.js — make createManifestForBuildAsync a lazy
// require so it only loads (and requires expo/config/paths) when mode === 'all'.
// Development builds use mode 'only-fingerprint', so this module is never needed, but
// its top-level require("expo/config/paths") crashes because expo@52 has no such export.
patch(
  'node_modules/expo-updates/utils/build/createUpdatesResources.js',
  'expo-updates: lazy-require createManifestForBuildAsync to avoid expo/config/paths load on only-fingerprint builds',
  `const createManifestForBuildAsync_1 = require("./createManifestForBuildAsync");
const findUpProjectRoot_1 = require("./findUpProjectRoot");`,
  `const findUpProjectRoot_1 = require("./findUpProjectRoot");`
);
patch(
  'node_modules/expo-updates/utils/build/createUpdatesResources.js',
  'expo-updates: inline createManifestForBuildAsync lazy require at call site',
  `            ? (0, createManifestForBuildAsync_1.createManifestForBuildAsync)(platform, possibleProjectRoot, destinationDir, entryFileArg)`,
  `            ? (0, require("./createManifestForBuildAsync").createManifestForBuildAsync)(platform, possibleProjectRoot, destinationDir, entryFileArg)`
);

// Fix 8b: expo-modules-core PersistentFileLog.kt — add secondary File constructor.
// expo-updates 0.29.x constructs PersistentFileLog(category, filesDirectory: File) but
// expo-modules-core 2.2.3 changed the constructor to (category, context: Context).
// Refactor to a no-arg primary constructor + two secondary constructors.
patch(
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/core/logging/PersistentFileLog.kt',
  'expo-modules-core PersistentFileLog: add File import',
  `import android.content.Context\n`,
  `import android.content.Context\nimport java.io.File\n`
);
patch(
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/core/logging/PersistentFileLog.kt',
  'expo-modules-core PersistentFileLog: refactor to support File constructor (expo-updates compat)',
  `class PersistentFileLog(\n  category: String,\n  context: Context\n) {\n`,
  `class PersistentFileLog {\n  constructor(category: String, context: Context) {\n    filePath = "\${context.filesDir.path}/${'$'}{FILE_NAME_PREFIX}.\${category}"\n  }\n  // Compat: expo-updates 0.29.x passes File instead of Context\n  constructor(category: String, filesDirectory: File) {\n    filePath = "\${filesDirectory.path}/${'$'}{FILE_NAME_PREFIX}.\${category}"\n  }\n`
);
patch(
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/core/logging/PersistentFileLog.kt',
  'expo-modules-core PersistentFileLog: change filePath val to property initialized in constructors',
  `  private val filePath = "\${context.filesDir.path}/$FILE_NAME_PREFIX.$category"\n`,
  `  private val filePath: String\n`
);

// Fix 8c: expo-modules-core PersistentFileLogHandler.kt — add File constructor.
// Must add File import AND rewrite class: Kotlin requires ': super()' in each secondary constructor
// when there is no primary constructor; the class header must say ': LogHandler' (no '()').
patch(
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/core/logging/PersistentFileLogHandler.kt',
  'expo-modules-core PersistentFileLogHandler: add File import',
  `import android.content.Context\n`,
  `import android.content.Context\nimport java.io.File\n`
);
patch(
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/core/logging/PersistentFileLogHandler.kt',
  'expo-modules-core PersistentFileLogHandler: rewrite to support File constructor (expo-updates compat)',
  `internal class PersistentFileLogHandler(\n  category: String,\n  context: Context\n) : LogHandler() {\n\n  private val persistentFileLog = PersistentFileLog(category, context)\n\n  override fun log(type: LogType, message: String, cause: Throwable?) {\n    persistentFileLog.appendEntry(message)\n    cause?.let {\n      persistentFileLog.appendEntry("\${cause.localizedMessageWithCauseLocalizedMessage()}\\n\${cause.stackTraceToString()}")\n    }\n  }\n}`,
  `internal class PersistentFileLogHandler : LogHandler {\n  private val persistentFileLog: PersistentFileLog\n  constructor(category: String, context: Context) : super() { persistentFileLog = PersistentFileLog(category, context) }\n  constructor(category: String, filesDirectory: File) : super() { persistentFileLog = PersistentFileLog(category, filesDirectory) } // compat for expo-updates 0.29.x\n\n  override fun log(type: LogType, message: String, cause: Throwable?) {\n    persistentFileLog.appendEntry(message)\n    cause?.let {\n      persistentFileLog.appendEntry("\${cause.localizedMessageWithCauseLocalizedMessage()}\\n\${cause.stackTraceToString()}")\n    }\n  }\n}`
);

// Fix 8d: expo-modules-core LogHandlers.kt — add createPersistentFileLogHandler(File, String) overload.
// expo-updates 0.29.x calls LogHandlers.createPersistentFileLogHandler(filesDirectory, category)
// but expo-modules-core 2.2.3 API is createPersistentFileLogHandler(context: Context, category).
patch(
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/core/logging/LogHandlers.kt',
  'expo-modules-core LogHandlers: add File import',
  `import android.content.Context\n`,
  `import android.content.Context\nimport java.io.File\n`
);
patch(
  'node_modules/expo-modules-core/android/src/main/java/expo/modules/core/logging/LogHandlers.kt',
  'expo-modules-core LogHandlers: add createPersistentFileLogHandler(File, String) overload for expo-updates compat',
  `  fun createPersistentFileLogHandler(context: Context, category: String): LogHandler = PersistentFileLogHandler(\n    category,\n    context\n  )\n}`,
  `  fun createPersistentFileLogHandler(context: Context, category: String): LogHandler = PersistentFileLogHandler(\n    category,\n    context\n  )\n  // Compat overload for expo-updates 0.29.x which calls (filesDirectory: File, category: String)\n  fun createPersistentFileLogHandler(filesDirectory: File, category: String): LogHandler = PersistentFileLogHandler(\n    category,\n    filesDirectory\n  )\n}`
);

// Fix 8e: expo-dev-launcher NonFinalBridgeDevSupportManager.kt (Bridge / legacy arch variant).
// Using createShim (full-file replacement) because multiple find/replace patches were fragile:
//   - @LegacyArchitecture annotation patch: replace='open class NonFinalBridgeDevSupportManager'
//     already present in original file, causing false "already patched" skip.
//   - com.facebook.react.common.annotations.internal.* does not exist in RN 0.76.
//   - uniqueTag val→getUniqueTag() fun (Kotlin 2.2.0 + Java abstract method).
//   - loadSplitBundleFromServer no-op (abstract in DevSupportManager interface RN 0.76).
//   - devSettings is DeveloperSettings? in RN 0.76 — needs null-safe access.
createShim(
  'node_modules/expo-dev-launcher/android/src/debug/java/com/facebook/react/devsupport/NonFinalBridgeDevSupportManager.kt',
  'expo-dev-launcher NonFinalBridgeDevSupportManager: full replacement (RN 0.76 + Kotlin 2.2.0 compat)',
  `/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

package com.facebook.react.devsupport

import android.content.Context
import com.facebook.infer.annotation.Assertions
import com.facebook.react.bridge.ReactMarker
import com.facebook.react.bridge.ReactMarkerConstants
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.common.SurfaceDelegateFactory
import com.facebook.react.devsupport.interfaces.DevBundleDownloadListener
import com.facebook.react.devsupport.interfaces.DevLoadingViewManager
import com.facebook.react.devsupport.interfaces.PausedInDebuggerOverlayManager
import com.facebook.react.devsupport.interfaces.DevSplitBundleCallback
import com.facebook.react.devsupport.interfaces.RedBoxHandler
import com.facebook.react.packagerconnection.RequestHandler

//
// Expo: This is a copy of react-native's {@link com.facebook.react.devsupport.BridgeDevSupportManager}
// just removing the "final" modifier that we can inherit and reuse.
// From time to time for react-native upgrade, just follow the steps to update the code
//   1. Copy the contents from BridgeDevSupportManager to this file.
//   2. Rename the class to NonFinalBridgeDevSupportManager.
//   3. Change the "public" modifier to "open".
//   4. Remove invalid imports and the use of the keyword printer (search this file) todo: Fix these imports
//   5. Revert the comment
//

/**
 * Interface for accessing and interacting with development features. Following features are
 * supported through this manager class:
 * 1) Displaying JS errors (aka RedBox)
 * 2) Displaying developers menu (Reload JS, Debug JS)
 * 3) Communication with developer server in order to download updated JS bundle
 * 4) Starting/stopping broadcast receiver for js reload signals
 * 5) Starting/stopping motion sensor listener that recognize shake gestures which in turn may
 *    trigger developers menu.
 * 6) Launching developers settings view
 *
 * This class automatically monitors the state of registered views and activities to which they are
 * bound to make sure that we don't display overlay or that we we don't listen for sensor events
 * when app is backgrounded.
 *
 * [com.facebook.react.ReactInstanceManager] implementation is responsible for instantiating this
 * class as well as for populating with a reference to [com.facebook.react.bridge.CatalystInstance]
 * whenever instance manager recreates it (through [onNewReactContextCreated]). Also, instance
 * manager is responsible for enabling/disabling dev support in case when app is backgrounded or
 * when all the views has been detached from the instance (through \`setDevSupportEnabled\` method).
 */
@Suppress("ACCIDENTAL_OVERRIDE")
open class NonFinalBridgeDevSupportManager(
  applicationContext: Context,
  reactInstanceManagerHelper: ReactInstanceDevHelper,
  packagerPathForJSBundleName: String?,
  enableOnCreate: Boolean,
  redBoxHandler: RedBoxHandler?,
  devBundleDownloadListener: DevBundleDownloadListener?,
  minNumShakes: Int,
  customPackagerCommandHandlers: Map<String, RequestHandler>?,
  surfaceDelegateFactory: SurfaceDelegateFactory?,
  devLoadingViewManager: DevLoadingViewManager?,
  pausedInDebuggerOverlayManager: PausedInDebuggerOverlayManager?
) :
  DevSupportManagerBase(
    applicationContext,
    reactInstanceManagerHelper,
    packagerPathForJSBundleName,
    enableOnCreate,
    redBoxHandler,
    devBundleDownloadListener,
    minNumShakes,
    customPackagerCommandHandlers,
    surfaceDelegateFactory,
    devLoadingViewManager,
    pausedInDebuggerOverlayManager
  ) {

  override fun getUniqueTag(): String = "Bridge" // RN 0.76: Java abstract method, must use fun override

  // Kotlin 2.2.0 K2: resolve "Inherited platform declarations clash" for getJSBundleURLForRemoteDebugging.
  // DevSupportManagerBase (Java) and DevSupportManager (Java interface) both declare this method,
  // causing a JVM signature clash. Explicit override selects the base-class implementation.
  override fun getJSBundleURLForRemoteDebugging(): String? = super.getJSBundleURLForRemoteDebugging()

  override fun loadSplitBundleFromServer(bundlePath: String, callback: DevSplitBundleCallback): Unit {} // RN 0.76 interface requirement

  override fun handleReloadJS() {
    UiThreadUtil.assertOnUiThread()
    ReactMarker.logMarker(
      ReactMarkerConstants.RELOAD,
      devSettings?.packagerConnectionSettings?.debugServerHost
    )

    // dismiss redbox if exists
    hideRedboxDialog()

    val bundleURL = devServerHelper.getDevServerBundleURL(Assertions.assertNotNull(jsAppBundleName))
    reloadJSFromServer(bundleURL) {
      UiThreadUtil.runOnUiThread { reactInstanceDevHelper.onJSBundleLoadedFromServer() }
    }
  }

  // companion object removed — LegacyArchitecture/assertLegacyArchitecture not in RN 0.76
}
`
);

// Fix 8f: expo-updates Kotlin API mismatches.
// OptimizedRecord does not exist in expo-modules-core 2.2.3.
// onDidCreateReactHost overrides nothing in ReactNativeHostHandler 2.2.3.
// getDelayLoadAppHandler in ReactActivityHandler 2.2.3 takes ReactNativeHost, not ReactHost.
patch(
  'node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesModule.kt',
  'expo-updates UpdatesModule: remove OptimizedRecord import',
  `import expo.modules.kotlin.types.OptimizedRecord\n`,
  ``
);
patch(
  'node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesModule.kt',
  'expo-updates UpdatesModule: remove @OptimizedRecord annotation',
  `  @OptimizedRecord\n`,
  ``
);
patch(
  'node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesPackage.kt',
  'expo-updates UpdatesPackage: remove override from onDidCreateReactHost (not in ReactNativeHostHandler 2.2.3)',
  `      override fun onDidCreateReactHost(context: Context, reactNativeHost: ReactHost) {`,
  `      fun onDidCreateReactHost(context: Context, reactNativeHost: ReactHost) { // override removed — not in ReactNativeHostHandler 2.2.3`
);
patch(
  'node_modules/expo-updates/android/src/main/java/expo/modules/updates/UpdatesPackage.kt',
  'expo-updates UpdatesPackage: remove override from getDelayLoadAppHandler (ReactActivityHandler 2.2.3 takes ReactNativeHost, not ReactHost)',
  `      override fun getDelayLoadAppHandler(activity: ReactActivity, reactHost: ReactHost): ReactActivityHandler.DelayLoadAppHandler? {`,
  `      fun getDelayLoadAppHandler(activity: ReactActivity, reactHost: ReactHost): ReactActivityHandler.DelayLoadAppHandler? { // override removed — takes ReactNativeHost in 2.2.3`
);
patch(
  'node_modules/expo-updates/android/src/main/java/expo/modules/updates/reloadscreen/ReloadScreenConfiguration.kt',
  'expo-updates ReloadScreenConfiguration: remove OptimizedRecord import',
  `import expo.modules.kotlin.types.OptimizedRecord\n`,
  ``
);
// ReloadScreenConfiguration has 3 @OptimizedRecord annotations — each patch() call removes one
patch(
  'node_modules/expo-updates/android/src/main/java/expo/modules/updates/reloadscreen/ReloadScreenConfiguration.kt',
  'expo-updates ReloadScreenConfiguration: remove @OptimizedRecord annotation (occurrence 1)',
  `@OptimizedRecord\n`,
  ``
);
patch(
  'node_modules/expo-updates/android/src/main/java/expo/modules/updates/reloadscreen/ReloadScreenConfiguration.kt',
  'expo-updates ReloadScreenConfiguration: remove @OptimizedRecord annotation (occurrence 2)',
  `@OptimizedRecord\n`,
  ``
);
patch(
  'node_modules/expo-updates/android/src/main/java/expo/modules/updates/reloadscreen/ReloadScreenConfiguration.kt',
  'expo-updates ReloadScreenConfiguration: remove @OptimizedRecord annotation (occurrence 3)',
  `@OptimizedRecord\n`,
  ``
);

// Fix 7: dynamic patch for all remaining modules using new-style `id 'expo-module-gradle-plugin'`
// (expo-dev-client, expo-dev-menu-interface, expo-eas-client, expo-json-utils,
//  expo-manifests, expo-structured-headers, expo-updates-interface, etc.)
const SIMPLE_PLUGIN_BLOCK = `plugins {
  id 'com.android.library'
  id 'expo-module-gradle-plugin'
}`;

const SIMPLE_REPLACEMENT = `apply plugin: 'com.android.library'

def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useDefaultAndroidSdkVersions()
useCoreDependencies()

def expoModule = { Object... args -> }`;

const SKIPPED = new Set(['expo-av', 'expo-modules-core', 'expo-dev-launcher', 'expo-dev-menu', 'expo-updates']);

const allPkgs = [];
for (const d of fs.readdirSync(nodeModulesDir)) {
  if (d.startsWith('@')) {
    try {
      for (const sd of fs.readdirSync(path.join(nodeModulesDir, d))) {
        allPkgs.push(d + '/' + sd);
      }
    } catch (_) {}
  } else {
    allPkgs.push(d);
  }
}

for (const pkg of allPkgs) {
  if (SKIPPED.has(pkg)) continue;
  const buildGradle = path.join(nodeModulesDir, pkg, 'android', 'build.gradle');
  if (!fs.existsSync(buildGradle)) continue;
  const content = fs.readFileSync(buildGradle, 'utf8');
  if (!content.includes("id 'expo-module-gradle-plugin'")) continue;
  if (content.includes(SIMPLE_PLUGIN_BLOCK)) {
    const patched = content.replace(SIMPLE_PLUGIN_BLOCK, SIMPLE_REPLACEMENT);
    fs.writeFileSync(buildGradle, patched, 'utf8');
    console.log(`[patch-gradle] Patched: ${pkg} - replaced expo-module-gradle-plugin`);
  } else {
    console.log(`[patch-gradle] WARNING: ${pkg} has expo-module-gradle-plugin but unexpected format`);
  }
}

// ─── iOS Swift patches ────────────────────────────────────────────────────────
// react-native-bottom-tabs uses `TabViewBottomAccessoryPlacement` (a SwiftUI type
// introduced in iOS 26) inside `@available(iOS 26.0, *)` guards, but the Swift
// compiler still resolves parameter types at compile time against the iOS 18.x
// SDK used by the EAS iOS builder — causing "cannot find type in scope" /
// "generic parameter could not be inferred" / "cannot infer key path type" errors.
// Fix: remove the iOS-26-only method + struct so they don't reference the absent type.

// iOS Fix 1 — BottomAccessoryProvider.swift: remove emitPlacementChanged that
// references TabViewBottomAccessoryPlacement? (iOS 26 type absent from iOS 18 SDK)
patch(
  'node_modules/react-native-bottom-tabs/ios/BottomAccessoryProvider.swift',
  'react-native-bottom-tabs BottomAccessoryProvider: remove iOS-26-only emitPlacementChanged (TabViewBottomAccessoryPlacement not in iOS 18 SDK)',
  `  #if !os(macOS)
  @available(iOS 26.0, tvOS 26.0, *)
  public func emitPlacementChanged(_ placement: TabViewBottomAccessoryPlacement?) {
    var placementValue = "none"
    if placement == .inline {
      placementValue = "inline"
    } else if placement == .expanded {
      placementValue = "expanded"
    }
    self.delegate?.onPlacementChanged(placement: placementValue)
  }
  #endif`,
  ``
);

// iOS Fix 2 — NewTabView.swift: remove BottomAccessoryRepresentableView struct that
// uses @Environment(\\.tabViewBottomAccessoryPlacement) — an iOS 26 environment key
// whose KeyPath can't be inferred when building with iOS 18 SDK.
patch(
  'node_modules/react-native-bottom-tabs/ios/TabView/NewTabView.swift',
  'react-native-bottom-tabs NewTabView: remove BottomAccessoryRepresentableView struct (iOS 26 @Environment key not in iOS 18 SDK)',
  `#if !os(macOS) && !os(tvOS)
@available(iOS 26.0, tvOS 26.0, *)
struct BottomAccessoryRepresentableView: PlatformViewRepresentable {
  @Environment(\\.tabViewBottomAccessoryPlacement) var tabViewBottomAccessoryPlacement
  var view: PlatformView

  func makeUIView(context: Context) -> PlatformView {
    let wrapper = UIView()
    wrapper.addSubview(view)

    view.autoresizingMask = [.flexibleWidth, .flexibleHeight]

    emitPlacementChanged(for: view)
    return wrapper
  }

  func updateUIView(_ uiView: PlatformView, context: Context) {
    if let subview = uiView.subviews.first {
      subview.frame = uiView.bounds
    }
    emitPlacementChanged(for: view)
  }

  private func emitPlacementChanged(for uiView: PlatformView) {
    if let contentView = uiView.value(forKey: "bottomAccessoryProvider") as? BottomAccessoryProvider {
      contentView.emitPlacementChanged(tabViewBottomAccessoryPlacement)
    }
  }
}
#endif`,
  ``
);

// iOS Fix 3 — NewTabView.swift: stub renderBottomAccessoryView() to return EmptyView
// now that BottomAccessoryRepresentableView has been removed.
patch(
  'node_modules/react-native-bottom-tabs/ios/TabView/NewTabView.swift',
  'react-native-bottom-tabs NewTabView: stub renderBottomAccessoryView() → EmptyView after removing iOS-26 struct',
  `  @ViewBuilder
  private func renderBottomAccessoryView() -> some View {
    #if !os(macOS) && !os(tvOS)
    if let bottomAccessoryView {
      if #available(iOS 26.0, *) {
        BottomAccessoryRepresentableView(view: bottomAccessoryView)
      }
    }
    #endif
  }`,
  `  @ViewBuilder
  private func renderBottomAccessoryView() -> some View {
    EmptyView()
  }`
);

// iOS Fix 5 — expo-modules-core ObjectFactories.swift: add singular Constant(name, body)
// DSL function used by expo-av@16.x VideoViewModule.swift. expo-modules-core@2.2.3 only
// ships Constants(dict) — the singular Constant(name){value} form is absent, causing a
// Swift "cannot find 'Constant' in scope" compile error on iOS.
patch(
  'node_modules/expo-modules-core/ios/Api/Factories/ObjectFactories.swift',
  'expo-modules-core iOS ObjectFactories: add singular Constant(name, body) DSL (expo-av@16.x compat)',
  `// MARK: - Events`,
  `// MARK: - Constant (singular — for expo-av@16.x compatibility)

/**
 Definition function exporting a single named constant to JavaScript.
 Wraps the value into a ConstantsDefinition dictionary keyed by \`name\`.
 This singular form was introduced in a later version of expo-modules-core;
 this shim makes expo-av@16.x compile against expo-modules-core@2.2.3.
 */
public func Constant<T>(_ name: String, @_implicitSelfCapture body: @escaping () -> T) -> AnyDefinition {
  return ConstantsDefinition(body: { [name: body()] })
}

// MARK: - Events`
);

// iOS Fix 4 — NewTabView.swift: ConditionalBottomAccessoryModifier.body uses
// .tabViewBottomAccessory{} — an iOS 26 ViewModifier that doesn't exist in iOS 18
// SDK. Even inside `if #available(iOS 26.0, *)`, Swift 6 on iOS 18.2 SDK still
// cannot resolve the member. Replace the whole body with `content` pass-through.
patch(
  'node_modules/react-native-bottom-tabs/ios/TabView/NewTabView.swift',
  'react-native-bottom-tabs NewTabView: remove .tabViewBottomAccessory call (iOS 26 modifier absent from iOS 18 SDK)',
  `  func body(content: Content) -> some View {
    #if os(macOS) || os(tvOS)
    // tabViewBottomAccessory is not available on macOS
    content
    #else
    if #available(iOS 26.0, visionOS 3.0, *), bottomAccessoryView != nil {
      content
        .tabViewBottomAccessory {
          renderBottomAccessoryView()
        }
    } else {
      content
    }
    #endif
  }`,
  `  func body(content: Content) -> some View {
    content
  }`
);
