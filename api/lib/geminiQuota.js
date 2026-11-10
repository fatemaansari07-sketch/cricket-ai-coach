const DEFAULT_DAILY_CAP = 20;

/** Returns { allowed, remaining }. Increments the counter if allowed. */
export async function checkAndBumpGeminiQuota(supabaseAdmin, userId) {
  const cap = Number(process.env.GEMINI_DAILY_CAP) || DEFAULT_DAILY_CAP;
  const today = new Date().toISOString().slice(0, 10);

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("gemini_calls_today, gemini_calls_reset_at")
    .eq("id", userId)
    .single();

  const isFreshDay = profile?.gemini_calls_reset_at !== today;
  const currentCount = isFreshDay ? 0 : profile?.gemini_calls_today || 0;

  if (currentCount >= cap) {
    return { allowed: false, remaining: 0 };
  }

  await supabaseAdmin
    .from("profiles")
    .update({ gemini_calls_today: currentCount + 1, gemini_calls_reset_at: today })
    .eq("id", userId);

  return { allowed: true, remaining: cap - (currentCount + 1) };
}
