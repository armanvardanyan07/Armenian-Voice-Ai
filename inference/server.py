import base64
import io
import os
import re
import shutil
import subprocess
import tempfile
import threading
import unicodedata
import zipfile
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from huggingface_hub import hf_hub_download
from transformers import (
    AutoModelForCausalLM,
    AutoModelForSpeechSeq2Seq,
    AutoProcessor,
    AutoTokenizer,
    BitsAndBytesConfig,
    SpeechT5ForTextToSpeech,
    SpeechT5HifiGan,
    SpeechT5Processor,
)


STT_NAME = os.getenv("STT_MODEL_ID", "Chillarmo/whisper-large-v3-turbo-armenian")
LLM_NAME = os.getenv("LLM_MODEL_ID", "Gen2B/HyGPT-10b-it")
TTS_NAME = os.getenv("TTS_MODEL_ID", "Edmon02/speecht5_finetuned_voxpopuli_hy")
VOCODER_NAME = os.getenv("VOCODER_MODEL_ID", "microsoft/speecht5_hifigan")
SPEAKER_DATASET_ID = os.getenv("SPEAKER_DATASET_ID", "Matthijs/cmu-arctic-xvectors")
SPEAKER_PROFILE_INDEX = int(os.getenv("SPEAKER_PROFILE_INDEX", "7306"))
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "7860"))

print("Loading Armenian Whisper STT...")

stt_processor = AutoProcessor.from_pretrained(STT_NAME)

stt_model = AutoModelForSpeechSeq2Seq.from_pretrained(
    STT_NAME,
    torch_dtype=torch.float16,
    low_cpu_mem_usage=True,
).to("cuda")

stt_model.eval()

print("Armenian Whisper STT loaded")


def get_ffmpeg_executable():
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg

    try:
        import imageio_ffmpeg
    except ImportError as error:
        raise RuntimeError(
            "ffmpeg was not found. Install imageio-ffmpeg."
        ) from error

    return imageio_ffmpeg.get_ffmpeg_exe()


def convert_to_stt_wav(audio_path):
    output_file = tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False,
    )
    wav_path = output_file.name
    output_file.close()

    try:
        subprocess.run(
            [
                get_ffmpeg_executable(),
                "-y",
                "-i",
                audio_path,
                "-vn",
                "-acodec",
                "pcm_s16le",
                "-ac",
                "1",
                "-ar",
                "16000",
                wav_path,
            ],
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
    except Exception:
        if os.path.exists(wav_path):
            os.remove(wav_path)
        raise

    return wav_path


def is_degenerate_transcript(text):
    words = [word.casefold().strip(".,!?։՝՜՛") for word in text.split()]
    words = [word for word in words if word]

    if len(words) < 6:
        return False

    unique_ratio = len(set(words)) / len(words)
    return unique_ratio <= 0.35


def transcribe_audio(audio_path):
    wav_path = convert_to_stt_wav(audio_path)

    try:
        audio, _ = librosa.load(
            wav_path,
            sr=16000,
            mono=True,
        )

        if audio.size == 0:
            raise RuntimeError("The recorded audio is empty.")

        inputs = stt_processor(
            audio,
            sampling_rate=16000,
            return_tensors="pt",
        )
        input_features = inputs["input_features"].to(
            device="cuda",
            dtype=torch.float16,
        )

        with torch.inference_mode():
            predicted_ids = stt_model.generate(
                input_features,
                max_length=96,
                num_beams=4,
                no_repeat_ngram_size=3,
                repetition_penalty=1.1,
                early_stopping=True,
                do_sample=False,
                use_cache=True,
            )

        transcript = stt_processor.batch_decode(
            predicted_ids,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False,
        )[0].strip()

        if not transcript:
            raise RuntimeError("Armenian Whisper returned an empty transcript.")

        if is_degenerate_transcript(transcript):
            raise RuntimeError("Armenian Whisper returned a repetitive transcript.")

        print("Transcript:", repr(transcript))
        return transcript
    finally:
        if os.path.exists(wav_path):
            os.remove(wav_path)


quantization = BitsAndBytesConfig(
    load_in_4bit=True,
    bnb_4bit_quant_type="nf4",
    bnb_4bit_compute_dtype=torch.float16,
    bnb_4bit_use_double_quant=True,
)

print("Loading Armenian LLM...")

llm_tokenizer = AutoTokenizer.from_pretrained(LLM_NAME)

llm_model = AutoModelForCausalLM.from_pretrained(
    LLM_NAME,
    quantization_config=quantization,
    device_map="auto",
    low_cpu_mem_usage=True,
)

llm_model.eval()

print("Armenian LLM loaded")


def generate_answer(recognized_text):
    instruction = f"""
Դու բարեհամբույր հայերեն ձայնային օգնական ես։

Պատասխանիր միայն գրագետ արևելահայերենով։
Պատասխանը պետք է լինի բնական և կարճ՝ մեկ կամ երկու նախադասություն։
Մի կրկնիր օգտատիրոջ հաղորդագրությունը։
Մի հորինիր գոյություն չունեցող փաստեր։
Գրիր միայն հայերեն տառերով։
Օտար անուններն ու բառերը գրիր հայերեն արտասանությամբ։
Մի օգտագործիր լատինատառ բառեր։
Թվերը գրիր բառերով, ոչ թե թվանշաններով։

Օգտատիրոջ հաղորդագրությունը՝
{recognized_text}

Գրիր միայն օգնականի պատասխանը։
""".strip()

    messages = [
        {
            "role": "user",
            "content": instruction,
        }
    ]

    prompt = llm_tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=True,
    )

    inputs = llm_tokenizer(
        prompt,
        return_tensors="pt",
    ).to(llm_model.device)

    with torch.inference_mode():
        output = llm_model.generate(
            **inputs,
            max_new_tokens=100,
            do_sample=False,
            repetition_penalty=1.1,
            pad_token_id=llm_tokenizer.eos_token_id,
        )

    new_tokens = output[
        0,
        inputs["input_ids"].shape[1]:,
    ]

    answer = llm_tokenizer.decode(
        new_tokens,
        skip_special_tokens=True,
    ).strip()

    print("LLM answer:", repr(answer))
    return answer


