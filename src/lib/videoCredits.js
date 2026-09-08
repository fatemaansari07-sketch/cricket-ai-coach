export const VIDEO_LIMITS = { free: 0, basic: 3, pro: 10 };

export function getVideoCreditStatus(planTier, profile = null) {
  const limit = VIDEO_LIMITS[planTier] ?? 0;
  const remaining = Math.max(0, Number(profile?.video_credits_remaining ?? 0));
  return { limit, remaining, used: Math.max(0, limit - remaining) };
}

export async function consumeVideoCredit(supabase) {
  const { data, error } = await supabase.rpc("consume_video_credit");
  if (error) return { allowed: false, remaining: 0, error };
  return { allowed: !!data?.allowed, remaining: Number(data?.remaining ?? 0), error: null };
}
