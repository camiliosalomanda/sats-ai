import hashlib
import subprocess
import json


def compute_job_hash(job_event_id: str, result: str, node_pubkey: str) -> str:
    """SHA256 of (job_event_id + result + node_pubkey)."""
    data = f'{job_event_id}{result}{node_pubkey}'
    return hashlib.sha256(data.encode()).hexdigest()


def _send_op_return(op_return_hex: str, bitcoin_cli: str = 'bitcoin-cli') -> str:
    """Create, fund, sign, and broadcast an OP_RETURN transaction."""
    # Build OP_RETURN script: OP_RETURN (6a) + pushdata length + data
    data_bytes = bytes.fromhex(op_return_hex)
    script_hex = '6a' + format(len(data_bytes), '02x') + op_return_hex

    # Create raw tx with OP_RETURN output (0 value)
    raw_tx_json = json.dumps([])  # no inputs yet
    out_json = json.dumps([{"data": op_return_hex}])

    create = subprocess.run(
        [bitcoin_cli, 'createrawtransaction', raw_tx_json, out_json],
        capture_output=True, text=True, timeout=30,
    )
    if create.returncode != 0:
        raise RuntimeError(f'createrawtransaction failed: {create.stderr}')
    raw_tx = create.stdout.strip()

    # Fund the transaction (adds inputs + change)
    fund = subprocess.run(
        [bitcoin_cli, 'fundrawtransaction', raw_tx],
        capture_output=True, text=True, timeout=30,
    )
    if fund.returncode != 0:
        raise RuntimeError(f'fundrawtransaction failed: {fund.stderr}')
    funded = json.loads(fund.stdout)['hex']

    # Sign
    sign = subprocess.run(
        [bitcoin_cli, 'signrawtransactionwithwallet', funded],
        capture_output=True, text=True, timeout=30,
    )
    if sign.returncode != 0:
        raise RuntimeError(f'signrawtransaction failed: {sign.stderr}')
    signed = json.loads(sign.stdout)
    if not signed.get('complete'):
        raise RuntimeError('Transaction signing incomplete')

    # Broadcast
    send = subprocess.run(
        [bitcoin_cli, 'sendrawtransaction', signed['hex']],
        capture_output=True, text=True, timeout=30,
    )
    if send.returncode != 0:
        raise RuntimeError(f'sendrawtransaction failed: {send.stderr}')

    return send.stdout.strip()


def anchor_job(
    job_event_id: str,
    result_hash: str,
    node_pubkey: str,
    bitcoin_cli: str = 'bitcoin-cli',
) -> str:
    """Anchor a job completion hash to Bitcoin via OP_RETURN."""
    job_hash = compute_job_hash(job_event_id, result_hash, node_pubkey)
    op_return_hex = f'SATS-AI:{job_hash}'.encode().hex()
    return _send_op_return(op_return_hex, bitcoin_cli)


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
    op_return_hex = f'SATS-AI-MKT:{mkt_hash}'.encode().hex()
    return _send_op_return(op_return_hex, bitcoin_cli)


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
