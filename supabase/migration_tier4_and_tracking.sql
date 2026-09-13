-- ============================================================
-- Cricket AI Coach — ADD-ON MIGRATION
-- Run this AFTER schema.sql (Supabase SQL Editor, once).
-- Adds: Tier-4 mastery gatekeeping, weekly-test tracking,
--       credit transaction log, pro-player match %.
-- Uses the SAME naming as schema.sql (profiles.*_credits_remaining,
-- plan_tier) — does NOT introduce a parallel user_subscriptions table.
-- ============================================================

-- ------------------------------------------------------------
-- 13. TIER-4 MASTERY GATEKEEPING (Level 1 Defense -> 2 Drives ->
--     3 Cuts/Pulls -> 4 Match Mastery). User can't attempt Level N+1
--     drills until Level N is in passed_levels.
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists current_level int not null default 1
    check (current_level between 1 and 4);

alter table public.profiles
  add column if not exists passed_levels text[] not null default '{}';

alter table public.profiles
  add column if not exists next_test_date timestamptz;

-- ------------------------------------------------------------
-- 14. WEEKLY / 7-DAY TEST SUBMISSIONS
--     ("Test in 3 Days!" countdown -> user submits test video ->
--     Progress Matrix -> pass/fail updates profiles.passed_levels)
-- ------------------------------------------------------------
create table if not exists public.weekly_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_id uuid references public.videos(id) on delete set null,
  level int not null check (level between 1 and 4),
  test_date timestamptz not null default now(),
  score jsonb,               -- e.g. { angle_improvements: {...}, head_stability_shift: ... }
  passed boolean,
  created_at timestamptz not null default now()
);

alter table public.weekly_tests enable row level security;
create policy "weekly_tests: owner all" on public.weekly_tests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 15. CREDIT TRANSACTION LOG (audit trail for recharges + spends,
--     matches: 100 credits / ₹99 pro recharge, 100 credits / ₹120
--     video recharge, -10 credits per keyframe analysis or video gen)
--     Insert-only from client; balances still live on profiles.*.
-- ------------------------------------------------------------
create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credit_type text not null check (credit_type in ('gemini','coaching_video')),
  amount int not null,                 -- positive = recharge, negative = spend
  reason text not null,                -- 'recharge' | '3_keyframe_analysis' | 'video_generation' | ...
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

alter table public.credit_transactions enable row level security;
create policy "credit_transactions: owner reads own" on public.credit_transactions
  for select using (auth.uid() = user_id);
create policy "credit_transactions: owner inserts own" on public.credit_transactions
  for insert with check (auth.uid() = user_id);
-- no update/delete policy on purpose — history should be append-only

-- ------------------------------------------------------------
-- 16. MATCH % on pro-player comparisons (self_vs_pro mode)
-- ------------------------------------------------------------
alter table public.comparisons
  add column if not exists match_percentage numeric(5,2);
