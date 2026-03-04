-- Row-Level Security policies
-- Public data is readable by anyone (anon key), writes are restricted.

-- =================== NODES ===================
alter table nodes enable row level security;

-- Anyone can read node listings (public marketplace data)
create policy "nodes_select_public" on nodes
  for select using (true);

-- Only the service role can insert/update nodes (via backend sync)
create policy "nodes_insert_service" on nodes
  for insert with check (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

create policy "nodes_update_service" on nodes
  for update using (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

-- No public deletes
create policy "nodes_delete_none" on nodes
  for delete using (false);

-- =================== JOBS ===================
alter table jobs enable row level security;

-- Anyone can read job history (public analytics)
create policy "jobs_select_public" on jobs
  for select using (true);

-- Only service role can write jobs
create policy "jobs_insert_service" on jobs
  for insert with check (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

create policy "jobs_update_none" on jobs
  for update using (false);

create policy "jobs_delete_none" on jobs
  for delete using (false);

-- =================== MARKETS ===================
alter table markets enable row level security;

-- Anyone can read markets
create policy "markets_select_public" on markets
  for select using (true);

-- Anyone can create a market (creator_pubkey is self-reported via Nostr sig)
create policy "markets_insert_public" on markets
  for insert with check (true);

-- Only service role can update markets (status changes, resolution)
create policy "markets_update_service" on markets
  for update using (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

create policy "markets_delete_none" on markets
  for delete using (false);

-- =================== POSITIONS ===================
alter table positions enable row level security;

-- Anyone can read positions (public market data)
create policy "positions_select_public" on positions
  for select using (true);

-- Anyone can create a position (backed by Lightning payment)
create policy "positions_insert_public" on positions
  for insert with check (true);

-- No updates or deletes (positions are immutable once committed)
create policy "positions_update_none" on positions
  for update using (false);

create policy "positions_delete_none" on positions
  for delete using (false);

-- =================== RESOLVER COMMITMENTS ===================
alter table resolver_commitments enable row level security;

-- Anyone can read resolver commitments (transparency)
create policy "resolver_select_public" on resolver_commitments
  for select using (true);

-- Only service role can write (backend processes resolver events)
create policy "resolver_insert_service" on resolver_commitments
  for insert with check (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

create policy "resolver_update_service" on resolver_commitments
  for update using (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

create policy "resolver_delete_none" on resolver_commitments
  for delete using (false);

-- =================== RESOLUTIONS ===================
alter table resolutions enable row level security;

-- Anyone can read resolutions (public record)
create policy "resolutions_select_public" on resolutions
  for select using (true);

-- Only service role can write resolutions
create policy "resolutions_insert_service" on resolutions
  for insert with check (
    current_setting('request.jwt.claims', true)::json->>'role' = 'service_role'
  );

create policy "resolutions_update_none" on resolutions
  for update using (false);

create policy "resolutions_delete_none" on resolutions
  for delete using (false);
