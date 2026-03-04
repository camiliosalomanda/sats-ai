# SATS·AI

**Decentralized AI inference + prediction markets on Bitcoin, Lightning & Nostr.**

No tokens. No chains. No accounts. Just sats.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/camiliosalomanda/sats-ai)

**Live:** [satsai.vercel.app](https://satsai.vercel.app)

---

## What is this?

SATS·AI is a permissionless AI inference marketplace where:

- **Anyone can submit** an AI inference job using a Nostr keypair
- **Anyone can run a node** and earn sats for every completed job
- **Prediction markets** are resolved by AI oracle nodes with staked sats
- **All payments** settle instantly over Lightning Network
- **All results** are anchored to Bitcoin via OP_RETURN

No API keys. No accounts. No centralized dependency.

## How it works

```
User submits prompt → kind:5100 Nostr event → Node runs llama.cpp →
kind:6100 result event → Lightning invoice → User pays sats → Done
```

For prediction markets:
```
Market created (kind:6200) → Traders commit YES/NO positions →
Resolution date arrives → AI nodes fetch data + run inference →
Consensus reached (kind:6203) → Winners paid via Lightning →
Outcome anchored to Bitcoin
```

## Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Identity | Nostr keypairs | Pseudonymous, censorship-resistant |
| Job routing | NIP-90 DVM (kind:5100/6100) | Decentralized job marketplace |
| Inference | llama.cpp (GGUF models) | Local CPU/GPU, no external APIs |
| Payments | Lightning Network (LNURL-pay) | Instant micropayments in sats |
| Markets | Custom kinds (6200-6205) | Prediction market lifecycle |
| Resolution | AI oracle nodes + staking | Skin-in-the-game consensus |
| Anchoring | Bitcoin OP_RETURN | Permanent, tamper-evident record |

## Quick start

### Run a node (earn sats)

```bash
# Clone
git clone https://github.com/camiliosalomanda/sats-ai
cd sats-ai

# Get llama.cpp (Linux)
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp && make -j$(nproc) && cd ..

# Download a model
pip install huggingface-hub
huggingface-cli download lmstudio-community/Llama-3.2-3B-Instruct-GGUF \
  --include "*.Q4_K_M.gguf" --local-dir ./models

# Configure
cp apps/node/.env.example apps/node/.env
# Edit .env: add your Nostr key + Lightning address

# Run
cd apps/node && pip install -r requirements.txt && python main.py
```

### Run with Docker

```bash
bash scripts/download-model.sh
cp apps/node/.env.example apps/node/.env
# Edit .env
docker compose up -d
```

### Submit a job (spend sats)

Visit [satsai.vercel.app/send](https://satsai.vercel.app/send) or run the client locally:

```bash
npm install
npm run dev
# Open http://localhost:3000/send
```

## Project structure

```
sats-ai/
├── apps/client/          # Next.js marketplace UI (10 pages)
│   └── src/lib/          # nostr.ts, markets.ts, lightning.ts, bitcoin.ts
├── apps/node/            # Python compute + resolver node
│   ├── inference.py      # llama.cpp wrapper
│   ├── dvm_handler.py    # NIP-90 job handler
│   ├── resolver.py       # Prediction market oracle
│   ├── data_fetcher.py   # CoinGecko, FRED, NewsAPI
│   └── htlc_manager.py   # LND/CLN stake management
├── packages/shared/      # TypeScript types + event builders
└── docs/                 # Supabase schemas
```

## Nostr event kinds

| Kind | Purpose |
|------|---------|
| 5100 | Inference job request |
| 6100 | Inference job result |
| 31990 | Node announcement |
| 6200 | Market creation |
| 6201 | Position commitment (YES/NO) |
| 6202 | Resolver registration + vote |
| 6203 | Consensus resolution |
| 6204 | Payout claim |
| 6205 | Market cancellation |

## Revenue model

- **Node operators** earn sats per inference job (1 sat/1k tokens default)
- **Resolvers** earn 3% of losing pool on correct market resolution
- **Anyone** can create and trade on prediction markets

## Requirements

- **Node:** Python 3.11+, llama.cpp, 4GB+ RAM, Lightning address
- **Client:** Any modern browser (keys generated client-side)
- **Model:** 3GB disk for Llama 3.2 3B (Q4_K_M quantization)

## Stack

- Next.js 16 + Tailwind
- Python + nostr-dvm + httpx
- nostr-tools
- Supabase (cache layer)
- llama.cpp (GGUF inference)
- Lightning Network (LNURL-pay)
- Bitcoin (OP_RETURN anchoring)

## License

MIT

---

*Built with sats and sovereignty. No permission needed.*
