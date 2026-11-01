# Mobile Release Plan

Port Veslo (Three.js web game) to Android and macOS native apps.

## Strategy

Do not rewrite natively. The game is already a landscape/fullscreen PWA
(`public/manifest.webmanifest`), so wrap the existing Vite build:

- **Android:** Capacitor (mature WebView + Play Store plugins)
- **macOS:** Tauri (preferred, smaller, WKWebView) or Electron (Chromium consistency)

Tauri v2 can target both, but Android WebView maturity favors Capacitor.

## Shared / Prep

- [ ] Freeze the Vite build as the single source; keep `base: './'` (already set)
- [ ] Verify the game doesn't call the dev-only `/api/debug/*` endpoints in production (`vite.config.js` middleware)
- [ ] Abstract platform bits: input (touch vs keyboard/mouse), fullscreen, orientation, storage, audio
- [ ] Replace/patch `requestFullscreen` (`src/main.js:41`) — Fullscreen API is unreliable in Android WebView and absent on macOS WebViews; use native window/immersive APIs
- [ ] Storage: `localStorage` (`src/main.js:151`, `src/systems/I18n.js:270`) works but can be cleared; migrate high score/lang to Capacitor Preferences or a native store
- [ ] Handle `visibilitychange`, Android back button, WebGL context loss, audio focus/ducking
- [ ] Confirm keyboard controls work for macOS desktop, and cap `devicePixelRatio` for low-end Android
- [ ] Asset licensing check (three.js MIT, `wildlife.mp3/ogg`, rank SVGs) and no external CDN dependencies

## Android (Capacitor)

- [ ] `npx cap add android`; configure min/target SDK, 64-bit, hardware acceleration
- [ ] Lock landscape, immersive fullscreen, keep-screen-on, cutout/safe-area insets
- [ ] Test WebGL/WebAudio on real low-end devices; tune renderer quality
- [ ] Handle back button (pause menu already exists) and background pause
- [ ] Signed AAB + keystore, Play Console listing, icons/screenshots, content rating, privacy policy, target-API deadlines

## macOS (Tauri preferred)

- [ ] Scaffold with Tauri (smaller, WKWebView) or Electron (Chromium consistency)
- [ ] App icon `.icns`, DMG/PKG, universal binary (arm64 + x86_64)
- [ ] Developer ID signing + notarization + hardened runtime/entitlements; Mac App Store sandbox only if needed
- [ ] Native window fullscreen/menu/quit behavior; Retina scaling; verify WebGL in WKWebView (Safari already has fallbacks here)
- [ ] Keyboard/mouse controls, window resize handling

## Release

- [ ] Crash/analytics opt-in, versioning, CI build pipelines
- [ ] Real-device test matrix (Android low/mid/high, Intel + Apple Silicon Macs)
- [ ] Store review assets and update flow (web builds now use a generated service worker; native store builds still ship updates through the store)
