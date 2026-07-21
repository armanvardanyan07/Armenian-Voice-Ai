# Training Recipes

The training directory contains reproducible entry points for the three learnable parts of Armenian AI. Training is separate from inference: the public repository contains code and configuration, not model weights or datasets.

## Install

Create an isolated Python 3.11 or 3.12 environment on a CUDA machine.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r training/requirements.txt
```

On Windows, activate with `.venv\Scripts\activate`.

## Validate without downloads

```bash
python training/train_stt.py --dry-run
python training/train_llm_qlora.py --dry-run
python training/train_tts.py --dry-run
```

Each command prints its complete training configuration without importing CUDA libraries or downloading weights.

## Armenian STT

The STT recipe fine-tunes Whisper Large v3 Turbo on Common Voice 20 Armenian and evaluates Word Error Rate.

```bash
python training/train_stt.py \
  --output-dir artifacts/whisper-armenian \
  --max-steps 5000 \
  --train-batch-size 4 \
  --gradient-accumulation-steps 8
```

For a T4 smoke test, add `--max-train-samples 500 --max-eval-samples 100 --max-steps 20`. Full fine-tuning is better suited to a GPU with at least 24 GB VRAM. A smaller Whisper checkpoint can be supplied through `--base-model`.

## Armenian LLM QLoRA

The LLM recipe creates a lightweight adapter rather than duplicating the full base model. The input is UTF-8 JSONL with one example per line.

```json
{"instruction":"Բացատրի՛ր, թե ինչ է արհեստական բանականությունը։","context":"","response":"Արհեստական բանականությունը համակարգերի կարողությունն է կատարել սովորաբար մարդկային մտածողություն պահանջող առաջադրանքներ։"}
```

```bash
python training/train_llm_qlora.py \
  --train-file training/data/armenian_instructions.jsonl \
  --output-dir artifacts/qwen3-armenian-qlora \
  --max-steps 2000
```

A 16 GB T4 is suitable for small QLoRA experiments with the default batch size. Training quality depends on the accuracy, variety, licensing, and safety of the instruction dataset.

## Armenian TTS

The TTS recipe expects a single-speaker or speaker-consistent dataset described by UTF-8 JSONL.

```json
{"audio":"/absolute/path/to/audio/0001.wav","text":"Բարև, ինչպե՞ս եք։"}
```

It also requires a 512-value SpeechT5-compatible speaker embedding saved as NumPy `float32` data.

```bash
python training/train_tts.py \
  --manifest training/data/armenian_tts.jsonl \
  --speaker-embedding training/data/speaker_embedding.npy \
  --output-dir artifacts/speecht5-armenian \
  --max-steps 4000
```

Use clean mono recordings, consistent transcription rules, and audio that you have permission to process. A T4 can run small experiments; longer high-quality training benefits from 24 GB or more VRAM.

## Outputs

All scripts write to `artifacts/` by default. That directory and common checkpoint formats are excluded from Git because trained weights are large and retain upstream license obligations.
