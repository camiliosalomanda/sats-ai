import os
import time
import json
import httpx

# Simple in-memory cache: key -> (data, timestamp)
_cache: dict[str, tuple[str, float]] = {}
CACHE_TTL = 300  # 5 minutes


def _cached(key: str) -> str | None:
    if key in _cache:
        data, ts = _cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
    return None


def _set_cache(key: str, data: str):
    _cache[key] = (data, time.time())


async def fetch_resolution_data(
    category: str, criteria: str, market: dict
) -> tuple[str, list[str]]:
    """Fetch evidence for market resolution based on category.

    Returns (formatted_evidence, list_of_sources).
    """
    fetchers = {
        'crypto': fetch_crypto_data,
        'macro': fetch_macro_data,
        'politics': fetch_news_data,
        'science': fetch_news_data,
        'sports': fetch_news_data,
        'ai-behavior': fetch_ai_behavior_data,
        'custom': fetch_news_data,
    }

    fetcher = fetchers.get(category, fetch_news_data)
    try:
        return await fetcher(criteria, market)
    except httpx.TimeoutException:
        err_type = 'timeout'
    except httpx.HTTPStatusError as e:
        err_type = f'HTTP {e.response.status_code}'
    except Exception:
        err_type = 'unknown'

    # Log sanitized error (never include raw exception which may contain API keys)
    print(f'[data_fetcher] Fetch failed for category={category}: {err_type}')
    return (
        f'ERROR: Failed to fetch resolution data ({err_type}).\n'
        f'Evidence status: UNAVAILABLE\n'
        f'Recommendation: Vote INVALID due to data retrieval failure.',
        [f'error: data fetch failed ({err_type})'],
    )


async def fetch_crypto_data(
    criteria: str, market: dict
) -> tuple[str, list[str]]:
    """Fetch crypto price data from CoinGecko."""
    cache_key = f'crypto:{criteria}'
    cached = _cached(cache_key)
    if cached:
        return cached, ['CoinGecko API (cached)']

    api_key = os.environ.get('COINGECKO_API_KEY', '')
    headers = {}
    if api_key:
        headers['x-cg-demo-api-key'] = api_key

    async with httpx.AsyncClient() as client:
        # Fetch BTC price as default; extend for other assets
        coin_id = 'bitcoin'
        criteria_lower = criteria.lower()
        if 'eth' in criteria_lower:
            coin_id = 'ethereum'
        elif 'sol' in criteria_lower:
            coin_id = 'solana'

        resp = await client.get(
            f'https://api.coingecko.com/api/v3/simple/price',
            params={'ids': coin_id, 'vs_currencies': 'usd', 'include_24hr_change': 'true'},
            headers=headers,
            timeout=15,
        )
        data = resp.json()
        price = data.get(coin_id, {}).get('usd', 'N/A')
        change = data.get(coin_id, {}).get('usd_24h_change', 'N/A')

        # Also fetch historical for context
        hist_resp = await client.get(
            f'https://api.coingecko.com/api/v3/coins/{coin_id}/market_chart',
            params={'vs_currency': 'usd', 'days': '30'},
            headers=headers,
            timeout=15,
        )
        hist = hist_resp.json()
        prices = hist.get('prices', [])

        high_30d = max((p[1] for p in prices), default=0)
        low_30d = min((p[1] for p in prices), default=0)

        evidence = (
            f'{coin_id.upper()}/USD current price: ${price}\n'
            f'24h change: {change:.2f}%\n'
            f'30-day high: ${high_30d:,.2f}\n'
            f'30-day low: ${low_30d:,.2f}\n'
            f'Source: CoinGecko API\n'
            f'Fetched at: {time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())}'
        )

        _set_cache(cache_key, evidence)
        return evidence, ['CoinGecko API']


async def fetch_macro_data(
    criteria: str, market: dict
) -> tuple[str, list[str]]:
    """Fetch macroeconomic data from FRED API."""
    cache_key = f'macro:{criteria}'
    cached = _cached(cache_key)
    if cached:
        return cached, ['FRED API (cached)']

    api_key = os.environ.get('FRED_API_KEY', '')
    if not api_key:
        return (
            'FRED API key not configured. Cannot fetch macro data.\n'
            'Evidence status: UNAVAILABLE.',
            ['FRED API (not configured)'],
        )

    # Map common indicators to FRED series IDs
    criteria_lower = criteria.lower()
    series_map = {
        'cpi': 'CPIAUCSL',
        'inflation': 'CPIAUCSL',
        'fed funds': 'FEDFUNDS',
        'interest rate': 'FEDFUNDS',
        'unemployment': 'UNRATE',
        'gdp': 'GDP',
    }

    series_id = 'FEDFUNDS'  # default
    for keyword, sid in series_map.items():
        if keyword in criteria_lower:
            series_id = sid
            break

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            'https://api.stlouisfed.org/fred/series/observations',
            params={
                'series_id': series_id,
                'api_key': api_key,
                'file_type': 'json',
                'sort_order': 'desc',
                'limit': '12',
            },
            timeout=15,
        )
        data = resp.json()
        observations = data.get('observations', [])

        lines = [f'FRED Series: {series_id}']
        for obs in observations[:12]:
            lines.append(f"  {obs['date']}: {obs['value']}")
        lines.append(f'Source: Federal Reserve Economic Data (FRED)')
        lines.append(f'Fetched at: {time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())}')

        evidence = '\n'.join(lines)
        _set_cache(cache_key, evidence)
        return evidence, ['FRED API']


