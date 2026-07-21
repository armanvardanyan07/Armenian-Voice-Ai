import argparse
import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass(frozen=True)
class LlmTrainingConfig:
    base_model: str
    train_file: str
    output_dir: str
    max_steps: int
    max_length: int
    learning_rate: float
    train_batch_size: int
    eval_batch_size: int
    gradient_accumulation_steps: int
    validation_size: float


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="train_llm_qlora", description="Train an Armenian instruction adapter with QLoRA.")
    parser.add_argument("--base-model", default="Qwen/Qwen3-4B-Base")
    parser.add_argument("--train-file", default="training/data/armenian_instructions.jsonl")
    parser.add_argument("--output-dir", default="artifacts/qwen3-armenian-qlora")
    parser.add_argument("--max-steps", type=int, default=2000)
    parser.add_argument("--max-length", type=int, default=1024)
    parser.add_argument("--learning-rate", type=float, default=2e-4)
    parser.add_argument("--train-batch-size", type=int, default=1)
    parser.add_argument("--eval-batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation-steps", type=int, default=16)
    parser.add_argument("--validation-size", type=float, default=0.05)
    parser.add_argument("--resume-from-checkpoint")
    parser.add_argument("--dry-run", action="store_true")
    return parser


def parse_config(args: argparse.Namespace) -> LlmTrainingConfig:
    return LlmTrainingConfig(
        base_model=args.base_model,
        train_file=args.train_file,
        output_dir=args.output_dir,
        max_steps=args.max_steps,
        max_length=args.max_length,
        learning_rate=args.learning_rate,
        train_batch_size=args.train_batch_size,
        eval_batch_size=args.eval_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        validation_size=args.validation_size,
    )


def run_training(config: LlmTrainingConfig, resume_from_checkpoint: str | None) -> None:
    import torch
    from datasets import load_dataset
    from peft import LoraConfig, prepare_model_for_kbit_training
    from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
    from trl import SFTConfig, SFTTrainer

    train_path = Path(config.train_file)
    if not train_path.is_file():
        raise FileNotFoundError(f"Training file not found: {train_path}")

    tokenizer = AutoTokenizer.from_pretrained(config.base_model, use_fast=True)
    tokenizer.pad_token = tokenizer.pad_token or tokenizer.eos_token
    tokenizer.padding_side = "right"

    quantization = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16,
        bnb_4bit_use_double_quant=True,
    )
    model = AutoModelForCausalLM.from_pretrained(
        config.base_model,
        quantization_config=quantization,
        device_map="auto",
        low_cpu_mem_usage=True,
    )
    model = prepare_model_for_kbit_training(model, use_gradient_checkpointing=True)

    dataset = load_dataset("json", data_files=str(train_path), split="train")

    def format_example(example):
        instruction = str(example.get("instruction", "")).strip()
        response = str(example.get("response", "")).strip()
        context = str(example.get("context", "")).strip()
        if not instruction or not response:
            raise ValueError("Every row must contain non-empty instruction and response fields.")
        user_content = instruction if not context else f"{instruction}\n\nՀամատեքստ՝\n{context}"
        messages = [
            {"role": "system", "content": "Դու օգտակար օգնական ես։ Պատասխանիր գրագետ արևելահայերենով։"},
            {"role": "user", "content": user_content},
            {"role": "assistant", "content": response},
        ]
        return {"text": tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=False)}

    dataset = dataset.map(format_example, remove_columns=dataset.column_names)
    split = dataset.train_test_split(test_size=config.validation_size, seed=42)
    lora = LoraConfig(
        r=32,
        lora_alpha=64,
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    )
    training_args = SFTConfig(
        output_dir=config.output_dir,
        max_steps=config.max_steps,
        max_length=config.max_length,
        learning_rate=config.learning_rate,
        per_device_train_batch_size=config.train_batch_size,
        per_device_eval_batch_size=config.eval_batch_size,
        gradient_accumulation_steps=config.gradient_accumulation_steps,
        gradient_checkpointing=True,
        bf16=torch.cuda.is_bf16_supported(),
        fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
        eval_strategy="steps",
        eval_steps=100,
        save_steps=100,
        logging_steps=10,
        warmup_ratio=0.03,
        lr_scheduler_type="cosine",
        optim="paged_adamw_8bit",
        report_to="none",
        dataset_text_field="text",
    )
    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=split["train"],
        eval_dataset=split["test"],
        processing_class=tokenizer,
        peft_config=lora,
    )
    trainer.train(resume_from_checkpoint=resume_from_checkpoint)
    trainer.save_model(config.output_dir)
    tokenizer.save_pretrained(config.output_dir)


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
