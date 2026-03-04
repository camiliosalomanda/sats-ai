'use client'

import { useState, use } from 'react'

export default function ClaimPayoutPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: marketId } = use(params)

  const [status, setStatus] = useState<'idle' | 'claiming' | 'done' | 'error'>('idle')
  const [payoutSats, setPayoutSats] = useState(0)

  // In production, these come from Nostr events + Supabase
  const demoPosition = {
    side: 'YES' as const,
    amountMsats: 50000,
    eventId: 'pos_event_123',
  }
  const demoOutcome = 'YES' as const
  const demoTotalYes = 200000
  const demoTotalNo = 150000

  useState(() => {
    // Calculate payout
    const { calculatePayout } = require('@/lib/resolution') as typeof import('@/lib/resolution')
    const payout = calculatePayout(
      demoPosition.amountMsats,
      demoPosition.side,
      demoOutcome,
      demoTotalYes,
      demoTotalNo,
    )
    setPayoutSats(Math.round(payout / 1000))
  })

  const handleClaim = async () => {
    setStatus('claiming')
    try {
      // In production: generate Lightning invoice via WebLN,
      // then publish kind:6204 claim event
      const { claimPayout } = await import('@/lib/resolution')

      // Simulate invoice generation
      const mockInvoice = `lnbc${payoutSats}...`
      await claimPayout(
        marketId,
        demoPosition.eventId,
        demoPosition.amountMsats,
        mockInvoice,
      )
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="rounded border border-border bg-surface p-8 text-center">
        <h1 className="mb-2 text-2xl font-bold text-accent">Claim Payout</h1>
        <p className="mb-8 text-sm text-muted">Market {marketId.slice(0, 16)}...</p>

        <div className="mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Outcome:</span>
            <span className="font-bold text-green-500">{demoOutcome}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Your position:</span>
            <span className="font-bold text-green-500">
              {demoPosition.side} ({Math.round(demoPosition.amountMsats / 1000)} sats)
            </span>
          </div>
          <div className="border-t border-border pt-3">
            <div className="flex justify-between text-lg">
              <span className="text-muted">Payout:</span>
              <span className="font-bold text-accent">{payoutSats} sats</span>
            </div>
          </div>
        </div>

        {status === 'idle' && (
          <button
            onClick={handleClaim}
            className="w-full rounded bg-accent py-3 text-sm font-bold text-black hover:bg-accent-dim"
          >
            Generate Invoice & Claim
          </button>
        )}

        {status === 'claiming' && (
          <div className="py-4 text-sm text-muted">
            Publishing kind:6204 claim event...
          </div>
        )}

        {status === 'done' && (
          <div className="rounded border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-500">
            Payout claim published. The escrow node will settle your Lightning
            invoice.
          </div>
        )}

        {status === 'error' && (
          <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
            Claim failed. Try again.
          </div>
        )}

        <a
          href={`/markets/${marketId}`}
          className="mt-4 inline-block text-xs text-muted hover:text-foreground"
        >
          ← Back to market
        </a>
      </div>
    </div>
  )
}
