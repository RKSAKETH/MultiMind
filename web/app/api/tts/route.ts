import { NextResponse } from "next/server";

/**
 * POST /api/tts
 * Server-side proxy for Sarvam AI Text-to-Speech.
 * Keeps the API key secure — never exposed to the browser.
 *
 * Request body: { text: string; voiceId: string }
 * Response:     { audioBase64: string } (base64-encoded WAV)
 */
export async function POST(req: Request) {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "SARVAM_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  let text: string;
  let voiceId: string;

  try {
    const body = await req.json();
    text = body.text;
    voiceId = body.voiceId;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "'text' is required" }, { status: 400 });
  }
  if (!voiceId || typeof voiceId !== "string") {
    return NextResponse.json({ error: "'voiceId' is required" }, { status: 400 });
  }

  // Sarvam TTS only supports up to 500 chars per request — truncate if needed
  const truncated = text.slice(0, 500);

  try {
    const sarvamRes = await fetch("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-subscription-key": apiKey,
      },
      body: JSON.stringify({
        text: truncated,
        target_language_code: "en-IN",
        speaker: voiceId,
        model: "bulbul:v3",
      }),
    });

    if (!sarvamRes.ok) {
      const errBody = await sarvamRes.text();
      console.error("[TTS] Sarvam error:", sarvamRes.status, errBody);
      return NextResponse.json(
        { error: "Sarvam TTS request failed", detail: errBody },
        { status: 502 }
      );
    }

    const data = await sarvamRes.json();
    // Sarvam returns { audios: [base64string, ...] }
    const audioBase64: string = data?.audios?.[0] ?? "";

    if (!audioBase64) {
      return NextResponse.json(
        { error: "No audio returned from Sarvam" },
        { status: 502 }
      );
    }

    return NextResponse.json({ audioBase64 });
  } catch (err) {
    console.error("[TTS] Network error:", err);
    return NextResponse.json(
      { error: "Failed to reach Sarvam API" },
      { status: 503 }
    );
  }
}
