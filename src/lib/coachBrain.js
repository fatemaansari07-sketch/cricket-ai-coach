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

// Second variant per issue — used when the FIRST set of drills didn't fix
// the problem (attempts >= 2). Different exercise, same underlying goal,
// so it doesn't feel like the coach is just repeating themselves.
const DRILL_MAP_V2 = {
  batting: {
    headTiltDeg: [
      "Tennis ball se soft-toss drill, coach bolega 'watch' jab tak head na hile — 15 reps",
      "One-eye-closed shadow drill — depth judge karna seekhta hai bina head hilaye — 10 reps",
      "Video khud record karo har 5 balls ke baad, apna head position check karo",
    ],
    frontElbowDeg: [
      "Towel-under-armpit drill: towel girne na do jab tak shot complete na ho — 15 reps",
      "Half-bat grip drill, sirf top hand se elbow-lead practice — 15 reps",
      "Slip-catching warm-up phir turant batting — muscle memory reset ke liye",
    ],
    frontKneeDeg: [
      "Resistance band ankle par laga ke step-drive drill — 15 reps",
      "Split-stance balance hold, phir drive — 10 reps",
      "Coach/partner manually front knee position check kare har rep par",
    ],
  },
  bowling: {
    headTiltDeg: [
      "Eyes-on-target walk-through, run-up ke bina — sirf release position — 10 reps",
      "Partner khada ho seedhe line me, unhe dekh ke bowl karo — 15 reps",
      "Slow-motion video record karo, apna head position khud dekho",
    ],
    frontElbowDeg: [
      "Overhead throw drill (baseball-style) warm-up ke roop me — 15 throws",
      "Wall ke bahut paas khade ho ke release karo, arm force seedha rahe — 15 reps",
      "Partner front-arm ko haath se guide kare 10 slow-motion reps tak",
    ],
    frontKneeDeg: [
      "Single-leg balance hold phir landing simulate karo — 10 reps",
      "Soft mat par landing practice, knee lock par focus — 15 reps",
      "Coach manually landing position check kare har delivery ke baad",
    ],
  },
  fielding: {
    headTiltDeg: [
      "Eyes-closed-then-open reaction drill — ball aane tak eyes band, phir open — 15 reps",
      "Partner random side se throw kare, head turn na ho — 15 reps",
      "Video record karo apne catches, head movement khud dekho",
    ],
    frontElbowDeg: [
      "One-hand pickup drill, dusra haath peeche — 15 reps",
      "Bounce-and-catch against wall, soft hands practice — 20 reps",
      "Coach ball speed thodi badhaye, elbow control test karo",
    ],
    frontKneeDeg: [
      "Squat-hold phir explode drill — 10 reps",
      "Cone-to-cone low-stance shuffle — 10 reps",
      "Partner random direction point kare, low stance se react karo",
    ],
  },
};

export function getDrillsForIssue(category, baseKey, attempts = 1) {
  const source = attempts >= 2 ? DRILL_MAP_V2[category]?.[baseKey] : DRILL_MAP[category]?.[baseKey];
  return source || DRILL_MAP[category]?.[baseKey] || DRILLS[category]?.slice(0, 3) || [];
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
 * attempts: how many sessions the CURRENT active focus has been tested
 *   against without improving — 1 means fresh, 2+ rotates the drill set
 */
export function buildCoachingResult({ evalResult, mainFocus, otherObservations = [], retest = null, attempts = 1 }) {
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
    drills: getDrillsForIssue(category, mainFocus.baseKey, attempts),
    drillsAreVariant: attempts >= 2,
    target: pickTarget(score, mainFocus.severity),
    otherObservations: otherObservations.slice(0, 4).map((o) => o.label),
    retest,
  };
}
