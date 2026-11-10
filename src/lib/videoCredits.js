export const VIDEO_CREDIT_COST = 10;
export const VIDEO_LIMITS = {
  free: 0,
  pro_99: 0,
  video_499: 100,
  special_coach: 100,
  // Legacy aliases for profiles that have not yet been migrated.
  basic: 0,
  pro: 100,
  video_120: 100,
};

export function getVideoCreditStatus(planTier, profile = null) {
  const tier = planTier === 'pro' || planTier === 'video_120' ? 'video_499' : planTier;
  const limit = VIDEO_LIMITS[tier] ?? 0;
  const remaining = limit === 0 ? 0 : Math.min(limit, Math.max(0, Number(profile?.video_credits_remaining ?? 0)));
  return { limit, remaining, used: Math.max(0, limit - remaining) };
}

export async function consumeVideoCredit(supabase) {
  const { data, error } = await supabase.rpc('consume_video_credit');
  if (error) return { allowed: false, remaining: 0, error };
  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: !!result?.allowed,
    remaining: Number(result?.remaining ?? 0),
    error: result?.allowed ? null : new Error(result?.reason || 'Video credit unavailable'),
  };
}
