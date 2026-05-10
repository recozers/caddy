# CaddyApp (iOS)

Native iOS app that pairs with your Oakley Meta Vanguard, captures a frame from the glasses' camera over the Meta Wearables Device Access Toolkit, and POSTs it to the `/api/caddy` backend for caddy advice. The reply is read back via `AVSpeechSynthesizer` — audio routes to the glasses speakers automatically when they're the active BT output device.

## Requirements

- macOS with Xcode 15+
- iPhone running iOS 15.2+ paired to your Oakley Meta Vanguard (firmware V22+)
- Meta AI app v254+ on the iPhone, with Developer Mode enabled (Settings → App Info → tap version 5x)
- The Next.js backend in this repo running and reachable over HTTPS (use `cloudflared tunnel --url http://localhost:3000` for dev)
- A Wearables Developer Center account to register your app and obtain an `APPLICATION_ID` (free)

## Set up the Xcode project

1. **New project** in Xcode → iOS → App → product name `CaddyApp`, Interface: SwiftUI, Language: Swift.
2. Delete the default `ContentView.swift` and `CaddyAppApp.swift`. Drag the `.swift` files from this directory into the project (check "Copy items if needed").
3. **Add the SDK package**: File → Add Package Dependencies → paste `https://github.com/facebook/meta-wearables-dat-ios` → Dependency Rule: Up to Next Major, `0.6.0`.
4. **Info.plist**: open the target's Info tab and merge in the keys from `Info.plist.snippet` (BT description, mic description, custom URL scheme).
5. **Edit `CaddyClient.swift`**: change `baseURL` to your tunnel/deployed backend URL.
6. **Bundle ID + signing**: set a unique bundle ID and your personal Apple Developer team. (Free tier works for sideloading to your own phone.)

## Register the app with Meta

1. Go to the [Wearables Developer Center](https://wearables.developer.meta.com/) and create an organization + project.
2. Note your `APPLICATION_ID`. The SDK will pick this up automatically when developer mode is on, but for release builds add it to your Info.plist as `MWDAT.APPLICATION_ID`.
3. The first time you tap **Pair with Meta AI app** in the app, it deeplinks into Meta AI — confirm there, and the glasses appear in the SDK's `devicesStream`.

## Run

1. Plug your iPhone into the Mac, build and run the app on the device (Xcode → ⌘R).
2. Tap **Pair with Meta AI app** → confirm in Meta AI.
3. Tap **Start camera stream** → grant camera permission via Meta AI.
4. Set your shot/conditions, tap **Ask caddy** — frame goes to the backend, caddy advice comes back, glasses speak it.

## Files

- `CaddyAppApp.swift` — App entry, configures the SDK, handles registration callback URL.
- `WearablesController.swift` — Owns the SDK session, stream lifecycle, and photo capture.
- `CaddyClient.swift` — POSTs JPEG + conditions to `/api/caddy`, speaks the reply.
- `ContentView.swift` — SwiftUI form for conditions + the "Ask caddy" button.
- `Info.plist.snippet` — required Info.plist keys.

## Known caveats

- The SDK is in developer preview. You can sideload to your own phone freely; App Store publishing is gated to approved partners until later in 2026.
- Bluetooth Classic is the bottleneck — even at `low` resolution, capture takes ~1–2s. Don't expect 60fps live preview.
- If `devicesStream` stays empty after registration, you haven't granted at least one permission yet — call `requestPermission(.camera)` (the Pair button does this).
