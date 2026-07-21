export interface VoiceChatResult {
  transcript: string;
  answer: string;
  audioUrl: string;
}

function readAudioUrl(value: unknown): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (typeof value === "object" && value !== null && "url" in value) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === "string" && url.length > 0) {
      return url;
    }
  }

  throw new Error("LIGHTNING_RESPONSE_INVALID");
}

function parseVoiceChatData(value: unknown): VoiceChatResult {
  if (typeof value !== "object" || value === null) {
    throw new Error("LIGHTNING_RESPONSE_INVALID");
  }

  const transcript = Reflect.get(value, "transcript");
  const answer = Reflect.get(value, "answer");
  const audio = Reflect.get(value, "audioUrl");
  if (typeof transcript !== "string" || typeof answer !== "string") {
    throw new Error("LIGHTNING_RESPONSE_INVALID");
  }

  return {
    transcript: transcript.trim(),
    answer: answer.trim(),
    audioUrl: readAudioUrl(audio),
  };
}

export async function runVoiceChat(audio: Blob): Promise<VoiceChatResult> {
  if (audio.size === 0) {
    throw new Error("AUDIO_EMPTY");
  }

  const extension = audio.type.includes("mp4") ? "m4a" : "webm";
  const formData = new FormData();
  formData.append("audio", audio, `recording.${extension}`);

  const response = await fetch("/api/voice-chat", {
    method: "POST",
    body: formData,
  });
  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (typeof data === "object" && data !== null && "error" in data) {
      const error = Reflect.get(data, "error");
      if (typeof error === "object" && error !== null) {
        const code = Reflect.get(error, "code");
        if (typeof code === "string" && code.length > 0) {
          throw new Error(code);
        }
      }
    }

    throw new Error("VOICE_REQUEST_FAILED");
  }

  return parseVoiceChatData(data);
}
