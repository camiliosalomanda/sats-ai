import os
from dataclasses import dataclass


@dataclass
class Config:
    nostr_privkey: str
    ln_address: str
    model_path: str
    model_name: str
    model_id: str
    sats_per_1k_tokens: int
    relays: list[str]
    max_tokens: int

    @classmethod
    def from_env(cls):
        return cls(
            nostr_privkey=os.environ['NOSTR_PRIVKEY'],
            ln_address=os.environ['LN_ADDRESS'],
            model_path=os.environ['MODEL_PATH'],
            model_name=os.environ.get('MODEL_NAME', 'Unknown'),
            model_id=os.environ.get('MODEL_ID', 'unknown'),
            sats_per_1k_tokens=int(os.environ.get('SATS_PER_1K', '1')),
            relays=os.environ.get(
                'RELAYS', 'wss://relay.damus.io'
            ).split(','),
            max_tokens=int(os.environ.get('MAX_TOKENS', '2048')),
        )
