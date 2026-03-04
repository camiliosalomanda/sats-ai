import os
import asyncio
from config import Config
from dvm_handler import SatsAINode
from reputation import announce_loop
from nostr_dvm.utils.nostr_utils import connect_to_relays


async def main():
    config = Config.from_env()
    node = SatsAINode(config)

    print(f'Starting SATS-AI node')
    print(f'Model: {config.model_name}')
    print(f'Price: {config.sats_per_1k_tokens} sats/1k tokens')
    print(f'LN Address: {config.ln_address}')
    print(f'Relays: {config.relays}')

    resolver_mode = os.environ.get('RESOLVER_MODE', 'false').lower() == 'true'
    if resolver_mode:
        print(f'Resolver mode: ENABLED')

    async with connect_to_relays(config.relays, config.nostr_privkey) as client:
        asyncio.create_task(announce_loop(client, config))

        if resolver_mode:
            from resolver import resolver_loop
            from htlc_manager import HTLCManager
            htlc = HTLCManager()
            asyncio.create_task(resolver_loop(client, config, htlc))
            print(f'Resolver backend: {htlc.backend}')

        await node.listen(client)


if __name__ == '__main__':
    asyncio.run(main())
