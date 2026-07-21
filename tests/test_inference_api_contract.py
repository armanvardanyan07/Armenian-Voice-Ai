import ast
from pathlib import Path
import unittest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
API_SOURCE = PROJECT_ROOT / "inference" / "server.py"


class InferenceApiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = API_SOURCE.read_text(encoding="utf-8")
        cls.tree = ast.parse(cls.source)

    def test_exposes_health_and_voice_chat_routes(self):
        routes = set()

        for node in ast.walk(self.tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                if not isinstance(decorator, ast.Call):
                    continue
                if not isinstance(decorator.func, ast.Attribute):
                    continue
                if not decorator.args or not isinstance(decorator.args[0], ast.Constant):
                    continue
                routes.add((decorator.func.attr, decorator.args[0].value))

        self.assertIn(("get", "/health"), routes)
        self.assertIn(("post", "/voice-chat"), routes)

    def test_returns_transcript_answer_and_inline_wav(self):
        self.assertIn('"transcript": recognized_text', self.source)
        self.assertIn('"answer": answer', self.source)
        self.assertIn('"mimeType": "audio/wav"', self.source)
        self.assertIn('base64.b64encode', self.source)

    def test_validates_upload_size_and_serializes_gpu_pipeline(self):
        self.assertIn("MAX_AUDIO_BYTES = 10 * 1024 * 1024", self.source)
        self.assertIn("GPU_LOCK = threading.Lock()", self.source)
        self.assertIn("with GPU_LOCK:", self.source)
        self.assertIn("status_code=413", self.source)

    def test_does_not_expose_a_gradio_transport(self):
        self.assertNotIn("import gradio", self.source)
        self.assertNotIn("gr.Blocks", self.source)
        self.assertNotIn("api_name=", self.source)

    def test_rejects_a_repetitive_whisper_hallucination(self):
        function = next(
            node
            for node in self.tree.body
            if isinstance(node, ast.FunctionDef)
            and node.name == "is_degenerate_transcript"
        )
        namespace = {}
        exec(
            compile(
                ast.Module(body=[function], type_ignores=[]),
                filename=str(API_SOURCE),
                mode="exec",
            ),
            namespace,
        )

        is_degenerate = namespace["is_degenerate_transcript"]
        repeated = " ".join(["համանական"] * 12)

        self.assertTrue(is_degenerate(repeated))
        self.assertFalse(is_degenerate("Բարև, ոնց ես, ես լավ եմ։"))

    def test_uses_bounded_beam_search_without_the_conflicting_token_limit(self):
        self.assertNotIn("max_new_tokens=128", self.source)
        self.assertIn("max_length=96", self.source)
        self.assertIn("num_beams=4", self.source)
        self.assertIn("no_repeat_ngram_size=3", self.source)
        self.assertIn("clean_up_tokenization_spaces=False", self.source)


if __name__ == "__main__":
    unittest.main()
