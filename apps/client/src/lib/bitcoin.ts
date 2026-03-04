export async function verifyJobAnchor(
  txid: string,
  jobHash: string,
): Promise<boolean> {
  const electrsUrl = process.env.ELECTRS_URL || process.env.NEXT_PUBLIC_ELECTRS_URL

  if (!electrsUrl) {
    throw new Error('ELECTRS_URL not configured')
  }

  const res = await fetch(`${electrsUrl}/tx/${txid}`)
  const tx = await res.json()

  const opReturn = tx.vout?.find(
    (o: { scriptpubkey_type: string }) => o.scriptpubkey_type === 'op_return',
  )

  if (!opReturn) return false

  // Decode OP_RETURN data (skip opcode prefix)
  const hex = opReturn.scriptpubkey.slice(4)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  const decoded = new TextDecoder().decode(bytes)

  const embeddedHash = decoded.replace('SATS-AI:', '')
  return embeddedHash === jobHash
}

export async function computeJobHash(
  jobEventId: string,
  result: string,
  nodePubkey: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${jobEventId}${result}${nodePubkey}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// --- Market resolution verification ---

export async function computeMarketHash(
  marketId: string,
  outcome: string,
  consensusEventId: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${marketId}${outcome}${consensusEventId}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyMarketResolution(
  txid: string,
  marketId: string,
  outcome: string,
  consensusEventId: string,
): Promise<{ verified: boolean; blockHeight?: number; timestamp?: number }> {
  const electrsUrl = process.env.ELECTRS_URL || process.env.NEXT_PUBLIC_ELECTRS_URL

  if (!electrsUrl) {
    throw new Error('ELECTRS_URL not configured')
  }

  const expectedHash = await computeMarketHash(marketId, outcome, consensusEventId)

  const res = await fetch(`${electrsUrl}/tx/${txid}`)
  const tx = await res.json()

  const opReturn = tx.vout?.find(
    (o: { scriptpubkey_type: string }) => o.scriptpubkey_type === 'op_return',
  )

  if (!opReturn) return { verified: false }

  const hex = opReturn.scriptpubkey.slice(4)
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  const decoded = new TextDecoder().decode(bytes)
  const embeddedHash = decoded.replace('SATS-AI-MKT:', '')

  return {
    verified: embeddedHash === expectedHash,
    blockHeight: tx.status?.block_height,
    timestamp: tx.status?.block_time,
  }
}
