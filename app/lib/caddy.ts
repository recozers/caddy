import Anthropic from "@anthropic-ai/sdk";

export type Conditions = {
  lie?: string;
  distance?: number;
  elevation?: number;
  wind?: string;
  windDir?: string;
  tempF?: number;
  bag?: string;
};

export type CaddyInput = {
  /** Base64 data URL or raw base64 (with mediaType). Optional — text-only is supported. */
  image?: { data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" };
  /** Free-form text from the player (e.g. transcribed voice caption from glasses). */
  caption?: string;
  /** Optional structured conditions; merged with anything Claude infers from caption. */
  conditions?: Conditions;
  /** Voice mode: even tighter, only ~2 sentences, no preamble — for glasses TTS readout. */
  voice?: boolean;
};

const SYSTEM_VOICE = `You are a PGA caddy speaking through smart glasses.
Reply in 2 short sentences max, ~25 words. Spoken aloud, no preamble.
Always: name a specific club, give a target line, mention the main risk.
Adjust for lie, wind, elevation, and temperature. No bullet points, no markdown.`;

const SYSTEM_TEXT = `You are an experienced PGA caddy. Reply in 3 to 5 short sentences.
Always: recommend a specific club, give a target line, note the main risk.
Adjust for lie quality, wind, elevation, and temperature. Speak as one short paragraph, no bullets.`;

function buildUserText(c: CaddyInput): string {
  const parts: string[] = [];
  if (c.caption) parts.push(`Player said: "${c.caption}"`);
  const cond = c.conditions ?? {};
  const lines: string[] = [];
  if (cond.lie) lines.push(`Lie: ${cond.lie}`);
  if (cond.distance != null) lines.push(`Distance to pin: ${cond.distance} yards`);
  if (cond.elevation != null) lines.push(`Elevation change: ${cond.elevation} ft (positive = uphill)`);
  if (cond.wind) lines.push(`Wind: ${cond.wind}${cond.windDir ? `, ${cond.windDir}` : ""}`);
  if (cond.tempF != null) lines.push(`Temperature: ${cond.tempF}°F`);
  if (cond.bag) lines.push(`Bag: ${cond.bag}`);
  if (lines.length) parts.push("Conditions:\n" + lines.map((l) => `- ${l}`).join("\n"));
  if (c.image) parts.push("The image is the player's POV down the target line. Read terrain, hazards, slope, green shape.");
  if (!c.image && !c.caption && lines.length === 0) parts.push("No info provided — ask for distance and lie.");
  return parts.join("\n\n");
}

export async function getCaddyAdvice(input: CaddyInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  type Block =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };

  const content: Block[] = [];
  if (input.image) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: input.image.mediaType, data: input.image.data },
    });
  }
  content.push({ type: "text", text: buildUserText(input) });

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-opus-4-7",
    max_tokens: input.voice ? 120 : 400,
    system: input.voice ? SYSTEM_VOICE : SYSTEM_TEXT,
    messages: [{ role: "user", content }],
  });
  return msg.content
    .filter((b: { type: string }): b is { type: "text"; text: string } => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim();
}
