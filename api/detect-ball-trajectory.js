import { detectBallInFrame } from "./lib/providers/replicate.js";

// POST { frames: [{ dataUrl, t }, ...] } -> { points: [{ x, y, t, confidence }] }
// Runs each frame through the Replicate ball-detector in parallel and
// returns only the confident hits — the client fits/smooths these into the
// release -> bounce -> end trajectory line.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  try {
    const { frames } = req.body || {};
    if (!Array.isArray(frames) || !frames.length) {
      return res.status(400).json({ error: "frames array required" });
    }
    if (frames.length > 16) {
      return res.status(400).json({ error: "too many frames (max 16 per request)" });
    }

    const results = await Promise.all(
      frames.map(async (f) => {
        try {
          const hit = await detectBallInFrame(f.dataUrl);
          return hit ? { ...hit, t: f.t } : null;
        } catch {
          return null; // one bad frame shouldn't fail the whole trajectory
        }
      })
    );

    const points = results.filter(Boolean).sort((a, b) => a.t - b.t);
    return res.status(200).json({ points });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Ball trajectory detection failed" });
  }
}
