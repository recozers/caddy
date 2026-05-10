# Connecting to Meta glasses

Native iOS app via the Meta Wearables Device Access Toolkit. Apps don't run on the glasses themselves — they run on a paired iPhone, and the SDK exposes the glasses' camera (photo + 720p/30fps stream) and audio over Bluetooth. Audio output routes to the glasses' speakers automatically when they're the active BT output device, so `AVSpeechSynthesizer` "just works" for spoken caddy advice.

The full iOS source is in [`../ios/CaddyApp/`](../ios/CaddyApp/).

## Hardware support — May 2026

From Meta's [version-dependencies page](https://wearables.developer.meta.com/docs/version-dependencies/), SDK v0.6.0 supports:

| Glasses | Required firmware |
| --- | --- |
| Ray-Ban Meta (Gen 1, Gen 2) | V20 |
| Ray-Ban Meta Optics | V20 |
| Meta Ray-Ban Display | V21 |
| **Oakley Meta HSTN** | **V22** |
| **Oakley Meta Vanguard** | **V22** |

Confusingly, Meta's prose "hardware requirements" page hasn't been updated and still lists only the Ray-Ban variants — the version-dependencies table is the source of truth.

Required Meta AI app version: **v254+** (Android) / equivalent on iOS.

## Flow

1. App registers with the Wearables Developer Center (one-time deeplink to Meta AI app).
2. User grants camera permission via Meta AI.
3. App opens a `Session` against an `AutoDeviceSelector`.
4. App opens a `StreamSession`, low-res 24 fps.
5. User taps "Ask caddy". App captures a JPEG via `capturePhoto(format: .jpeg)`, POSTs it + form conditions to `/api/caddy` on this backend.
6. App speaks the response with `AVSpeechSynthesizer` — audio routes to glasses speakers.

## v0.6.0 API quick reference

```swift
// One-time configure
try Wearables.configure()

// Pairing (deeplinks to Meta AI app)
try Wearables.shared.startRegistration()
// In your AppDelegate / SceneDelegate URL handler:
_ = try await Wearables.shared.handleUrl(url)

// Permissions
let status = try await Wearables.shared.requestPermission(.camera)

// Open device session
let selector = AutoDeviceSelector(wearables: Wearables.shared)
let session  = try Wearables.shared.createSession(deviceSelector: selector)
try session.start()

// Open camera stream
let config = StreamSessionConfig(
  videoCodec: .raw,
  resolution: .low,        // .low | .medium | .high
  frameRate: 24            // 2, 7, 15, 24, or 30
)
let stream = try session.addStream(config: config)
_ = stream.videoFramePublisher.listen { frame in /* frame.makeUIImage() */ }
Task { await stream.start() }

// Capture and receive a photo
_ = stream.photoDataPublisher.listen { photoData in
  let jpeg: Data = photoData.data
  // POST jpeg to https://<your-host>/api/caddy with the conditions JSON
}
stream.capturePhoto(format: .jpeg)
```

## Resolution / framerate

Bluetooth Classic bandwidth is the bottleneck. Valid `frameRate`: 2, 7, 15, 24, 30. `resolution`: `low` (360×640), `medium` (504×896), `high` (720×1280). The SDK auto-degrades quality if BT is congested. Low + 24 fps is plenty for stills.

## Publishing constraints

The SDK is in **developer preview**. You can sideload to your own glasses and share with org testers freely. Public publishing to the App Store requires being an approved partner (Twitch, Microsoft, Disney, Logitech Streamlabs, L+R, Pixel and Texel today). Meta has said general availability for publishing comes later in 2026.

Practically: for personal use of the caddy app on your own Vanguards, you don't need approval — just sideload via Xcode.

## Mock Device Kit

Test the whole flow from your Mac without putting the glasses on. As of v0.6.0, `MockCameraKit.setCameraFeed(.front)` lets the simulator use your laptop camera as the "glasses" feed. Useful for prompt iteration.

## Sidecar data sources to layer in

- **Garmin Golf** — Vanguard already integrates with Garmin watches. Garmin Connect IQ + Health API exposes shot tracking, distance to pin, and hole layout server-side. Replaces the part where the player has to say the distance aloud.
- **Weather** — OpenWeatherMap or Tomorrow.io by GPS at the moment of the photo. Replaces wind/temp self-reporting.
- **Course data** — GolfBert / USGA-style APIs for green shape, hazard polygons, doglegs.

Drop these onto `CaddyInput.conditions` in `app/lib/caddy.ts` — Claude already reads optional fields and ignores what's missing.
