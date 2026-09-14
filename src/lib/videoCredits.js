export const VISUAL_LIMITS = { free: 0, pro_99: 100, video_499: 100, special_999: 100 };
export const VIDEO_LIMITS = { free: 0, pro_99: 0, video_499: 100, special_999: 100 };

export function getVisualCreditStatus(planTier, profile = null) {
  const limit = VISUAL_LIMITS[planTier] ?? 0;
  const remaining = Math.max(0, Number(profile?.visual_credits_remaining ?? 0));
  return { limit, remaining, used: Math.max(0, limit - remaining) };
}
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
export async function consumeVisualCredit(supabase) {
  const { data, error } = await supabase.rpc("consume_visual_credit");
  if (error) return { allowed: false, remaining: 0, error };
  return { allowed: !!data?.allowed, remaining: Number(data?.remaining ?? 0), error: null };
}
