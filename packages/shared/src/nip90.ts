import { DVM_KINDS } from './types'

export interface DVMEventTemplate {
  kind: number
  tags: string[][]
  content: string
  created_at: number
}

export function buildJobRequestEvent(
  prompt: string,
  model: string,
  maxBidMsats: number,
): DVMEventTemplate {
  return {
    kind: DVM_KINDS.JOB_REQUEST,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['param', 'model', model],
      ['bid', String(maxBidMsats)],
      ['output', 'text/plain'],
    ],
    content: prompt,
  }
}

export function buildJobResultTags(
  jobEventId: string,
  invoice: string,
  tokensUsed: number,
): string[][] {
  return [
    ['e', jobEventId],
    ['amount', invoice],
    ['tokens', String(tokensUsed)],
  ]
}

export function buildNodeAnnouncementEvent(
  pubkey: string,
  modelName: string,
  modelId: string,
  lnAddress: string,
  satsPer1k: number,
): DVMEventTemplate {
  return {
    kind: DVM_KINDS.NODE_ANNOUNCEMENT,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['k', String(DVM_KINDS.JOB_REQUEST)],
      ['d', pubkey],
      ['model', modelName],
      ['model-id', modelId],
      ['ln-address', lnAddress],
      ['price', String(satsPer1k), 'sats/1k-tokens'],
      ['about', `SATS-AI node running ${modelName}`],
    ],
    content: JSON.stringify({
      name: `SATS-AI / ${modelName}`,
      about: 'Decentralized inference node',
    }),
  }
}

export function extractTagValue(tags: string[][], name: string, key?: string): string | undefined {
  for (const tag of tags) {
    if (tag[0] === name) {
      if (key === undefined) return tag[1]
      if (tag[1] === key) return tag[2]
    }
  }
  return undefined
}

// --- Market event builders ---

export function buildMarketCreationEvent(params: {
  question: string
  description: string
  resolutionCriteria: string
  category: string
  resolutionDate: number
  minResolverStakeMsats: number
  minResolvers: number
  inferencePrompt?: string
  targetModel?: string
}): DVMEventTemplate {
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
  return {
    kind: DVM_KINDS.MARKET_CREATION,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  }
}

export function buildPositionCommitmentEvent(
  marketId: string,
  side: 'YES' | 'NO',
  amountMsats: number,
  paymentHash: string,
): DVMEventTemplate {
  return {
    kind: DVM_KINDS.POSITION_COMMITMENT,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', marketId],
      ['side', side],
      ['amount-msats', String(amountMsats)],
      ['payment-hash', paymentHash],
    ],
    content: '',
  }
}

export function buildResolverVoteEvent(
  marketId: string,
  verdict: 'YES' | 'NO' | 'INVALID',
  evidenceSummary: string,
  dataSources: string[],
  stakePaymentHash: string,
): DVMEventTemplate {
  const tags: string[][] = [
    ['e', marketId],
    ['verdict', verdict],
    ['evidence-summary', evidenceSummary],
    ['stake-payment-hash', stakePaymentHash],
  ]
  for (const source of dataSources) {
    tags.push(['data-source', source])
  }
  return {
    kind: DVM_KINDS.RESOLVER_VOTE,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  }
}

export function buildConsensusResolutionEvent(
  marketId: string,
  outcome: 'YES' | 'NO' | 'INVALID',
  yesVotes: number,
  noVotes: number,
  invalidVotes: number,
  bitcoinAnchor?: string,
): DVMEventTemplate {
  const tags: string[][] = [
    ['e', marketId],
    ['outcome', outcome],
    ['yes-votes', String(yesVotes)],
    ['no-votes', String(noVotes)],
    ['invalid-votes', String(invalidVotes)],
  ]
  if (bitcoinAnchor) {
    tags.push(['bitcoin-anchor', bitcoinAnchor])
  }
  return {
    kind: DVM_KINDS.CONSENSUS_RESOLUTION,
    created_at: Math.floor(Date.now() / 1000),
    tags,
    content: '',
  }
}

export function buildPayoutClaimEvent(
  marketId: string,
  positionEventId: string,
  payoutInvoice: string,
  payoutAmountMsats: number,
): DVMEventTemplate {
  return {
    kind: DVM_KINDS.PAYOUT_CLAIM,
    created_at: Math.floor(Date.now() / 1000),
    tags: [
      ['e', marketId],
      ['position', positionEventId],
      ['invoice', payoutInvoice],
      ['amount-msats', String(payoutAmountMsats)],
    ],
    content: '',
  }
}
