import json
import asyncio


async def publish_node_announcement(client, config):
    """Publish kind:31990 node announcement (NIP-89 app handler)."""
    event = {
        'kind': 31990,
        'tags': [
            ['k', '5100'],
            ['d', config.nostr_privkey],  # replaceable event identifier
            ['model', config.model_name],
            ['model-id', config.model_id],
            ['ln-address', config.ln_address],
            ['price', str(config.sats_per_1k_tokens), 'sats/1k-tokens'],
            ['about', f'SATS-AI node running {config.model_name}'],
        ],
        'content': json.dumps({
            'name': f'SATS-AI / {config.model_name}',
            'about': 'Decentralized inference node',
        }),
    }
    await client.publish(event)


async def announce_loop(client, config, interval: int = 600):
    """Publish node announcement on startup and every 10 minutes."""
    while True:
        try:
            await publish_node_announcement(client, config)
            print(f'[reputation] Published node announcement')
        except Exception as e:
            print(f'[reputation] Announcement failed: {e}')
        await asyncio.sleep(interval)
