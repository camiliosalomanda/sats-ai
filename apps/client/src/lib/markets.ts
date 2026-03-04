'use client'

import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  SimplePool,
} from 'nostr-tools'
import type { Filter } from 'nostr-tools'

const MARKET_CREATION = 6200
const POSITION_COMMITMENT = 6201
const RESOLVER_VOTE = 6202
const CONSENSUS_RESOLUTION = 6203

const RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
]

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}

function getKeypair() {
  let sk = localStorage.getItem('nostr_sk')
  if (!sk) {
    const secret = generateSecretKey()
    sk = bytesToHex(secret)
    localStorage.setItem('nostr_sk', sk)
  }
  const secret = hexToBytes(sk)
  return { sk: secret, pk: getPublicKey(secret) }
}

export interface CreateMarketParams {
  question: string
  description: string
  resolutionCriteria: string
  category: string
  resolutionDate: number
  minResolverStakeMsats: number
  minResolvers: number
  inferencePrompt?: string
  targetModel?: string
}

export async function createMarket(params: CreateMarketParams): Promise<string> {
  const { sk } = getKeypair()
  const pool = new SimplePool()

  const tags: string[][] = [
    ['question', params.question],
    ['description', params.description],
    ['resolution-criteria', params.resolutionCriteria],
    ['category', params.category],
    ['resolution-date', String(params.resolutionDate)],
    ['min-resolver-stake', String(params.minResolverStakeMsats)],
    ['min-resolvers', String(params.minResolvers)],
  ]
  if (params.inferencePrompt) {
    tags.push(['inference-prompt', params.inferencePrompt])
  }
  if (params.targetModel) {
    tags.push(['target-model', params.targetModel])
  }

  const event = finalizeEvent(
    {
      kind: MARKET_CREATION,
      created_at: Math.floor(Date.now() / 1000),
      tags,
      content: '',
    },
    sk,
  )

  await Promise.any(RELAYS.map((r) => pool.publish([r], event)))
  pool.close(RELAYS)
  return event.id
}

export interface MarketEvent {
  id: string
  pubkey: string
  question: string
  description: string
  resolutionCriteria: string
  category: string
  resolutionDate: number
  minResolverStakeMsats: number
  minResolvers: number
  inferencePrompt?: string
  targetModel?: string
  createdAt: number
}

function extractTag(tags: string[][], name: string): string | undefined {
  const tag = tags.find((t) => t[0] === name)
  return tag?.[1]
}

function parseMarketEvent(event: {
  id: string
  pubkey: string
  tags: string[][]
  created_at: number
}): MarketEvent {
  return {
    id: event.id,
    pubkey: event.pubkey,
    question: extractTag(event.tags, 'question') ?? '',
    description: extractTag(event.tags, 'description') ?? '',
    resolutionCriteria: extractTag(event.tags, 'resolution-criteria') ?? '',
    category: extractTag(event.tags, 'category') ?? 'custom',
    resolutionDate: parseInt(extractTag(event.tags, 'resolution-date') ?? '0', 10),
    minResolverStakeMsats: parseInt(extractTag(event.tags, 'min-resolver-stake') ?? '10000', 10),
    minResolvers: parseInt(extractTag(event.tags, 'min-resolvers') ?? '5', 10),
    inferencePrompt: extractTag(event.tags, 'inference-prompt'),
    targetModel: extractTag(event.tags, 'target-model'),
    createdAt: event.created_at,
  }
}

export function subscribeToMarkets(
  filters: { category?: string; since?: number; until?: number },
  onMarket: (market: MarketEvent) => void,
) {
  const pool = new SimplePool()
  const filter: Filter & Record<string, unknown> = {
    kinds: [MARKET_CREATION],
    limit: 100,
  }
  if (filters.since) filter.since = filters.since
  if (filters.until) filter.until = filters.until

  const sub = pool.subscribeMany(RELAYS, filter as Filter, {
    onevent: (event) => {
      const market = parseMarketEvent(event)
      if (filters.category && market.category !== filters.category) return
      onMarket(market)
    },
    oneose: () => {},
  })

  return sub
}

