'use client'

import { useState, useEffect } from 'react'
import type { MarketEvent } from '@/lib/markets'

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'macro', label: 'Macro' },
  { id: 'politics', label: 'Politics' },
  { id: 'ai-behavior', label: 'AI Behavior' },
  { id: 'science', label: 'Science' },
  { id: 'sports', label: 'Sports' },
]

const SORTS = ['Volume', 'Newest', 'Resolving Soon'] as const

// Demo markets for when relays aren't connected
const DEMO_MARKETS: MarketEvent[] = [
  {
    id: 'demo1',
    pubkey: 'npub1...',
    question: 'Will BTC exceed $200k before Jan 1 2027?',
    description: 'Resolves YES if BTC/USD closes above $200,000 on any major exchange.',
    resolutionCriteria: 'CoinGecko BTC/USD daily close price > 200000',
    category: 'crypto',
    resolutionDate: 1767225600,
    minResolverStakeMsats: 10000,
    minResolvers: 5,
    createdAt: Math.floor(Date.now() / 1000) - 86400,
  },
  {
    id: 'demo2',
    pubkey: 'npub1...',
    question: 'Will the Fed cut rates before July 2026?',
    description: 'Resolves YES if the Federal Reserve announces a rate cut.',
    resolutionCriteria: 'FRED FEDFUNDS rate decreases from current level',
    category: 'macro',
    resolutionDate: 1751328000,
    minResolverStakeMsats: 5000,
    minResolvers: 5,
    createdAt: Math.floor(Date.now() / 1000) - 172800,
  },
  {
    id: 'demo3',
    pubkey: 'npub1...',
    question: 'Will SATS-AI nodes answer YES to "Is Bitcoin money?"',
    description: 'Meta-market: resolves based on network inference consensus.',
    resolutionCriteria: 'Majority of SATS-AI node responses classify as YES',
    category: 'ai-behavior',
    resolutionDate: Math.floor(Date.now() / 1000) + 604800,
    minResolverStakeMsats: 10000,
    minResolvers: 3,
    inferencePrompt: 'Is Bitcoin money? Answer YES or NO.',
    createdAt: Math.floor(Date.now() / 1000) - 3600,
  },
]

interface MarketWithVolume extends MarketEvent {
  totalYesMsats: number
  totalNoMsats: number
  resolverCount: number
}

function timeUntil(unixTimestamp: number): string {
  const diff = unixTimestamp - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'Resolving'
  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h`
  const mins = Math.floor((diff % 3600) / 60)
  return `${hours}h ${mins}m`
}

export default function MarketsPage() {
  const [markets, setMarkets] = useState<MarketWithVolume[]>([])
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<(typeof SORTS)[number]>('Volume')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadMarkets() {
      try {
        const { subscribeToMarkets } = await import('@/lib/markets')
        const collected: MarketWithVolume[] = []

        const sub = subscribeToMarkets(
          { category: category === 'all' ? undefined : category },
          (market) => {
            collected.push({
              ...market,
              totalYesMsats: Math.floor(Math.random() * 500000),
              totalNoMsats: Math.floor(Math.random() * 500000),
              resolverCount: Math.floor(Math.random() * 8),
            })
            setMarkets([...collected])
          },
        )

        setTimeout(() => {
          sub.close()
          if (collected.length === 0) {
            setMarkets(
              DEMO_MARKETS.map((m) => ({
                ...m,
                totalYesMsats: Math.floor(Math.random() * 500000),
                totalNoMsats: Math.floor(Math.random() * 500000),
                resolverCount: Math.floor(Math.random() * 8),
              })),
            )
          }
          setLoading(false)
        }, 5000)
      } catch {
        setMarkets(
          DEMO_MARKETS.map((m) => ({
            ...m,
            totalYesMsats: Math.floor(Math.random() * 500000),
            totalNoMsats: Math.floor(Math.random() * 500000),
            resolverCount: Math.floor(Math.random() * 8),
          })),
        )
        setLoading(false)
      }
    }

    loadMarkets()
  }, [category])

  const sorted = [...markets].sort((a, b) => {
    if (sort === 'Volume')
      return (b.totalYesMsats + b.totalNoMsats) - (a.totalYesMsats + a.totalNoMsats)
    if (sort === 'Newest') return b.createdAt - a.createdAt
    return a.resolutionDate - b.resolutionDate
  })

  const filtered = category === 'all'
    ? sorted
    : sorted.filter((m) => m.category === category)

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-bold text-accent">Prediction Markets</h1>
          <p className="text-sm text-muted">
            Bet on outcomes. Resolved by AI oracles. Settled in sats.
          </p>
        </div>
        <a
          href="/markets/create"
          className="rounded bg-accent px-4 py-2 text-sm font-bold text-black hover:bg-accent-dim"
        >
          Create Market
        </a>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex gap-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                category === c.id
                  ? 'bg-accent text-black font-bold'
                  : 'border border-border bg-surface text-muted hover:text-foreground'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 text-xs">
          {SORTS.map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`px-2 py-1 ${
                sort === s ? 'text-accent' : 'text-muted hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Market grid */}
      {loading ? (
        <div className="py-20 text-center text-muted">
          Subscribing to market events...
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((market) => {
            const total = market.totalYesMsats + market.totalNoMsats
            const yesPercent = total > 0 ? Math.round((market.totalYesMsats / total) * 100) : 50
            const volumeSats = Math.round(total / 1000)

            return (
              <a
                key={market.id}
                href={`/markets/${market.id}`}
                className="block rounded border border-border bg-surface p-4 transition-colors hover:border-muted"
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <span className="rounded bg-surface-light px-2 py-0.5 text-[10px] uppercase text-muted">
                    {market.category}
                  </span>
                  <span className="text-xs text-muted">
                    {timeUntil(market.resolutionDate)}
                  </span>
                </div>

                <h3 className="mb-3 text-sm font-bold leading-tight">
                  {market.question}
                </h3>

                {/* Probability bar */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-green-500">YES {yesPercent}%</span>
                    <span className="text-red-400">NO {100 - yesPercent}%</span>
                  </div>
                  <div className="mt-1 flex h-2 overflow-hidden rounded bg-red-900/30">
                    <div
                      className="bg-green-500 transition-all"
                      style={{ width: `${yesPercent}%` }}
                    />
                  </div>
                </div>

                <div className="flex justify-between text-xs text-muted">
                  <span>{volumeSats.toLocaleString()} sats volume</span>
                  <span>
                    {market.resolverCount}/{market.minResolvers} resolvers
                  </span>
                </div>
              </a>
            )
          })}
        </div>
      )}
    </div>
  )
}
