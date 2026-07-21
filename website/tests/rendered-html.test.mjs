import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const siteUrl = new URL("../app/components/ArmenianSite.tsx", import.meta.url);
const routeUrl = new URL("../app/api/voice-chat/route.ts", import.meta.url);

async function readSite() {
  return readFile(siteUrl, "utf8");
}

async function loadVoiceRoute() {
  return import(`${routeUrl.href}?test=${Date.now()}-${Math.random()}`);
}

test("uses Armenian AI as the only product brand", async () => {
  const [site, layout] = await Promise.all([
    readSite(),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(site, /Armenian <b>AI<\/b>/);
  assert.doesNotMatch(site, /Lusine/i);
  assert.match(layout, /Armenian AI — Armenian-first voice intelligence/);
});

test("keeps independent Home, Voice, AI and API routes", async () => {
  const routes = ["page.tsx", "voice/page.tsx", "ai/page.tsx", "api/page.tsx"];

  for (const route of routes) {
    const source = await readFile(new URL(`../app/${route}`, import.meta.url), "utf8");
    assert.match(source, /ArmenianSite/);
  }
});

test("keeps the voice experience free of a local question limit", async () => {
  const site = await readSite();

  assert.doesNotMatch(site, /className="attempts"/);
  assert.doesNotMatch(site, /questions remaining/i);
  assert.match(site, /listen: "Խոսել"/);
});

test("stops recording after speech followed by configured silence", async () => {
  const site = await readSite();

  assert.match(site, /createMediaStreamSource\(stream\)/);
  assert.match(site, /updateSilenceDetector\(detectorState, calculateRms\(samples\), now\)/);
  assert.match(site, /if \(update\.shouldStop\) \{\s*stopRecording\(\)/s);
  assert.match(site, /onClick=\{status === "listening" \? stopRecording : start\}/);
});

test("stores successful turns in a replayable and clearable session history", async () => {
  const site = await readSite();

  assert.match(site, /setHistory\(\(current\) => \[turn, \.\.\.current\]\)/);
  assert.match(site, /playAnswer\(turn\.audioUrl\)/);
  assert.match(site, /navigator\.clipboard\.writeText\(turn\.answer\)/);
  assert.match(site, /setHistory\(\[\]\)/);
});

test("rejects a missing voice upload", async () => {
  const { POST } = await loadVoiceRoute();
  const response = await POST(new Request("http://localhost/api/voice-chat", {
    method: "POST",
    body: new FormData(),
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: {
      code: "AUDIO_REQUIRED",
      message: "An audio file is required.",
    },
  });
});

test("rejects an upload larger than ten megabytes", async () => {
  const { POST } = await loadVoiceRoute();
  const formData = new FormData();
  formData.append("audio", new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]), "large.webm");
  const response = await POST(new Request("http://localhost/api/voice-chat", {
    method: "POST",
    body: formData,
  }));

  assert.equal(response.status, 413);
  assert.equal((await response.json()).error.code, "AUDIO_TOO_LARGE");
});

test("reports a missing GPU service configuration", async () => {
  const originalUrl = process.env.LIGHTNING_VOICE_API_URL;
  delete process.env.LIGHTNING_VOICE_API_URL;

  try {
    const { POST } = await loadVoiceRoute();
    const formData = new FormData();
    formData.append("audio", new Blob(["voice"], { type: "audio/webm" }), "recording.webm");
    const response = await POST(new Request("http://localhost/api/voice-chat", {
      method: "POST",
      body: formData,
    }));

    assert.equal(response.status, 500);
    assert.equal((await response.json()).error.code, "LIGHTNING_URL_MISSING");
  } finally {
    if (originalUrl === undefined) delete process.env.LIGHTNING_VOICE_API_URL;
    else process.env.LIGHTNING_VOICE_API_URL = originalUrl;
  }
});

test("returns transcript, answer and playable WAV data from the GPU service", async () => {
  const originalFetch = globalThis.fetch;
  const originalUrl = process.env.LIGHTNING_VOICE_API_URL;
  process.env.LIGHTNING_VOICE_API_URL = "https://gpu.example";
  globalThis.fetch = async () => Response.json({
    transcript: "Բարև, ինչպե՞ս ես։",
    answer: "Բարև, լավ եմ, շնորհակալություն։",
    audio: { mimeType: "audio/wav", base64: "UklGRg==" },
  });

  try {
    const { POST } = await loadVoiceRoute();
    const formData = new FormData();
    formData.append("audio", new Blob(["voice"], { type: "audio/webm" }), "recording.webm");
    const response = await POST(new Request("http://localhost/api/voice-chat", {
      method: "POST",
      body: formData,
    }));

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      transcript: "Բարև, ինչպե՞ս ես։",
      answer: "Բարև, լավ եմ, շնորհակալություն։",
      audioUrl: "data:audio/wav;base64,UklGRg==",
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.LIGHTNING_VOICE_API_URL;
    else process.env.LIGHTNING_VOICE_API_URL = originalUrl;
  }
});

test("keeps three distinct 3D scenes off the Home route", async () => {
  const scene = await readFile(new URL("../app/components/ProductScene.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(scene, /function Home/);
  assert.match(scene, /function VoiceWaveform/);
  assert.match(scene, /function NeuralConstellation/);
  assert.match(scene, /function ApiGateway/);
});
