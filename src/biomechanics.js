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
export function evaluatePose(landmarks, category) {
  const rules = IDEAL_RANGES[category];
  const nose = landmarks[LM.NOSE];
  const lShoulder = landmarks[LM.LEFT_SHOULDER];
  const rShoulder = landmarks[LM.RIGHT_SHOULDER];
  const lElbow = landmarks[LM.LEFT_ELBOW];
  const lWrist = landmarks[LM.LEFT_WRIST];
  const lHip = landmarks[LM.LEFT_HIP];
  const lKnee = landmarks[LM.LEFT_KNEE];
  const lAnkle = landmarks[LM.LEFT_ANKLE];

  const midShoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };

  const headTilt = Math.round(headTiltFromVertical(nose, midShoulder));
  const frontElbow = Math.round(angleBetween(lShoulder, lElbow, lWrist) ?? 0);
  const frontKnee = Math.round(angleBetween(lHip, lKnee, lAnkle) ?? 0);

  const angles = { headTiltDeg: headTilt, frontElbowDeg: frontElbow, frontKneeDeg: frontKnee };

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

  return { category, score, correct, incorrect, angles };
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
