'use client'

import { useState, useEffect, use } from 'react'
import type { PositionEvent, ResolverVoteEvent, ConsensusEvent } from '@/lib/markets'

interface MarketDetail {
  id: string
  question: string
  description: string
  resolutionCriteria: string
  category: string
  resolutionDate: number
  minResolvers: number
  minResolverStakeMsats: number
  status: 'open' | 'resolving' | 'resolved'
  outcome?: string
  bitcoinAnchor?: string
}

function timeRemaining(unixTs: number): string {
  const diff = unixTs - Math.floor(Date.now() / 1000)
  if (diff <= 0) return 'Resolution period active'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h ${m}m remaining`
  return `${h}h ${m}m remaining`
}

export default function MarketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: marketId } = use(params)

  const [market, setMarket] = useState<MarketDetail | null>(null)
  const [positions, setPositions] = useState<PositionEvent[]>([])
  const [votes, setVotes] = useState<ResolverVoteEvent[]>([])
  const [consensus, setConsensus] = useState<ConsensusEvent | null>(null)
  const [tradeSide, setTradeSide] = useState<'YES' | 'NO'>('YES')
  const [tradeAmount, setTradeAmount] = useState(100)
  const [tradeStatus, setTradeStatus] = useState<'idle' | 'committing' | 'done'>('idle')

  // Load market data
  useEffect(() => {
    // Demo market data
    setMarket({
      id: marketId,
      question: 'Will BTC exceed $200k before Jan 1 2027?',
      description: 'Resolves YES if BTC/USD closes above $200,000 on any major exchange.',
      resolutionCriteria: 'CoinGecko BTC/USD daily close price > 200000',
      category: 'crypto',
      resolutionDate: 1767225600,
      minResolvers: 5,
      minResolverStakeMsats: 10000,
      status: 'open',
    })

    // Subscribe to positions
    async function loadPositions() {
      try {
        const { getMarketPositions } = await import('@/lib/markets')
        getMarketPositions(marketId, (pos) => {
          setPositions((prev) => [...prev, pos])
        })
      } catch {
        // Demo positions
        setPositions([
          {
            id: 'pos1', pubkey: 'npub1abc...', marketId, side: 'YES',
            amountMsats: 50000, paymentHash: 'hash1', committedAt: Date.now() / 1000 - 3600,
          },
          {
            id: 'pos2', pubkey: 'npub1def...', marketId, side: 'NO',
            amountMsats: 30000, paymentHash: 'hash2', committedAt: Date.now() / 1000 - 1800,
          },
        ])
      }
    }

    // Subscribe to resolver votes
    async function loadVotes() {
      try {
        const { subscribeToResolverVotes } = await import('@/lib/markets')
        subscribeToResolverVotes(marketId, (vote) => {
          setVotes((prev) => [...prev, vote])
        })
      } catch {
        // no votes yet
      }
    }

    // Subscribe to resolution
    async function loadResolution() {
      try {
        const { subscribeToResolution } = await import('@/lib/markets')
        subscribeToResolution(marketId, (res) => {
          setConsensus(res)
        })
      } catch {
        // not resolved yet
      }
    }

    loadPositions()
    loadVotes()
    loadResolution()
  }, [marketId])

  const totalYes = positions
    .filter((p) => p.side === 'YES')
    .reduce((sum, p) => sum + p.amountMsats, 0)
  const totalNo = positions
    .filter((p) => p.side === 'NO')
    .reduce((sum, p) => sum + p.amountMsats, 0)
  const total = totalYes + totalNo
  const yesPercent = total > 0 ? Math.round((totalYes / total) * 100) : 50

  const handleTrade = async () => {
    setTradeStatus('committing')
    try {
      const { commitPosition } = await import('@/lib/markets')
      await commitPosition(marketId, tradeSide, tradeAmount * 1000)
      setTradeStatus('done')
    } catch {
      setTradeStatus('idle')
    }
  }

  if (!market) {
    return (
      <div className="py-20 text-center text-muted">Loading market...</div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="mb-2 flex items-center gap-3">
          <span className="rounded bg-surface-light px-2 py-0.5 text-[10px] uppercase text-muted">
            {market.category}
          </span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] uppercase ${
              market.status === 'open'
                ? 'bg-green-500/10 text-green-500'
                : market.status === 'resolved'
                  ? 'bg-accent/10 text-accent'
                  : 'bg-yellow-500/10 text-yellow-500'
            }`}
          >
            {market.status}
          </span>
          {consensus?.bitcoinAnchor && (
            <span className="rounded bg-accent/10 px-2 py-0.5 text-[10px] text-accent">
              Verified on Bitcoin
            </span>
          )}
        </div>
        <h1 className="mb-2 text-2xl font-bold">{market.question}</h1>
        <p className="text-sm text-muted">{market.description}</p>
        <div className="mt-2 text-xs text-muted">
          {timeRemaining(market.resolutionDate)}
        </div>
      </div>

      {/* Probability meter */}
      <div className="mb-8 rounded border border-border bg-surface p-6">
        <div className="mb-2 flex justify-between text-lg font-bold">
          <span className="text-green-500">YES {yesPercent}%</span>
          <span className="text-red-400">NO {100 - yesPercent}%</span>
        </div>
        <div className="flex h-4 overflow-hidden rounded bg-red-900/30">
          <div
            className="bg-green-500 transition-all duration-500"
            style={{ width: `${yesPercent}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{Math.round(totalYes / 1000)} sats</span>
          <span>{Math.round(total / 1000)} sats total</span>
          <span>{Math.round(totalNo / 1000)} sats</span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Trade section */}
        <div>
          <h2 className="mb-4 text-sm font-bold uppercase text-muted">
            Take a Position
          </h2>
          <div className="rounded border border-border bg-surface p-4">
            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                onClick={() => setTradeSide('YES')}
                className={`rounded py-3 text-sm font-bold transition-colors ${
                  tradeSide === 'YES'
                    ? 'bg-green-500 text-black'
                    : 'border border-border text-muted hover:border-green-500'
                }`}
              >
                YES
              </button>
              <button
                onClick={() => setTradeSide('NO')}
                className={`rounded py-3 text-sm font-bold transition-colors ${
                  tradeSide === 'NO'
                    ? 'bg-red-500 text-black'
                    : 'border border-border text-muted hover:border-red-500'
                }`}
              >
                NO
              </button>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-xs text-muted">
                Amount (sats)
              </label>
              <input
                type="number"
                value={tradeAmount}
                onChange={(e) => setTradeAmount(Number(e.target.value))}
                min={1}
                className="w-full rounded border border-border bg-black p-3 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>

            <button
              onClick={handleTrade}
              disabled={tradeStatus === 'committing'}
              className={`w-full rounded py-3 text-sm font-bold text-black transition-colors ${
                tradeSide === 'YES'
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-red-500 hover:bg-red-600'
              } disabled:opacity-50`}
            >
              {tradeStatus === 'committing'
                ? 'Committing...'
                : `Commit ${tradeAmount} sats on ${tradeSide}`}
            </button>

            {tradeStatus === 'done' && (
              <div className="mt-3 text-center text-xs text-green-500">
                Position committed!
              </div>
            )}
          </div>
        </div>

        {/* Recent positions */}
        <div>
          <h2 className="mb-4 text-sm font-bold uppercase text-muted">
            Recent Positions
          </h2>
          <div className="space-y-2">
            {positions.slice(-10).reverse().map((pos) => (
              <div
                key={pos.id}
                className="flex items-center justify-between rounded border border-border/50 bg-surface p-3 text-xs"
              >
                <span className="font-mono text-muted">
                  {pos.pubkey.slice(0, 12)}...
                </span>
                <span
                  className={`font-bold ${
                    pos.side === 'YES' ? 'text-green-500' : 'text-red-400'
                  }`}
                >
                  {pos.side}
                </span>
                <span className="text-accent">
                  {Math.round(pos.amountMsats / 1000)} sats
                </span>
              </div>
            ))}
            {positions.length === 0 && (
              <div className="py-8 text-center text-xs text-muted">
                No positions yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Resolver section */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-bold uppercase text-muted">
          Resolvers ({votes.length}/{market.minResolvers} required)
        </h2>
        <div className="rounded border border-border bg-surface p-4">
          {votes.length > 0 ? (
            <div className="space-y-2">
              {votes.map((vote) => (
                <div
                  key={vote.id}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="font-mono text-muted">
                    {vote.pubkey.slice(0, 12)}...
                  </span>
                  <span
                    className={`font-bold ${
                      vote.verdict === 'YES'
                        ? 'text-green-500'
                        : vote.verdict === 'NO'
                          ? 'text-red-400'
                          : 'text-yellow-500'
                    }`}
                  >
                    {vote.verdict}
                  </span>
                  <span className="text-muted">{vote.evidenceSummary.slice(0, 50)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-muted">
              No resolvers committed yet. Stake: {Math.round(market.minResolverStakeMsats / 1000)} sats minimum.
            </div>
          )}
        </div>
      </div>

      {/* Resolution criteria */}
      <div className="mt-8 rounded border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-bold uppercase text-muted">
          Resolution Criteria
        </h2>
        <p className="text-sm">{market.resolutionCriteria}</p>
        <div className="mt-2 text-xs text-muted">
          Resolves: {new Date(market.resolutionDate * 1000).toLocaleString()}
        </div>
        <div className="mt-1 text-xs text-muted">
          Quorum: {market.minResolvers} resolvers required
        </div>
      </div>

      {/* Consensus result */}
      {consensus && (
        <div className="mt-8 rounded border border-accent bg-accent/5 p-6 text-center">
          <div className="mb-2 text-xs uppercase text-muted">
            Consensus Reached
          </div>
          <div className="text-4xl font-bold text-accent">
            {consensus.outcome}
          </div>
          <div className="mt-2 text-xs text-muted">
            YES: {consensus.yesVotes} / NO: {consensus.noVotes} / INVALID:{' '}
            {consensus.invalidVotes}
          </div>
          {consensus.bitcoinAnchor && (
            <div className="mt-2 font-mono text-xs text-accent">
              BTC anchor: {consensus.bitcoinAnchor.slice(0, 20)}...
            </div>
          )}
          <a
            href={`/markets/${marketId}/claim`}
            className="mt-4 inline-block rounded bg-accent px-6 py-2 text-sm font-bold text-black hover:bg-accent-dim"
          >
            Claim Payout
          </a>
        </div>
      )}
    </div>
  )
}
