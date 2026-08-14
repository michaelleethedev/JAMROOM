-- JamRoom Live Room / Party Mode schema
-- Run this in the Supabase SQL editor for the project used by JamRoom.

create extension if not exists "pgcrypto";

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{6}$'),
  name text not null check (char_length(name) between 2 and 60),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'party' check (mode in ('party', 'sync')),
  guests_can_add boolean not null default true,
  require_approval boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  role text not null default 'guest' check (role in ('host', 'guest')),
  joined_at timestamptz not null default now(),
  unique (room_id, user_id)
);

create table if not exists public.queue_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  provider text not null,
  provider_id text,
  external_url text,
  title text not null,
  artist text not null,
  artwork text,
  duration integer not null default 210 check (duration >= 0),
  added_by uuid not null references auth.users(id) on delete cascade,
  vote_score integer not null default 0,
  position integer not null default 0,
  approval_status text not null default 'approved' check (approval_status in ('approved', 'pending', 'rejected', 'unavailable')),
  created_at timestamptz not null default now()
);

create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  queue_item_id uuid not null references public.queue_items(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  value integer not null check (value in (-1, 1)),
  unique (room_id, queue_item_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  type text not null default 'chat' check (type in ('chat', 'system', 'reaction')),
  message text not null check (char_length(message) between 1 and 500),
  created_at timestamptz not null default now()
);

create table if not exists public.player_state (
  room_id uuid primary key references public.rooms(id) on delete cascade,
  current_queue_item_id uuid references public.queue_items(id) on delete set null,
  playback_state text not null default 'paused' check (playback_state in ('playing', 'paused', 'ended')),
  position_seconds integer not null default 0 check (position_seconds >= 0),
  volume integer not null default 76 check (volume between 0 and 100),
  updated_at timestamptz not null default now()
);

create or replace function public.is_room_participant(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.participants p
    where p.room_id = target_room_id
      and p.user_id = auth.uid()
  );
$$;

create or replace function public.is_room_host(target_room_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rooms r
    where r.id = target_room_id
      and r.host_user_id = auth.uid()
  );
$$;

create or replace function public.recalculate_queue_vote_score()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_item uuid;
begin
  target_item := coalesce(new.queue_item_id, old.queue_item_id);
  update public.queue_items
  set vote_score = coalesce((select sum(value) from public.votes where queue_item_id = target_item), 0)
  where id = target_item;
  return null;
end;
$$;

drop trigger if exists votes_recalculate_queue_score on public.votes;
create trigger votes_recalculate_queue_score
after insert or update or delete on public.votes
for each row execute function public.recalculate_queue_vote_score();

alter table public.rooms enable row level security;
alter table public.participants enable row level security;
alter table public.queue_items enable row level security;
alter table public.votes enable row level security;
alter table public.messages enable row level security;
alter table public.player_state enable row level security;

drop policy if exists "rooms can be created by authenticated users" on public.rooms;
create policy "rooms can be created by authenticated users"
on public.rooms for insert
to authenticated
with check (host_user_id = auth.uid());

drop policy if exists "active rooms can be discovered by code" on public.rooms;
create policy "active rooms can be discovered by code"
on public.rooms for select
to authenticated
using (is_active or public.is_room_participant(id));

drop policy if exists "hosts can update rooms" on public.rooms;
create policy "hosts can update rooms"
on public.rooms for update
to authenticated
using (public.is_room_host(id))
with check (public.is_room_host(id));

drop policy if exists "participants can read participants" on public.participants;
create policy "participants can read participants"
on public.participants for select
to authenticated
using (public.is_room_participant(room_id) or exists (select 1 from public.rooms r where r.id = room_id and r.is_active));

drop policy if exists "users can join active rooms" on public.participants;
create policy "users can join active rooms"
on public.participants for insert
to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.rooms r where r.id = room_id and r.is_active)
  and role = 'guest'
);

drop policy if exists "hosts can insert self as host" on public.participants;
create policy "hosts can insert self as host"
on public.participants for insert
to authenticated
with check (user_id = auth.uid() and role = 'host' and public.is_room_host(room_id));

drop policy if exists "participants can update own participant" on public.participants;
create policy "participants can update own participant"
on public.participants for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "hosts can remove participants" on public.participants;
create policy "hosts can remove participants"
on public.participants for delete
to authenticated
using (public.is_room_host(room_id) or user_id = auth.uid());

drop policy if exists "participants can read queue" on public.queue_items;
create policy "participants can read queue"
on public.queue_items for select
to authenticated
using (public.is_room_participant(room_id));

drop policy if exists "participants can add queue items when allowed" on public.queue_items;
create policy "participants can add queue items when allowed"
on public.queue_items for insert
to authenticated
with check (
  added_by = auth.uid()
  and public.is_room_participant(room_id)
  and (
    public.is_room_host(room_id)
    or exists (select 1 from public.rooms r where r.id = room_id and r.guests_can_add and r.is_active)
  )
);

drop policy if exists "hosts can manage queue" on public.queue_items;
create policy "hosts can manage queue"
on public.queue_items for update
to authenticated
using (public.is_room_host(room_id))
with check (public.is_room_host(room_id));

drop policy if exists "hosts can remove queue items" on public.queue_items;
create policy "hosts can remove queue items"
on public.queue_items for delete
to authenticated
using (public.is_room_host(room_id));

drop policy if exists "participants can read votes" on public.votes;
create policy "participants can read votes"
on public.votes for select
to authenticated
using (public.is_room_participant(room_id));

drop policy if exists "participants can vote once" on public.votes;
create policy "participants can vote once"
on public.votes for insert
to authenticated
with check (user_id = auth.uid() and public.is_room_participant(room_id));

drop policy if exists "participants can update own vote" on public.votes;
create policy "participants can update own vote"
on public.votes for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "participants can delete own vote" on public.votes;
create policy "participants can delete own vote"
on public.votes for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "participants can read messages" on public.messages;
create policy "participants can read messages"
on public.messages for select
to authenticated
using (public.is_room_participant(room_id));

drop policy if exists "participants can write messages" on public.messages;
create policy "participants can write messages"
on public.messages for insert
to authenticated
with check (public.is_room_participant(room_id) and (user_id = auth.uid() or user_id is null));

drop policy if exists "participants can read player state" on public.player_state;
create policy "participants can read player state"
on public.player_state for select
to authenticated
using (public.is_room_participant(room_id));

drop policy if exists "hosts can create player state" on public.player_state;
create policy "hosts can create player state"
on public.player_state for insert
to authenticated
with check (public.is_room_host(room_id));

drop policy if exists "hosts can update player state" on public.player_state;
create policy "hosts can update player state"
on public.player_state for update
to authenticated
using (public.is_room_host(room_id))
with check (public.is_room_host(room_id));

-- Supabase Realtime must also be enabled for these tables in the Dashboard:
-- rooms, participants, queue_items, votes, messages, player_state
