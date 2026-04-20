#!/bin/zsh
set -e

# --- Config ---
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BOT_DIR="$ROOT_DIR/bot-demo"
PROMO_FILE="$ROOT_DIR/src/components/BotDemoPromo/BotDemoPromo.js"
export PATH="$HOME/bin:$PATH"

# --- Determine version ---
if [[ -n "$1" ]]; then
  NEW_VERSION="$1"
else
  CURRENT=$(grep '"version"' "$BOT_DIR/package.json" | head -1 | sed 's/.*"\([0-9]*\.[0-9]*\.[0-9]*\)".*/\1/')
  MAJOR=$(echo "$CURRENT" | cut -d. -f1)
  MINOR=$(echo "$CURRENT" | cut -d. -f2)
  PATCH=$(echo "$CURRENT" | cut -d. -f3)
  NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
  echo "Current version: $CURRENT"
  echo -n "New version [$NEW_VERSION]: "
  read USER_VERSION
  [[ -n "$USER_VERSION" ]] && NEW_VERSION="$USER_VERSION"
fi

echo ""
echo "==> Releasing v$NEW_VERSION"
echo ""

# --- 1. Bump version in both files ---
echo "📝 Bumping version to $NEW_VERSION..."
sed -i '' "s/\"version\": \"[0-9]*\.[0-9]*\.[0-9]*\"/\"version\": \"$NEW_VERSION\"/" "$BOT_DIR/package.json"
sed -i '' "s/const APP_VERSION = \"[0-9]*\.[0-9]*\.[0-9]*\"/const APP_VERSION = \"$NEW_VERSION\"/" "$PROMO_FILE"
echo "   ✓ bot-demo/package.json"
echo "   ✓ BotDemoPromo.js"

# --- 2. Build bot-demo (web output) ---
echo ""
echo "🔨 Building bot-demo (web)..."
cd "$BOT_DIR"
npx tsc --noEmit
npx vite build
echo "   ✓ Web build complete"

# --- 3. Build Electron installers ---
echo ""
echo "📦 Building Mac installer..."
npm run electron:build
echo "   ✓ Mac DMG built"

echo ""
echo "📦 Building Windows installer..."
npx electron-builder --win --x64
echo "   ✓ Windows EXE built"

MAC_DMG="$BOT_DIR/release/Scape-${NEW_VERSION}-mac.dmg"
WIN_EXE="$BOT_DIR/release/Scape-Setup-${NEW_VERSION}-win.exe"

if [[ ! -f "$MAC_DMG" ]]; then
  echo "❌ Mac DMG not found at $MAC_DMG"
  exit 1
fi
if [[ ! -f "$WIN_EXE" ]]; then
  echo "❌ Windows EXE not found at $WIN_EXE"
  exit 1
fi

echo "   Mac: $(du -h "$MAC_DMG" | cut -f1 | xargs)"
echo "   Win: $(du -h "$WIN_EXE" | cut -f1 | xargs)"

# --- 4. Build React website ---
echo ""
echo "🌐 Building React website..."
cd "$ROOT_DIR"
npm run build
cp -r public/bot-demo build/
echo "   ✓ Website build complete"

# --- 5. Git commit + push ---
echo ""
echo "📤 Committing and pushing..."
cd "$ROOT_DIR"
git add -A
git commit -m "v${NEW_VERSION}: release" || echo "   (nothing to commit)"
git push origin electron
echo "   ✓ Pushed to GitHub"

# --- 6. Create GitHub Release ---
echo ""
echo "🏷️  Creating GitHub Release v${NEW_VERSION}..."
gh release create "v${NEW_VERSION}" \
  "$MAC_DMG" \
  "$WIN_EXE" \
  --target electron \
  --title "Scape v${NEW_VERSION}" \
  --notes "Scape v${NEW_VERSION} release

Download:
- **Mac**: Scape-${NEW_VERSION}-mac.dmg
- **Windows**: Scape-Setup-${NEW_VERSION}-win.exe"
echo "   ✓ Release created"

# --- 7. Deploy to Firebase ---
echo ""
echo "🔥 Deploying to Firebase..."
cd "$ROOT_DIR"
npx firebase deploy --only hosting
echo "   ✓ Firebase deployed"

echo ""
echo "✅ Release v${NEW_VERSION} complete!"
echo "   GitHub: https://github.com/skyylersiejko/scape_simple/releases/tag/v${NEW_VERSION}"
echo "   Web:    https://scape-fc6ca.web.app"
