# Armenian AI Web

The web application is the public presentation and browser client for Armenian AI. It records Armenian speech, sends the recording through a server-side proxy, and plays the WAV response returned by the GPU inference service.

## Requirements

- Node.js 22.13 or newer
- A running Armenian AI GPU service

## Configuration

```powershell
Copy-Item .env.example .env.local
```

Set `LIGHTNING_VOICE_API_URL` to the public base URL of the GPU service. Do not expose tokens in a `NEXT_PUBLIC_` variable.

## Development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```powershell
npm run lint
npm test
```

`npm test` builds every Next.js route and runs the API, recording, silence-detector, and conversation-history contract tests.

## Netlify

The current portfolio deployment is available at [armenian-ai-arman.netlify.app](https://armenian-ai-arman.netlify.app). The website remains visible when the GPU service is offline, but Voice requests cannot complete until `LIGHTNING_VOICE_API_URL` points to a running inference server.
