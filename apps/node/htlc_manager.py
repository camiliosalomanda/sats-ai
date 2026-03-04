"""HTLC stake management for resolver stakes.

Supports LND REST API and CLN REST API (auto-detect from env).
"""

import os
import hashlib
import secrets
import httpx


class HTLCManager:
    def __init__(self):
        self.lnd_url = os.environ.get('LND_REST_URL', '')
        self.lnd_macaroon = os.environ.get('LND_MACAROON', '')
        self.cln_url = os.environ.get('CLN_REST_URL', '')
        self.cln_rune = os.environ.get('CLN_RUNE', '')
        self.backend = self._detect_backend()

        # Track our preimages locally: payment_hash -> preimage
        self._preimages: dict[str, str] = {}

    def _detect_backend(self) -> str:
        if self.lnd_url and self.lnd_macaroon:
            return 'lnd'
        if self.cln_url and self.cln_rune:
            return 'cln'
        return 'none'

    async def lock_stake(self, amount_msats: int) -> dict | None:
        """Create a hold invoice to lock stake.

        Returns {payment_hash, payment_request} or None on failure.
        """
        if self.backend == 'none':
            print('[htlc] No Lightning backend configured')
            return None

        # Generate preimage and hash
        preimage = secrets.token_bytes(32)
        preimage_hex = preimage.hex()
        payment_hash = hashlib.sha256(preimage).hexdigest()

        # Store preimage for later settlement
        self._preimages[payment_hash] = preimage_hex

        if self.backend == 'lnd':
            return await self._lnd_hold_invoice(payment_hash, amount_msats)
        else:
            return await self._cln_hold_invoice(payment_hash, amount_msats)

    async def _lnd_hold_invoice(
        self, payment_hash: str, amount_msats: int
    ) -> dict | None:
        """Create a hold invoice via LND REST API."""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                resp = await client.post(
                    f'{self.lnd_url}/v2/invoices/hodl',
                    json={
                        'hash': payment_hash,
                        'value_msat': str(amount_msats),
                    },
                    headers={'Grpc-Metadata-macaroon': self.lnd_macaroon},
                    timeout=15,
                )
                data = resp.json()
                return {
                    'payment_hash': payment_hash,
                    'payment_request': data.get('payment_request', ''),
                }
        except Exception as e:
            print(f'[htlc] LND hold invoice failed: {e}')
            return None

    async def _cln_hold_invoice(
        self, payment_hash: str, amount_msats: int
    ) -> dict | None:
        """Create a hold invoice via CLN REST API."""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                resp = await client.post(
                    f'{self.cln_url}/v1/holdinvoice',
                    json={
                        'payment_hash': payment_hash,
                        'amount_msat': amount_msats,
                        'label': f'satsai-resolver-{payment_hash[:16]}',
                        'description': 'SATS-AI resolver stake',
                    },
                    headers={'Rune': self.cln_rune},
                    timeout=15,
                )
                data = resp.json()
                return {
                    'payment_hash': payment_hash,
                    'payment_request': data.get('bolt11', ''),
                }
        except Exception as e:
            print(f'[htlc] CLN hold invoice failed: {e}')
            return None

    async def settle_stakes(
        self, my_verdict: str, consensus_outcome: str, payment_hash: str
    ):
        """Settle or slash stake based on consensus outcome."""
        preimage = self._preimages.get(payment_hash)
        if not preimage:
            print(f'[htlc] No preimage found for {payment_hash[:16]}')
            return

        if consensus_outcome == 'INVALID':
            # INVALID consensus: all stakes returned
            await self._settle_invoice(payment_hash, preimage)
            print(f'[htlc] Stake returned (INVALID consensus)')
        elif my_verdict == consensus_outcome:
            # Honest resolver: stake returned
            await self._settle_invoice(payment_hash, preimage)
            print(f'[htlc] Stake returned (honest vote: {my_verdict})')
        else:
            # Wrong vote: stake slashed
            await self._cancel_invoice(payment_hash)
            print(f'[htlc] Stake SLASHED (voted {my_verdict}, '
                  f'consensus was {consensus_outcome})')

        # Clean up
        self._preimages.pop(payment_hash, None)

    async def _settle_invoice(self, payment_hash: str, preimage: str):
        """Settle a hold invoice by revealing the preimage."""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                if self.backend == 'lnd':
                    await client.post(
                        f'{self.lnd_url}/v2/invoices/settle',
                        json={'preimage': preimage},
                        headers={'Grpc-Metadata-macaroon': self.lnd_macaroon},
                        timeout=15,
                    )
                elif self.backend == 'cln':
                    await client.post(
                        f'{self.cln_url}/v1/holdinvoice/settle',
                        json={'payment_hash': payment_hash, 'preimage': preimage},
                        headers={'Rune': self.cln_rune},
                        timeout=15,
                    )
        except Exception as e:
            print(f'[htlc] Settle failed: {e}')

    async def _cancel_invoice(self, payment_hash: str):
        """Cancel a hold invoice (slash the stake)."""
        try:
            async with httpx.AsyncClient(verify=False) as client:
                if self.backend == 'lnd':
                    await client.post(
                        f'{self.lnd_url}/v2/invoices/cancel',
                        json={'payment_hash': payment_hash},
                        headers={'Grpc-Metadata-macaroon': self.lnd_macaroon},
                        timeout=15,
                    )
                elif self.backend == 'cln':
                    await client.post(
                        f'{self.cln_url}/v1/holdinvoice/cancel',
                        json={'payment_hash': payment_hash},
                        headers={'Rune': self.cln_rune},
                        timeout=15,
                    )
        except Exception as e:
            print(f'[htlc] Cancel failed: {e}')

    async def claim_slash_reward(
        self, market_id: str, slashed_payment_hash: str
    ):
        """Claim proportional share of a slashed resolver's stake."""
        # In v1, this is tracked in Supabase and settled manually
        # by the consensus-calling node. Full HTLC routing in v2.
        print(f'[htlc] Slash reward claim for market {market_id[:16]} '
              f'(hash: {slashed_payment_hash[:16]})')
