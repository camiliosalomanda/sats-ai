'use client'

import { useState, useEffect } from 'react'

interface ResolverMarket {
  id: string
  question: string
  category: string
  resolutionDate: number
  status: 'committed' | 'voted' | 'resolved'
  myVerdict?: 'YES' | 'NO' | 'INVALID'
  consensusOutcome?: string
  stakeMsats: number
  stakeStatus: 'locked' | 'returned' | 'slashed'
  satsEarned: number
}

interface AvailableMarket {
  id: string
  question: string
  category: string
  resolutionDate: number
  requiredStakeSats: number
  currentResolvers: number
  minResolvers: number
  volumeSats: number
}

const DEMO_COMMITTED: ResolverMarket[] = [
  {
    id: 'mkt1',
    question: 'Will BTC exceed $200k before Jan 1 2027?',
    category: 'crypto',
    resolutionDate: 1767225600,
    status: 'voted',
    myVerdict: 'YES',
    stakeMsats: 10000,
    stakeStatus: 'locked',
    satsEarned: 0,
  },
  {
    id: 'mkt2',
    question: 'Will the Fed cut rates before July 2026?',
    category: 'macro',
    resolutionDate: 1751328000,
    status: 'resolved',
    myVerdict: 'YES',
    consensusOutcome: 'YES',
    stakeMsats: 5000,
    stakeStatus: 'returned',
    satsEarned: 150,
  },
]

const DEMO_AVAILABLE: AvailableMarket[] = [
  {
    id: 'mkt3',
    question: 'Will Ethereum flip Bitcoin in market cap by 2027?',
    category: 'crypto',
    resolutionDate: Math.floor(Date.now() / 1000) + 43200,
    requiredStakeSats: 10,
    currentResolvers: 2,
    minResolvers: 5,
    volumeSats: 500,
  },
  {
    id: 'mkt4',
    question: 'Will US unemployment exceed 5% by Dec 2026?',
    category: 'macro',
    resolutionDate: Math.floor(Date.now() / 1000) + 72000,
    requiredStakeSats: 5,
    currentResolvers: 1,
    minResolvers: 5,
    volumeSats: 200,
  },
]

function timeUntil(unixTs: number): string {
  const diff = unixTs - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'Now'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  if (d > 0) return `${d}d ${h}h`
  return `${h}h`
}

export default function ResolveDashboard() {
  const [committed, setCommitted] = useState<ResolverMarket[]>([])
  const [available, setAvailable] = useState<AvailableMarket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // In production: query Supabase for committed markets
    // and Nostr relays for available markets
    setCommitted(DEMO_COMMITTED)
    setAvailable(DEMO_AVAILABLE)
    setLoading(false)
  }, [])

  const totalStakedSats = committed.reduce(
    (sum, m) => sum + Math.round(m.stakeMsats / 1000), 0
  )
  const totalEarned = committed.reduce((sum, m) => sum + m.satsEarned, 0)
  const slashedCount = committed.filter((m) => m.stakeStatus === 'slashed').length

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-accent">Resolver Dashboard</h1>
      <p className="mb-8 text-sm text-muted">
        Manage your market resolution commitments
      </p>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <div className="rounded border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-accent">
            {committed.length}
          </div>
          <div className="text-xs text-muted">markets committed</div>
        </div>
        <div className="rounded border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-accent">
            {totalStakedSats}
          </div>
          <div className="text-xs text-muted">sats staked</div>
        </div>
        <div className="rounded border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-green-500">
            {totalEarned}
          </div>
          <div className="text-xs text-muted">sats earned</div>
        </div>
        <div className="rounded border border-border bg-surface p-4">
          <div className="text-2xl font-bold text-red-400">
            {slashedCount}
          </div>
          <div className="text-xs text-muted">times slashed</div>
        </div>
      </div>

      {/* Committed markets */}
      <h2 className="mb-4 text-sm font-bold uppercase text-muted">
        Your Commitments
      </h2>
      {loading ? (
        <div className="py-10 text-center text-muted">Loading...</div>
      ) : (
        <div className="mb-8 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase text-muted">
                <th className="pb-3 pr-4">Market</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Your Vote</th>
                <th className="pb-3 pr-4">Consensus</th>
                <th className="pb-3 pr-4">Stake</th>
                <th className="pb-3">Earned</th>
              </tr>
            </thead>
            <tbody>
              {committed.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border/50 hover:bg-surface-light"
                >
                  <td className="max-w-xs truncate py-3 pr-4">
                    <a
                      href={`/markets/${m.id}`}
                      className="hover:text-accent"
                    >
                      {m.question}
                    </a>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`text-xs ${
                        m.status === 'resolved'
                          ? 'text-accent'
                          : m.status === 'voted'
                            ? 'text-yellow-500'
                            : 'text-muted'
                      }`}
                    >
                      {m.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {m.myVerdict ? (
                      <span
                        className={`font-bold ${
                          m.myVerdict === 'YES'
                            ? 'text-green-500'
                            : m.myVerdict === 'NO'
                              ? 'text-red-400'
                              : 'text-yellow-500'
                        }`}
                      >
                        {m.myVerdict}
                      </span>
                    ) : (
                      <span className="text-muted">--</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {m.consensusOutcome ?? (
                      <span className="text-muted">pending</span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        m.stakeStatus === 'slashed'
                          ? 'text-red-400'
                          : m.stakeStatus === 'returned'
                            ? 'text-green-500'
                            : 'text-muted'
                      }
                    >
                      {Math.round(m.stakeMsats / 1000)} sats ({m.stakeStatus})
                    </span>
                  </td>
                  <td className="py-3 text-accent">
                    {m.satsEarned > 0 ? `+${m.satsEarned}` : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Available markets */}
      <h2 className="mb-4 text-sm font-bold uppercase text-muted">
        Available to Resolve
      </h2>
      <div className="space-y-3">
        {available.map((m) => (
          <div
            key={m.id}
            className="flex items-center justify-between rounded border border-border bg-surface p-4"
          >
            <div className="flex-1">
              <div className="text-sm font-bold">{m.question}</div>
              <div className="mt-1 text-xs text-muted">
                {m.category} · Resolves in {timeUntil(m.resolutionDate)} ·{' '}
                {m.currentResolvers}/{m.minResolvers} resolvers ·{' '}
                {m.volumeSats} sats volume
              </div>
            </div>
            <button className="ml-4 rounded border border-accent px-4 py-2 text-xs font-bold text-accent hover:bg-accent/10">
              Stake {m.requiredStakeSats} sats
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
