import { DRILLS } from "../data/content";

/**
 * COACH BRAIN
 * -----------
 * Takes the Priority Engine's output and this session's score, and produces
 * the human-facing coaching package: what went well, why the main focus
 * matters, 2-3 specific drills, and a measurable next target.
 *
 * This is deliberately separate from the vision/pose layer — biomechanics.js
 * answers "what happened in the video", this file answers "what should the
 * player do about it".
 */

// Joint-specific drills, one list per category + baseKey (headTiltDeg,
// frontElbowDeg, frontKneeDeg — the 3 angles biomechanics.js tracks).
const DRILL_MAP = {
  batting: {
    headTiltDeg: [
      "Head-still drill: ball ko string se latka ke sirf usi par nazar rakho — 15 reps",
      "Mirror ke saamne shadow batting, head bilkul steady — 10 mins",
      "Partner se throwdowns lo, sirf head position par focus — 15 balls",
    ],
    frontElbowDeg: [
      "Resistance band front-elbow raise drill — 3 sets x 12",
      "Wall drill: bat ko wall ke paas seedha le jao, elbow high rakho — 15 reps",
      "Drop-ball drive: ball khud girao, seedhi bat se drive karo — 20 reps",
    ],
    frontKneeDeg: [
      "Shadow front-foot drill, front knee brace karke — 20 reps",
      "Tee ke saamne step-and-drive drill — 20 reps",
      "Controlled throwdowns, sirf weight transfer par focus — 15 balls",
    ],
  },
  bowling: {
    headTiltDeg: [
      "Run-up rhythm drill, head bilkul steady rakh ke — 10 reps",
      "Wall seam drill, head still rakhte hue release — 15 reps",
      "Slow-motion walk-through, head position check karte hue — 10 reps",
    ],
    frontElbowDeg: [
      "Resistance band front-arm drill — 3 sets x 12",
      "Target wall par release drill, arm poora seedha — 15 reps",
      "Single stump ko target bana ke bowl karo — 2 overs",
    ],
    frontKneeDeg: [
      "Front-leg brace drill, landing par knee lock karo — 15 reps",
      "Run-up + single delivery, sirf braced landing par focus — 10 reps",
      "Slow-motion landing drill — 15 reps",
    ],
  },
  fielding: {
    headTiltDeg: [
      "Reaction catches drill, head steady rakh ke — 15 mins",
      "Ball-watch drill: partner throw kare, sirf ball par nazar — 20 reps",
      "Low ready-position holds, head still — 5 x 30 sec",
    ],
    frontElbowDeg: [
      "Soft hands pickup drill wall ke against — 20 reps",
      "Partner ke saath underarm pickup drill — 15 reps",
      "Hand-to-hand transfer drill, elbow relaxed — 15 reps",
    ],
    frontKneeDeg: [
      "Low ready-position holds — 5 x 30 sec",
      "Low stance se reaction sprint drill — 10 reps",
      "Single stump par run-and-throw — 15 throws",
    ],
  },
};

const WHY_FALLBACK = {
  headTiltDeg: "Head steady na hone se eyes ball ki line se hat jaate hain, timing aur judgement dono kharab hote hain.",
  frontElbowDeg: "Elbow sahi angle par na hone se arm/bat ki line seedhi nahi rehti, control kam ho jaata hai.",
  frontKneeDeg: "Weight/balance sahi tarike se transfer na hone se power aur stability dono kam ho jaate hain.",
};

export function getDrillsForIssue(category, baseKey) {
  return DRILL_MAP[category]?.[baseKey] || DRILLS[category]?.slice(0, 3) || [];
}

function pickTarget(currentScore, severity) {
  // Bigger issue = bigger realistic jump to aim for, capped so it stays achievable.
  const gap = Math.round(4 + severity * 8); // 4 to 12
  return Math.min(98, currentScore + gap);
}

/**
 * evalResult: { category, score, correct: [...] }
 * mainFocus: Priority Engine's top issue, or null if nothing significant found
 * otherObservations: the rest of the ranked issues
 * retest: evaluateRetest() output, or null if this wasn't a retest
 */
export function buildCoachingResult({ evalResult, mainFocus, otherObservations = [], retest = null }) {
  const { category, score, correct = [] } = evalResult;

  if (!mainFocus) {
    return {
      category,
      score,
      whatWentWell: correct.slice(0, 2),
      mainFocus: null,
      why: "Aaj ki video me koi bada issue nahi mila — sab kuch reasonable range me hai. Consistency banaye rakho!",
      drills: ["Regular practice jaari rakho", "Har hafte ek fresh video daalo comparison ke liye"],
      target: Math.min(98, score + 3),
      otherObservations: [],
      retest,
    };
  }

  return {
    category,
    score,
    whatWentWell: correct.slice(0, 2),
    mainFocus: { label: mainFocus.label, baseKey: mainFocus.baseKey },
    why: mainFocus.message || WHY_FALLBACK[mainFocus.baseKey] || "Ye area sabse zyada score kaat raha hai abhi.",
    drills: getDrillsForIssue(category, mainFocus.baseKey),
    target: pickTarget(score, mainFocus.severity),
    otherObservations: otherObservations.slice(0, 4).map((o) => o.label),
    retest,
  };
}
