'use client'

import { useState, useRef, useEffect } from 'react'

type JobStatus =
  | 'idle'
  | 'broadcasting'
  | 'waiting'
  | 'payment_required'
  | 'complete'
  | 'error'

interface LogEntry {
  time: string
  message: string
  type: 'info' | 'success' | 'error' | 'event'
}

interface ModelOption {
  id: string
  name: string
  desc: string
}

function timestamp() {
  return new Date().toLocaleTimeString('en-US', { hour12: false })
}

export default function SendPage() {
  const [models, setModels] = useState<ModelOption[]>([])
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('')
  const [maxSats, setMaxSats] = useState(10)
  const [status, setStatus] = useState<JobStatus>('idle')
  const [result, setResult] = useState('')
  const [invoice, setInvoice] = useState('')
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logRef = useRef<HTMLDivElement>(null)

  // Fetch available models from online nodes
  useEffect(() => {
    async function loadModels() {
      try {
        const { supabase } = await import('@/lib/supabase')
        const { data, error } = await supabase
          .from('nodes')
          .select('model_id, model_name, sats_per_1k')
          .eq('online', true)
          .order('reputation', { ascending: false })

        if (error) throw error
        if (data && data.length > 0) {
          const unique = data.reduce<ModelOption[]>((acc, node) => {
            if (!acc.find((m) => m.id === node.model_id)) {
              acc.push({
                id: node.model_id,
                name: node.model_name,
                desc: `${node.sats_per_1k} sat/1k tokens`,
              })
            }
            return acc
          }, [])
          setModels(unique)
          setModel(unique[0].id)
          return
        }
      } catch {
        // fall through to default
      }
      const fallback = [{ id: 'llama3.1-8b', name: 'Llama 3.1 8B', desc: 'General purpose' }]
      setModels(fallback)
      setModel(fallback[0].id)
    }
    loadModels()
  }, [])

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs((prev) => [...prev, { time: timestamp(), message, type }])
  }

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  const handleSubmit = async () => {
    if (!prompt.trim()) return

    setStatus('broadcasting')
    setResult('')
    setInvoice('')
    setLogs([])

    addLog('Generating Nostr keypair...', 'info')
    addLog('Signing kind:5100 DVM job request...', 'event')

    try {
      const { submitInferenceJob, listenForResult } = await import(
        '@/lib/nostr'
      )

      const jobId = await submitInferenceJob(prompt, model, maxSats * 1000)

      addLog(`Job published: ${jobId.slice(0, 16)}...`, 'success')
      addLog('Broadcasting to relays...', 'info')
      setStatus('waiting')
      addLog('Listening for kind:6100 result events...', 'event')

      listenForResult(jobId, (resultEvent) => {
        const invoiceTag = resultEvent.tags.find(
          (t: string[]) => t[0] === 'amount',
        )
        setResult(resultEvent.content)
        setInvoice(invoiceTag?.[1] ?? '')
        setStatus('payment_required')
        addLog('Result received from compute node!', 'success')
        addLog(`Invoice: ${invoiceTag?.[1]?.slice(0, 30)}...`, 'info')
      })
    } catch (err) {
      setStatus('error')
      addLog(`Error: ${err instanceof Error ? err.message : 'Unknown'}`, 'error')
    }
  }

  const handlePay = async () => {
    if (!invoice) return
    try {
      const { payInvoice } = await import('@/lib/lightning')
      const preimage = await payInvoice(invoice)
      if (preimage) {
        setStatus('complete')
        addLog(`Payment confirmed: ${preimage.slice(0, 16)}...`, 'success')
      } else {
        addLog('Open your Lightning wallet to pay the invoice', 'info')
      }
    } catch {
      addLog('Payment failed — try scanning the QR code manually', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-accent">Submit Job</h1>
      <p className="mb-8 text-sm text-muted">
        Send an inference request to the decentralized network
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Form */}
        <div className="space-y-6">
          {/* Model selector */}
          <div>
            <label className="mb-2 block text-xs uppercase text-muted">
              Model
            </label>
            <div className="grid grid-cols-2 gap-2">
              {models.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModel(m.id)}
                  className={`rounded border p-3 text-left text-sm transition-colors ${
                    model === m.id
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border bg-surface text-foreground hover:border-muted'
                  }`}
                >
                  <div className="font-bold">{m.name}</div>
                  <div className="text-xs text-muted">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Max sats slider */}
          <div>
            <label className="mb-2 block text-xs uppercase text-muted">
              Max bid: {maxSats} sats
            </label>
            <input
              type="range"
              min={1}
              max={100}
              value={maxSats}
              onChange={(e) => setMaxSats(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-muted">
              <span>1 sat</span>
              <span>100 sats</span>
            </div>
          </div>

          {/* Prompt */}
          <div>
            <label className="mb-2 block text-xs uppercase text-muted">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter your prompt..."
              rows={6}
              className="w-full rounded border border-border bg-surface p-3 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={
              !prompt.trim() || status === 'broadcasting' || status === 'waiting'
            }
            className="w-full rounded bg-accent py-3 text-sm font-bold text-black transition-colors hover:bg-accent-dim disabled:opacity-50"
          >
            {status === 'broadcasting'
              ? 'Broadcasting...'
              : status === 'waiting'
                ? 'Waiting for result...'
                : 'Submit to Network'}
          </button>
        </div>

        {/* Right: Event log + Result */}
        <div className="space-y-6">
          {/* Event log */}
          <div>
            <label className="mb-2 block text-xs uppercase text-muted">
              Event Log
            </label>
            <div
              ref={logRef}
              className="h-48 overflow-y-auto rounded border border-border bg-black p-3 font-mono text-xs"
            >
              {logs.length === 0 && (
                <div className="text-muted">
                  Waiting for job submission...
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className="mb-1">
                  <span className="text-muted">[{log.time}]</span>{' '}
                  <span
                    className={
                      log.type === 'success'
                        ? 'text-green-500'
                        : log.type === 'error'
                          ? 'text-red-500'
                          : log.type === 'event'
                            ? 'text-accent'
                            : 'text-foreground'
                    }
                  >
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          {result && (
            <div>
              <label className="mb-2 block text-xs uppercase text-muted">
                Result
              </label>
              <div className="rounded border border-border bg-surface p-4 text-sm whitespace-pre-wrap">
                {result}
              </div>
            </div>
          )}

          {/* Payment */}
          {status === 'payment_required' && invoice && (
            <div>
              <label className="mb-2 block text-xs uppercase text-muted">
                Lightning Payment
              </label>
              <div className="rounded border border-accent/30 bg-surface p-4 text-center">
                <div className="mb-3 break-all font-mono text-xs text-muted">
                  {invoice.slice(0, 60)}...
                </div>
                <button
                  onClick={handlePay}
                  className="rounded bg-accent px-6 py-2 text-sm font-bold text-black hover:bg-accent-dim"
                >
                  Pay with Lightning
                </button>
              </div>
            </div>
          )}

          {status === 'complete' && (
            <div className="rounded border border-green-500/30 bg-green-500/10 p-4 text-center text-sm text-green-500">
              Job complete. Payment confirmed.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
