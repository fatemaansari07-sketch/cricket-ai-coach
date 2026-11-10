-- Cricket AI Coach V2 additive migration.
-- SAME Supabase project/database/auth can be reused. This does not delete old data.

alter table public.profiles add column if not exists player_role text;
alter table public.profiles add column if not exists batting_hand text;
alter table public.profiles add column if not exists bowling_style text;
alter table public.profiles add column if not exists onboarding_completed boolean not null default false;
alter table public.profiles add column if not exists age_group text;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists current_focus text;

-- Keep the existing four-tier plan check if the old migration already created it.
alter table public.profiles drop constraint if exists profiles_plan_tier_check;
alter table public.profiles drop constraint if exists profiles_plan_tier_check_v2;
alter table public.profiles add constraint profiles_plan_tier_check_v2
  check (plan_tier in ('free','pro_99','video_499','special_coach'));

create table if not exists public.coaching_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  role text,
  shot text,
  phase text,
  landmarks jsonb,
  angles jsonb,
  ai_findings jsonb,
  mistakes jsonb,
  corrections jsonb,
  score integer,
  test_number integer,
  plan_day integer,
  credits_used integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.coaching_events enable row level security;
drop policy if exists "coaching_events owner" on public.coaching_events;
create policy "coaching_events owner" on public.coaching_events for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table if not exists public.coaching_tests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  test_number integer not null,
  focus text,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.coaching_tests enable row level security;
drop policy if exists "coaching_tests owner" on public.coaching_tests;
create policy "coaching_tests owner" on public.coaching_tests for all using (auth.uid()=user_id) with check (auth.uid()=user_id);

create table if not exists public.coach_assignments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid references public.academies(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  coach_user_id uuid references public.profiles(id) on delete set null,
  focus text not null,
  instructions text,
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active',
  created_at timestamptz not null default now()
);
alter table public.coach_assignments enable row level security;
drop policy if exists "coach assignments student" on public.coach_assignments;
create policy "coach assignments student" on public.coach_assignments for select using (auth.uid()=student_id or auth.uid()=coach_user_id);

-- Launch feature flags: marketplace stays architected but hidden until supply is ready.
create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  city text,
  updated_at timestamptz not null default now()
);
insert into public.feature_flags(key,enabled) values
('shop_system',false),('need_it',false),('shop_promotions',false),('deals',false),('academy_marketplace',false),('affiliate',true),('broadcast',true)
on conflict (key) do nothing;

-- Credits used by the paid tiers.
alter table public.profiles add column if not exists visual_credits_remaining integer not null default 0;
alter table public.profiles add column if not exists video_credits_remaining integer not null default 0;
alter table public.profiles add column if not exists visual_credits_reset_at date;
alter table public.profiles add column if not exists video_credits_reset_at date;
alter table public.videos add column if not exists shot_type text;
alter table public.analyses add column if not exists issues jsonb not null default '[]'::jsonb;

create table if not exists public.visual_analysis_usage (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  cost integer not null default 10, created_at timestamptz not null default now(), metadata jsonb not null default '{}'::jsonb
);
alter table public.visual_analysis_usage enable row level security;
drop policy if exists "Users view own visual usage" on public.visual_analysis_usage;
create policy "Users view own visual usage" on public.visual_analysis_usage for select using (auth.uid()=user_id);

create or replace function public.consume_visual_credit()
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); tier text; remaining integer; today date := current_date; cost integer := 10; lim integer;
begin
 if uid is null then return jsonb_build_object('allowed',false,'remaining',0,'reason','not_authenticated'); end if;
 -- Authorizes the UPDATEs below past guard_profile_self_update() (see end of
 -- this file), which otherwise blocks a non-admin from writing their own
 -- plan_tier/credits columns directly.
 perform set_config('cricket.trusted_credit_update','on', true);
 select plan_tier,coalesce(visual_credits_remaining,0) into tier,remaining from public.profiles where id=uid for update;
 if tier is null then return jsonb_build_object('allowed',false,'remaining',0,'reason','profile_not_found'); end if;
 lim := case tier when 'pro_99' then 100 when 'video_499' then 100 when 'special_coach' then 100 else 0 end;
 if lim=0 then return jsonb_build_object('allowed',false,'remaining',0,'reason','plan_has_no_visual_credits'); end if;
 if (select visual_credits_reset_at from public.profiles where id=uid) is null or date_trunc('month',(select visual_credits_reset_at from public.profiles where id=uid))::date <> date_trunc('month',today)::date then
   remaining := lim; update public.profiles set visual_credits_remaining=lim,visual_credits_reset_at=today where id=uid;
 end if;
 if remaining < cost then return jsonb_build_object('allowed',false,'remaining',remaining,'reason','credits_exhausted'); end if;
 remaining := remaining-cost; update public.profiles set visual_credits_remaining=remaining where id=uid;
 insert into public.visual_analysis_usage(user_id,cost) values(uid,cost);
 return jsonb_build_object('allowed',true,'remaining',remaining,'cost',cost);
