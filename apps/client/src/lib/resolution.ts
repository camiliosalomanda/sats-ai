'use client'

import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  SimplePool,
} from 'nostr-tools'

const PAYOUT_CLAIM = 6204

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

export function calculatePayout(
  positionAmountMsats: number,
  positionSide: 'YES' | 'NO',
  outcome: 'YES' | 'NO' | 'INVALID',
  totalYesMsats: number,
  totalNoMsats: number,
): number {
  // INVALID: full refund
  if (outcome === 'INVALID') return positionAmountMsats

  // Losing side: zero
  if (positionSide !== outcome) return 0

  // Winning side: original amount + proportional share of losing pool (minus 3% resolver fee)
  const totalWinning = outcome === 'YES' ? totalYesMsats : totalNoMsats
  const totalLosing = outcome === 'YES' ? totalNoMsats : totalYesMsats

  if (totalWinning === 0) return positionAmountMsats

  const share = positionAmountMsats / totalWinning
  const winnings = Math.floor(share * totalLosing * 0.97)
  return positionAmountMsats + winnings
}

export async function claimPayout(
  marketId: string,
  positionEventId: string,
  payoutAmountMsats: number,
  invoice: string,
): Promise<string> {
  const { sk } = getKeypair()
  const pool = new SimplePool()

  const event = finalizeEvent(
    {
      kind: PAYOUT_CLAIM,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['e', marketId],
        ['position', positionEventId],
        ['invoice', invoice],
        ['amount-msats', String(payoutAmountMsats)],
      ],
      content: '',
    },
    sk,
  )

  await Promise.any(RELAYS.map((r) => pool.publish([r], event)))
  pool.close(RELAYS)
  return event.id
}
