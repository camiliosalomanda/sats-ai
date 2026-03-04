'use client'

import {
  generateSecretKey,
  getPublicKey,
  finalizeEvent,
  SimplePool,
} from 'nostr-tools'
import type { Filter } from 'nostr-tools'

const DVM_JOB_REQUEST = 5100
const DVM_JOB_RESULT = 6100
const DVM_NODE_ANNOUNCEMENT = 31990

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

export function getOrCreateKeypair() {
  let sk = localStorage.getItem('nostr_sk')
  if (!sk) {
    const secret = generateSecretKey()
    sk = bytesToHex(secret)
    localStorage.setItem('nostr_sk', sk)
  }
  const secret = hexToBytes(sk)
  return { sk: secret, pk: getPublicKey(secret) }
}

export function getPublicKeyHex(): string | null {
  const sk = localStorage.getItem('nostr_sk')
  if (!sk) return null
  return getPublicKey(hexToBytes(sk))
}

export async function submitInferenceJob(
  prompt: string,
  model: string,
  maxBidMsats: number,
): Promise<string> {
  const { sk } = getOrCreateKeypair()
  const pool = new SimplePool()

  const event = finalizeEvent(
    {
      kind: DVM_JOB_REQUEST,
      created_at: Math.floor(Date.now() / 1000),
      tags: [
        ['param', 'model', model],
        ['bid', String(maxBidMsats)],
        ['output', 'text/plain'],
      ],
      content: prompt,
    },
    sk,
  )

  await Promise.any(RELAYS.map((r) => pool.publish([r], event)))
  pool.close(RELAYS)
  return event.id
}

export function listenForResult(
  jobId: string,
  onResult: (event: { content: string; tags: string[][] }) => void,
) {
  const pool = new SimplePool()
  const filter: Filter = {
    kinds: [DVM_JOB_RESULT],
    '#e': [jobId],
    limit: 1,
  }

  const sub = pool.subscribeMany(RELAYS, filter, {
    onevent: (event) => {
      onResult({ content: event.content, tags: event.tags })
      sub.close()
      pool.close(RELAYS)
    },
    oneose: () => {},
  })

  return sub
}

export function listenForNodeAnnouncements(
  onNode: (event: { pubkey: string; tags: string[][]; content: string }) => void,
) {
  const pool = new SimplePool()
  const filter: Filter = {
    kinds: [DVM_NODE_ANNOUNCEMENT],
    '#k': [String(DVM_JOB_REQUEST)],
    limit: 50,
  }

  const sub = pool.subscribeMany(RELAYS, filter, {
    onevent: (event) => {
      onNode({
        pubkey: event.pubkey,
        tags: event.tags,
        content: event.content,
      })
    },
    oneose: () => {},
  })

  return sub
}
