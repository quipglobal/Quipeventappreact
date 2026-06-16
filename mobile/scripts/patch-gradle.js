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
//   a) Remove kotlin.plugin.compose classpath (only exists for Kotlin 2.0+, EAS worker uses 1.9.x)
//   b) Replace old-style expo-module-gradle-plugin and kotlin.plugin.compose apply lines
//   c) Add Kotlin 1.9.x Compose config (buildFeatures + composeOptions)
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

// Kotlin 1.9.x Compose compiler config (replaces org.jetbrains.kotlin.plugin.compose)
android {
  buildFeatures {
    compose true
  }
  composeOptions {
    kotlinCompilerExtensionVersion = "1.5.15"
  }
}`
);

// Fix 5: expo-dev-menu — same Kotlin 2.x compose plugin issue as expo-dev-launcher
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
  `apply plugin: 'com.android.library'

def expoModulesCorePlugin = new File(project(":expo-modules-core").projectDir.absolutePath, "ExpoModulesCorePlugin.gradle")
apply from: expoModulesCorePlugin
applyKotlinExpoModulesCorePlugin()
useDefaultAndroidSdkVersions()
useCoreDependencies()

def expoModule = { Object... args -> }

// Kotlin 1.9.x Compose compiler config (replaces org.jetbrains.kotlin.plugin.compose)
android {
  buildFeatures {
    compose true
  }
  composeOptions {
    kotlinCompilerExtensionVersion = "1.5.15"
  }
}`
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
