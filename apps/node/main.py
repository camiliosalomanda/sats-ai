import os
import sys
import asyncio
import subprocess
from config import Config
from dvm_handler import SatsAINode
from reputation import announce_loop
from nostr_client import connect_to_relays


def _get_server_binary() -> str:
    """Find llama-server binary."""
    candidates = [
        os.environ.get('LLAMA_SERVER', ''),
        './llama-bin/llama-server.exe',
        './llama.cpp/llama-server.exe',
        './llama.cpp/llama-server',
        '/llama.cpp/llama-server',
    ]
    for path in candidates:
        if path and os.path.isfile(path):
            return path
    return 'llama-server.exe' if sys.platform == 'win32' else './llama.cpp/llama-server'


def start_llama_server(config: Config) -> subprocess.Popen | None:
    """Start llama-server as a background process (if not already running)."""
    server_url = os.environ.get('LLAMA_SERVER_URL', 'http://127.0.0.1:8080')

    # Check if external server is already running
    try:
        import httpx
        resp = httpx.get(f'{server_url}/health', timeout=2)
        if resp.status_code == 200:
            print(f'[server] External llama-server already running at {server_url}')
            return None
    except Exception:
        pass

    binary = _get_server_binary()
    port = server_url.split(':')[-1].rstrip('/')
    cmd = [
        binary,
        '-m', config.model_path,
        '--port', port,
        '-ngl', os.environ.get('GPU_LAYERS', '99'),
        '-c', '2048',
        '--threads', str(os.cpu_count() or 4),
    ]

    print(f'[server] Starting llama-server: {binary}')
    print(f'[server] Model: {config.model_path}')
    print(f'[server] Port: {port}')

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )

    # Wait for server to be ready
    import time
    import httpx
    for i in range(60):
        time.sleep(2)
        try:
            resp = httpx.get(f'{server_url}/health', timeout=2)
            if resp.status_code == 200:
                print(f'[server] llama-server ready on port {port}')
                return proc
        except Exception:
            pass
        if proc.poll() is not None:
            stderr = proc.stderr.read().decode() if proc.stderr else ''
            raise RuntimeError(f'llama-server exited: {stderr[-500:]}')
        if i % 5 == 4:
            print(f'[server] Waiting for model to load... ({(i+1)*2}s)')

    raise RuntimeError('llama-server failed to start within 120 seconds')


async def main():
    config = Config.from_env()

    # Start inference server
    server_proc = start_llama_server(config)

    print(f'Starting SATS-AI node')
    print(f'Model: {config.model_name}')
    print(f'Price: {config.sats_per_1k_tokens} sats/1k tokens')
    print(f'LN Address: {config.ln_address}')
    print(f'Relays: {config.relays}')

    resolver_mode = os.environ.get('RESOLVER_MODE', 'false').lower() == 'true'
    if resolver_mode:
        print(f'Resolver mode: ENABLED')

    try:
        async with connect_to_relays(config.relays, config.nostr_privkey) as client:
            asyncio.create_task(announce_loop(client, config))

            if resolver_mode:
                from resolver import resolver_loop
                from htlc_manager import HTLCManager
                htlc = HTLCManager()
                asyncio.create_task(resolver_loop(client, config, htlc))
                print(f'Resolver backend: {htlc.backend}')

            node = SatsAINode(config)
            await node.listen(client)
    finally:
        if server_proc:
            server_proc.terminate()
            print('[server] llama-server stopped')


if __name__ == '__main__':
    asyncio.run(main())
