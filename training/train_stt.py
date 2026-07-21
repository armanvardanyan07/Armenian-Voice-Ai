import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class SttTrainingConfig:
    base_model: str
    dataset: str
    output_dir: str
    max_steps: int
    learning_rate: float
    train_batch_size: int
    eval_batch_size: int
    gradient_accumulation_steps: int
    warmup_steps: int
    max_train_samples: int | None
    max_eval_samples: int | None


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="train_stt", description="Fine-tune Whisper for Armenian speech recognition.")
    parser.add_argument("--base-model", default="openai/whisper-large-v3-turbo")
    parser.add_argument("--dataset", default="Chillarmo/common_voice_20_armenian")
    parser.add_argument("--output-dir", default="artifacts/whisper-armenian")
    parser.add_argument("--max-steps", type=int, default=5000)
    parser.add_argument("--learning-rate", type=float, default=1e-5)
    parser.add_argument("--train-batch-size", type=int, default=4)
    parser.add_argument("--eval-batch-size", type=int, default=4)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=8)
    parser.add_argument("--warmup-steps", type=int, default=500)
    parser.add_argument("--max-train-samples", type=int)
    parser.add_argument("--max-eval-samples", type=int)
    parser.add_argument("--resume-from-checkpoint")
    parser.add_argument("--dry-run", action="store_true")
    return parser


def parse_config(args: argparse.Namespace) -> SttTrainingConfig:
    return SttTrainingConfig(
        base_model=args.base_model,
        dataset=args.dataset,
        output_dir=args.output_dir,
        max_steps=args.max_steps,
        learning_rate=args.learning_rate,
        train_batch_size=args.train_batch_size,
        eval_batch_size=args.eval_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        warmup_steps=args.warmup_steps,
        max_train_samples=args.max_train_samples,
        max_eval_samples=args.max_eval_samples,
    )


def run_training(config: SttTrainingConfig, resume_from_checkpoint: str | None) -> None:
    import evaluate
    import torch
    from datasets import Audio, DatasetDict, load_dataset
    from transformers import (
        AutoModelForSpeechSeq2Seq,
        AutoProcessor,
        Seq2SeqTrainer,
        Seq2SeqTrainingArguments,
    )

    processor = AutoProcessor.from_pretrained(config.base_model, language="Armenian", task="transcribe")
    model = AutoModelForSpeechSeq2Seq.from_pretrained(
        config.base_model,
        torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
        low_cpu_mem_usage=True,
        use_safetensors=True,
    )
    model.config.forced_decoder_ids = None
    model.config.suppress_tokens = []
    model.freeze_feature_encoder()

    raw = load_dataset(config.dataset)
    eval_split = "validation" if "validation" in raw else "test"
    datasets = DatasetDict(train=raw["train"], validation=raw[eval_split])
    datasets = datasets.cast_column("audio", Audio(sampling_rate=16000))
    if config.max_train_samples is not None:
        datasets["train"] = datasets["train"].select(range(min(config.max_train_samples, len(datasets["train"]))))
    if config.max_eval_samples is not None:
        datasets["validation"] = datasets["validation"].select(range(min(config.max_eval_samples, len(datasets["validation"]))))

    def prepare(example):
        audio = example["audio"]
        example["input_features"] = processor.feature_extractor(
            audio["array"],
            sampling_rate=audio["sampling_rate"],
        ).input_features[0]
        example["labels"] = processor.tokenizer(example["sentence"]).input_ids
        return example

    remove_columns = datasets["train"].column_names
    datasets = datasets.map(prepare, remove_columns=remove_columns, num_proc=1)

    class DataCollator:
        def __call__(self, features):
            input_features = [{"input_features": feature["input_features"]} for feature in features]
            label_features = [{"input_ids": feature["labels"]} for feature in features]
            batch = processor.feature_extractor.pad(input_features, return_tensors="pt")
            labels_batch = processor.tokenizer.pad(label_features, return_tensors="pt")
            labels = labels_batch["input_ids"].masked_fill(labels_batch.attention_mask.ne(1), -100)
            if (labels[:, 0] == processor.tokenizer.bos_token_id).all().cpu().item():
                labels = labels[:, 1:]
            batch["labels"] = labels
            return batch

    wer = evaluate.load("wer")

    def compute_metrics(prediction):
        predictions = prediction.predictions
        labels = prediction.label_ids
        labels[labels == -100] = processor.tokenizer.pad_token_id
        predicted_text = processor.tokenizer.batch_decode(predictions, skip_special_tokens=True)
        label_text = processor.tokenizer.batch_decode(labels, skip_special_tokens=True)
        return {"wer": 100 * wer.compute(predictions=predicted_text, references=label_text)}

    training_args = Seq2SeqTrainingArguments(
        output_dir=config.output_dir,
        max_steps=config.max_steps,
        learning_rate=config.learning_rate,
        per_device_train_batch_size=config.train_batch_size,
        per_device_eval_batch_size=config.eval_batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        warmup_steps=config.warmup_steps,
        gradient_checkpointing=True,
        fp16=torch.cuda.is_available(),
        eval_strategy="steps",
        eval_steps=250,
        save_steps=250,
        logging_steps=25,
        predict_with_generate=True,
        generation_max_length=225,
        load_best_model_at_end=True,
        metric_for_best_model="wer",
        greater_is_better=False,
        report_to="none",
        remove_unused_columns=False,
    )
    trainer = Seq2SeqTrainer(
        model=model,
        args=training_args,
        train_dataset=datasets["train"],
        eval_dataset=datasets["validation"],
        data_collator=DataCollator(),
        compute_metrics=compute_metrics,
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
