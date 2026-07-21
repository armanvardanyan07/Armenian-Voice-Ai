# GPU Inference Service

The FastAPI service loads Armenian STT, LLM, TTS, vocoder, and speaker-conditioning assets on a CUDA GPU. It exposes a small HTTP contract for the web application.

## Install

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r inference/requirements.txt
```

Copy `.env.example` to `.env`, export the values required by your platform, and start the service:

```bash
python inference/server.py
```

The first start downloads several gigabytes of model assets from Hugging Face. Keep the model cache on persistent storage when using an ephemeral GPU provider.

## Endpoints

### `GET /health`

```json
{"status":"ok"}
```

### `POST /voice-chat`

Send a multipart field named `audio`. Supported recordings include WAV, WebM, M4A, MP3, MP4, and OGG up to 10 MB.

```json
{
  "transcript": "Բարև, ինչպե՞ս ես։",
  "answer": "Բարև, լավ եմ, շնորհակալություն։",
  "audio": {
    "mimeType": "audio/wav",
    "base64": "..."
  }
}
```

GPU execution is serialized with a process lock to avoid overlapping model generations on a single 16 GB card.
