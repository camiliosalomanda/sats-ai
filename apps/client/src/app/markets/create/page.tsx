'use client'

import { useState } from 'react'

const CATEGORIES = [
  'crypto',
  'macro',
  'politics',
  'ai-behavior',
  'science',
  'sports',
  'custom',
]

export default function CreateMarketPage() {
  const [question, setQuestion] = useState('')
  const [description, setDescription] = useState('')
  const [criteria, setCriteria] = useState('')
  const [category, setCategory] = useState('crypto')
  const [resolutionDate, setResolutionDate] = useState('')
  const [minStakeSats, setMinStakeSats] = useState(1000)
  const [minResolvers, setMinResolvers] = useState(5)
  const [inferencePrompt, setInferencePrompt] = useState('')
  const [status, setStatus] = useState<'idle' | 'publishing' | 'done' | 'error'>('idle')
  const [marketId, setMarketId] = useState('')

  const isAIBehavior = category === 'ai-behavior'

  // Build preview JSON
  const previewEvent = {
    kind: 6200,
    tags: [
      ['question', question],
      ['description', description],
      ['resolution-criteria', criteria],
      ['category', category],
      ['resolution-date', resolutionDate ? String(Math.floor(new Date(resolutionDate).getTime() / 1000)) : ''],
      ['min-resolver-stake', String(minStakeSats * 1000)],
      ['min-resolvers', String(minResolvers)],
      ...(isAIBehavior && inferencePrompt ? [['inference-prompt', inferencePrompt]] : []),
    ],
    content: '',
  }

  const handleSubmit = async () => {
    if (!question || !criteria || !resolutionDate) return

    setStatus('publishing')
    try {
      const { createMarket } = await import('@/lib/markets')
      const id = await createMarket({
        question,
        description,
        resolutionCriteria: criteria,
        category,
        resolutionDate: Math.floor(new Date(resolutionDate).getTime() / 1000),
        minResolverStakeMsats: minStakeSats * 1000,
        minResolvers,
        inferencePrompt: isAIBehavior ? inferencePrompt : undefined,
      })
      setMarketId(id)
      setStatus('done')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-accent">Create Market</h1>
      <p className="mb-8 text-sm text-muted">
        Define a prediction market. Resolved by AI oracle nodes.
      </p>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Form */}
        <div className="space-y-5">
          <div>
            <label className="mb-1 block text-xs uppercase text-muted">
              Question ({question.length}/200)
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
              placeholder="Will BTC exceed $200k before Jan 1 2027?"
              className="w-full rounded border border-border bg-surface p-3 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase text-muted">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional context about the market..."
              rows={3}
              className="w-full rounded border border-border bg-surface p-3 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs uppercase text-muted">
              Resolution Criteria (be specific and unambiguous)
            </label>
            <textarea
              value={criteria}
              onChange={(e) => setCriteria(e.target.value)}
              placeholder="CoinGecko BTC/USD daily close price > 200000"
              rows={3}
              className="w-full rounded border border-border bg-surface p-3 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs uppercase text-muted">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded border border-border bg-surface p-3 text-sm text-foreground focus:border-accent focus:outline-none"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase text-muted">
                Resolution Date
              </label>
              <input
                type="datetime-local"
                value={resolutionDate}
                onChange={(e) => setResolutionDate(e.target.value)}
                className="w-full rounded border border-border bg-surface p-3 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs uppercase text-muted">
                Min Resolver Stake (sats)
              </label>
              <input
                type="number"
                value={minStakeSats}
                onChange={(e) => setMinStakeSats(Number(e.target.value))}
                min={100}
                className="w-full rounded border border-border bg-surface p-3 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs uppercase text-muted">
                Min Resolvers
              </label>
              <input
                type="number"
                value={minResolvers}
                onChange={(e) => setMinResolvers(Number(e.target.value))}
                min={3}
                max={21}
                className="w-full rounded border border-border bg-surface p-3 text-sm text-foreground focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          {isAIBehavior && (
            <div>
              <label className="mb-1 block text-xs uppercase text-muted">
                Inference Prompt (exact prompt to run at resolution)
              </label>
              <textarea
                value={inferencePrompt}
                onChange={(e) => setInferencePrompt(e.target.value)}
                placeholder="Is Bitcoin money? Answer YES or NO."
                rows={3}
                className="w-full rounded border border-accent/30 bg-surface p-3 text-sm text-foreground placeholder-muted focus:border-accent focus:outline-none"
              />
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!question || !criteria || !resolutionDate || status === 'publishing'}
            className="w-full rounded bg-accent py-3 text-sm font-bold text-black hover:bg-accent-dim disabled:opacity-50"
          >
            {status === 'publishing' ? 'Publishing to Nostr...' : 'Create Market'}
          </button>

          {status === 'done' && (
            <div className="rounded border border-green-500/30 bg-green-500/10 p-4">
              <div className="mb-1 text-sm text-green-500">
                Market published!
              </div>
              <div className="break-all font-mono text-xs text-muted">
                ID: {marketId}
              </div>
              <a
                href={`/markets/${marketId}`}
                className="mt-2 inline-block text-xs text-accent hover:underline"
              >
                View Market →
              </a>
            </div>
          )}

          {status === 'error' && (
            <div className="rounded border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-500">
              Failed to publish market. Check your relay connection.
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <label className="mb-2 block text-xs uppercase text-muted">
            Event Preview (kind:6200)
          </label>
          <pre className="overflow-x-auto rounded border border-border bg-black p-4 font-mono text-xs text-green-400">
            {JSON.stringify(previewEvent, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
