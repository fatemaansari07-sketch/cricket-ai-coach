import { LM } from "../lib/poseEstimation";

/**
 * OUR OWN coaching knowledge — not borrowed from any AI model.
 * These ideal ranges are written based on standard cricket coaching
 * fundamentals (MCC coaching manual style guidance). This is the part
 * that makes the app "know how a shot/delivery should look" — tune these
 * numbers freely as you bring in real coaches to refine them.
 */
export const IDEAL_RANGES = {
  batting: {
    headTiltDeg: { min: -8, max: 8, label: "Head position", tip: (v, ok) => ok
      ? `Head bilkul seedha hai (${v}° tilt) — isse eyes ball ki line par rehte hain, timing aur shot selection dono better honge.`
      : `Head ${v}° tilt kar raha hai (ideal: -8° se 8°). Isse eyes ball ki line se hat jaate hain — agar nahi sudhara to bowled ya LBW hone ka risk badhega, aur mishit shots catch out hone ka chance badha denge.` },
    frontElbowDeg: { min: 90, max: 150, label: "Front elbow", tip: (v, ok) => ok
      ? `Front elbow ${v}° par hai — bat seedhi line me aa rahi hai, isse shots ka control aur power dono achhe milenge.`
      : `Front elbow sirf ${v}° hai (ideal: 90°-150°). Isse bat ka swing seedha nahi rehta — agar nahi sudhara to shots hawa me uthenge aur catch out hone ke chances badh jaayenge.` },
    frontKneeDeg: { min: 140, max: 175, label: "Front knee / weight transfer", tip: (v, ok) => ok
      ? `Front knee ${v}° par braced hai — weight sahi tarike se front foot par gaya, shot me power aur balance dono milega.`
      : `Front knee sirf ${v}° hai (ideal: 140°+). Weight abhi bhi back foot par lag raha hai — agar nahi sudhara to shots weak jayenge aur mistiming se jaldi out hone ka risk badhega.` },
  },
  bowling: {
    headTiltDeg: { min: -10, max: 10, label: "Head position", tip: (v, ok) => ok
      ? `Head stable hai (${v}° tilt) release ke time — line aur length dono consistent rahenge.`
      : `Head ${v}° tilt hai (ideal: -10° se 10°). Isse balance bigadta hai — agar nahi sudhara to line/length gadbad hogi, aur batsman ko free runs/boundaries milne ka chance badh jaayega.` },
    frontElbowDeg: { min: 150, max: 180, label: "Front arm", tip: (v, ok) => ok
      ? `Front arm ${v}° par seedha hai — accha high-arm release, ball par control aur bounce dono milega.`
      : `Front arm sirf ${v}° hai (ideal: 150°+). Release ke time target ki taraf pointing nahi hai — agar nahi sudhara to line consistently off rahegi, aur wickets milne ke chances kam ho jaayenge.` },
    frontKneeDeg: { min: 155, max: 180, label: "Front leg brace", tip: (v, ok) => ok
      ? `Front leg ${v}° par braced hai — achhi height mil rahi hai delivery ko, bounce aur pace dono improve honge.`
      : `Front leg sirf ${v}° hai (ideal: 155°+). Landing ke time achhi tarah braced nahi ho rahi — agar nahi sudhara to bowling height aur pace kam hogi, batsman ko easy runs banane ka mauka milega.` },
  },
  fielding: {
    headTiltDeg: { min: -12, max: 12, label: "Head position", tip: (v, ok) => ok
      ? `Head steady hai (${v}° tilt), ball ko achhe se watch kar rahe ho — clean pickup ke chances badh jaate hain.`
      : `Head ${v}° tilt hai (ideal: -12° se 12°). Zyada movement se ball track karna mushkil hota hai — agar nahi sudhara to fumble/misfield hone ka risk badhega aur extra runs dene padenge.` },
    frontElbowDeg: { min: 60, max: 130, label: "Hands / pickup position", tip: (v, ok) => ok
      ? `Elbow ${v}° par hai — soft hands ke liye accha angle, ball clean pickup hogi.`
      : `Elbow ${v}° hai (ideal: 60°-130°). Hands hard reh jaate hain — agar nahi sudhara to ball haathon se chhoot sakti hai, jisse boundary ya overthrow ka risk badhega.` },
    frontKneeDeg: { min: 110, max: 165, label: "Ready position / knee bend", tip: (v, ok) => ok
      ? `Knee ${v}° par hai — low aur balanced ready position, reaction time better hoga.`
      : `Knee sirf ${v}° hai (ideal: 110°-165°). Ready position zyada upright hai — agar nahi sudhara to ball tak pahunchne me late hoga, aur singles easily doubles ban jaayenge.` },
  },
};

