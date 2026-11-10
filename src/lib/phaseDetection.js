import { LM } from "./poseEstimation";

const TRACK = [LM.NOSE, LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_WRIST, LM.RIGHT_WRIST, LM.LEFT_HIP, LM.RIGHT_HIP, LM.LEFT_ANKLE, LM.RIGHT_ANKLE];

function bodyScale(lm) {
  const a = lm[LM.LEFT_SHOULDER], b = lm[LM.RIGHT_SHOULDER], h1 = lm[LM.LEFT_HIP], h2 = lm[LM.RIGHT_HIP];
  return Math.max(0.04, (Math.hypot(a.x - b.x, a.y - b.y) + Math.hypot(h1.x - h2.x, h1.y - h2.y)) / 2);
}
function frameDistance(a, b) {
  if (!a || !b) return 1;
  const scale = bodyScale(a);
  let sum = 0, n = 0;
  for (const i of TRACK) {
    const p = a[i], q = b[i];
    if ((p?.visibility ?? 0) < 0.35 || (q?.visibility ?? 0) < 0.35) continue;
    sum += Math.hypot(p.x - q.x, p.y - q.y) / scale; n++;
  }
  return n ? sum / n : 1;
}

/**
 * Finds useful movement phases from motion rather than hard-coded timestamps.
 * It deliberately returns confidence so the UI can avoid pretending an exact
 * phase was found when the clip does not contain enough evidence.
 */
export function detectMovementPhases(frames, category = "batting") {
  if (!frames || frames.length < 6) return { stanceIndex: 0, impactIndex: Math.floor((frames?.length || 1) / 2), followThroughIndex: (frames?.length || 1) - 1, confidence: "low" };
  const motion = frames.map((f, i) => i === 0 ? 0 : frameDistance(frames[i - 1].landmarks, f.landmarks));
  const smoothed = motion.map((_, i) => {
    const vals = motion.slice(Math.max(0, i - 1), Math.min(motion.length, i + 2));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  const peak = smoothed.indexOf(Math.max(...smoothed.slice(1, -1))) || Math.floor(frames.length / 2);

  // Stance = last stable frame before movement ramps up, not simply frame 0.
  const threshold = Math.max(0.012, Math.min(0.055, smoothed.slice(0, Math.max(2, peak)).reduce((a,b)=>a+b,0) / Math.max(1, peak) * 1.8));
  let stanceIndex = 0;
  for (let i = Math.max(1, Math.floor(peak * 0.65)); i < peak; i++) {
    if (smoothed[i] <= threshold && smoothed[i + 1] > threshold * 1.15) stanceIndex = i;
  }
  if (!stanceIndex) {
    let best = Infinity;
    for (let i = 0; i < peak; i++) if (smoothed[i] < best) { best = smoothed[i]; stanceIndex = i; }
  }

  // Prefer a ball/body-contact moment when ball detections exist. Pose-only
  // peaks are only a fallback; this prevents "Impact = middle frame".
  let impactIndex = peak;
  const searchStart = Math.max(1, Math.floor(frames.length * 0.18));
  const searchEnd = Math.min(frames.length - 2, Math.floor(frames.length * 0.82));
  let bestPeak = -1;
  for (let i = searchStart; i <= searchEnd; i++) {
    const local = smoothed[i] >= smoothed[i - 1] && smoothed[i] >= smoothed[i + 1];
    if (local && smoothed[i] > bestPeak) { bestPeak = smoothed[i]; impactIndex = i; }
  }
  if (category === "batting") {
    let bestContact = Infinity, contactIndex = -1;
    for (let i = searchStart; i <= searchEnd; i++) {
      const b = frames[i]?.ball;
      const lm = frames[i]?.landmarks;
      if (!b || !lm) continue;
      const wristA = lm[LM.LEFT_WRIST], wristB = lm[LM.RIGHT_WRIST];
      if (!wristA || !wristB) continue;
      const d = Math.min(Math.hypot(b.x-wristA.x,b.y-wristA.y), Math.hypot(b.x-wristB.x,b.y-wristB.y));
      if (d < bestContact) { bestContact=d; contactIndex=i; }
    }
    // Require the ball to be genuinely close to the player's hands.
    // Otherwise keep the motion peak and label it as an impact candidate.
    if (contactIndex >= 0 && bestContact <= 0.16) impactIndex = contactIndex;
  }

  // Follow-through = first stable/completion frame after the impact candidate.
  let followThroughIndex = frames.length - 1;
  const ftStart = Math.min(frames.length - 2, impactIndex + Math.max(2, Math.floor(frames.length * 0.08)));
  for (let i = ftStart; i < frames.length - 1; i++) {
    const tail = smoothed.slice(i, Math.min(frames.length, i + 3));
    if (tail.every(v => v < threshold * 1.35)) { followThroughIndex = i; break; }
  }

  const stableEvidence = smoothed.slice(Math.max(0, stanceIndex - 2), Math.min(peak, stanceIndex + 3)).filter(v => v < threshold * 1.5).length;
  const confidence = stableEvidence >= 2 && bestPeak > threshold * 1.5 ? "high" : stableEvidence >= 1 ? "medium" : "low";
  const triggerIndex = Math.max(stanceIndex + 1, Math.min(impactIndex - 1, stanceIndex + Math.max(1, Math.round((impactIndex - stanceIndex) * 0.25))));
  const backswingIndex = Math.max(triggerIndex, Math.min(impactIndex - 1, triggerIndex + Math.max(1, Math.round((impactIndex - triggerIndex) * 0.55))));
  return { stanceIndex, triggerIndex, backswingIndex, impactIndex, followThroughIndex,
    stanceSec: frames[stanceIndex]?.t ?? 0, triggerSec: frames[triggerIndex]?.t ?? 0,
    backswingSec: frames[backswingIndex]?.t ?? 0, impactSec: frames[impactIndex]?.t ?? 0,
    followThroughSec: frames[followThroughIndex]?.t ?? 0, confidence, motion: smoothed };
}
