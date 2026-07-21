import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class TtsTrainingConfig:
    base_model: str
    manifest: str
    speaker_embedding: str
    output_dir: str
    max_steps: int
    learning_rate: float
    train_batch_size: int
    eval_batch_size: int
    gradient_accumulation_steps: int
    validation_size: float


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="train_tts", description="Fine-tune SpeechT5 for Armenian speech synthesis.")
    parser.add_argument("--base-model", default="microsoft/speecht5_tts")
    parser.add_argument("--manifest", default="training/data/armenian_tts.jsonl")
    parser.add_argument("--speaker-embedding", default="training/data/speaker_embedding.npy")
    parser.add_argument("--output-dir", default="artifacts/speecht5-armenian")
    parser.add_argument("--max-steps", type=int, default=4000)
    parser.add_argument("--learning-rate", type=float, default=2e-5)
    parser.add_argument("--train-batch-size", type=int, default=4)
    parser.add_argument("--eval-batch-size", type=int, default=2)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--validation-size", type=float, default=0.05)
    parser.add_argument("--resume-from-checkpoint")
    parser.add_argument("--dry-run", action="store_true")
    return parser


def parse_config(args: argparse.Namespace) -> TtsTrainingConfig:
    return TtsTrainingConfig(
        base_model=args.base_model,
        manifest=args.manifest,
        speaker_embedding=args.speaker_embedding,
        output_dir=args.output_dir,
        max_steps=args.max_steps,
        learning_rate=args.learning_rate,
        train_batch_size=args.train_batch_size,
        eval_batch_size=args.eval_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        validation_size=args.validation_size,
    )


def run_training(config: TtsTrainingConfig, resume_from_checkpoint: str | None) -> None:
    import numpy as np
    import torch
    from datasets import Audio, load_dataset
    from transformers import Seq2SeqTrainer, Seq2SeqTrainingArguments, SpeechT5ForTextToSpeech, SpeechT5Processor

    manifest_path = Path(config.manifest)
    embedding_path = Path(config.speaker_embedding)
    if not manifest_path.is_file():
        raise FileNotFoundError(f"TTS manifest not found: {manifest_path}")
    if not embedding_path.is_file():
        raise FileNotFoundError(f"Speaker embedding not found: {embedding_path}")

    speaker_embedding = np.load(embedding_path).astype(np.float32).reshape(-1)
    if speaker_embedding.shape != (512,):
        raise ValueError("Speaker embedding must contain exactly 512 float values.")

    processor = SpeechT5Processor.from_pretrained(config.base_model)
    model = SpeechT5ForTextToSpeech.from_pretrained(config.base_model)
    dataset = load_dataset("json", data_files=str(manifest_path), split="train")
    required_columns = {"audio", "text"}
    if not required_columns.issubset(dataset.column_names):
        raise ValueError("Every TTS manifest row must contain audio and text fields.")
    dataset = dataset.cast_column("audio", Audio(sampling_rate=16000))

    def prepare(example):
        text = str(example["text"]).strip()
        if not text:
            raise ValueError("TTS text must not be empty.")
        audio = example["audio"]
        processed = processor(
            text=text,
            audio_target=audio["array"],
            sampling_rate=audio["sampling_rate"],
            return_attention_mask=False,
        )
        return {
            "input_ids": processed["input_ids"][0],
            "labels": processed["labels"][0],
            "speaker_embeddings": speaker_embedding,
        }

    dataset = dataset.map(prepare, remove_columns=dataset.column_names, num_proc=1)
    split = dataset.train_test_split(test_size=config.validation_size, seed=42)

    class DataCollator:
        def __call__(self, features):
            input_features = [{"input_ids": feature["input_ids"]} for feature in features]
            label_features = [{"input_values": feature["labels"]} for feature in features]
            batch = processor.pad(input_ids=input_features, labels=label_features, return_tensors="pt")
            batch["labels"] = batch["labels"].masked_fill(batch["decoder_attention_mask"].unsqueeze(-1).ne(1), -100)
            del batch["decoder_attention_mask"]
            reduction_factor = model.config.reduction_factor
            target_length = batch["labels"].shape[1]
            if target_length % reduction_factor != 0:
                batch["labels"] = batch["labels"][:, : target_length - target_length % reduction_factor]
            batch["speaker_embeddings"] = torch.tensor(
                np.stack([feature["speaker_embeddings"] for feature in features]),
                dtype=torch.float32,
            )
            return batch

    training_args = Seq2SeqTrainingArguments(
        output_dir=config.output_dir,
        max_steps=config.max_steps,
        learning_rate=config.learning_rate,
        per_device_train_batch_size=config.train_batch_size,
        per_device_eval_batch_size=config.eval_batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        gradient_checkpointing=True,
        fp16=torch.cuda.is_available(),
        eval_strategy="steps",
        eval_steps=250,
        save_steps=250,
        logging_steps=25,
        warmup_steps=500,
        load_best_model_at_end=True,
        report_to="none",
        remove_unused_columns=False,
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=split["train"],
        eval_dataset=split["test"],
        data_collator=DataCollator(),
        processing_class=processor,
    )
    trainer.train(resume_from_checkpoint=resume_from_checkpoint)
    trainer.save_model(config.output_dir)
    processor.save_pretrained(config.output_dir)


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()
    config = parse_config(args)
    if args.dry_run:
        print(json.dumps(asdict(config), ensure_ascii=False, indent=2))
        return
    Path(config.output_dir).mkdir(parents=True, exist_ok=True)
    run_training(config, args.resume_from_checkpoint)


if __name__ == "__main__":
    main()