print("Loading Armenian SpeechT5 TTS...")

tts_processor = SpeechT5Processor.from_pretrained(TTS_NAME)

tts_model = SpeechT5ForTextToSpeech.from_pretrained(
    TTS_NAME,
).to("cuda")

tts_vocoder = SpeechT5HifiGan.from_pretrained(
    VOCODER_NAME,
).to("cuda")

tts_model.eval()
tts_vocoder.eval()

print("Loading speaker embedding...")

zip_path = hf_hub_download(
    repo_id=SPEAKER_DATASET_ID,
    filename="spkrec-xvect.zip",
    repo_type="dataset",
)

with zipfile.ZipFile(zip_path) as archive:
    xvector_files = sorted(
        filename
        for filename in archive.namelist()
        if filename.endswith(".npy")
    )

    if len(xvector_files) <= SPEAKER_PROFILE_INDEX:
        raise RuntimeError("The configured speaker profile is unavailable.")

    with archive.open(xvector_files[SPEAKER_PROFILE_INDEX]) as file:
        xvector = np.load(io.BytesIO(file.read()))

speaker_embedding = torch.tensor(
    xvector,
    dtype=torch.float32,
).unsqueeze(0).to("cuda")

print("Armenian SpeechT5 TTS loaded")


def normalize_tts_text(text):
    text = unicodedata.normalize("NFC", text)
    text = re.sub(r"[^\u0530-\u058F\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if not text:
        raise ValueError("TTS text is empty after normalization.")

    return text


def synthesize_speech(text):
    normalized_text = normalize_tts_text(text)
    print("SpeechT5 input:", repr(normalized_text))

    tts_inputs = tts_processor(
        text=normalized_text,
        return_tensors="pt",
    )

    input_ids = tts_inputs["input_ids"].to("cuda")

    with torch.inference_mode():
        speech = tts_model.generate_speech(
            input_ids,
            speaker_embedding,
            vocoder=tts_vocoder,
        )

    audio = speech.detach().cpu().float().numpy().reshape(-1)
    audio = np.nan_to_num(audio, nan=0.0, posinf=0.0, neginf=0.0)

    if audio.size == 0:
        raise RuntimeError("SpeechT5 returned empty audio.")

    peak = float(np.max(np.abs(audio)))
    if peak < 1e-6:
        raise RuntimeError("SpeechT5 returned silence.")

    audio = audio / peak * 0.95
    padding = np.zeros(800, dtype=np.float32)
    audio = np.concatenate([padding, audio.astype(np.float32), padding])

    output_file = tempfile.NamedTemporaryFile(
        suffix=".wav",
        delete=False,
    )
    output_path = output_file.name
    output_file.close()

    sf.write(
        output_path,
        audio,
        samplerate=16000,
    )

    print(
        "SpeechT5 WAV:",
        output_path,
        "duration=",
        round(len(audio) / 16000, 2),
        "peak=",
        round(float(np.max(np.abs(audio))), 3),
    )

    return output_path


MAX_AUDIO_BYTES = 10 * 1024 * 1024
GPU_LOCK = threading.Lock()
ALLOWED_AUDIO_SUFFIXES = {".wav", ".webm", ".m4a", ".mp3", ".mp4", ".ogg"}

app = FastAPI(
    title="Armenian AI Voice API",
    version="1.0.0",
)


def remove_temporary_file(path):
    if path and os.path.exists(path):
        os.remove(path)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/voice-chat")
async def voice_chat(audio: UploadFile = File(...)):
    audio_bytes = await audio.read(MAX_AUDIO_BYTES + 1)

    if not audio_bytes:
        raise HTTPException(
            status_code=400,
            detail="Audio file is required.",
        )

    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Audio file must be 10 MB or smaller.",
        )

    suffix = Path(audio.filename or "").suffix.lower()
    if suffix not in ALLOWED_AUDIO_SUFFIXES:
        suffix = ".webm"

    input_file = tempfile.NamedTemporaryFile(
        suffix=suffix,
        delete=False,
    )
    input_path = input_file.name
    answer_audio = None

    try:
        input_file.write(audio_bytes)
        input_file.close()

        with GPU_LOCK:
            recognized_text = transcribe_audio(input_path)
            answer = generate_answer(recognized_text)
            answer_audio = synthesize_speech(answer)

        with open(answer_audio, "rb") as wav_file:
            wav_base64 = base64.b64encode(wav_file.read()).decode("ascii")

        return {
            "transcript": recognized_text,
            "answer": answer,
            "audio": {
                "mimeType": "audio/wav",
                "base64": wav_base64,
            },
        }
    except HTTPException:
        raise
    except Exception as error:
        print("voice_chat failed:", repr(error))
        raise HTTPException(
            status_code=500,
            detail="Voice pipeline failed.",
        ) from error
    finally:
        if not input_file.closed:
            input_file.close()
        remove_temporary_file(input_path)
        remove_temporary_file(answer_audio)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host=HOST,
        port=PORT,
    )
