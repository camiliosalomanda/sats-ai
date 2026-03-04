import subprocess
from dataclasses import dataclass


@dataclass
class InferenceResult:
    text: str
    tokens_generated: int
    prompt_tokens: int


def run_inference(
    model_path: str,
    prompt: str,
    max_tokens: int = 512,
    temp: float = 0.7,
) -> InferenceResult:
    result = subprocess.run(
        [
            './llama.cpp/llama-cli',
            '-m', model_path,
            '-p', prompt,
            '--n-predict', str(max_tokens),
            '--temp', str(temp),
            '--no-display-prompt',
            '-ngl', '0',
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )

    if result.returncode != 0:
        raise RuntimeError(f'Inference failed: {result.stderr}')

    output = result.stdout.strip()
    return InferenceResult(
        text=output,
        tokens_generated=len(output) // 4,
        prompt_tokens=len(prompt) // 4,
    )
