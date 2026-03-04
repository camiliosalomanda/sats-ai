'use client'

declare global {
  interface Window {
    webln?: {
      enable: () => Promise<void>
      sendPayment: (invoice: string) => Promise<{ preimage: string }>
    }
  }
}

export async function payInvoice(invoice: string): Promise<string | null> {
  // Try WebLN first (Alby, etc.)
  if (typeof window !== 'undefined' && window.webln) {
    try {
      await window.webln.enable()
      const result = await window.webln.sendPayment(invoice)
      return result.preimage
    } catch {
      // Fall through to manual payment
    }
  }
  // Return null to indicate manual payment needed (show QR)
  return null
}

export function decodeInvoiceAmount(invoice: string): number | null {
  // BOLT11 amount decoding — extract from the human-readable part
  const match = invoice.match(/^ln(?:bc|tb)(\d+)([munp]?)/)
  if (!match) return null

  const value = parseInt(match[1], 10)
  const multiplier = match[2]

  // Convert to millisats then to sats
  const msatsMap: Record<string, number> = {
    '': 100_000_000_000, // BTC to msats
    'm': 100_000_000,    // mBTC to msats
    'u': 100_000,        // uBTC to msats
    'n': 100,            // nBTC to msats
    'p': 0.1,            // pBTC to msats
  }

  const msats = value * (msatsMap[multiplier] ?? 1)
  return Math.round(msats / 1000) // return sats
}
