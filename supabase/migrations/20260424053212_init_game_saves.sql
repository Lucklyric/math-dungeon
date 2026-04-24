create table if not exists public.game_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  inventory jsonb not null default '[]'::jsonb,
  equipped jsonb not null default '{}'::jsonb,
  next_id integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.game_saves enable row level security;

drop policy if exists "Players can read their own save" on public.game_saves;
drop policy if exists "Players can insert their own save" on public.game_saves;
drop policy if exists "Players can update their own save" on public.game_saves;
drop policy if exists "Players can delete their own save" on public.game_saves;

create policy "Players can read their own save"
on public.game_saves
for select
to authenticated
using (auth.uid() = user_id);

create policy "Players can insert their own save"
on public.game_saves
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "Players can update their own save"
on public.game_saves
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "Players can delete their own save"
on public.game_saves
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists game_saves_set_updated_at on public.game_saves;

create trigger game_saves_set_updated_at
before update on public.game_saves
for each row
execute function public.set_updated_at();
