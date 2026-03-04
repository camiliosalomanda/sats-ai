"""Minimal pure-Python Nostr client for SATS-AI node.

Replaces nostr-dvm dependency with zero C extensions.
Uses secp256k1 via Python's hashlib + manual EC math.
"""
import asyncio
import hashlib
import hmac
import json
import secrets
import struct
import time
from typing import Callable

import websockets


# --- secp256k1 pure-Python (signing + pubkey derivation) ---

# secp256k1 curve parameters
P = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEFFFFFC2F
N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141
Gx = 0x79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798
Gy = 0x483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8


def _modinv(a: int, m: int) -> int:
    """Modular inverse using extended Euclidean algorithm."""
    if a < 0:
        a = a % m
    g, x, _ = _extended_gcd(a, m)
    if g != 1:
        raise ValueError('No modular inverse')
    return x % m


def _extended_gcd(a: int, b: int):
    if a == 0:
        return b, 0, 1
    g, x, y = _extended_gcd(b % a, a)
    return g, y - (b // a) * x, x


def _point_add(p1, p2):
    if p1 is None:
        return p2
    if p2 is None:
        return p1
    x1, y1 = p1
    x2, y2 = p2
    if x1 == x2 and y1 != y2:
        return None
    if x1 == x2:
        lam = (3 * x1 * x1) * _modinv(2 * y1, P) % P
    else:
        lam = (y2 - y1) * _modinv(x2 - x1, P) % P
    x3 = (lam * lam - x1 - x2) % P
    y3 = (lam * (x1 - x3) - y1) % P
    return (x3, y3)


def _point_mul(k: int, point=None):
    if point is None:
        point = (Gx, Gy)
    result = None
    addend = point
    while k:
        if k & 1:
            result = _point_add(result, addend)
        addend = _point_add(addend, addend)
        k >>= 1
    return result


def privkey_to_pubkey(privkey_hex: str) -> str:
    """Derive x-only public key (32 bytes hex) from private key."""
    k = int(privkey_hex, 16)
    point = _point_mul(k)
    return format(point[0], '064x')


def _det_k(privkey: int, msg_hash: bytes) -> int:
    """RFC 6979 deterministic k for signing."""
    x = privkey.to_bytes(32, 'big')
    v = b'\x01' * 32
    k = b'\x00' * 32
    k = hmac.new(k, v + b'\x00' + x + msg_hash, hashlib.sha256).digest()
    v = hmac.new(k, v, hashlib.sha256).digest()
    k = hmac.new(k, v + b'\x01' + x + msg_hash, hashlib.sha256).digest()
    v = hmac.new(k, v, hashlib.sha256).digest()
    while True:
        v = hmac.new(k, v, hashlib.sha256).digest()
        candidate = int.from_bytes(v, 'big')
        if 1 <= candidate < N:
            return candidate
        k = hmac.new(k, v + b'\x00', hashlib.sha256).digest()
        v = hmac.new(k, v, hashlib.sha256).digest()


def schnorr_sign(privkey_hex: str, msg_hash: bytes) -> str:
    """BIP-340 Schnorr signature."""
    d = int(privkey_hex, 16)
    pubpoint = _point_mul(d)
    px = pubpoint[0]
    # Negate d if y is odd
    if pubpoint[1] % 2 != 0:
        d = N - d

    px_bytes = px.to_bytes(32, 'big')

    # Aux randomness (deterministic for reproducibility)
    aux = hashlib.sha256(privkey_hex.encode()).digest()
    t = bytes(a ^ b for a, b in zip(d.to_bytes(32, 'big'), _tagged_hash('BIP0340/aux', aux)))

    k0 = int.from_bytes(_tagged_hash('BIP0340/nonce', t + px_bytes + msg_hash), 'big') % N
    if k0 == 0:
        raise ValueError('k0 is zero')

    R = _point_mul(k0)
    if R[1] % 2 != 0:
        k0 = N - k0

    rx = R[0].to_bytes(32, 'big')
    e = int.from_bytes(_tagged_hash('BIP0340/challenge', rx + px_bytes + msg_hash), 'big') % N
    s = (k0 + e * d) % N

    sig = rx + s.to_bytes(32, 'big')
    return sig.hex()


def _tagged_hash(tag: str, data: bytes) -> bytes:
    tag_hash = hashlib.sha256(tag.encode()).digest()
    return hashlib.sha256(tag_hash + tag_hash + data).digest()


# --- Nostr event handling ---

def compute_event_id(event: dict) -> str:
    """Compute NIP-01 event ID."""
    serialized = json.dumps([
        0,
        event['pubkey'],
        event['created_at'],
        event['kind'],
        event['tags'],
        event['content'],
    ], separators=(',', ':'), ensure_ascii=False)
    return hashlib.sha256(serialized.encode()).hexdigest()


def sign_event(event: dict, privkey_hex: str) -> dict:
    """Sign a Nostr event."""
    pubkey = privkey_to_pubkey(privkey_hex)
    event['pubkey'] = pubkey
    event['created_at'] = event.get('created_at', int(time.time()))
    event['id'] = compute_event_id(event)
    event['sig'] = schnorr_sign(privkey_hex, bytes.fromhex(event['id']))
    return event


class NostrClient:
    """Async Nostr relay client."""

    def __init__(self, relays: list[str], privkey: str):
        self.relays = relays
        self.privkey = privkey
        self.pubkey = privkey_to_pubkey(privkey)
        self._ws_connections: list = []
        self._subscriptions: dict[str, Callable] = {}
        self._running = False

    async def connect(self):
        """Connect to all relays."""
        for url in self.relays:
            try:
                ws = await websockets.connect(url)
                self._ws_connections.append(ws)
                print(f'[nostr] Connected to {url}')
            except Exception as e:
                print(f'[nostr] Failed to connect to {url}: {e}')

    async def close(self):
        self._running = False
        for ws in self._ws_connections:
            await ws.close()

    async def publish(self, event: dict):
        """Sign and publish an event to all connected relays."""
        if 'sig' not in event:
            event = sign_event(event, self.privkey)
        msg = json.dumps(['EVENT', event])
        for ws in self._ws_connections:
            try:
                await ws.send(msg)
            except Exception as e:
                print(f'[nostr] Publish error: {e}')

    async def subscribe(self, filters: list[dict], callback: Callable, sub_id: str = None):
        """Subscribe to events matching filters."""
        sub_id = sub_id or secrets.token_hex(8)
        self._subscriptions[sub_id] = callback
        msg = json.dumps(['REQ', sub_id] + filters)
        for ws in self._ws_connections:
            try:
                await ws.send(msg)
            except Exception as e:
                print(f'[nostr] Subscribe error: {e}')
        return sub_id

    async def listen(self):
        """Listen for events from all relays."""
        self._running = True

        async def _listen_ws(ws):
            try:
                async for raw in ws:
                    try:
                        msg = json.loads(raw)
                        if msg[0] == 'EVENT' and len(msg) >= 3:
                            sub_id = msg[1]
                            event = msg[2]
                            if sub_id in self._subscriptions:
                                cb = self._subscriptions[sub_id]
                                if asyncio.iscoroutinefunction(cb):
                                    await cb(event)
                                else:
                                    cb(event)
                    except (json.JSONDecodeError, IndexError):
                        pass
            except websockets.ConnectionClosed:
                print(f'[nostr] Connection closed, reconnecting...')
            except Exception as e:
                print(f'[nostr] Listen error: {e}')

        tasks = [asyncio.create_task(_listen_ws(ws)) for ws in self._ws_connections]
        await asyncio.gather(*tasks)


# --- Convenience: connect_to_relays replacement ---

class _ClientContextManager:
    def __init__(self, relays, privkey):
        self.client = NostrClient(relays, privkey)

    async def __aenter__(self):
        await self.client.connect()
        return self.client

    async def __aexit__(self, *args):
        await self.client.close()


def connect_to_relays(relays: list[str], privkey: str):
    """Drop-in replacement for nostr_dvm's connect_to_relays."""
    return _ClientContextManager(relays, privkey)
