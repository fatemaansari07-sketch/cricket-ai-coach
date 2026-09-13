import { supabase } from "./supabaseClient";

export const CREDIT_COSTS = { keyframe_analysis: 10, video_generation: 10 };

export function getCreditBalance(profile, type) {
  return type === "gemini" ? (profile?.gemini_credits_remaining || 0) : (profile?.coaching_video_credits_remaining || 0);
}

/** Deducts credits from the DB-backed balance and logs the spend in
 * credit_transactions. Caller is responsible for confirming with the user
 * and checking currentBalance >= amount first. */
export async function spendCredits({ userId, type, amount, reason, currentBalance }) {
  if (currentBalance < amount) return { ok: false, remaining: currentBalance };
  const column = type === "gemini" ? "gemini_credits_remaining" : "coaching_video_credits_remaining";
  const remaining = currentBalance - amount;
  await supabase.from("profiles").update({ [column]: remaining }).eq("id", userId);
  await supabase.from("credit_transactions").insert({ user_id: userId, credit_type: type, amount: -amount, reason });
  return { ok: true, remaining };
}

/** Call this after a verified payment (Razorpay webhook/success handler) —
 * never trust an unverified client call to grant paid credits in production. */
export async function rechargeCredits({ userId, type, amount, reason = "recharge", razorpayPaymentId }) {
  const column = type === "gemini" ? "gemini_credits_remaining" : "coaching_video_credits_remaining";
  const { data: profile } = await supabase.from("profiles").select(column).eq("id", userId).single();
  const remaining = (profile?.[column] || 0) + amount;
  await supabase.from("profiles").update({ [column]: remaining }).eq("id", userId);
  await supabase.from("credit_transactions").insert({ user_id: userId, credit_type: type, amount, reason, razorpay_payment_id: razorpayPaymentId });
  return remaining;
}
