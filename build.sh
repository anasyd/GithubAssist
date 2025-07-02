#!/bin/bash

# Build script for GitHub Merge Conflict Helper
# Creates both debug and production builds

set -e

echo "🔨 Building GitHub Merge Conflict Helper..."

# Get version from manifest.json
VERSION=$(grep '"version"' manifest.json | sed 's/.*"version": *"\([^"]*\)".*/\1/')
echo "📋 Version: $VERSION"

# Clean up previous builds
rm -rf builds
mkdir -p builds/{debug,production}

echo "📁 Creating build directories..."

# Copy files to debug build (excluding unnecessary files)
echo "🐛 Creating debug build..."
rsync -av \
  --exclude='.git' \
  --exclude='builds' \
  --exclude='.github' \
  --exclude='*.md' \
  --exclude='LICENSE' \
  --exclude='build.sh' \
  ./ builds/debug/

# Copy files to production build
echo "🚀 Creating production build..."
rsync -av \
  --exclude='.git' \
  --exclude='builds' \
  --exclude='.github' \
  --exclude='*.md' \
  --exclude='LICENSE' \
  --exclude='build.sh' \
  ./ builds/production/

# Set debug mode for each build
echo "⚙️  Configuring debug modes..."

# Debug build: ensure DEBUG_MODE = true
sed -i.bak 's/const DEBUG_MODE = false;/const DEBUG_MODE = true;/' builds/debug/content.js
rm -f builds/debug/content.js.bak

# Production build: ensure DEBUG_MODE = false
sed -i.bak 's/const DEBUG_MODE = true;/const DEBUG_MODE = false;/' builds/production/content.js
rm -f builds/production/content.js.bak

# Create ZIP files
echo "📦 Creating ZIP files..."

cd builds

# Debug ZIP
cd debug
zip -r "../github-merge-helper-v${VERSION}-debug.zip" . > /dev/null
cd ..

# Production ZIP
cd production
zip -r "../github-merge-helper-v${VERSION}-production.zip" . > /dev/null
cd ..

# Return to root
cd ..

# Verify builds
echo "✅ Verifying builds..."
echo "Debug build:"
grep "const DEBUG_MODE" builds/debug/content.js | head -1

echo "Production build:"
grep "const DEBUG_MODE" builds/production/content.js | head -1

echo "📊 Build summary:"
ls -lh builds/*.zip

echo "✨ Build complete!"
echo ""
echo "📁 Files created:"
echo "  🐛 Debug: builds/github-merge-helper-v${VERSION}-debug.zip"
echo "  🚀 Production: builds/github-merge-helper-v${VERSION}-production.zip"
echo ""
echo "🚀 Upload the production ZIP to Chrome Web Store"
echo "🐛 Use the debug ZIP for development testing"
