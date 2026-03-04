export interface JobRequest {
  id: string
  pubkey: string
  prompt: string
  model: string
  maxBidMsats: number
  createdAt: number
}

export interface JobResult {
  id: string
  jobEventId: string
  nodePubkey: string
  content: string
  tokensUsed: number
  invoice: string
  completedAt: number
}

export interface NodeInfo {
  pubkey: string
  modelName: string
  modelId: string
  lnAddress: string
  satsPer1k: number
  jobsCompleted: number
  reputation: number
  region?: string
  online: boolean
  lastSeen: string
}

export interface InferenceConfig {
  modelPath: string
  modelName: string
  modelId: string
  maxTokens: number
  temperature: number
  satsPer1k: number
}

// --- Prediction Markets ---

export type MarketCategory =
  | 'crypto'
  | 'macro'
  | 'politics'
  | 'ai-behavior'
  | 'science'
  | 'sports'
  | 'custom'

export type MarketStatus = 'open' | 'resolving' | 'resolved' | 'cancelled'
export type MarketOutcome = 'YES' | 'NO' | 'INVALID'

export interface Market {
  id: string
  question: string
  description: string
  resolution_criteria: string
  category: MarketCategory
  creator_pubkey: string
  created_at: number
  resolution_date: number
  min_resolver_stake_msats: number
  min_resolvers: number
  status: MarketStatus
  outcome?: MarketOutcome
  total_yes_msats: number
  total_no_msats: number
}

export interface Position {
  id: string
  market_id: string
  pubkey: string
  side: 'YES' | 'NO'
  amount_msats: number
  invoice: string
  payment_hash: string
  committed_at: number
}

export interface ResolverCommitment {
  market_id: string
  node_pubkey: string
  stake_msats: number
  stake_payment_hash: string
  verdict?: MarketOutcome
  verdict_event_id?: string
  verdict_at?: number
  slashed: boolean
  rewarded: boolean
}

export interface Resolution {
  market_id: string
  outcome: MarketOutcome
  consensus_event_id: string
  yes_votes: number
  no_votes: number
  invalid_votes: number
  total_resolvers: number
  bitcoin_anchor?: string
  resolved_at: number
}

export interface AIBehaviorMarketParams {
  question: string
  inference_prompt: string
  target_model?: string
  min_nodes: number
  resolution_date: number
}

export const DVM_KINDS = {
  JOB_REQUEST: 5100,
  JOB_RESULT: 6100,
  NODE_ANNOUNCEMENT: 31990,
  MARKET_CREATION: 6200,
  POSITION_COMMITMENT: 6201,
  RESOLVER_VOTE: 6202,
  CONSENSUS_RESOLUTION: 6203,
  PAYOUT_CLAIM: 6204,
  MARKET_CANCELLATION: 6205,
} as const

export const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
] as const
