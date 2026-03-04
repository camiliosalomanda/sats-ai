import asyncio
import json
from config import Config
from inference import run_inference_http
from data_fetcher import fetch_resolution_data
from htlc_manager import HTLCManager


RESOLUTION_PROMPT = """You are an objective fact-checker resolving a prediction market.

MARKET QUESTION: {question}
RESOLUTION CRITERIA: {resolution_criteria}
RESOLUTION DATE: {resolution_date}

EVIDENCE:
{fetched_data}

Based solely on the evidence above and the resolution criteria,
did this market resolve YES, NO, or INVALID (if criteria cannot
be determined from available evidence)?

Respond with exactly one word: YES, NO, or INVALID.
Then on a new line, provide a one-sentence justification."""


def extract_tag(tags: list, name: str) -> str:
    for tag in tags:
        if tag[0] == name:
            return tag[1] if len(tag) > 1 else ''
    return ''


async def scan_resolvable_markets(client, relays: list[str]) -> list[dict]:
    """Find markets approaching resolution that need resolvers."""
    import time

    now = int(time.time())
    cutoff = now + 86400  # within 24 hours

    markets = []

    def on_event(event):
        res_date = int(extract_tag(event['tags'], 'resolution-date') or '0')
        if now <= res_date <= cutoff:
            markets.append(event)

    # Subscribe to kind:6200 events
    filter_obj = {'kinds': [6200], 'limit': 100}
    await client.subscribe([filter_obj], on_event)
    await asyncio.sleep(5)  # collect events

    return markets


async def commit_to_resolve(
    client,
    config: Config,
    market: dict,
    htlc: HTLCManager,
) -> dict | None:
    """Lock stake and register as resolver for a market."""
    market_id = market['id']
    min_stake = int(extract_tag(market['tags'], 'min-resolver-stake') or '10000')

    # Lock stake via HTLC
    stake_info = await htlc.lock_stake(min_stake)
    if not stake_info:
        print(f'[resolver] Failed to lock stake for {market_id[:16]}')
        return None

    # Publish kind:6202 registration event
    event = {
        'kind': 6202,
        'tags': [
            ['e', market_id],
            ['stake-msats', str(min_stake)],
            ['stake-payment-hash', stake_info['payment_hash']],
        ],
        'content': '',
    }
    await client.publish(event)
    print(f'[resolver] Committed to resolve {market_id[:16]} '
          f'(stake: {min_stake} msats)')
    return stake_info


async def resolve_market(
    config: Config,
    market: dict,
) -> tuple[str, str, list[str]]:
    """Resolve a market by fetching data and running inference.

    Returns (verdict, evidence_summary, data_sources).
    """
    question = extract_tag(market['tags'], 'question')
    criteria = extract_tag(market['tags'], 'resolution-criteria')
    res_date = extract_tag(market['tags'], 'resolution-date')
    category = extract_tag(market['tags'], 'category')

    # Fetch evidence
    data, sources = await fetch_resolution_data(category, criteria, market)

    # Build resolution prompt
    prompt = RESOLUTION_PROMPT.format(
        question=question,
        resolution_criteria=criteria,
        resolution_date=res_date,
        fetched_data=data,
    )

    # Run local inference
    result = await run_inference_http(
        prompt,
        max_tokens=256,
        temp=0.1,  # low temp for deterministic resolution
    )

    # Parse verdict from first word
    first_line = result.text.strip().split('\n')[0].strip().upper()
    if first_line in ('YES', 'NO', 'INVALID'):
        verdict = first_line
    else:
        verdict = 'INVALID'

    evidence_summary = result.text.strip()
    return verdict, evidence_summary, sources


async def monitor_consensus(
    client,
    config: Config,
    market_id: str,
    min_resolvers: int,
    htlc: HTLCManager,
    my_verdict: str,
    my_stake_hash: str,
):
    """Watch for resolver votes and call consensus when quorum is reached."""
    votes: dict[str, str] = {}

    def on_vote(event):
        pubkey = event['pubkey']
        verdict = extract_tag(event['tags'], 'verdict')
        if verdict in ('YES', 'NO', 'INVALID'):
            votes[pubkey] = verdict

    filter_obj = {'kinds': [6202], '#e': [market_id], 'limit': 50}
    await client.subscribe([filter_obj], on_vote)

    # Poll until quorum
    while len(votes) < min_resolvers:
        await asyncio.sleep(30)

    # Tally votes
    yes_count = sum(1 for v in votes.values() if v == 'YES')
    no_count = sum(1 for v in votes.values() if v == 'NO')
    invalid_count = sum(1 for v in votes.values() if v == 'INVALID')

    # Determine outcome by majority
    counts = {'YES': yes_count, 'NO': no_count, 'INVALID': invalid_count}
    outcome = max(counts, key=lambda k: counts[k])

    # Check if we should call consensus (lowest pubkey lexicographically)
    resolver_pubkeys = sorted(votes.keys())
    # Use our pubkey from config (derived from privkey)
    my_pubkey = config.nostr_privkey  # TODO: derive actual pubkey

    if resolver_pubkeys and resolver_pubkeys[0] <= my_pubkey:
        # We call consensus
        event = {
            'kind': 6203,
            'tags': [
                ['e', market_id],
                ['outcome', outcome],
                ['yes-votes', str(yes_count)],
                ['no-votes', str(no_count)],
                ['invalid-votes', str(invalid_count)],
            ],
            'content': '',
        }

        # Anchor to Bitcoin if available
        try:
            from bitcoin_anchor import anchor_market_resolution
            txid = anchor_market_resolution(market_id, outcome, event.get('id', ''))
            event['tags'].append(['bitcoin-anchor', txid])
        except Exception as e:
            print(f'[resolver] Bitcoin anchor failed: {e}')

        await client.publish(event)
        print(f'[resolver] Consensus called: {market_id[:16]} -> {outcome}')

    # Settle our stake
    await htlc.settle_stakes(my_verdict, outcome, my_stake_hash)


async def resolver_loop(client, config: Config, htlc: HTLCManager):
    """Main resolver loop — scans for markets and resolves them."""
    print('[resolver] Starting resolver loop')

    while True:
        try:
            markets = await scan_resolvable_markets(client, config.relays)
            print(f'[resolver] Found {len(markets)} resolvable markets')

            for market in markets:
                market_id = market['id']
                min_resolvers = int(
                    extract_tag(market['tags'], 'min-resolvers') or '5'
                )

                # Commit to resolve
                stake_info = await commit_to_resolve(
                    client, config, market, htlc
                )
                if not stake_info:
                    continue

                # Run resolution
                verdict, evidence, sources = await resolve_market(
                    config, market
                )

                # Publish verdict
                vote_event = {
                    'kind': 6202,
                    'tags': [
                        ['e', market_id],
                        ['verdict', verdict],
                        ['evidence-summary', evidence],
                        ['stake-payment-hash', stake_info['payment_hash']],
                    ] + [['data-source', s] for s in sources],
                    'content': '',
                }
                await client.publish(vote_event)
                print(f'[resolver] Voted {verdict} on {market_id[:16]}')

                # Monitor consensus
                asyncio.create_task(
                    monitor_consensus(
                        client, config, market_id, min_resolvers,
                        htlc, verdict, stake_info['payment_hash'],
                    )
                )

        except Exception as e:
            print(f'[resolver] Error: {e}')

        await asyncio.sleep(300)  # check every 5 minutes
