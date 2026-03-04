-- Node registry (populated by nodes announcing themselves)
create table nodes (
  pubkey         text primary key,
  model_name     text not null,
  model_id       text not null,
  ln_address     text not null,
  sats_per_1k    integer not null default 1,
  jobs_completed integer not null default 0,
  reputation     numeric(5,2) not null default 100.0,
  region         text,
  online         boolean not null default true,
  last_seen      timestamptz not null default now()
);

-- Job history for analytics and reputation
create table jobs (
  id              uuid primary key default gen_random_uuid(),
  job_event_id    text not null unique,
  node_pubkey     text references nodes(pubkey),
  requester_pk    text not null,
  model           text not null,
  tokens_used     integer,
  sats_paid       integer,
  completed_at    timestamptz,
  bitcoin_anchor  text,
  created_at      timestamptz not null default now()
);

-- Indexes for marketplace queries
create index on nodes(online, reputation desc);
create index on jobs(node_pubkey, created_at desc);
