# AI Caddy

A glasses-first AI golf caddy. You stand over the ball, voice-command your Meta glasses to send a photo + spoken context to a WhatsApp number, and the glasses read back a Claude-generated club + line + risk in your ear.

```
"Hey Meta, send a photo to AI Caddy on WhatsApp.
 One fifty into the wind, slight uphill, fairway."
                                ↓
                  [glasses snap, transcribe, send]
                                ↓
                /api/whatsapp  (this server)
                                ↓
                Claude (vision + caddy prompt)
                                ↓
        "Smooth eight, aim left edge of the bunker, draw it back.
         Don't go long — back pin, false front."
                                ↓
                       [glasses speak it]
```

## What's real

| Piece | Status |
| --- | --- |
| Glasses → server bridge | **Real** — uses Meta WhatsApp Cloud API on Oakley Meta Vanguard / Ray-Ban Meta / Oakley Meta HSTN. |
| Vision + caddy reasoning | **Real** — Claude with a PGA-caddy system prompt, sees the image and the spoken context. |
| Spoken reply on glasses | **Real** — glasses auto-read incoming WhatsApp messages aloud (or "Hey Meta, read it"). |
| Distance / lie / wind | **Manual today** — say it in your voice command. Easy to swap for Garmin Golf + a weather API later. |
| Native iOS app w/ Meta Wearables SDK | **Designed, not built** — see `docs/glasses-integration.md`. The SDK doesn't yet support Vanguard; when it does, swap the WhatsApp bridge for an iOS app calling the same backend. |

## Routes

- **`/api/whatsapp`** — webhook the glasses talk to (via WhatsApp Cloud API).
- **`/api/caddy`** — the same caddy logic, callable directly with `{ image, conditions }`. Useful for the local web demo and for future native apps.
- **`/`** — desktop test page: webcam POV + form + spoken reply, for iterating on the prompt without touching the glasses.

## Setup

```bash
npm install
cp .env.local.example .env.local
# fill in ANTHROPIC_API_KEY and the three WHATSAPP_* vars
npm run dev
```

For the WhatsApp bridge to actually receive messages, follow `docs/glasses-integration.md` → "Route A — WhatsApp bridge". You need:
1. A Meta WhatsApp Business app (free).
2. A public tunnel to your dev server (`cloudflared tunnel --url http://localhost:3000`) or a deploy.
3. A webhook registered against `/api/whatsapp`.
4. The test number saved in your phone contacts as "AI Caddy".

For the desktop demo, just `npm run dev` and open http://localhost:3000.

## Files

- `app/lib/caddy.ts` — Claude call. Same code path for both web and WhatsApp.
- `app/api/whatsapp/route.ts` — webhook verification, message dedupe, media download, reply send.
- `app/api/caddy/route.ts` — direct JSON endpoint.
- `app/page.tsx` — desktop POV demo.
- `docs/glasses-integration.md` — what works on which Meta hardware today, and the iOS/SDK migration path.
