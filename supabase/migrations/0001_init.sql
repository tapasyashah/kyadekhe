create extension if not exists "uuid-ossp";

create table titles (
  id uuid primary key default uuid_generate_v4(),
  tmdb_id integer unique,
  imdb_id text,
  title text not null,
  original_title text,
  title_type text not null default 'movie', -- 'movie' | 'series' | 'short'
  year integer,
  runtime_minutes integer,
  overview text,
  poster_path text,
  backdrop_path text,
  tmdb_rating decimal,
  tmdb_vote_count integer,
  imdb_rating decimal,
  imdb_vote_count integer,
  director text[] default '{}',
  top_cast text[] default '{}',
  genres text[] default '{}',
  language text,
  origin_country text,
  hindi_dub boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table title_tags (
  id uuid primary key default uuid_generate_v4(),
  title_id uuid references titles(id) on delete cascade,
  tags jsonb not null default '{}',
  tagged_by text default 'claude-sonnet-4-6',
  tagged_at timestamptz default now(),
  version integer default 1
);

create table streaming_availability (
  id uuid primary key default uuid_generate_v4(),
  title_id uuid references titles(id) on delete cascade,
  region text not null,
  platform text not null,
  availability_type text not null,
  link text,
  last_verified timestamptz default now()
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  region text default 'IN',
  onboarded boolean default false,
  created_at timestamptz default now()
);

create table ratings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  title_id uuid references titles(id) on delete cascade,
  rating text not null check (rating in ('loved','liked','meh','disliked','havent_seen','skip')),
  rated_at timestamptz default now(),
  unique(user_id, title_id)
);

create table user_taste_vectors (
  user_id uuid primary key references users(id) on delete cascade,
  vector jsonb not null default '{}',
  computed_at timestamptz default now(),
  rating_count integer default 0
);

create table collections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  description text,
  emoji text default '🎬',
  is_public boolean default false,
  created_at timestamptz default now()
);

create table collection_items (
  id uuid primary key default uuid_generate_v4(),
  collection_id uuid references collections(id) on delete cascade,
  title_id uuid references titles(id) on delete cascade,
  added_at timestamptz default now(),
  note text,
  unique(collection_id, title_id)
);

create table recommendation_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  title_id uuid references titles(id) on delete cascade,
  recommended_at timestamptz default now(),
  reason_tags text[] default '{}',
  action text
);

create table why_cache (
  id uuid primary key default uuid_generate_v4(),
  title_id uuid references titles(id) on delete cascade,
  taste_cluster text not null,
  explanation text not null,
  generated_at timestamptz default now(),
  unique(title_id, taste_cluster)
);

-- RLS
alter table users enable row level security;
alter table ratings enable row level security;
alter table user_taste_vectors enable row level security;
alter table collections enable row level security;
alter table collection_items enable row level security;
alter table recommendation_log enable row level security;
alter table why_cache enable row level security;

-- Public read for catalogue
alter table titles enable row level security;
alter table title_tags enable row level security;
alter table streaming_availability enable row level security;

create policy "Public read titles" on titles for select using (true);
create policy "Public read title_tags" on title_tags for select using (true);
create policy "Public read streaming" on streaming_availability for select using (true);
create policy "Why cache readable by all" on why_cache for select using (true);

-- User-scoped policies
create policy "Users own row" on users for all using (auth.uid() = id);
create policy "Ratings own" on ratings for all using (auth.uid() = user_id);
create policy "Taste vectors own" on user_taste_vectors for all using (auth.uid() = user_id);
create policy "Collections own" on collections for all using (auth.uid() = user_id);
create policy "Collection items own" on collection_items for all
  using (exists (select 1 from collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy "Rec log own" on recommendation_log for all using (auth.uid() = user_id);

-- Trigger: create user row + default collections on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into users (id, display_name) values (new.id, new.raw_user_meta_data->>'full_name');
  insert into collections (user_id, name, emoji, description)
  values
    (new.id, 'Watch Next', '🎬', 'Films and series to watch soon'),
    (new.id, 'Loved It', '❤️', 'Things you''d watch again'),
    (new.id, 'Want to Revisit', '🔁', 'Rewatches on the list');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Indexes
create index on titles (tmdb_id);
create index on titles (imdb_id);
create index on title_tags (title_id);
create index on streaming_availability (title_id, region);
create index on ratings (user_id, title_id);
create index on collection_items (collection_id);
create index on recommendation_log (user_id, recommended_at desc);
