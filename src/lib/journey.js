/**
 * CRICKET JOURNEY
 * ---------------
 * Turns raw history into "problems fixed / current focus / streak" — the
 * Phase 7 long-term view. Deliberately score/issue-based rather than
 * video-based: raw video files get auto-deleted after 7 days (see
 * supabase/schema.sql cleanup policy), so a real "watch old vs new clip"
 * comparison only works for a week. Scores and issues live forever in
 * `analyses`/`player_focus`, so that's what long-term progress is built on.
 */
export async function getJourneySummary(supabase, userId) {
  const [{ data: profile }, { data: fixedFocuses }, { data: activeFocuses }, { count: sessionsCompleted }] =
    await Promise.all([
      supabase.from("profiles").select("practice_streak, last_practice_date").eq("id", userId).single(),
      supabase
        .from("player_focus")
        .select("*")
        .eq("user_id", userId)
        .eq("status", "improved")
        .order("resolved_at", { ascending: false })
        .limit(10),
      supabase.from("player_focus").select("*").eq("user_id", userId).eq("status", "active"),
      supabase.from("coaching_sessions").select("id", { count: "exact", head: true }).eq("user_id", userId),
    ]);

  return {
    streak: profile?.practice_streak || 0,
    sessionsCompleted: sessionsCompleted || 0,
    problemsFixed: fixedFocuses || [],
    activeFocuses: activeFocuses || [],
  };
}
