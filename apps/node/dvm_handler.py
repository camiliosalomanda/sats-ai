from nostr_dvm.tasks.textgeneration import TextGenerationTask
from inference import run_inference
from lightning import get_invoice_from_lnaddress, calculate_sats


class SatsAINode(TextGenerationTask):
    def __init__(self, config):
        super().__init__()
        self.config = config

    async def process_job(self, event, client):
        """Handle incoming kind:5100 DVM job request."""
        prompt = event.content
        max_bid_msats = int(self._get_tag(event, 'bid', default='1000'))

        result = run_inference(
            self.config.model_path,
            prompt,
            max_tokens=self.config.max_tokens,
        )

        total_tokens = result.tokens_generated + result.prompt_tokens
        sats_owed = calculate_sats(
            total_tokens, self.config.sats_per_1k_tokens
        )
        msats_owed = sats_owed * 1000

        invoice = await get_invoice_from_lnaddress(
            self.config.ln_address, msats_owed
        )

        await self.publish_result(
            client=client,
            job_event=event,
            content=result.text,
            invoice=invoice,
        )

    def _get_tag(self, event, tag_name, key=None, default=''):
        for tag in event.tags:
            if tag[0] == tag_name:
                if key is None or (len(tag) > 2 and tag[1] == key):
                    return tag[-1]
        return default
