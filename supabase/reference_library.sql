-- Reference shot library (admin only). Users NEVER see these videos or rows.
-- Safe to re-run.

create table if not exists public.reference_shots (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'batting',
  shot_type text not null,
  camera_angle text not null default 'side-on',
  handedness text not null default 'right',
  phase_angles jsonb not null,
  video_path text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists reference_shots_lookup on public.reference_shots (category, shot_type, camera_angle);

alter table public.reference_shots enable row level security;
drop policy if exists "reference_shots admin all" on public.reference_shots;
create policy "reference_shots admin all" on public.reference_shots
  for all using (public.is_admin()) with check (public.is_admin());

-- Private bucket for the reference videos themselves (admin only).
insert into storage.buckets (id, name, public) values ('reference-videos', 'reference-videos', false)
on conflict (id) do nothing;
drop policy if exists "reference videos admin all" on storage.objects;
create policy "reference videos admin all" on storage.objects
  for all using (bucket_id = 'reference-videos' and public.is_admin())
  with check (bucket_id = 'reference-videos' and public.is_admin());

-- What users' apps may read: ONLY angle numbers (no video path, no ids), and only on ₹499+ plans.
create or replace function public.get_reference_profile(p_category text, p_shot_type text, p_camera_angle text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  tier text;
  result jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('items', '[]'::jsonb);
  end if;
  select plan_tier into tier from public.profiles where id = auth.uid();
  if not (public.is_admin() or coalesce(tier, 'free') in ('video_499', 'special_coach')) then
    return jsonb_build_object('items', '[]'::jsonb);
  end if;
  select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object(
           'camera_angle', camera_angle, 'phase_angles', phase_angles)), '[]'::jsonb))
    into result
    from public.reference_shots
   where category = p_category and lower(shot_type) = lower(p_shot_type);
  return result;
end;
$$;
revoke all on function public.get_reference_profile(text, text, text) from public;
grant execute on function public.get_reference_profile(text, text, text) to authenticated;
