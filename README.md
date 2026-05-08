# AI Caddy (prototype)

A glasses-style AI golf caddy. You point a camera down the target line, fill in lie / distance / wind, and Claude (vision) reads the terrain and tells you what to hit.

## What's real and what's faked

- **Camera POV** — uses your phone or laptop camera to simulate the glasses view.
- **AI caddy logic** — real, calls Claude with the captured image + conditions.
- **Spoken advice** — real, uses the browser's built-in text-to-speech.
- **Meta Ray-Ban / Oakley integration** — *not real*. Meta does not yet expose a public live-camera SDK for third-party apps; the glasses talk to Meta AI, not to your code. Today's path to "real glasses" would be to take a photo on the glasses, sync via the Meta View app, then process — not live.
- **Golf course / GPS API** — skipped for v1. You enter distance manually. Easy add later (GolfBert, Garmin, USGA-style data).
- **Weather API** — skipped for v1. You enter wind/temp manually. Easy add later (OpenWeatherMap).

## Setup

```bash
npm install
cp .env.local.example .env.local   # add your Anthropic key
npm run dev
```

Open http://localhost:3000 on a phone (real camera + GPS-style use) or laptop. Allow camera access.

## Use

1. Point at your ball / target line.
2. Tap **Capture frame**.
3. Set lie, distance, wind, temperature, and your bag.
4. Tap **Ask caddy** — advice appears in text and is spoken aloud.

## Next steps if you want to take it further

- Pull distance + hole layout from a course API instead of typing it.
- Pull wind/temp from a weather API by GPS.
- Replace browser TTS with ElevenLabs for a better voice.
- Wrap as a PWA so it installs on your phone.
- When/if Meta opens a glasses SDK, swap the webcam for the glasses camera feed and route advice to glasses audio.
