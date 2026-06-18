const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const nodeModulesDir = path.join(root, 'node_modules');

function patch(filePath, description, find, replace) {
  const abs = path.join(root, filePath);
  if (!fs.existsSync(abs)) {
    console.log(`[patch-gradle] SKIP (not found): ${filePath}`);
    return false;
  }
  let content = fs.readFileSync(abs, 'utf8');
  if (content.includes(find)) {
    content = content.replace(find, replace);
    fs.writeFileSync(abs, content, 'utf8');
    console.log(`[patch-gradle] Patched: ${description}`);
    return true;
  }
  console.log(`[patch-gradle] Already patched: ${description}`);
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
