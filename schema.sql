-- ============================================================
-- Cricket AI Coach — Supabase Schema
-- Paste this in Supabase SQL Editor and run once.
-- Uses Supabase Auth (auth.users) as the source of truth for users.
-- ============================================================

-- extensions
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. PROFILES (extends auth.users)
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  city text,
  plan_tier text not null default 'free' check (plan_tier in ('free','basic','pro')),
  plan_renews_at timestamptz,
  videos_analyzed_today int not null default 0,
  videos_quota_reset_at date default current_date,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: user reads own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles: user updates own" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles: user inserts own" on public.profiles
  for insert with check (auth.uid() = id);

-- auto-create profile row on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ------------------------------------------------------------
-- 2. VIDEOS  (uploaded practice clips — file itself lives in Supabase Storage bucket "videos")
-- ------------------------------------------------------------
create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,              -- path inside the "videos" storage bucket
  category text not null check (category in ('batting','bowling','fielding')),
  thumbnail_path text,
  duration_seconds int,
  created_at timestamptz not null default now()
);

alter table public.videos enable row level security;
create policy "videos: owner all" on public.videos
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. ANALYSES (AI output per video)
-- ------------------------------------------------------------
create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('batting','bowling','fielding')),
  score int not null check (score between 0 and 100),
  correct_points jsonb not null default '[]',   -- array of strings
  incorrect_points jsonb not null default '[]', -- array of strings
  pose_keypoints jsonb,                          -- raw pose-estimation output (per-frame joints), if using MediaPipe/OpenPose
  model_version text,
  created_at timestamptz not null default now()
);

alter table public.analyses enable row level security;
create policy "analyses: owner all" on public.analyses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. PRACTICE PLANS (30-day plan generated from an analysis)
-- ------------------------------------------------------------
create table if not exists public.practice_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  category text not null check (category in ('batting','bowling','fielding')),
  started_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.practice_plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.practice_plans(id) on delete cascade,
  day_number int not null check (day_number between 1 and 30),
  is_rest_day boolean not null default false,
  drill text,
  focus_point text,
  completed boolean not null default false,
  unique (plan_id, day_number)
);

alter table public.practice_plans enable row level security;
alter table public.practice_plan_days enable row level security;

create policy "plans: owner all" on public.practice_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "plan_days: owner all" on public.practice_plan_days
  for all using (
    auth.uid() = (select user_id from public.practice_plans p where p.id = plan_id)
  ) with check (
    auth.uid() = (select user_id from public.practice_plans p where p.id = plan_id)
  );

-- ------------------------------------------------------------
-- 5. COMPARISONS (self-vs-self or self-vs-pro-player)
-- ------------------------------------------------------------
create table if not exists public.pro_players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  role text not null check (role in ('Batting','Bowling','Fielding')),
  reference_style text,       -- e.g. "Cover Drive", "Yorker"
  reference_pose_keypoints jsonb, -- pre-computed pose reference data
  is_active boolean not null default true
);

create table if not exists public.comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  mode text not null check (mode in ('self_vs_self','self_vs_pro')),
  video_a_id uuid references public.videos(id) on delete set null,
  video_b_id uuid references public.videos(id) on delete set null,
  pro_player_id uuid references public.pro_players(id) on delete set null,
  breakdown jsonb not null default '[]',  -- [{ joint: 'Head position', note: '...' }, ...]
  created_at timestamptz not null default now()
);

alter table public.comparisons enable row level security;
create policy "comparisons: owner all" on public.comparisons
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.pro_players enable row level security;
create policy "pro_players: everyone reads" on public.pro_players
  for select using (true);

