import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const SYSTEM = `You are an experienced PGA caddy speaking through a golfer's smart glasses.
Be brief, confident, and conversational — 3 to 5 short sentences total, as if spoken aloud.
Always:
1. Recommend a specific club from the player's bag.
2. Give a target line (e.g. "aim at the left edge of the bunker, draw it back").
3. Note one risk to avoid.
4. Adjust for lie quality, wind, elevation, and temperature (cold/altitude affect carry).
Do not list bullet points. Speak as one short paragraph.`;

type Conditions = {
  lie: string;
  distance: number;
  elevation: number;
  wind: string;
  windDir: string;
  tempF: number;
  bag: string;
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }

  const body = (await req.json()) as { image?: string; conditions: Conditions };
  const { image, conditions } = body;

  const userText = `Conditions:
- Lie: ${conditions.lie}
- Distance to pin: ${conditions.distance} yards
- Elevation change: ${conditions.elevation} ft (positive = uphill)
- Wind: ${conditions.wind}, ${conditions.windDir}
- Temperature: ${conditions.tempF}°F
- Bag: ${conditions.bag}

The image is the golfer's POV looking down the target line.
Read the visible terrain (hazards, slope, trees, green shape) and give caddy advice.`;

  type Block =
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "base64"; media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp"; data: string } };
  const content: Block[] = [];
  if (image && image.startsWith("data:image/")) {
    const [meta, b64] = image.split(",");
    const mediaType = (meta.match(/data:(image\/[a-zA-Z+]+);/)?.[1] ?? "image/jpeg") as
      "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    content.push({
      type: "image",
      source: { type: "base64", media_type: mediaType, data: b64 },
    });
  }
  content.push({ type: "text", text: userText });

  const client = new Anthropic({ apiKey });
  try {
    const msg = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 400,
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });
    const advice = msg.content
      .filter((b: { type: string }): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return NextResponse.json({ advice });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Claude call failed" }, { status: 500 });
  }
}
