-- Initial Butaca schema. Every row belongs to a Supabase Auth user.

create table if not exists public.marks (
  user_id      uuid         not null references auth.users (id) on delete cascade,
  key          text         not null,              -- 'movie:123' | 'tv:456'
  type         text         not null check (type in ('movie', 'tv')),
  tmdb_id      integer      not null,
  status       text         not null default 'watched'
               check (status in ('watching', 'watched', 'plan_to_watch', 'dropped', 'not_interested')),
  stars        numeric(2,1) check (stars between 0.5 and 5),
  season       integer      not null default 0,
  episode      integer      not null default 0,
  times_watched integer     not null default 1,
  watched_at   timestamptz,
  updated_at   timestamptz  not null default now(),
  primary key (user_id, key)
);

-- Activity log: feeds watch time, streaks and records.
create table if not exists public.events (
  id          bigint generated always as identity primary key,
  user_id     uuid         not null references auth.users (id) on delete cascade,
  key         text         not null,
  action      text         not null,              -- 'rated' | 'watched_episode' | 'finished' | 'discarded'
  minutes     integer      not null default 0,
  created_at  timestamptz  not null default now()
);

create table if not exists public.daily_picks (
  user_id     uuid         not null references auth.users (id) on delete cascade,
  day         date         not null,
  key         text         not null,
  accepted    boolean,
  primary key (user_id, day)
);

create table if not exists public.achievements (
  user_id      uuid        not null references auth.users (id) on delete cascade,
  code         text        not null,
  unlocked_at  timestamptz not null default now(),
  primary key (user_id, code)
);

-- Shared OMDb ratings cache (not per user, but still protected).
create table if not exists public.omdb_cache (
  imdb_id     text         primary key,
  data        jsonb        not null,
  updated_at  timestamptz  not null default now()
);

alter table public.marks          enable row level security;
alter table public.events         enable row level security;
alter table public.daily_picks    enable row level security;
alter table public.achievements   enable row level security;

create policy "own marks" on public.marks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own events" on public.events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own daily picks" on public.daily_picks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own achievements" on public.achievements
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- omdb_cache has no policies for the anon role: only the server's service key writes it.
alter table public.omdb_cache enable row level security;

create index if not exists marks_user_updated_idx on public.marks (user_id, updated_at);
create index if not exists events_user_created_idx on public.events (user_id, created_at);
