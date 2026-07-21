# Model and Dataset Attribution

Armenian AI is an original voice-assistant system that combines audio processing, model orchestration, API validation, Armenian text normalization, browser recording, and a custom user experience. The repository does not claim authorship of the third-party foundation model weights listed below.

## Runtime models

| Component | Model | Role | Upstream license |
|---|---|---|---|
| Speech recognition | [Chillarmo/whisper-large-v3-turbo-armenian](https://huggingface.co/Chillarmo/whisper-large-v3-turbo-armenian) | Armenian audio to Armenian text | Apache-2.0 |
| Language model | [Gen2B/HyGPT-10b-it](https://huggingface.co/Gen2B/HyGPT-10b-it) | Armenian response generation | HyGPT Permissive Use License + Gemma terms |
| Speech synthesis | [Edmon02/speecht5_finetuned_voxpopuli_hy](https://huggingface.co/Edmon02/speecht5_finetuned_voxpopuli_hy) | Armenian text to mel spectrogram | MIT |
| Vocoder | [microsoft/speecht5_hifigan](https://huggingface.co/microsoft/speecht5_hifigan) | Mel spectrogram to waveform | MIT |
| Speaker embedding | [Matthijs/cmu-arctic-xvectors](https://huggingface.co/datasets/Matthijs/cmu-arctic-xvectors) | SpeechT5 speaker conditioning | MIT |

## Training foundations

| Recipe | Foundation | Dataset |
|---|---|---|
| Armenian STT fine-tuning | [openai/whisper-large-v3-turbo](https://huggingface.co/openai/whisper-large-v3-turbo), MIT | [Chillarmo/common_voice_20_armenian](https://huggingface.co/datasets/Chillarmo/common_voice_20_armenian), CC0-1.0 |
| Armenian instruction QLoRA | [Qwen/Qwen3-4B-Base](https://huggingface.co/Qwen/Qwen3-4B-Base), Apache-2.0 | User-provided instruction JSONL |
| Armenian TTS fine-tuning | [microsoft/speecht5_tts](https://huggingface.co/microsoft/speecht5_tts), MIT | User-provided licensed audio and transcripts |

## HyGPT restriction

The HyGPT license allows many personal, research, and commercial uses but requires explicit permission from Gen2B before reselling the model or offering it as a hosted service where third parties submit requests and receive model responses. It also requires applicable HyGPT and Gemma notices when distributing model derivatives.

The public website in this repository is a portfolio frontend. Before enabling a public HyGPT-backed inference endpoint, review the current upstream terms and obtain any required permission from Gen2B. An Apache-2.0 Qwen training recipe is included as a path toward a separately trained Armenian adapter with more permissive hosting terms.

## Repository ownership

Repository-owned work includes the end-to-end architecture, FastAPI service, request validation, audio conversion, repetitive-transcript detection, Armenian response constraints, TTS normalization, speaker-profile integration, Next.js interface, automatic silence detection, session history, deployment configuration, and training recipes.

Any adapter or checkpoint trained with these scripts remains subject to the license and acceptable-use terms of its base model and training data.
