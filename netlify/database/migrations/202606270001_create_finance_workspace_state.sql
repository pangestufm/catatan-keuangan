create table if not exists finance_workspace_state (
  state_key text primary key,
  state_value jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  migrated_from text
);

create index if not exists finance_workspace_state_updated_at_idx
  on finance_workspace_state (updated_at desc);