-- ------------------------------------------------------------
-- 6. SUBSCRIPTIONS & PAYMENTS (Razorpay / UPI integration friendly)
-- ------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_tier text not null check (plan_tier in ('basic','pro')),
  billing_type text not null check (billing_type in ('monthly','per_video')),
  amount_paise int not null,          -- e.g. 9900 for ₹99
  razorpay_payment_id text,
  razorpay_order_id text,
  status text not null default 'created' check (status in ('created','paid','failed','refunded')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy "subscriptions: owner all" on public.subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 7. ADS (in-app generic ads + shop/product ads submitted by vendors)
-- ------------------------------------------------------------
create table if not exists public.shop_ads (
  id uuid primary key default gen_random_uuid(),
  shop_name text not null,
  product_name text not null,
  category text not null check (category in ('Bat','Ball','Shoes','Gloves','Pads','Kit Bag','Other')),
  price_inr numeric(10,2),
  description text,
  image_path text,                 -- storage bucket "ad-images"
  address text,
  phone text,
  map_link text,
  vendor_user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

alter table public.shop_ads enable row level security;
create policy "shop_ads: public reads approved" on public.shop_ads
  for select using (status = 'approved');
create policy "shop_ads: vendor inserts own" on public.shop_ads
  for insert with check (auth.uid() = vendor_user_id);
create policy "shop_ads: vendor updates own pending" on public.shop_ads
  for update using (auth.uid() = vendor_user_id and status = 'pending');

create table if not exists public.affiliate_ads (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  affiliate_url text not null,
  image_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.affiliate_ads enable row level security;
create policy "affiliate_ads: public reads active" on public.affiliate_ads
  for select using (is_active = true);

-- ad impression/click log (optional, for analytics/billing advertisers)
create table if not exists public.ad_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  ad_type text not null check (ad_type in ('shop_ad','affiliate_ad')),
  ad_id uuid not null,
  event_type text not null check (event_type in ('impression','click')),
  screen text,                     -- which app screen the ad was shown on
  created_at timestamptz not null default now()
);

alter table public.ad_events enable row level security;
create policy "ad_events: insert by anyone authenticated" on public.ad_events
  for insert with check (auth.uid() = user_id or user_id is null);

-- ------------------------------------------------------------
-- 8. STORAGE BUCKETS (run in Supabase dashboard or via SQL)
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('videos', 'videos', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('ad-images', 'ad-images', true)
  on conflict (id) do nothing;

-- storage policy: users can upload/read only their own videos
create policy "videos bucket: owner rw" on storage.objects
  for all using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "ad-images bucket: public read" on storage.objects
  for select using (bucket_id = 'ad-images');

-- ------------------------------------------------------------
-- 9. DAILY QUOTA RESET (basic: 3/day, pro: 10/day) — call via
--    a Supabase scheduled Edge Function / pg_cron at midnight
-- ------------------------------------------------------------
create or replace function public.reset_daily_video_quota()
returns void as $$
begin
  update public.profiles
  set videos_analyzed_today = 0,
      videos_quota_reset_at = current_date
  where videos_quota_reset_at < current_date;
end;
$$ language plpgsql security definer;

-- Example (needs pg_cron extension enabled in Supabase):
-- select cron.schedule('reset-video-quota', '0 0 * * *', $$select public.reset_daily_video_quota();$$);

-- ============================================================
-- ADDED LATER: Admin flag + phone-based auth support + admin policies
-- ============================================================

-- 10. ADMIN FLAG on profiles
alter table public.profiles add column if not exists is_admin boolean not null default false;

-- Helper function: is the current logged-in user an admin?
create or replace function public.is_admin()
returns boolean as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$ language sql security definer stable;

-- Admins can read every profile (needed for the admin user list)
create policy "profiles: admin reads all" on public.profiles
  for select using (public.is_admin());

-- Admins can update any profile (e.g. change someone's plan_tier, ban a user)
create policy "profiles: admin updates all" on public.profiles
  for update using (public.is_admin());

-- Admins can see every shop ad, including pending/rejected ones
create policy "shop_ads: admin reads all" on public.shop_ads
  for select using (public.is_admin());

-- Admins can approve/reject any shop ad
create policy "shop_ads: admin updates all" on public.shop_ads
  for update using (public.is_admin());

-- To make your own account an admin after signing up once, run this in the
-- SQL Editor (replace with your real email):
--   update public.profiles set is_admin = true
--   where id = (select id from auth.users where email = 'you@example.com');

-- NOTE on phone-number login: profiles.phone already exists (see section 1).
-- To let users register/login with just a phone number + OTP, turn on
-- "Phone" under Supabase Dashboard -> Authentication -> Providers, and
-- configure an SMS provider (Twilio, MessageBird, etc). The app calls
-- supabase.auth.signInWithOtp({ phone }) and supabase.auth.verifyOtp(...),
-- which only work once a provider is configured there.

-- ============================================================
-- ADDED LATER: auto-delete raw video files after 7 days
-- (analyses/plans/text data are NEVER deleted — only the video file itself)
-- ============================================================
alter table public.videos add column if not exists deleted_at timestamptz;

create index if not exists idx_videos_cleanup
  on public.videos (created_at)
  where deleted_at is null;

-- ============================================================
-- ADDED LATER: Academies + shot-type + daily quota
-- ============================================================

-- 11. ACADEMIES
create table if not exists public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  owner_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.academies enable row level security;

create policy "academies: owner manages own" on public.academies
  for all using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);

-- students need to look up an academy by invite code to join it
create policy "academies: anyone can look up by code" on public.academies
  for select using (true);

-- link students to an academy + flag academy-owner accounts
alter table public.profiles add column if not exists academy_id uuid references public.academies(id) on delete set null;
alter table public.profiles add column if not exists is_academy_owner boolean not null default false;

-- academy owners need to read their students' profiles + analyses
create policy "profiles: academy owner reads own students" on public.profiles
  for select using (
    academy_id in (select id from public.academies where owner_user_id = auth.uid())
  );

create policy "analyses: academy owner reads students' analyses" on public.analyses
  for select using (
    user_id in (
      select p.id from public.profiles p
      join public.academies a on a.id = p.academy_id
      where a.owner_user_id = auth.uid()
    )
  );

-- 12. Shot type on videos (free tier = one focused shot per video, shorter clips)
alter table public.videos add column if not exists shot_type text;