async def fetch_news_data(
    criteria: str, market: dict
) -> tuple[str, list[str]]:
    """Fetch news headlines for factual event resolution."""
    cache_key = f'news:{criteria[:100]}'
    cached = _cached(cache_key)
    if cached:
        return cached, ['NewsAPI (cached)']

    api_key = os.environ.get('NEWS_API_KEY', '')
    if not api_key:
        return (
            'NewsAPI key not configured. Cannot fetch news data.\n'
            'Evidence status: UNAVAILABLE.',
            ['NewsAPI (not configured)'],
        )

    # Extract key terms from criteria for search
    query = ' '.join(criteria.split()[:10])

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            'https://newsapi.org/v2/everything',
            params={
                'q': query,
                'sortBy': 'relevancy',
                'pageSize': '10',
            },
            headers={'X-Api-Key': api_key},
            timeout=15,
        )
        data = resp.json()
        articles = data.get('articles', [])

        if not articles:
            return (
                f'No news articles found for query: "{query}"\n'
                f'Evidence status: INSUFFICIENT.',
                ['NewsAPI (no results)'],
            )

        lines = [f'News search: "{query}"', '']
        sources = set()
        for article in articles[:10]:
            source = article.get('source', {}).get('name', 'Unknown')
            title = article.get('title', 'No title')
            published = article.get('publishedAt', '')[:10]
            lines.append(f'  [{published}] {source}: {title}')
            sources.add(source)

        lines.append('')
        lines.append(f'Sources: {", ".join(sources)}')
        lines.append(f'Fetched at: {time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())}')

        evidence = '\n'.join(lines)
        _set_cache(cache_key, evidence)
        return evidence, [f'NewsAPI ({", ".join(list(sources)[:3])})']


async def fetch_onchain_data(
    criteria: str, market: dict
) -> tuple[str, list[str]]:
    """Fetch Bitcoin on-chain data from local Electrs instance."""
    electrs_url = os.environ.get('ELECTRS_URL', '')
    if not electrs_url:
        return (
            'Electrs URL not configured. Cannot fetch on-chain data.\n'
            'Evidence status: UNAVAILABLE.',
            ['Electrs (not configured)'],
        )

    async with httpx.AsyncClient() as client:
        # Get latest block info
        tip_resp = await client.get(f'{electrs_url}/blocks/tip/height', timeout=10)
        block_height = tip_resp.text.strip()

        tip_hash_resp = await client.get(f'{electrs_url}/blocks/tip/hash', timeout=10)
        block_hash = tip_hash_resp.text.strip()

        evidence = (
            f'Bitcoin blockchain state:\n'
            f'  Block height: {block_height}\n'
            f'  Tip hash: {block_hash}\n'
            f'  Source: Local Electrs instance\n'
            f'  Fetched at: {time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime())}'
        )

        return evidence, ['Electrs (local Bitcoin node)']


async def fetch_ai_behavior_data(
    criteria: str, market: dict
) -> tuple[str, list[str]]:
    """Fetch AI network behavior data for meta-markets.

    Queries SATS·AI relay for historical inference results
    matching the market's inference prompt.
    """
    from config import Config

    tags = {tag[0]: tag[1] for tag in market.get('tags', []) if len(tag) > 1}
    inference_prompt = tags.get('inference-prompt', '')
    target_model = tags.get('target-model', '')

    if not inference_prompt:
        return (
            'No inference-prompt tag found on this AI behavior market.\n'
            'Evidence status: INVALID — market is misconfigured.',
            ['SATS-AI network (misconfigured)'],
        )

    evidence = (
        f'AI Behavior Market Resolution:\n'
        f'  Inference prompt: "{inference_prompt[:200]}"\n'
        f'  Target model: {target_model or "any"}\n'
        f'  Note: This market will be resolved by broadcasting the\n'
        f'  inference prompt to the network and tallying responses.\n'
        f'  The resolver module handles this via kind:5100 job submission.'
    )

    return evidence, ['SATS-AI network (self-referential)']
