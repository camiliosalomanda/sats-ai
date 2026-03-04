'use client'

import { useState } from 'react'

type OS = 'linux' | 'mac' | 'windows' | 'docker'

const STEPS: Record<OS, { title: string; commands: string[] }[]> = {
  linux: [
    {
      title: '1. Clone and build llama.cpp',
      commands: [
        'git clone https://github.com/ggerganov/llama.cpp',
        'cd llama.cpp && make -j$(nproc)',
      ],
    },
    {
      title: '2. Install Python dependencies',
      commands: [
        'pip install nostr-dvm httpx python-dotenv',
      ],
    },
    {
      title: '3. Download a model',
      commands: [
        'pip install huggingface-hub',
        'huggingface-cli download lmstudio-community/Llama-3.2-3B-Instruct-GGUF \\',
        '  --include "*.Q4_K_M.gguf" --local-dir ./models',
      ],
    },
    {
      title: '4. Configure your node',
      commands: [
        'cp .env.example .env',
        '# Edit .env with your Nostr key and Lightning address',
        'nano .env',
      ],
    },
    {
      title: '5. Start earning sats',
      commands: ['python main.py'],
    },
  ],
  mac: [
    {
      title: '1. Clone and build llama.cpp',
      commands: [
        'git clone https://github.com/ggerganov/llama.cpp',
        'cd llama.cpp && make -j$(sysctl -n hw.ncpu)',
      ],
    },
    {
      title: '2. Install Python dependencies',
      commands: [
        'pip3 install nostr-dvm httpx python-dotenv',
      ],
    },
    {
      title: '3. Download a model',
      commands: [
        'pip3 install huggingface-hub',
        'huggingface-cli download lmstudio-community/Llama-3.2-3B-Instruct-GGUF \\',
        '  --include "*.Q4_K_M.gguf" --local-dir ./models',
      ],
    },
    {
      title: '4. Configure your node',
      commands: [
        'cp .env.example .env',
        '# Edit .env with your Nostr key and Lightning address',
      ],
    },
    {
      title: '5. Start earning sats',
      commands: ['python3 main.py'],
    },
  ],
  windows: [
    {
      title: '1. Install prerequisites',
      commands: [
        '# Install Python 3.11+ from python.org',
        '# Install Git from git-scm.com',
        '# Install Visual Studio Build Tools (C++ workload)',
      ],
    },
    {
      title: '2. Clone and build llama.cpp',
      commands: [
        'git clone https://github.com/ggerganov/llama.cpp',
        'cd llama.cpp && cmake -B build && cmake --build build --config Release',
      ],
    },
    {
      title: '3. Install Python dependencies',
      commands: [
        'pip install nostr-dvm httpx python-dotenv',
      ],
    },
    {
      title: '4. Download a model',
      commands: [
        'pip install huggingface-hub',
        'huggingface-cli download lmstudio-community/Llama-3.2-3B-Instruct-GGUF ^',
        '  --include "*.Q4_K_M.gguf" --local-dir ./models',
      ],
    },
    {
      title: '5. Start earning sats',
      commands: ['python main.py'],
    },
  ],
  docker: [
    {
      title: '1. Clone the repository',
      commands: ['git clone https://github.com/yourname/sats-ai', 'cd sats-ai'],
    },
    {
      title: '2. Download a model',
      commands: [
        'bash scripts/download-model.sh',
      ],
    },
    {
      title: '3. Configure environment',
      commands: [
        'cp apps/node/.env.example apps/node/.env',
        '# Edit apps/node/.env',
      ],
    },
    {
      title: '4. Launch with Docker Compose',
      commands: ['docker compose up -d'],
    },
    {
      title: '5. Check logs',
      commands: ['docker compose logs -f node'],
    },
  ],
}

export default function RunPage() {
  const [os, setOs] = useState<OS>('linux')

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-1 text-2xl font-bold text-accent">Run a Node</h1>
      <p className="mb-8 text-sm text-muted">
        Start earning sats by running AI inference on your hardware
      </p>

      {/* Requirements */}
      <div className="mb-8 rounded border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-bold uppercase text-muted">
          Requirements
        </h2>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <span className="text-accent">CPU:</span> Any x86_64 (GPU optional)
          </div>
          <div>
            <span className="text-accent">RAM:</span> 4GB+ (8GB recommended)
          </div>
          <div>
            <span className="text-accent">Disk:</span> 3GB for 3B model
          </div>
          <div>
            <span className="text-accent">Network:</span> Stable internet
          </div>
          <div>
            <span className="text-accent">Lightning:</span> LN address (Alby,
            Voltage, etc.)
          </div>
          <div>
            <span className="text-accent">Nostr:</span> Private key (auto-generated)
          </div>
        </div>
      </div>

      {/* OS selector */}
      <div className="mb-6 flex gap-2">
        {(
          [
            ['linux', 'Linux'],
            ['mac', 'macOS'],
            ['windows', 'Windows'],
            ['docker', 'Docker'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setOs(key)}
            className={`rounded px-4 py-2 text-sm transition-colors ${
              os === key
                ? 'bg-accent text-black font-bold'
                : 'border border-border bg-surface text-foreground hover:border-muted'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="space-y-6">
        {STEPS[os].map((step, i) => (
          <div key={i}>
            <h3 className="mb-2 text-sm font-bold text-foreground">
              {step.title}
            </h3>
            <div className="rounded border border-border bg-black p-4 font-mono text-sm">
              {step.commands.map((cmd, j) => (
                <div
                  key={j}
                  className={
                    cmd.startsWith('#') ? 'text-muted' : 'text-green-400'
                  }
                >
                  {!cmd.startsWith('#') && !cmd.startsWith(' ') && (
                    <span className="text-muted">$ </span>
                  )}
                  {cmd}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue estimate */}
      <div className="mt-12 rounded border border-accent/30 bg-accent/5 p-6 text-center">
        <div className="mb-2 text-lg font-bold text-accent">
          Revenue Estimate
        </div>
        <p className="text-sm text-muted">
          At 1 sat/1k tokens, processing ~1000 jobs/day with an average 500
          tokens each:
        </p>
        <div className="mt-3 text-3xl font-bold text-accent">
          ~500 sats/day
        </div>
        <p className="mt-1 text-xs text-muted">
          Scales with demand. No ceiling.
        </p>
      </div>
    </div>
  )
}
