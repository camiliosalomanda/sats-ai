-- Prediction Markets schema
-- Run AFTER supabase-schema.sql (depends on nodes table)

-- Markets
create table markets (
  id                       text primary key,
  question                 text not null,
  description              text not null,
  resolution_criteria      text not null,
  category                 text not null,
  creator_pubkey           text not null,
  created_at               timestamptz not null,
  resolution_date          timestamptz not null,
  min_resolver_stake_msats bigint not null default 10000,
  min_resolvers            integer not null default 5,
  status                   text not null default 'open',
  outcome                  text,
  total_yes_msats          bigint not null default 0,
  total_no_msats           bigint not null default 0,
  bitcoin_anchor           text
);

-- Positions (YES/NO commitments from traders)
create table positions (
  id            text primary key default gen_random_uuid()::text,
  market_id     text not null references markets(id),
  pubkey        text not null,
  side          text not null check (side in ('YES','NO')),
  amount_msats  bigint not null,
  invoice       text not null,
  payment_hash  text not null unique,
  committed_at  timestamptz not null default now()
);

-- Resolver commitments (nodes staking to resolve)
create table resolver_commitments (
  market_id          text not null references markets(id),
  node_pubkey        text not null references nodes(pubkey),
  stake_msats        bigint not null,
  stake_payment_hash text not null unique,
  verdict            text check (verdict in ('YES','NO','INVALID')),
  verdict_event_id   text,
  verdict_at         timestamptz,
  slashed            boolean not null default false,
  rewarded           boolean not null default false,
  primary key (market_id, node_pubkey)
);

-- Resolved markets
create table resolutions (
  market_id          text primary key references markets(id),
  outcome            text not null,
  consensus_event_id text not null,
  yes_votes          integer not null default 0,
  no_votes           integer not null default 0,
  invalid_votes      integer not null default 0,
  total_resolvers    integer not null,
  bitcoin_anchor     text,
  resolved_at        timestamptz not null default now()
);

-- Indexes
create index on markets(status, resolution_date);
create index on markets(category);
create index on positions(market_id, side);
create index on positions(pubkey);
create index on resolver_commitments(market_id, verdict);
