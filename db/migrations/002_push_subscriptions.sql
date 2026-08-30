-- Browser push subscriptions (desktop/Android — iOS Safari requires an installed PWA and is
-- out of scope for this build). One row per subscribed browser, anonymous (no user auth on
-- this app). `endpoint` is unique per browser/device; re-subscribing upserts in place.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