export interface PositionEvent {
  id: string
  pubkey: string
  marketId: string
  side: 'YES' | 'NO'
  amountMsats: number
  paymentHash: string
  committedAt: number
}

export async function commitPosition(
  marketId: string,
  side: 'YES' | 'NO',
  amountMsats: number,
): Promise<{ eventId: string; paymentHash: string }> {
  const { sk } = getKeypair()
  const pool = new SimplePool()

  // Generate a payment hash for HTLC tracking
  const randomBytes = new Uint8Array(32)
  crypto.getRandomValues(randomBytes)
  const paymentHash = bytesToHex(randomBytes)

  const event = finalizeEvent(
    {
      kind: POSITION_COMMITMENT,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', marketId],
        ['side', side],
        ['amount-msats', String(amountMsats)],
        ['payment-hash', paymentHash],
      ],
      content: '',
    },
    sk,
  )

  await Promise.any(RELAYS.map((r) => pool.publish([r], event)))
  pool.close(RELAYS)
  return { eventId: event.id, paymentHash }
}

export function getMarketPositions(
  marketId: string,
  onPosition: (pos: PositionEvent) => void,
) {
  const pool = new SimplePool()
  const filter: Filter = {
    kinds: [POSITION_COMMITMENT],
    '#e': [marketId],
    limit: 500,
  }

  const sub = pool.subscribeMany(RELAYS, filter, {
    onevent: (event) => {
      const sideTag = extractTag(event.tags, 'side') as 'YES' | 'NO'
      onPosition({
        id: event.id,
        pubkey: event.pubkey,
        marketId,
        side: sideTag,
        amountMsats: parseInt(extractTag(event.tags, 'amount-msats') ?? '0', 10),
        paymentHash: extractTag(event.tags, 'payment-hash') ?? '',
        committedAt: event.created_at,
      })
    },
    oneose: () => {},
  })

  return sub
}

export interface ResolverVoteEvent {
  id: string
  pubkey: string
  marketId: string
  verdict: 'YES' | 'NO' | 'INVALID'
  evidenceSummary: string
  stakePaymentHash: string
}

export function subscribeToResolverVotes(
  marketId: string,
  onVote: (vote: ResolverVoteEvent) => void,
) {
  const pool = new SimplePool()
  const filter: Filter = {
    kinds: [RESOLVER_VOTE],
    '#e': [marketId],
    limit: 50,
  }

  const sub = pool.subscribeMany(RELAYS, filter, {
    onevent: (event) => {
      onVote({
        id: event.id,
        pubkey: event.pubkey,
        marketId,
        verdict: (extractTag(event.tags, 'verdict') ?? 'INVALID') as 'YES' | 'NO' | 'INVALID',
        evidenceSummary: extractTag(event.tags, 'evidence-summary') ?? '',
        stakePaymentHash: extractTag(event.tags, 'stake-payment-hash') ?? '',
      })
    },
    oneose: () => {},
  })

  return sub
}

export interface ConsensusEvent {
  id: string
  marketId: string
  outcome: 'YES' | 'NO' | 'INVALID'
  yesVotes: number
  noVotes: number
  invalidVotes: number
  bitcoinAnchor?: string
}

export function subscribeToResolution(
  marketId: string,
  onResolution: (resolution: ConsensusEvent) => void,
) {
  const pool = new SimplePool()
  const filter: Filter = {
    kinds: [CONSENSUS_RESOLUTION],
    '#e': [marketId],
    limit: 1,
  }

  const sub = pool.subscribeMany(RELAYS, filter, {
    onevent: (event) => {
      onResolution({
        id: event.id,
        marketId,
        outcome: (extractTag(event.tags, 'outcome') ?? 'INVALID') as 'YES' | 'NO' | 'INVALID',
        yesVotes: parseInt(extractTag(event.tags, 'yes-votes') ?? '0', 10),
        noVotes: parseInt(extractTag(event.tags, 'no-votes') ?? '0', 10),
        invalidVotes: parseInt(extractTag(event.tags, 'invalid-votes') ?? '0', 10),
        bitcoinAnchor: extractTag(event.tags, 'bitcoin-anchor'),
      })
      sub.close()
      pool.close(RELAYS)
    },
    oneose: () => {},
  })

  return sub
}
