#!/bin/bash
set -e

echo "Running post-merge setup..."

# Install root dependencies if package.json changed
if [ -f package.json ]; then
  npm install --legacy-peer-deps --no-audit --no-fund
fi

# Install mobile dependencies if mobile/package.json changed
if [ -f mobile/package.json ]; then
  cd mobile && npm install --legacy-peer-deps --no-audit --no-fund && cd ..
fi

echo "Post-merge setup complete."
