alter table public.game_saves
  add column if not exists prefs jsonb not null default '{}'::jsonb;