/**
 * Approximate stance and follow-through checks — reuse the SAME frame
 * sequence already sampled for the main analysis (no extra video reads
 * needed). "Stance" = the first couple of sampled frames (before the
 * player starts moving into the shot), "Follow-through" = the last
 * couple (after impact). This is an approximation based on where in the
 * clip the frame was sampled, not true phase detection — good enough to
 * give real, useful feedback without a much bigger engineering project.
 */
export const STANCE_RANGES = {
  batting: {
    headTiltDeg: { min: -10, max: 10, label: "Stance — head", tip: (v, ok) => ok
      ? `Stance me head balanced hai (${v}° tilt) — achhi shuruaat.`
      : `Stance me hi head ${v}° tilt hai — shot shuru hone se pehle hi balance thoda off hai, isse pura shot prabhavit hota hai.` },
    frontKneeDeg: { min: 150, max: 180, label: "Stance — knee bend", tip: (v, ok) => ok
      ? `Stance me knees ${v}° par relaxed-upright hain — ready position achhi hai.`
      : `Stance me knee sirf ${v}° hai — bahut zyada ya bahut kam bend, dono se reaction time slow hota hai.` },
  },
  bowling: {
    headTiltDeg: { min: -10, max: 10, label: "Run-up start — head", tip: (v, ok) => ok
      ? `Run-up shuru me head steady hai (${v}° tilt).`
      : `Run-up shuru se hi head ${v}° tilt hai — rhythm shuru se hi disturb ho sakta hai.` },
    frontKneeDeg: { min: 150, max: 180, label: "Run-up start — posture", tip: (v, ok) => ok
      ? `Shuruaati posture (${v}°) tall aur relaxed hai.`
      : `Shuruaati posture me knee ${v}° hai — bahut jhuka/tight start rhythm bigad sakta hai.` },
  },
  fielding: {
    headTiltDeg: { min: -12, max: 12, label: "Ready position — head", tip: (v, ok) => ok
      ? `Ready position me head steady hai (${v}°).`
      : `Ready position me hi head ${v}° tilt hai — ball ko pehle se hi poori tarah track nahi kar rahe.` },
    frontKneeDeg: { min: 110, max: 165, label: "Ready position — knee", tip: (v, ok) => ok
      ? `Ready stance me knee ${v}° par low hai — reaction ke liye achha.`
      : `Ready stance me knee sirf ${v}° hai — bahut upright hai, first-step slow hoga.` },
  },
};

export const FOLLOW_THROUGH_RANGES = {
  batting: {
    headTiltDeg: { min: -10, max: 10, label: "Follow-through — head", tip: (v, ok) => ok
      ? `Follow-through tak head steady raha (${v}°) — balance poori shot me maintain hua.`
      : `Follow-through me head ${v}° tilt ho gaya — shot ke end tak balance nahi rakh paye, isse consistency kam hoti hai.` },
    frontElbowDeg: { min: 120, max: 180, label: "Follow-through — bat swing", tip: (v, ok) => ok
      ? `Bat ${v}° tak achhi tarah through gaya — full extension mila.`
      : `Bat sirf ${v}° tak gaya — swing beech me hi ruk gayi, isse power aur direction dono kam control me rehte hain.` },
  },
  bowling: {
    headTiltDeg: { min: -12, max: 12, label: "Follow-through — head", tip: (v, ok) => ok
      ? `Follow-through me head balanced raha (${v}°).`
      : `Follow-through me head ${v}° tilt ho gaya — momentum control se bahar ja raha hai, agli delivery ki rhythm bigad sakti hai.` },
    frontElbowDeg: { min: 90, max: 180, label: "Follow-through — arm completion", tip: (v, ok) => ok
      ? `Bowling arm follow-through me ${v}° tak achhe se complete hua.`
      : `Arm sirf ${v}° tak gaya — action beech me hi cut ho raha hai, isse consistency aur pace dono par asar padta hai.` },
  },
  fielding: {
    headTiltDeg: { min: -12, max: 12, label: "Throw follow-through — head", tip: (v, ok) => ok
      ? `Throw ke baad bhi head steady raha (${v}°) — target par focus bana raha.`
      : `Throw follow-through me head ${v}° tilt ho gaya — accuracy is se prabhavit ho sakti hai.` },
    frontElbowDeg: { min: 100, max: 180, label: "Throw follow-through — arm", tip: (v, ok) => ok
      ? `Throwing arm ${v}° tak achhe se complete hua — power poora transfer hua.`
      : `Arm sirf ${v}° tak gaya — throw beech me hi cut hui, isse distance/accuracy dono kam ho sakte hain.` },
  },
};

