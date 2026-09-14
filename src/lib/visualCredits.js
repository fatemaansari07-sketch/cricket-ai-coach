export const VISUAL_ANALYSIS_COST = 10;
export const VISUAL_MONTHLY_LIMITS = { free: 0, pro_99: 100, video_499: 100, special_coach: 100 };

export function getVisualCreditStatus(planTier, profile = {}) {
  const limit = VISUAL_MONTHLY_LIMITS[planTier] ?? 0;
  const remaining = Math.max(0, Number(profile?.visual_credits_remaining ?? 0));
  return { limit, remaining, cost: VISUAL_ANALYSIS_COST, allowed: remaining >= VISUAL_ANALYSIS_COST };
}

export async function consumeVisualCredit(supabase) {
  const { data, error } = await supabase.rpc('consume_visual_credit');
  if (error) throw error;
  return data || { allowed: false, remaining: 0, reason: 'unknown' };
}
