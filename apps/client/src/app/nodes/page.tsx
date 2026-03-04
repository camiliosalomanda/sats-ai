'use client'

import { useState, useEffect } from 'react'

interface Node {
  pubkey: string
  model_name: string
  model_id: string
  ln_address: string
  sats_per_1k: number
  jobs_completed: number
  reputation: number
  region: string | null
  online: boolean
  last_seen: string
}

// Demo nodes for when Supabase isn't connected
const DEMO_NODES: Node[] = [
  {
    pubkey: 'npub1demo...abc',
    model_name: 'Llama 3.2 3B',
    model_id: 'llama3.2-3b',
    ln_address: 'node1@getalby.com',
    sats_per_1k: 1,
    jobs_completed: 342,
    reputation: 99.2,
    region: 'US-East',
    online: true,
    last_seen: new Date().toISOString(),
  },
  {
    pubkey: 'npub1demo...def',
    model_name: 'Mistral 7B',
    model_id: 'mistral-7b',
    ln_address: 'node2@getalby.com',
    sats_per_1k: 2,
    jobs_completed: 128,
    reputation: 97.8,
    region: 'EU-West',
    online: true,
    last_seen: new Date().toISOString(),
  },
  {
    pubkey: 'npub1demo...ghi',
    model_name: 'Phi-3 Mini',
    model_id: 'phi-3-mini',
    ln_address: 'node3@getalby.com',
    sats_per_1k: 1,
    jobs_completed: 56,
    reputation: 95.0,
    region: 'Asia-SE',
    online: false,
    last_seen: new Date(Date.now() - 3600000).toISOString(),
  },
]

export default function NodesPage() {
  const [nodes, setNodes] = useState<Node[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchNodes() {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase
          .from('nodes')
          .select('*')
          .order('reputation', { ascending: false })

        if (error) throw error
        setNodes(data ?? [])
      } catch {
        // Use demo data when Supabase isn't configured
        setNodes(DEMO_NODES)
      } finally {
        setLoading(false)
      }
    }

    fetchNodes()
  }, [])

  const onlineCount = nodes.filter((n) => n.online).length

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent">Node Marketplace</h1>
          <p className="text-sm text-muted">
            Decentralized compute nodes earning sats
          </p>
        </div>
        <div className="text-right text-sm">
          <span className="text-green-500">{onlineCount} online</span>
          <span className="text-muted"> / {nodes.length} total</span>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center text-muted">
          Querying node registry...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Pubkey</th>
                <th className="pb-3 pr-4">Model</th>
                <th className="pb-3 pr-4">Price</th>
                <th className="pb-3 pr-4">Jobs</th>
                <th className="pb-3 pr-4">Reputation</th>
                <th className="pb-3 pr-4">Region</th>
                <th className="pb-3">LN Address</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((node) => (
                <tr
                  key={node.pubkey}
                  className="border-b border-border/50 hover:bg-surface-light"
                >
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        node.online ? 'bg-green-500' : 'bg-muted'
                      }`}
                    />
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs">
                    {node.pubkey.slice(0, 12)}...
                  </td>
                  <td className="py-3 pr-4">{node.model_name}</td>
                  <td className="py-3 pr-4 text-accent">
                    {node.sats_per_1k} sat/1k
                  </td>
                  <td className="py-3 pr-4">
                    {node.jobs_completed.toLocaleString()}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        node.reputation >= 95
                          ? 'text-green-500'
                          : node.reputation >= 80
                            ? 'text-yellow-500'
                            : 'text-red-500'
                      }
                    >
                      {node.reputation.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-muted">
                    {node.region ?? '--'}
                  </td>
                  <td className="py-3 font-mono text-xs text-muted">
                    {node.ln_address}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
