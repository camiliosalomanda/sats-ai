export default function Home() {
  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4">
      <div className="max-w-2xl text-center">
        <h1 className="mb-2 text-5xl font-bold tracking-tight text-accent">
          SATS·AI
        </h1>
        <p className="mb-8 text-lg text-muted">
          Decentralized AI inference on Bitcoin + Nostr
        </p>

        <div className="mb-12 rounded border border-border bg-surface p-6 text-left font-mono text-sm">
          <div className="mb-4 text-muted">$ sats-ai status</div>
          <div className="space-y-1">
            <div>
              <span className="text-muted">network:</span>{" "}
              <span className="text-green-500">online</span>
            </div>
            <div>
              <span className="text-muted">protocol:</span> NIP-90 DVM
            </div>
            <div>
              <span className="text-muted">payment:</span> Lightning Network
            </div>
            <div>
              <span className="text-muted">anchor:</span> Bitcoin OP_RETURN
            </div>
            <div>
              <span className="text-muted">models:</span> llama.cpp (GGUF)
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded border border-border bg-surface p-4">
            <div className="text-2xl font-bold text-accent">--</div>
            <div className="text-xs text-muted">nodes online</div>
          </div>
          <div className="rounded border border-border bg-surface p-4">
            <div className="text-2xl font-bold text-accent">--</div>
            <div className="text-xs text-muted">jobs completed</div>
          </div>
          <div className="rounded border border-border bg-surface p-4">
            <div className="text-2xl font-bold text-accent">--</div>
            <div className="text-xs text-muted">sats earned</div>
          </div>
        </div>

        <div className="mt-12 flex justify-center gap-4">
          <a
            href="/send"
            className="rounded bg-accent px-6 py-3 text-sm font-bold text-black transition-colors hover:bg-accent-dim"
          >
            Submit a Job
          </a>
          <a
            href="/run"
            className="rounded border border-accent px-6 py-3 text-sm font-bold text-accent transition-colors hover:bg-accent/10"
          >
            Run a Node
          </a>
        </div>
      </div>
    </div>
  );
}
