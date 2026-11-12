-- Credits fix: safe to re-run. Run this in Supabase SQL editor.
alter table public.profiles add column if not exists is_admin boolean not null default false;
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

create or replace function public.guard_profile_self_update()
returns trigger language plpgsql as $$
begin
  -- auth.uid() is null for the SQL editor and the server-side service-role key
  -- (trusted backend); only real end-user sessions are restricted.
  if auth.uid() is null or public.is_admin() or coalesce(current_setting('cricket.trusted_credit_update', true), 'off') = 'on' then
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
