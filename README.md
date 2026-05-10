# AI Caddy

A glasses-first AI golf caddy. You stand over the ball, capture a frame from your Meta glasses' camera, and the glasses read back a Claude-generated club + line + risk in your ear.

```
            ┌────────────────────────────────────┐
            │   Oakley Meta Vanguard / Ray-Ban   │
            │   Meta / Meta HSTN / Display       │
            └─────────────┬──────────────────────┘
              camera + audio over BT
                          │
            ┌─────────────▼──────────────────────┐
            │   iPhone running CaddyApp          │
            │   (Meta Wearables DAT SDK 0.6.0)   │
            └─────────────┬──────────────────────┘
              JPEG + shot conditions
                          │
            ┌─────────────▼──────────────────────┐
            │   /api/caddy  (Next.js + Claude)   │
            └─────────────┬──────────────────────┘
              advice text
                          │
                  AVSpeechSynthesizer
                          │
                 ▶ glasses speakers
```

## Status

| Piece | Status |
| --- | --- |
| Native iOS app for Vanguards | **Real** — `ios/CaddyApp/` uses Meta Wearables Device Access Toolkit v0.6.0; Vanguard supported since v0.4.0 (firmware V22+). |
| WhatsApp bridge (no-code-needed alt) | **Real** — `app/api/whatsapp/`. Uses "Hey Meta, send a photo to AI Caddy on WhatsApp" + glasses notification readout. |
| Vision + caddy reasoning | **Real** — Claude (Opus) with a PGA-caddy system prompt. |
| Spoken reply on glasses | **Real** — `AVSpeechSynthesizer` (native) or WhatsApp readout (bridge). |
| Distance / lie / wind | **Manual today** (form on the iPhone, or spoken in the WhatsApp caption). Garmin Golf + a weather API are the obvious next sources — drop them onto `CaddyInput.conditions`. |
| Desktop test page | **Real** — `/` uses your laptop webcam, for prompt iteration without touching the glasses. |

## Routes & files

- **`ios/CaddyApp/`** — SwiftUI app: pairs with glasses, opens a stream, captures a JPEG, calls `/api/caddy`, speaks the reply. See its README for Xcode setup.
- **`/api/caddy`** — Backend endpoint. Takes `{ image, conditions }`, returns `{ advice }`. Used by both iOS and the desktop demo.
- **`/api/whatsapp`** — WhatsApp Cloud API webhook. Verifies + receives image+caption, returns advice as a text reply (which the glasses read aloud).
- **`/`** — Desktop POV: webcam + form + spoken reply. Useful for iterating on the prompt locally.
- **`app/lib/caddy.ts`** — Single Claude call shared by all routes. `voice: true` mode keeps replies under ~25 words for glasses TTS.
- **`docs/glasses-integration.md`** — SDK landscape, hardware support table, API quick reference, and the Route A vs B trade-offs.

## Backend setup

```bash
npm install
cp .env.local.example .env.local
# fill in ANTHROPIC_API_KEY
# (the WHATSAPP_* vars are only needed if you're using the WhatsApp bridge)
npm run dev
```

For the iOS app to reach the dev server from your phone, expose it:

```bash
cloudflared tunnel --url http://localhost:3000
```

then paste the tunnel URL into `ios/CaddyApp/CaddyClient.swift` as `baseURL`.

## Native (iOS) setup

See `ios/CaddyApp/README.md`. Short version: open Xcode, new SwiftUI app, drop the four `.swift` files in, add `https://github.com/facebook/meta-wearables-dat-ios` as a Swift Package, merge in the Info.plist keys from the snippet, set your tunnel URL, build and run on your iPhone.

## WhatsApp bridge setup (no Xcode)

See `docs/glasses-integration.md` → Route A. Short version: make a free WhatsApp Business app on developers.facebook.com, drop the three `WHATSAPP_*` vars in `.env.local`, expose the dev server with cloudflared, register `/api/whatsapp` as the webhook, save the test number in your contacts as "AI Caddy", send it a message from your phone first, then voice-command the glasses.

## Hardware support (SDK v0.6.0, May 2026)

| Glasses | Required firmware |
| --- | --- |
| Ray-Ban Meta (Gen 1, Gen 2) | V20 |
| Ray-Ban Meta Optics | V20 |
| Meta Ray-Ban Display | V21 |
| Oakley Meta HSTN | V22 |
| Oakley Meta Vanguard | V22 |
