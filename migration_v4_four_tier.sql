-- Cricket AI Coach V4 — four-tier credits/features
-- Run after the existing schema. Safe for existing installs.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS visual_credits_remaining integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS video_credits_remaining integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS visual_credits_reset_at date;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS video_credits_reset_at date;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_tier_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_plan_tier_check CHECK (plan_tier IN ('free','pro_99','video_499','special_coach'));

CREATE TABLE IF NOT EXISTS public.visual_analysis_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cost integer NOT NULL DEFAULT 10, created_at timestamptz NOT NULL DEFAULT now(), metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.visual_analysis_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own visual usage" ON public.visual_analysis_usage;
CREATE POLICY "Users view own visual usage" ON public.visual_analysis_usage FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.consume_visual_credit()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); tier text; remaining integer; today date := CURRENT_DATE; cost integer := 10; lim integer;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('allowed',false,'remaining',0,'reason','not_authenticated'); END IF;
 SELECT plan_tier, COALESCE(visual_credits_remaining,0) INTO tier, remaining FROM public.profiles WHERE id=uid FOR UPDATE;
 IF tier IS NULL THEN RETURN jsonb_build_object('allowed',false,'remaining',0,'reason','profile_not_found'); END IF;
 lim := CASE tier WHEN 'pro_99' THEN 100 WHEN 'video_499' THEN 100 WHEN 'special_coach' THEN 100 ELSE 0 END;
 IF lim=0 THEN RETURN jsonb_build_object('allowed',false,'remaining',0,'reason','plan_has_no_visual_credits'); END IF;
 IF (SELECT visual_credits_reset_at FROM public.profiles WHERE id=uid) IS NULL OR date_trunc('month',(SELECT visual_credits_reset_at FROM public.profiles WHERE id=uid))::date <> date_trunc('month',today)::date THEN
   remaining := lim; UPDATE public.profiles SET visual_credits_remaining=lim, visual_credits_reset_at=today WHERE id=uid;
 END IF;
 IF remaining < cost THEN RETURN jsonb_build_object('allowed',false,'remaining',remaining,'reason','credits_exhausted'); END IF;
 remaining := remaining-cost;
 UPDATE public.profiles SET visual_credits_remaining=remaining WHERE id=uid;
 INSERT INTO public.visual_analysis_usage(user_id,cost) VALUES(uid,cost);
 RETURN jsonb_build_object('allowed',true,'remaining',remaining,'cost',cost);
END; $$;
GRANT EXECUTE ON FUNCTION public.consume_visual_credit() TO authenticated;

CREATE OR REPLACE FUNCTION public.consume_video_credit()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); tier text; remaining integer; today date := CURRENT_DATE;
BEGIN
 IF uid IS NULL THEN RETURN jsonb_build_object('allowed',false,'remaining',0,'reason','not_authenticated'); END IF;
 SELECT plan_tier, COALESCE(video_credits_remaining,0) INTO tier, remaining FROM public.profiles WHERE id=uid FOR UPDATE;
 IF tier IS NULL THEN RETURN jsonb_build_object('allowed',false,'remaining',0,'reason','profile_not_found'); END IF;
 IF tier NOT IN ('video_499','special_coach') THEN RETURN jsonb_build_object('allowed',false,'remaining',0,'reason','plan_has_no_video_credits'); END IF;
 IF (SELECT video_credits_reset_at FROM public.profiles WHERE id=uid) IS NULL OR date_trunc('month',(SELECT video_credits_reset_at FROM public.profiles WHERE id=uid))::date <> date_trunc('month',today)::date THEN
   remaining := 100; UPDATE public.profiles SET video_credits_remaining=100, video_credits_reset_at=today WHERE id=uid;
 END IF;
 IF remaining < 10 THEN RETURN jsonb_build_object('allowed',false,'remaining',remaining,'reason','credits_exhausted'); END IF;
 remaining := remaining-10; UPDATE public.profiles SET video_credits_remaining=remaining WHERE id=uid;
 RETURN jsonb_build_object('allowed',true,'remaining',remaining,'cost',10);
END; $$;
GRANT EXECUTE ON FUNCTION public.consume_video_credit() TO authenticated;

UPDATE public.profiles SET plan_tier='pro_99' WHERE plan_tier='basic';
UPDATE public.profiles SET plan_tier='video_499' WHERE plan_tier='pro';
UPDATE public.profiles SET visual_credits_remaining=100, visual_credits_reset_at=CURRENT_DATE WHERE plan_tier IN ('pro_99','video_499','special_coach') AND COALESCE(visual_credits_remaining,0)=0;
UPDATE public.profiles SET video_credits_remaining=100, video_credits_reset_at=CURRENT_DATE WHERE plan_tier IN ('video_499','special_coach') AND COALESCE(video_credits_remaining,0)=0;
