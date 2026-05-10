import { NextRequest, NextResponse } from "next/server";
import { getCaddyAdvice, type Conditions } from "@/app/lib/caddy";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    image?: string;
    conditions?: Conditions;
    voice?: boolean;
  };
  const { image, conditions, voice } = body;

  let imagePart: { data: string; mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp" } | undefined;
  if (image && image.startsWith("data:image/")) {
    const [meta, b64] = image.split(",");
    const mediaType = (meta.match(/data:(image\/[a-zA-Z+]+);/)?.[1] ?? "image/jpeg") as
      "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    imagePart = { data: b64, mediaType };
  }

  try {
    const advice = await getCaddyAdvice({ image: imagePart, conditions, voice });
    return NextResponse.json({ advice });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Caddy call failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