end; $$;
grant execute on function public.consume_visual_credit() to authenticated;

create or replace function public.consume_video_credit()
returns jsonb language plpgsql security definer set search_path=public as $$
declare uid uuid := auth.uid(); tier text; remaining integer; today date := current_date;
begin
 if uid is null then return jsonb_build_object('allowed',false,'remaining',0,'reason','not_authenticated'); end if;
 perform set_config('cricket.trusted_credit_update','on', true);
 select plan_tier,coalesce(video_credits_remaining,0) into tier,remaining from public.profiles where id=uid for update;
 if tier is null then return jsonb_build_object('allowed',false,'remaining',0,'reason','profile_not_found'); end if;
 if tier not in ('video_499','special_coach') then return jsonb_build_object('allowed',false,'remaining',0,'reason','plan_has_no_video_credits'); end if;
 if (select video_credits_reset_at from public.profiles where id=uid) is null or date_trunc('month',(select video_credits_reset_at from public.profiles where id=uid))::date <> date_trunc('month',today)::date then
   remaining := 100; update public.profiles set video_credits_remaining=100,video_credits_reset_at=today where id=uid;
 end if;
 if remaining < 10 then return jsonb_build_object('allowed',false,'remaining',remaining,'reason','credits_exhausted'); end if;
 remaining := remaining-10; update public.profiles set video_credits_remaining=remaining where id=uid;
 return jsonb_build_object('allowed',true,'remaining',remaining,'cost',10);
end; $$;
grant execute on function public.consume_video_credit() to authenticated;

-- Existing users keep their data; only old plan names are normalized.
update public.profiles set plan_tier='pro_99' where plan_tier='basic';
update public.profiles set plan_tier='video_499' where plan_tier='pro';
update public.profiles set visual_credits_remaining=100,visual_credits_reset_at=current_date where plan_tier in ('pro_99','video_499','special_coach') and coalesce(visual_credits_remaining,0)=0;
update public.profiles set video_credits_remaining=100,video_credits_reset_at=current_date where plan_tier in ('video_499','special_coach') and coalesce(video_credits_remaining,0)=0;

-- ============================================================
-- SECURITY FIX: stop a normal user from self-granting a paid plan.
--
-- "profiles: user updates own" (schema.sql) only checks auth.uid()=id —
-- it does not restrict WHICH columns a user may change. Without this
-- guard, any logged-in user could call
--   supabase.from('profiles').update({ plan_tier: 'special_coach',
--     visual_credits_remaining: 100, is_admin: true }).eq('id', myId)
-- directly from the browser console and unlock every paid feature (or
-- the admin panel) for free.
--
-- consume_visual_credit()/consume_video_credit() above set a local,
-- transaction-scoped flag before touching these columns themselves (that
-- is the only legitimate way credits move), and an admin (checked via
-- is_admin(), itself already security definer) may still assign plans
-- from AdminScreen. Everyone else keeps their existing values.
-- ============================================================
create or replace function public.guard_profile_self_update()
returns trigger language plpgsql as $$
begin
  if public.is_admin() or coalesce(current_setting('cricket.trusted_credit_update', true), 'off') = 'on' then
    return new;
  end if;
  new.plan_tier := old.plan_tier;
  new.visual_credits_remaining := old.visual_credits_remaining;
  new.visual_credits_reset_at := old.visual_credits_reset_at;
  new.video_credits_remaining := old.video_credits_remaining;
  new.video_credits_reset_at := old.video_credits_reset_at;
  new.is_admin := old.is_admin;
  return new;
end;
$$;

drop trigger if exists guard_profile_self_update on public.profiles;
create trigger guard_profile_self_update
  before update on public.profiles
  for each row execute procedure public.guard_profile_self_update();
