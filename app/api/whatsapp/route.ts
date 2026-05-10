import { NextRequest, NextResponse } from "next/server";
import { getCaddyAdvice } from "@/app/lib/caddy";

export const runtime = "nodejs";

// ---- Config ----
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v22.0";
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

// ---- In-memory dedupe (Meta retries webhooks; restart-safe is overkill for a prototype) ----
const seen = new Set<string>();
function rememberMessage(id: string): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  // Cap memory; lose oldest if huge
  if (seen.size > 5000) {
    const first = seen.values().next().value;
    if (first) seen.delete(first);
  }
  return false;
}

// ---- WhatsApp webhook verification (GET) ----
// Meta hits this once when you set up the webhook URL.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

// ---- WhatsApp event delivery (POST) ----
type WhatsAppMessage = {
  from: string;
  id: string;
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
};

type WhatsAppPayload = {
  object: string;
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: WhatsAppMessage[];
        statuses?: unknown[];
      };
    }>;
  }>;
};

export async function POST(req: NextRequest) {
  if (!ACCESS_TOKEN || !PHONE_NUMBER_ID) {
    return NextResponse.json({ error: "WhatsApp env vars not set" }, { status: 500 });
  }

  let body: WhatsAppPayload;
  try {
    body = (await req.json()) as WhatsAppPayload;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages: WhatsAppMessage[] = [];
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) messages.push(m);
    }
  }

  // Process each new message; ignore retries and non-actionable types.
  await Promise.all(
    messages.map(async (m) => {
      if (rememberMessage(m.id)) return;
      try {
        await handleMessage(m);
      } catch (e) {
        console.error("caddy handler failed:", e);
        await sendText(m.from, "Caddy hit an error reading that — try again.").catch(() => {});
      }
    })
  );

  // Always 200 fast so Meta doesn't retry.
  return NextResponse.json({ ok: true });
}

async function handleMessage(m: WhatsAppMessage): Promise<void> {
  if (m.type === "text") {
    const text = m.text?.body?.trim() ?? "";
    if (!text) return;
    const advice = await getCaddyAdvice({ caption: text, voice: true });
    await sendText(m.from, advice);
    return;
  }

  if (m.type === "image" && m.image) {
    const caption = m.image.caption?.trim();
    const downloaded = await downloadWhatsAppMedia(m.image.id);
    const advice = await getCaddyAdvice({
      image: { data: downloaded.base64, mediaType: downloaded.mediaType },
      caption,
      voice: true,
    });
    await sendText(m.from, advice);
    return;
  }

  if (m.type === "audio") {
    await sendText(
      m.from,
      "Voice notes aren't transcribed yet — send a photo of your line, or text the distance and lie."
    );
    return;
  }

  // Other types: ignore.
}

// ---- Download an image from WhatsApp Cloud API ----
type DownloadedMedia = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
};

async function downloadWhatsAppMedia(mediaId: string): Promise<DownloadedMedia> {
  const metaRes = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${mediaId}`, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!metaRes.ok) throw new Error(`media metadata: ${metaRes.status}`);
  const meta = (await metaRes.json()) as { url: string; mime_type: string };

  const fileRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
  });
  if (!fileRes.ok) throw new Error(`media bytes: ${fileRes.status}`);
  const buf = Buffer.from(await fileRes.arrayBuffer());

  const mt = meta.mime_type.split(";")[0].trim();
  const mediaType = (
    ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mt) ? mt : "image/jpeg"
  ) as DownloadedMedia["mediaType"];

  return { base64: buf.toString("base64"), mediaType };
}

// ---- Send a text reply via WhatsApp Cloud API ----
async function sendText(to: string, body: string): Promise<void> {
  const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body, preview_url: false },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sendText ${res.status}: ${text}`);
  }
}
