import httpx


async def get_invoice_from_lnaddress(
    ln_address: str, amount_msats: int
) -> str:
    """Fetch a Lightning invoice from an LN address (LNURL-pay)."""
    user, domain = ln_address.split('@')
    lnurl_endpoint = f'https://{domain}/.well-known/lnurlp/{user}'

    async with httpx.AsyncClient() as client:
        meta = (await client.get(lnurl_endpoint)).json()
        callback = meta['callback']
        resp = (await client.get(
            callback, params={'amount': amount_msats}
        )).json()
        return resp['pr']


def calculate_sats(tokens: int, sats_per_1k: int) -> int:
    return max(1, (tokens * sats_per_1k) // 1000)
