# Connecting to Meta glasses

Two routes to get camera + audio off your Meta glasses and into this caddy backend. Pick based on hardware you own and how much native dev you want to do.

## Route A — WhatsApp bridge (works on Vanguards today)

This is what `/api/whatsapp` implements. No native app, no SDK, no Xcode. Uses Meta AI's own voice command on the glasses to send a photo + spoken caption to a WhatsApp number you own; the backend replies with text; the glasses read the reply aloud automatically.

### Flow

1. On the course: `"Hey Meta, send a photo to AI Caddy on WhatsApp. One fifty into the wind, slight uphill, fairway."`
2. Glasses snap a frame, transcribe the spoken caption, and send both as a WhatsApp message to the contact you saved as "AI Caddy".
3. Meta's WhatsApp Cloud API forwards that message to `/api/whatsapp` on this server.
4. Server downloads the image, calls Claude vision with the caption + image, sends a short text reply.
5. Glasses notify; "Hey Meta, read it" (or auto-read if enabled) speaks the advice.

### Setup

1. **Make a WhatsApp Business app**: developers.facebook.com → Create App → Business → add the WhatsApp product. Meta gives you a free test phone number and a permanent access token (use a System User token for production).
2. **Set env vars** (`.env.local`): `WHATSAPP_VERIFY_TOKEN` (any random string), `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`.
3. **Expose the webhook publicly** (cloudflared, ngrok, or deploy to Vercel):
   ```bash
   npm run dev
   cloudflared tunnel --url http://localhost:3000
   ```
4. **Register the webhook** in the WhatsApp product settings: callback URL = `https://<your-tunnel>/api/whatsapp`, verify token = whatever you put in env. Subscribe to the `messages` field.
5. **Add the test number to your phone's contacts** as "AI Caddy" (whatever name you want voiced).
6. From your phone, send a message to that number first (Meta requires the user to initiate). Now you can send freely from the glasses for the next 24h, and each new send re-opens the window.

### Limits

- ~5–15s round trip (one-shot photo, not live).
- Free tier on WhatsApp Cloud API covers personal use easily; check current quotas.
- The glasses don't auto-read every notification by default — enable "Read messages" in the Meta AI app, or say "Hey Meta, read my messages."

## Route B — Native app via Meta Wearables Device Access Toolkit

This is the proper path. Apps don't run on the glasses themselves — they run on a paired iOS/Android phone, and the SDK exposes the glasses' camera (photo + 720p/30fps stream) and audio over Bluetooth.

### Status as of May 2026

- iOS SDK: [github.com/facebook/meta-wearables-dat-ios](https://github.com/facebook/meta-wearables-dat-ios) (Swift Package Manager).
- Android SDK: [github.com/facebook/meta-wearables-dat-android](https://github.com/facebook/meta-wearables-dat-android).
- **Supported hardware**: Ray-Ban Meta (Gen 1, Gen 2), Oakley Meta HSTN.
- **Not yet supported**: Oakley Meta Vanguard, Meta Ray-Ban Display ("coming soon" per Meta).
- **Publishing**: developer preview — you can build, sideload to your own glasses, and share with org testers; public publishing is limited to early partners (Twitch, Microsoft, Disney, Logitech Streamlabs, L+R, Pixel and Texel) until general availability later in 2026.
- **Mock Device Kit** ships with the SDK so you can build and test without hardware.

### Minimum iOS skeleton (Swift)

```swift
// AppDelegate / SceneDelegate
import Wearables

func configureWearables() {
  do { try Wearables.configure() }
  catch { assertionFailure("wearables configure failed: \(error)") }
}

// One-time pair flow
try Wearables.shared.startRegistration()

// Open a session and capture a frame
let selector = AutoDeviceSelector(wearables: Wearables.shared)
let session = try Wearables.shared.createSession(deviceSelector: selector)
try session.start()

let config = StreamSessionConfig(
  videoCodec: .raw,
  resolution: .low,
  frameRate: 24
)
guard let stream = try? session.addStream(config: config) else { return }

_ = session.photoDataPublisher.listen { photoData in
  let jpeg = photoData.data
  // POST jpeg + conditions to https://<your-host>/api/caddy
  // then speak the response via AVSpeechSynthesizer (BT audio routes to glasses)
}

session.capturePhoto(format: .jpeg)
```

### When to switch from Route A to Route B

- When Meta enables Vanguard support in the SDK (announced "near future" at Connect 2025).
- The backend doesn't change — the iOS app just calls the existing `/api/caddy` route with the JPEG and conditions, then plays Claude's reply through `AVSpeechSynthesizer`. BT audio routes to the glasses' speakers automatically when they're the active output device.

## Sidecar data sources to layer in

- **Garmin Golf** (Vanguard already integrates with Garmin watches/Edge): real distance to pin, hole layout, shot tracking. Garmin Connect IQ + Health API can expose this server-side.
- **Weather**: OpenWeatherMap or Tomorrow.io by GPS at the moment of the photo — replaces the wind/temp the player has to currently say aloud.
- **Course data**: GolfBert, USGA-style course APIs for green shape, hazard polygons, doglegs.

Drop these into `app/lib/caddy.ts` as additional fields on `CaddyInput.conditions` — Claude already reads optional fields and ignores what's missing.
