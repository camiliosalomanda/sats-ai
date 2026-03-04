import { createClient } from '@supabase/supabase-js'

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getOnlineNodes(): Promise<NodeInfo[]> {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('online', true)
    .order('reputation', { ascending: false })

  if (error) throw error
  return data as NodeInfo[]
}

export async function getNodeByPubkey(pubkey: string): Promise<NodeInfo | null> {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('pubkey', pubkey)
    .single()

  if (error) return null
  return data as NodeInfo
}

export async function recordJobCompletion(job: {
  jobEventId: string
  nodePubkey: string
  requesterPk: string
  model: string
  tokensUsed: number
  satsPaid: number
  bitcoinAnchor?: string
}) {
  const { error } = await supabase.from('jobs').insert({
    job_event_id: job.jobEventId,
    node_pubkey: job.nodePubkey,
    requester_pk: job.requesterPk,
    model: job.model,
    tokens_used: job.tokensUsed,
    sats_paid: job.satsPaid,
    bitcoin_anchor: job.bitcoinAnchor,
    completed_at: new Date().toISOString(),
  })

  if (error) throw error
}