function angleBetween(a, b, c) {
  // angle at point b, formed by points a-b-c, in degrees
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const dot = ab.x * cb.x + ab.y * cb.y;
  const magAB = Math.hypot(ab.x, ab.y);
  const magCB = Math.hypot(cb.x, cb.y);
  if (magAB === 0 || magCB === 0) return null;
  const cos = Math.max(-1, Math.min(1, dot / (magAB * magCB)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function headTiltFromVertical(nose, midShoulder) {
  const dx = nose.x - midShoulder.x;
  const dy = midShoulder.y - nose.y; // y grows downward, so flip
  if (dy === 0) return 0;
  return (Math.atan2(dx, dy) * 180) / Math.PI;
}

/**
 * Runs OUR rules against the joints MediaPipe found, category by category.
 * Returns the same shape the rest of the app already expects:
 * { category, score, correct: [...], incorrect: [...], angles: {...} }
 */
/** Computes the 3 tracked angles + a visibility-based confidence for one frame's landmarks. */
function computeFrameAngles(landmarks, handedness = "right") {
  const nose = landmarks[LM.NOSE];
  const lShoulder = landmarks[LM.LEFT_SHOULDER];
  const rShoulder = landmarks[LM.RIGHT_SHOULDER];

  // A right-handed player's "front" side (leading arm/leg into the shot) is
  // their LEFT side; a left-handed player's front side is their RIGHT side.
  const front = handedness === "left"
    ? { shoulder: rShoulder, elbow: landmarks[LM.RIGHT_ELBOW], wrist: landmarks[LM.RIGHT_WRIST], hip: landmarks[LM.RIGHT_HIP], knee: landmarks[LM.RIGHT_KNEE], ankle: landmarks[LM.RIGHT_ANKLE] }
    : { shoulder: lShoulder, elbow: landmarks[LM.LEFT_ELBOW], wrist: landmarks[LM.LEFT_WRIST], hip: landmarks[LM.LEFT_HIP], knee: landmarks[LM.LEFT_KNEE], ankle: landmarks[LM.LEFT_ANKLE] }

  const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };

  const angles = {
    headTiltDeg: Math.round(headTiltFromVertical(nose, midShoulder)),
    frontElbowDeg: Math.round(angleBetween(front.shoulder, front.elbow, front.wrist) ?? 0),
    frontKneeDeg: Math.round(angleBetween(front.hip, front.knee, front.ankle) ?? 0),
  };

  const usedPoints = [nose, lShoulder, rShoulder, front.elbow, front.wrist, front.hip, front.knee, front.ankle];
  const visibilities = usedPoints.map((p) => p?.visibility ?? 0);
  const avgVisibility = visibilities.reduce((a, b) => a + b, 0) / visibilities.length;

  return { angles, avgVisibility };
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function scoreAngles(angles, rules) {
  const correct = [];
  const incorrect = [];
  let passCount = 0;
  Object.entries(rules).forEach(([key, rule]) => {
    const value = angles[key];
    const ok = value >= rule.min && value <= rule.max;
    const line = `${rule.label}: ${rule.tip(value, ok)}`;
    if (ok) {
      correct.push(line);
      passCount += 1;
    } else {
      incorrect.push(line);
    }
  });
  const score = Math.round((passCount / Object.keys(rules).length) * 100);
  return { correct, incorrect, score };
}

export function evaluatePose(landmarks, category, handedness = "right") {
  const rules = IDEAL_RANGES[category];
  const { angles, avgVisibility } = computeFrameAngles(landmarks, handedness);
  const confidence = avgVisibility >= 0.7 ? "high" : avgVisibility >= 0.45 ? "medium" : "low";
  const { correct, incorrect, score } = scoreAngles(angles, rules);
  return { category, score, correct, incorrect, angles, confidence, handedness };
}

/**
 * Multi-frame version — evaluates several frames spread across the shot
 * (from extractPoseSequenceFromVideo) and uses the MEDIAN angle per joint
 * instead of a single frame's reading. A median throws out one-off outliers
 * (motion blur, an odd transitional pose) much better than trusting
 * whichever single frame happened to get sampled — this is the main fix
 * for wildly-wrong single-frame readings like an impossible head tilt.
 *
 * frames: [{ t, landmarks }, ...] as returned by extractPoseSequenceFromVideo
 */
export function evaluatePoseSequence(frames, category, handedness = "right") {
  const rules = IDEAL_RANGES[category];

  if (!frames || frames.length === 0) {
    return { category, score: 0, correct: [], incorrect: [], angles: null, confidence: "low", handedness, framesUsed: 0 };
  }

  const perFrame = frames.map((f) => computeFrameAngles(f.landmarks, handedness));

  const angles = {
    headTiltDeg: median(perFrame.map((f) => f.angles.headTiltDeg)),
    frontElbowDeg: median(perFrame.map((f) => f.angles.frontElbowDeg)),
    frontKneeDeg: median(perFrame.map((f) => f.angles.frontKneeDeg)),
  };

  const avgVisibility = perFrame.reduce((a, f) => a + f.avgVisibility, 0) / perFrame.length;
  // More frames successfully read = more confidence, on top of how clearly
  // the body was visible in them.
  const coverageBonus = Math.min(frames.length / 8, 1); // full bonus at 8+ good frames
  const confidenceScore = avgVisibility * 0.7 + coverageBonus * 0.3;
  const confidence = confidenceScore >= 0.7 ? "high" : confidenceScore >= 0.45 ? "medium" : "low";

  const { correct, incorrect, score } = scoreAngles(angles, rules);

  // Stance = first couple of sampled frames, Follow-through = last couple.
  // Only bother with these if we actually have enough spread of frames.
  let stance = null;
  let followThrough = null;
  if (perFrame.length >= 4) {
    const stanceFrames = perFrame.slice(0, 2);
    const stanceAngles = {
      headTiltDeg: median(stanceFrames.map((f) => f.angles.headTiltDeg)),
      frontKneeDeg: median(stanceFrames.map((f) => f.angles.frontKneeDeg)),
    };
    stance = scoreAngles(stanceAngles, STANCE_RANGES[category]);

    const ftFrames = perFrame.slice(-2);
    const ftAngles = {
      headTiltDeg: median(ftFrames.map((f) => f.angles.headTiltDeg)),
      frontElbowDeg: median(ftFrames.map((f) => f.angles.frontElbowDeg)),
    };
    followThrough = scoreAngles(ftAngles, FOLLOW_THROUGH_RANGES[category]);
  }

  const allCorrect = [...(stance?.correct || []), ...correct, ...(followThrough?.correct || [])];
  const allIncorrect = [...(stance?.incorrect || []), ...incorrect, ...(followThrough?.incorrect || [])];

  // Overall score blends the main (mid-shot) score with stance/follow-through if we have them.
  const overallScore = stance && followThrough
    ? Math.round(score * 0.5 + stance.score * 0.25 + followThrough.score * 0.25)
    : score;

  return {
    category,
    score: overallScore,
    correct: allCorrect,
    incorrect: allIncorrect,
    angles,
    confidence,
    handedness,
    framesUsed: frames.length,
    phases: stance && followThrough ? { stance: stance.score, midShot: score, followThrough: followThrough.score } : null,
  };
}

/** Simple readable joint diff between two pose evaluations, for the Compare screen. */
export function compareAngles(anglesA, anglesB) {
  const labels = { headTiltDeg: "Head position", frontElbowDeg: "Front elbow", frontKneeDeg: "Front knee" };
  return Object.keys(labels).map((key) => {
    const a = anglesA?.[key];
    const b = anglesB?.[key];
    const diff = a != null && b != null ? Math.round(b - a) : null;
    return { joint: labels[key], a, b, diff };
  });
}
