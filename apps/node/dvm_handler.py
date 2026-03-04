"""NIP-90 DVM handler for kind:5100 text generation jobs."""
import asyncio
import time
from inference import run_inference_http
from lightning import get_invoice_from_lnaddress, calculate_sats

# Limits
MAX_PROMPT_LENGTH = 16_000  # ~4k tokens
MIN_BID_MSATS = 1_000
MAX_BID_MSATS = 10_000_000  # 10k sats
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX_JOBS = 5  # per pubkey per window
MAX_CONCURRENT_JOBS = 3


class SatsAINode:
    def __init__(self, config):
        self.config = config
        self._rate_limits: dict[str, list[float]] = {}
        self._active_jobs = 0

    def _check_rate_limit(self, pubkey: str) -> bool:
        """Return True if request is allowed, False if rate-limited."""
        now = time.time()
        timestamps = self._rate_limits.get(pubkey, [])
        # Prune old entries
        timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW]
        if len(timestamps) >= RATE_LIMIT_MAX_JOBS:
            return False
        timestamps.append(now)
        self._rate_limits[pubkey] = timestamps
        return True

    async def listen(self, client):
        """Subscribe to kind:5100 job requests and process them."""
        filters = [{'kinds': [5100], 'limit': 0}]

        async def on_job(event):
            try:
                await self._process_job(event, client)
            except Exception as e:
                print(f'[dvm] Error processing job {event.get("id", "")[:16]}: {e}')

        await client.subscribe(filters, on_job, sub_id='dvm-jobs')
        print('[dvm] Listening for kind:5100 inference jobs...')
        await client.listen()

    async def _process_job(self, event: dict, client):
        """Handle incoming kind:5100 DVM job request."""
        prompt = event.get('content', '')
        if not prompt:
            return

        job_id = event.get('id', '')
        requester = event.get('pubkey', '')

        # --- Input validation ---
        if len(prompt) > MAX_PROMPT_LENGTH:
            print(f'[dvm] Rejected {job_id[:16]}: prompt too long ({len(prompt)} chars)')
            return

        if not requester or len(requester) != 64:
            print(f'[dvm] Rejected {job_id[:16]}: invalid pubkey')
            return

        # --- Rate limiting ---
        if not self._check_rate_limit(requester):
            print(f'[dvm] Rate-limited {requester[:16]}')
            return

        # --- Concurrency limit ---
        if self._active_jobs >= MAX_CONCURRENT_JOBS:
            print(f'[dvm] Rejected {job_id[:16]}: too many concurrent jobs')
            return

        # --- Bid validation ---
        try:
            bid = int(self._get_tag(event, 'bid', default='1000'))
        except (ValueError, TypeError):
            bid = 1000
        bid = max(MIN_BID_MSATS, min(bid, MAX_BID_MSATS))

        print(f'[dvm] Job received: {job_id[:16]} from {requester[:16]}')

        self._active_jobs += 1
        try:
            result = await run_inference_http(
                prompt,
                max_tokens=self.config.max_tokens,
            )

            total_tokens = result.tokens_generated + result.prompt_tokens
            sats_owed = calculate_sats(
                total_tokens, self.config.sats_per_1k_tokens
            )
            msats_owed = sats_owed * 1000

            # Don't process if cost exceeds bid
            if msats_owed > bid:
                print(f'[dvm] Job {job_id[:16]} cost ({msats_owed} msats) exceeds bid ({bid} msats)')
                return

            invoice = await get_invoice_from_lnaddress(
                self.config.ln_address, msats_owed
            )

            # Publish kind:6100 result event
            result_event = {
                'kind': 6100,
                'tags': [
                    ['e', job_id],
                    ['p', requester],
                    ['amount', str(msats_owed)],
                    ['bolt11', invoice or ''],
                ],
                'content': result.text,
            }
            await client.publish(result_event)
            print(f'[dvm] Result published for {job_id[:16]} '
                  f'({total_tokens} tokens, {sats_owed} sats)')
        finally:
            self._active_jobs -= 1

    def _get_tag(self, event: dict, tag_name: str, default='') -> str:
        for tag in event.get('tags', []):
            if tag[0] == tag_name:
                return tag[-1] if len(tag) > 1 else default
        return default
