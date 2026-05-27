-- DevEnglish v1 — Supabase 初始化迁移
-- 运行方式：supabase migration up
-- 或：Supabase Dashboard → SQL Editor → 粘贴执行

-- ═══════════════════════════════════════════════════
-- 1. 用户资料表（扩展 Supabase Auth）
-- ═══════════════════════════════════════════════════

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  avatar_url    text,
  is_paid       boolean      not null default false,   -- Lemon Squeezy 付款后置 true
  paid_at       timestamptz,
  trial_count   int          not null default 0 check (trial_count >= 0),
  created_at    timestamptz  not null default now(),
  updated_at    timestamptz  not null default now()
);

-- ─── 触发器：新用户注册时自动创建 profiles 行 ───────────────────

create or replace function public.handle_new_user()
returns trigger
-- FIX: set search_path prevents search_path-injection attacks on SECURITY DEFINER fns
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- FIX: store NULL instead of '' when no display_name is provided
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  )
  -- FIX: guard against rare race conditions (e.g. duplicate webhook fires)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════
-- 2. 词卡表
-- ═══════════════════════════════════════════════════

create table if not exists public.flashcards (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references public.profiles(id) on delete cascade,
  -- FIX: reject blank/whitespace-only strings
  word            text        not null check (length(trim(word)) > 0),
  ipa             text,
  part_of_speech  text,
  definition      text        not null check (length(trim(definition)) > 0),
  example         text,
  example_zh      text,
  scene           text        default 'work',
  mastery_level   smallint    not null default 0 check (mastery_level between 0 and 4),
  next_review_at  timestamptz not null default now(),
  review_count    int         not null default 0 check (review_count >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- FIX: required by sync Edge Function (.gt('synced_at', lastSyncedIso))
  synced_at       timestamptz not null default now()
);

-- FIX: unique constraint required by sync Edge Function (onConflict: 'user_id, word')
alter table public.flashcards
  drop constraint if exists flashcards_user_word_unique;
alter table public.flashcards
  add constraint flashcards_user_word_unique unique (user_id, word);

-- Indexes
-- (user_id, next_review_at) — covers the primary SRS query
create index if not exists idx_flashcards_next_review
  on public.flashcards (user_id, next_review_at);

-- FIX: (user_id, synced_at) — covers the delta-sync query in sync Edge Function
create index if not exists idx_flashcards_synced_at
  on public.flashcards (user_id, synced_at);

-- FIX: drop the low-utility single-column word index; the unique constraint
--      on (user_id, word) already provides efficient word lookups per user
-- (if you genuinely need global word search, add a GIN/pg_trgm index instead)

-- ═══════════════════════════════════════════════════
-- 3. 学习记录表
-- ═══════════════════════════════════════════════════

create table if not exists public.study_records (
  id            uuid      primary key default gen_random_uuid(),
  user_id       uuid      not null references public.profiles(id) on delete cascade,
  flashcard_id  uuid      references public.flashcards(id) on delete set null,
  session_type  text      not null check (session_type in ('review', 'typing', 'oral')),
  rating        text      check (rating in ('easy', 'blurry', 'forgot', 'skip')),
  wpm           int       check (wpm is null or wpm >= 0),
  accuracy      smallint  check (accuracy is null or accuracy between 0 and 100),
  wrong_count   int       not null default 0 check (wrong_count >= 0),
  created_at    timestamptz not null default now()
);

-- Composite index for dashboard/streak queries (user + time)
create index if not exists idx_study_records_user_time
  on public.study_records (user_id, created_at);

-- FIX: index for flashcard-level analytics (e.g. "how many times did I practice X?")
create index if not exists idx_study_records_flashcard
  on public.study_records (flashcard_id)
  where flashcard_id is not null;

-- ═══════════════════════════════════════════════════
-- 4. 行级安全策略（RLS）
-- ═══════════════════════════════════════════════════

alter table public.profiles      enable row level security;
alter table public.flashcards    enable row level security;
alter table public.study_records enable row level security;

-- ─── profiles ──────────────────────────────────────

-- Users can SELECT / UPDATE / DELETE their own row only.
-- INSERT is intentionally excluded here: the SECURITY DEFINER trigger
-- (handle_new_user) inserts the row automatically with superuser privileges,
-- bypassing RLS entirely. No extra INSERT policy is needed.
drop policy if exists "profiles_select_own"   on public.profiles;
drop policy if exists "profiles_update_own"   on public.profiles;
drop policy if exists "profiles_own"          on public.profiles;
drop policy if exists "profiles_insert"       on public.profiles;  -- FIX: remove unsafe policy

create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- ─── flashcards ────────────────────────────────────

drop policy if exists "flashcards_own" on public.flashcards;

create policy "flashcards_own" on public.flashcards
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── study_records ─────────────────────────────────

drop policy if exists "study_records_own" on public.study_records;

create policy "study_records_own" on public.study_records
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════
-- 5. 存储过程：获取当前用户今天到期的复习词
-- ═══════════════════════════════════════════════════

create or replace function public.get_due_reviews(p_limit int default 20)
returns table (
  id             uuid,
  word           text,
  ipa            text,
  part_of_speech text,
  definition     text,
  example        text,
  example_zh     text,
  scene          text,
  mastery_level  smallint,
  review_count   int
)
language sql stable
-- No SECURITY DEFINER — runs as the calling user so RLS applies automatically
as $$
  select
    f.id, f.word, f.ipa, f.part_of_speech, f.definition,
    f.example, f.example_zh, f.scene,
    f.mastery_level, f.review_count
  from public.flashcards f
  where
    -- FIX: use auth.uid() directly — callers cannot request another user's cards
    f.user_id = auth.uid()
    and f.next_review_at <= now()
  order by f.next_review_at asc
  -- FIX: cap at 200 to prevent runaway queries
  limit least(p_limit, 200);
$$;

-- ═══════════════════════════════════════════════════
-- 6. 更新时间戳触发器
-- ═══════════════════════════════════════════════════

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- FIX: drop before create — CREATE TRIGGER has no OR REPLACE, re-runs would fail
drop trigger if exists set_profiles_updated_at   on public.profiles;
drop trigger if exists set_flashcards_updated_at on public.flashcards;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger set_flashcards_updated_at
  before update on public.flashcards
  for each row execute function public.set_updated_at();
