import hashlib
import subprocess
import json


def compute_job_hash(job_event_id: str, result: str, node_pubkey: str) -> str:
    """SHA256 of (job_event_id + result + node_pubkey)."""
    data = f'{job_event_id}{result}{node_pubkey}'
    return hashlib.sha256(data.encode()).hexdigest()


def anchor_job(
    job_event_id: str,
    result_hash: str,
    node_pubkey: str,
    bitcoin_cli: str = 'bitcoin-cli',
) -> str:
    """Anchor a job completion hash to Bitcoin via OP_RETURN."""
    job_hash = compute_job_hash(job_event_id, result_hash, node_pubkey)
    op_return_data = f'SATS-AI:{job_hash}'.encode().hex()

    # Create a raw transaction with OP_RETURN
    result = subprocess.run(
        [
            bitcoin_cli,
            'sendtoaddress', '', '0', '', '', 'false', 'false',
            '1', 'UNSET',
            json.dumps({'data': op_return_data}),
            'true',
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode != 0:
        raise RuntimeError(f'Bitcoin anchor failed: {result.stderr}')

    txid = result.stdout.strip()
    return txid


def verify_anchor(txid: str, expected_hash: str, electrs_url: str) -> bool:
    """Verify a job anchor by checking OP_RETURN data in a transaction."""
    import httpx

    resp = httpx.get(f'{electrs_url}/tx/{txid}')
    tx = resp.json()

    for vout in tx.get('vout', []):
        if vout.get('scriptpubkey_type') == 'op_return':
            script = vout['scriptpubkey']
            # Skip OP_RETURN opcode prefix (6a + push bytes)
            data = bytes.fromhex(script[4:]).decode('utf-8', errors='ignore')
            if data.startswith('SATS-AI:'):
                embedded_hash = data.replace('SATS-AI:', '')
                return embedded_hash == expected_hash

    return False


# --- Market resolution anchoring ---

def compute_market_hash(
    market_id: str, outcome: str, consensus_event_id: str
) -> str:
    """SHA256 of (market_id || outcome || consensus_event_id)."""
    data = f'{market_id}{outcome}{consensus_event_id}'
    return hashlib.sha256(data.encode()).hexdigest()


def anchor_market_resolution(
    market_id: str,
    outcome: str,
    consensus_event_id: str,
    bitcoin_cli: str = 'bitcoin-cli',
) -> str:
    """Anchor a market resolution to Bitcoin via OP_RETURN."""
    mkt_hash = compute_market_hash(market_id, outcome, consensus_event_id)
    op_return_data = f'SATS-AI-MKT:{mkt_hash}'.encode().hex()

    result = subprocess.run(
        [
            bitcoin_cli,
            'sendtoaddress', '', '0', '', '', 'false', 'false',
            '1', 'UNSET',
            json.dumps({'data': op_return_data}),
            'true',
        ],
        capture_output=True,
        text=True,
        timeout=30,
    )

    if result.returncode != 0:
        raise RuntimeError(f'Market anchor failed: {result.stderr}')

    txid = result.stdout.strip()
    return txid


def verify_market_anchor(
    txid: str, market_id: str, outcome: str, consensus_event_id: str,
    electrs_url: str,
) -> dict:
    """Verify a market resolution anchor."""
    import httpx

    expected = compute_market_hash(market_id, outcome, consensus_event_id)
    resp = httpx.get(f'{electrs_url}/tx/{txid}')
    tx = resp.json()

    for vout in tx.get('vout', []):
        if vout.get('scriptpubkey_type') == 'op_return':
            script = vout['scriptpubkey']
            data = bytes.fromhex(script[4:]).decode('utf-8', errors='ignore')
            if data.startswith('SATS-AI-MKT:'):
                embedded_hash = data.replace('SATS-AI-MKT:', '')
                return {
                    'verified': embedded_hash == expected,
                    'block_height': tx.get('status', {}).get('block_height'),
                    'timestamp': tx.get('status', {}).get('block_time'),
                }

    return {'verified': False, 'block_height': None, 'timestamp': None}
