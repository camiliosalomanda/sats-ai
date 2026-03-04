import os
import sys
import json
import subprocess
from dataclasses import dataclass

import httpx


@dataclass
class InferenceResult:
    text: str
    tokens_generated: int
    prompt_tokens: int


# ---------- HTTP mode (llama-server) ----------

LLAMA_SERVER_URL = os.environ.get('LLAMA_SERVER_URL', 'http://127.0.0.1:8080')


async def run_inference_http(
    prompt: str,
    max_tokens: int = 512,
    temp: float = 0.7,
) -> InferenceResult:
    """Call a running llama-server via its /completion endpoint."""
    async with httpx.AsyncClient(timeout=300) as client:
        resp = await client.post(
            f'{LLAMA_SERVER_URL}/completion',
            json={
                'prompt': prompt,
                'n_predict': max_tokens,
                'temperature': temp,
                'stop': ['<|eot_id|>', '<|end_of_text|>'],
            },
        )
        resp.raise_for_status()
        data = resp.json()

    return InferenceResult(
        text=data.get('content', '').strip(),
        tokens_generated=data.get('tokens_predicted', len(data.get('content', '')) // 4),
        prompt_tokens=data.get('tokens_evaluated', len(prompt) // 4),
    )


# ---------- Subprocess mode (fallback) ----------

def _get_llama_binary() -> str:
    """Find the llama-cli / llama-completion binary."""
    candidates = [
        os.environ.get('LLAMA_CLI', ''),
        './llama.cpp/llama-completion.exe',
        './llama.cpp/llama-completion',
        './llama.cpp/llama-cli.exe',
        './llama.cpp/llama-cli',
        '/llama.cpp/llama-cli',
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return 'llama-cli.exe' if sys.platform == 'win32' else './llama.cpp/llama-cli'


def run_inference(
    model_path: str,
    prompt: str,
    max_tokens: int = 512,
    temp: float = 0.7,
) -> InferenceResult:
    """Subprocess-based inference (loads model every call — use HTTP mode in production)."""
    binary = _get_llama_binary()
    result = subprocess.run(
        [
            binary,
            '-m', model_path,
            '-p', prompt,
            '--n-predict', str(max_tokens),
            '--temp', str(temp),
            '--no-display-prompt',
            '-no-cnv',
            '-ngl', '0',
            '-c', '2048',
        ],
        capture_output=True,
        text=True,
        timeout=300,
    )

    if result.returncode != 0:
        raise RuntimeError(f'Inference failed: {result.stderr[-500:]}')

    output = result.stdout.strip()
    return InferenceResult(
        text=output,
        tokens_generated=len(output) // 4,
        prompt_tokens=len(prompt) // 4,
    )
