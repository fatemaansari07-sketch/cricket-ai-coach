/* Reference shot library — angle templates made from admin-uploaded technique videos.
   Users only ever get angle NUMBERS (via a ₹499+-gated RPC); the videos stay private. */
import { supabase } from "./supabaseClient";
import { detectMovementPhases } from "./phaseDetection";
import { computeFrameAngles } from "../data/biomechanics";

export const JOINTS = { headTiltDeg: "Head position", frontElbowDeg: "Front elbow", frontKneeDeg: "Front knee" };
export const PHASES = { stance: "Stance", backlift: "Backlift", impact: "Impact", followThrough: "Follow-through" };
export const CAMERA_ANGLES = ["side-on", "front-on", "behind"];

const median = (a) => {
  const v = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};

/** Angles (head / front elbow / front knee) at stance, backlift, impact, follow-through. */
export function extractPhaseAngles(frames, category = "batting", handedness = "right") {
  const ph = detectMovementPhases(frames, category);
  const per = frames.map((f) => computeFrameAngles(f.landmarks, handedness).angles);
  const at = (i) => {
    const idx = [i - 1, i, i + 1].filter((k) => k >= 0 && k < per.length);
    return Object.fromEntries(Object.keys(JOINTS).map((j) => [j, median(idx.map((k) => per[k][j]))]));
  };
  return {
    phases: {
      stance: at(ph.stanceIndex),
      backlift: at(ph.backswingIndex ?? ph.triggerIndex ?? ph.stanceIndex),
      impact: at(ph.impactIndex),
      followThrough: at(ph.followThroughIndex),
    },
    times: { stance: ph.stanceSec, backlift: ph.backswingSec, impact: ph.impactSec, followThrough: ph.followThroughSec },
    confidence: ph.confidence,
  };
}

function statsOf(values) {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return null;
  const mean = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - mean) ** 2, 0) / v.length);
  return { mean, sd, min: Math.min(...v), max: Math.max(...v), n: v.length };
}

/** Fetch + summarise the reference set for this shot. null if there is nothing usable. */
export async function fetchReferenceProfile(category, shotType, cameraAngle = "side-on") {
  try {
    const { data, error } = await supabase.rpc("get_reference_profile", { p_category: category, p_shot_type: shotType, p_camera_angle: cameraAngle });
    if (error || !data?.items?.length) return null;
    let items = data.items.filter((i) => i.camera_angle === cameraAngle);
    const exact = items.length > 0;
    if (!exact) items = data.items;
    const stats = {};
    for (const p of Object.keys(PHASES)) {
      stats[p] = {};
      for (const j of Object.keys(JOINTS)) stats[p][j] = statsOf(items.map((i) => i.phase_angles?.[p]?.[j]));
    }
    return { n: items.length, exact, stats };
  } catch {
    return null;
  }
}

/** Compare the user's per-phase angles with the reference set. */
export function compareToReference(userPhases, profile, category = "batting") {
  const correct = [], incorrect = [], issues = [];
  let simSum = 0, simN = 0;
  // With very few references we allow a wider band so one player's style isn't treated as law.
  const baseTol = profile.n >= 5 ? 10 : profile.n >= 3 ? 13 : 16;
  for (const p of Object.keys(PHASES)) {
    for (const j of Object.keys(JOINTS)) {
      const u = userPhases?.[p]?.[j];
      const s = profile.stats?.[p]?.[j];
      if (!Number.isFinite(u) || !s) continue;
      const tol = Math.max(baseTol, 1.5 * s.sd);
      const diff = u - s.mean;
      const ok = Math.abs(diff) <= tol;
      simSum += Math.max(0, Math.min(1, 1 - Math.max(0, Math.abs(diff) - tol * 0.3) / (tol * 2.5)));
      simN++;
      const where = `${PHASES[p]} par ${JOINTS[j]}`;
      const target = `~${Math.round(s.mean)}° (${Math.round(s.min)}°–${Math.round(s.max)}°)`;
      if (ok) {
        correct.push(`${where} ${Math.round(u)}° hai — achhe technique ke kareeb (${target}).`);
      } else {
        const dir = diff > 0 ? "zyada khula/seedha" : "zyada jhuka/band";
        const msg = `${where} ${Math.round(u)}° hai, jabki is shot me sahi technique me ${target} hota hai — tumhara angle ${dir} hai.`;
        incorrect.push(msg);
        issues.push({
          key: `ref.${p}.${j}`, baseKey: j, label: `${PHASES[p]} — ${JOINTS[j]}`, category,
          phase: p, severity: Math.max(0.05, Math.min(1, (Math.abs(diff) - tol) / (tol * 2))), message: msg,
        });
      }
    }
  }
  return { correct, incorrect, issues, similarity: simN ? Math.round((simSum / simN) * 100) : null, compared: simN };
}
