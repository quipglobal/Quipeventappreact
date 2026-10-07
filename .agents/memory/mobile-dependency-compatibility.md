---
name: Mobile dependency compatibility
description: Why security updates retain the current Expo SDK and use one npm dependency tree.
---

Use npm as the mobile app's only package manager; do not reintroduce a second
lockfile without deliberately changing the local and cloud install process.

**Why:** EAS selects Yarn when a yarn.lock exists, ignoring npm overrides.
Previously the two trees diverged, preserving vulnerable dependencies in
cloud builds even when npm was patched.

**How to apply:** Update the npm manifest and lockfile together. Security
remediation should retain the existing native SDK unless a migration is
explicitly requested. Where safe dependency releases change module exports
or accepted inputs, test both the bundler and the CLI consumers. Ensure any
required compatibility adaptation also runs after EAS dependency installation:
the existing cloud profiles disable npm install scripts.

Mobile lockfiles must not persist local registry download URLs.

**Why:** npm also records Replit-only package-firewall hostnames, which EAS
workers cannot resolve; this problem is not limited to Yarn.

**How to apply:** Keep npm's omit-lockfile-registry-resolved setting enabled.
It preserves exact versions and integrity hashes, but lets each environment
use its own registry. Do not bypass the local firewall to generate a lockfile.

For the unpatched upstream braces nesting advisory, retain brace semantics
across all mobile consumers rather than assuming removal of a proxy package
eliminates the dependency. Use an exact, source-inspected depth-guard backport
until upstream offers a safe replacement.

**Why:** Metro watchers, Expo asset globs, and React Native tooling share this
dependency independently of the app's proxy. An audit does not establish a
fork's safety just because the fork has a different package name.

**How to apply:** Require ordinary-pattern compatibility checks and explicit
deep-pattern/AST rejection checks before changing the backport; distinguish
upstream releases from third-party mitigations in security reporting.
