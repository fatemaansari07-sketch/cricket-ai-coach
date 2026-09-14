/**
 * PRIORITY ENGINE
 * ---------------
 * The pose/biomechanics engine (and Gemini) may surface several problems in
 * one session. This module decides the ONE thing the player should hear
 * about as "today's main focus", using:
 *   - severity        (how far off the ideal range this session)
 *   - frequency        (how often this same issue showed up recently)
 *   - continuity        (is this already the player's active focus?)
 *
 * It also contains the retest logic: given the player's current active
 * focus and this session's issues, decide IMPROVED vs NOT IMPROVED.
 */

const SEVERITY_WEIGHT = 0.45;
const FREQUENCY_WEIGHT = 0.3;
const CONTINUITY_WEIGHT = 0.25;

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40);
}

/**
 * Gemini gives us free-text flaws, not numeric angles. To let the same
 * Priority Engine work for both engines, we turn each incorrect[] line into
 * a pseudo-issue. Severity here is inferred from LIST POSITION ONLY (Gemini
 * tends to lead with the biggest flaw when prompted for "correct"/"incorrect")
 * — this is a heuristic, not a measurement, and is clearly weaker than the
 * pose engine's real angle-based severity.
 */
export function issuesFromGeminiIncorrect(incorrect = [], category) {
  return incorrect.map((text, i) => {
    const label = text.split("—")[0].split(":")[0].trim().slice(0, 48);
    return {
      key: `gemini.${slug(label)}`,
      baseKey: slug(label),
      label,
      category,
      phase: "mid",
      severity: Math.max(0.3, 1 - i * 0.2),
      message: text,
    };
  });
}

/**
 * issues: this session's detected issues (from biomechanics.js or the
 *   Gemini adapter above), each { baseKey, label, category, severity, message }
 * historyIssueKeys: flat array of baseKey strings from the player's recent
 *   sessions in this category (used to measure "is this recurring?")
 * activeFocus: the player's current player_focus row for this category, or null
 */
export function prioritize({ issues = [], historyIssueKeys = [], activeFocus = null }) {
  if (!issues.length) return { mainFocus: null, otherObservations: [] };

  const freqCount = {};
  historyIssueKeys.forEach((k) => {
    if (k) freqCount[k] = (freqCount[k] || 0) + 1;
  });
  const maxFreq = Math.max(1, ...Object.values(freqCount));

  const scored = issues.map((issue) => {
    const frequency = (freqCount[issue.baseKey] || 0) / maxFreq;
    const isContinuingFocus = activeFocus && activeFocus.issue_key === issue.baseKey ? 1 : 0;
    const priority =
      issue.severity * SEVERITY_WEIGHT +
      frequency * FREQUENCY_WEIGHT +
      isContinuingFocus * CONTINUITY_WEIGHT;
    return { ...issue, frequency, priority };
  });

  scored.sort((a, b) => b.priority - a.priority);
  const [mainFocus, ...otherObservations] = scored;
  return { mainFocus, otherObservations };
}

/**
 * Was the player's active focus actually fixed this session?
 * Returns null if there was no active focus to test against.
 */
export function evaluateRetest({ activeFocus, issues = [], score }) {
  if (!activeFocus) return null;

  const stillPresent = issues.find((i) => i.baseKey === activeFocus.issue_key);
  const delta = score - activeFocus.baseline_score;

  if (!stillPresent) {
    return { outcome: "improved", delta, reason: "issue_resolved" };
  }
  const baselineSeverity = activeFocus.baseline_severity ?? 1;
  if (stillPresent.severity < baselineSeverity * 0.6) {
    return { outcome: "improved", delta, reason: "severity_dropped" };
  }
  return { outcome: "not_improved", delta, reason: "still_present" };
}
