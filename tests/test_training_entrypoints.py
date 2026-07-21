import json
from pathlib import Path
import subprocess
import sys
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
TRAINING_DIR = PROJECT_ROOT / "training"


class TrainingEntrypointTests(unittest.TestCase):
    def run_dry(self, script_name):
        process = subprocess.run(
            [sys.executable, str(TRAINING_DIR / script_name), "--dry-run"],
            cwd=PROJECT_ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
        return json.loads(process.stdout)

    def test_stt_dry_run_exposes_armenian_whisper_defaults(self):
        config = self.run_dry("train_stt.py")

        self.assertEqual(config["base_model"], "openai/whisper-large-v3-turbo")
        self.assertEqual(config["dataset"], "Chillarmo/common_voice_20_armenian")
        self.assertGreater(config["max_steps"], 0)

    def test_llm_dry_run_uses_adapter_friendly_base_model(self):
        config = self.run_dry("train_llm_qlora.py")

        self.assertEqual(config["base_model"], "Qwen/Qwen3-4B-Base")
        self.assertIn("qlora", config["output_dir"])
        self.assertGreater(config["gradient_accumulation_steps"], 1)

    def test_tts_dry_run_requires_manifest_and_speaker_embedding_paths(self):
        config = self.run_dry("train_tts.py")

        self.assertTrue(config["manifest"].endswith(".jsonl"))
        self.assertTrue(config["speaker_embedding"].endswith(".npy"))
        self.assertGreater(config["max_steps"], 0)


if __name__ == "__main__":
    unittest.main()
