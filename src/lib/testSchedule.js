import { checkLevelPass } from "./mastery";

export function daysUntilTest(profile) {
  if (!profile?.next_test_date) return null;
  const ms = new Date(profile.next_test_date) - new Date();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

/** Only shows a countdown inside the 3-day window, per the "Test in 3 Days!"
 * spec — otherwise the Home screen banner stays quiet. */
export function testCountdownLabel(days) {
  if (days == null || days > 3) return null;
  if (days <= 0) return "Test Today!";
  if (days === 1) return "Test Tomorrow!";
  return `Test in ${days} Days!`;
}

export async function scheduleNextTest(supabase, userId, daysFromNow = 7) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  await supabase.from("profiles").update({ next_test_date: d.toISOString() }).eq("id", userId);
  return d.toISOString();
}

/** Submits a weekly mastery test result. On pass, unlocks the next level and
 * appends to passed_levels; always reschedules the next 7-day test. */
export async function submitWeeklyTest({ supabase, userId, level, score, videoId }) {
  const passed = checkLevelPass(level, score);
  await supabase.from("weekly_tests").insert({ user_id: userId, video_id: videoId ?? null, level, score: { score }, passed });

  if (passed) {
    const { data: profile } = await supabase.from("profiles").select("passed_levels, current_level").eq("id", userId).single();
    const passedLevels = Array.from(new Set([...(profile?.passed_levels || []), String(level)]));
    const nextLevel = Math.min(4, level + 1);
    await supabase
      .from("profiles")
      .update({ passed_levels: passedLevels, current_level: Math.max(profile?.current_level || 1, nextLevel) })
      .eq("id", userId);
  }
  await scheduleNextTest(supabase, userId);
  return passed;
}
