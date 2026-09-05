import { prioritize, evaluateRetest, issuesFromGeminiIncorrect } from "./priorityEngine";
import { buildCoachingResult, getDrillsForIssue } from "./coachBrain";

const HISTORY_LOOKBACK = 8;

/**
 * Call this right after an analysis row has been inserted into `analyses`.
 * Reads the player's active focus + recent history for this category,
 * runs the Priority Engine + retest check, updates player_focus /
 * coaching_sessions, bumps the practice streak, and returns everything
 * CoachResultScreen needs to render.
 */
export async function runCoachingLoop({ supabase, user, category, analysisId, evalResult }) {
  const issues =
    evalResult.issues && evalResult.issues.length
      ? evalResult.issues
      : issuesFromGeminiIncorrect(evalResult.incorrect, category);

  const { data: activeFocus } = await supabase
    .from("player_focus")
    .select("*")
    .eq("user_id", user.id)
    .eq("category", category)
    .eq("status", "active")
    .maybeSingle();

  const { data: recentAnalyses } = await supabase
    .from("analyses")
    .select("issues, created_at")
    .eq("user_id", user.id)
    .eq("category", category)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LOOKBACK);

  const historyIssueKeys = (recentAnalyses || [])
    .flatMap((a) => (Array.isArray(a.issues) ? a.issues : []))
    .map((i) => i.baseKey)
    .filter(Boolean);

  const retest = evaluateRetest({ activeFocus, issues, score: evalResult.score });
  const { mainFocus, otherObservations } = prioritize({ issues, historyIssueKeys, activeFocus });

  let previousSessionId = null;
  if (activeFocus) {
    const { data: lastSession } = await supabase
      .from("coaching_sessions")
      .select("id")
      .eq("focus_id", activeFocus.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    previousSessionId = lastSession?.id ?? null;

    if (retest?.outcome === "improved") {
      await supabase
        .from("player_focus")
        .update({ status: "improved", resolved_at: new Date().toISOString() })
        .eq("id", activeFocus.id);
    }
  }

  // Keep the same focus row if it hasn't been fixed yet; otherwise start a
  // fresh one for whatever the Priority Engine now says matters most.
  let focusRow = null;
  if (activeFocus && retest?.outcome !== "improved") {
    const { data: updated } = await supabase
      .from("player_focus")
      .update({ attempts: (activeFocus.attempts || 1) + 1 })
      .eq("id", activeFocus.id)
      .select()
      .single();
    focusRow = updated || activeFocus;
  }
  if (!focusRow && mainFocus) {
    const { data: inserted } = await supabase
      .from("player_focus")
      .insert({
        user_id: user.id,
        category,
        issue_key: mainFocus.baseKey,
        issue_label: mainFocus.label,
        baseline_score: evalResult.score,
        baseline_severity: mainFocus.severity,
        target_score: Math.min(98, evalResult.score + Math.round(4 + mainFocus.severity * 8)),
        attempts: 1,
      })
      .select()
      .single();
    focusRow = inserted;
  }

  const { data: sessionRow } = await supabase
    .from("coaching_sessions")
    .insert({
      user_id: user.id,
      analysis_id: analysisId,
      category,
      focus_id: focusRow?.id ?? null,
      is_retest: !!activeFocus,
      previous_session_id: previousSessionId,
      improvement: retest?.delta ?? null,
    })
    .select()
    .single();

  const streak = await bumpPracticeStreak(supabase, user.id);

  const coaching = buildCoachingResult({
    evalResult,
    mainFocus,
    otherObservations,
    retest: activeFocus ? retest : null,
    attempts: focusRow?.attempts || 1,
  });

  return {
    ...coaching,
    streak,
    sessionId: sessionRow?.id,
    confidence: evalResult.confidence,
    framesUsed: evalResult.framesUsed,
    phases: evalResult.phases,
    rawCorrect: evalResult.correct || [],
    rawIncorrect: evalResult.incorrect || [],
    skeletonLandmarks: evalResult.skeletonLandmarks || null,
    jointStatus: evalResult.jointStatus || null,
    jointDetail: evalResult.jointDetail || null,
    stanceSkeleton: evalResult.stanceSkeleton || null,
    followThroughSkeleton: evalResult.followThroughSkeleton || null,
    handedness: evalResult.handedness,
  };
}

/** Streak counts meaningful coaching activity (a video analyzed), not just
 * opening the app — bumps by 1 if the player practiced yesterday, resets
 * to 1 otherwise, and no-ops if already counted today. */
export async function bumpPracticeStreak(supabase, userId) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("practice_streak, last_practice_date")
    .eq("id", userId)
    .single();

  const today = new Date().toISOString().slice(0, 10);
  if (profile?.last_practice_date === today) return profile.practice_streak || 1;

  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yesterday = y.toISOString().slice(0, 10);
  const newStreak = profile?.last_practice_date === yesterday ? (profile.practice_streak || 0) + 1 : 1;

  await supabase
    .from("profiles")
    .update({ practice_streak: newStreak, last_practice_date: today })
    .eq("id", userId);
  return newStreak;
}

/** Read-only — used by the Home screen's "Today's Practice" card. */
export async function getTodaysPractice(supabase, userId) {
  const { data: focuses } = await supabase
    .from("player_focus")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("baseline_severity", { ascending: false });

  if (!focuses || focuses.length === 0) return null;
  const top = focuses[0];
  return {
    category: top.category,
    focusLabel: top.issue_label,
    baseKey: top.issue_key,
    currentScore: top.baseline_score,
    target: top.target_score,
    drills: getDrillsForIssue(top.category, top.issue_key, top.attempts || 1),
  };
}
