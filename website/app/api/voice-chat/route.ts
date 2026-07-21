interface VoiceChatResult {
  transcript: string;
  answer: string;
  audioUrl: string;
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

function json(body: VoiceChatResult | ErrorBody, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
    },
  });
}

function getLightningUrl(): string {
  const value = process.env.LIGHTNING_VOICE_API_URL?.trim();

  if (!value) {
    throw new Error("LIGHTNING_URL_MISSING");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("LIGHTNING_URL_INVALID");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("LIGHTNING_URL_INVALID");
  }

  return url.toString().replace(/\/$/, "");
}

function parseVoiceChatData(value: unknown): VoiceChatResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("LIGHTNING_RESPONSE_INVALID");
  }

  const transcript = Reflect.get(value, "transcript");
  const answer = Reflect.get(value, "answer");
  const audio = Reflect.get(value, "audio");

  if (
    typeof transcript !== "string"
    || transcript.trim().length === 0
    || typeof answer !== "string"
    || answer.trim().length === 0
    || typeof audio !== "object"
    || audio === null
  ) {
    throw new Error("LIGHTNING_RESPONSE_INVALID");
  }

  const mimeType = Reflect.get(audio, "mimeType");
  const base64 = Reflect.get(audio, "base64");

  if (
    mimeType !== "audio/wav"
    || typeof base64 !== "string"
    || base64.length === 0
    || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)
  ) {
    throw new Error("LIGHTNING_RESPONSE_INVALID");
  }

  return {
    transcript: transcript.trim(),
    answer: answer.trim(),
    audioUrl: `data:${mimeType};base64,${base64}`,
  };
}

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const audio = formData.get("audio");

  if (!(audio instanceof Blob) || audio.size === 0) {
    return json({
      error: {
        code: "AUDIO_REQUIRED",
        message: "An audio file is required.",
      },
    }, 400);
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return json({
      error: {
        code: "AUDIO_TOO_LARGE",
        message: "The audio file must be 10 MB or smaller.",
      },
    }, 413);
  }

  try {
    const upstreamForm = new FormData();
    const filename = audio instanceof File && audio.name
      ? audio.name
      : "recording.webm";
    upstreamForm.append("audio", audio, filename);

    const response = await fetch(`${getLightningUrl()}/voice-chat`, {
      method: "POST",
      body: upstreamForm,
    });
    const data: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error("LIGHTNING_UPSTREAM_ERROR");
    }

    return json(parseVoiceChatData(data));
  } catch (error) {
    const code = error instanceof Error ? error.message : "LIGHTNING_UNAVAILABLE";
    const isConfigurationError = code === "LIGHTNING_URL_MISSING" || code === "LIGHTNING_URL_INVALID";

    console.error("[voice-chat] Lightning request failed", error);

    return json({
      error: {
        code: isConfigurationError ? code : "LIGHTNING_UNAVAILABLE",
        message: isConfigurationError
          ? "The Lightning endpoint is not configured."
          : "The Lightning voice service did not return a valid response.",
      },
    }, isConfigurationError ? 500 : 502);
  }
}
