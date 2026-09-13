// Wraps Replicate's REST API for the ball-detection model. Replicate jobs
// are async (create -> poll until succeeded), unlike Gemini's single call.
//
// IMPORTANT: the model must be an OBJECT-DETECTION model that returns
// bounding boxes for a text query (e.g. "cricket ball", "red ball"), NOT an
// image-generation model. black-forest-labs/flux-2-pro (image generation)
// will NOT work here — use an open-vocabulary detector such as
// adirik/grounding-dino instead. Configure via REPLICATE_BALL_MODEL if you
// want a different one.
const REPLICATE_API = "https://api.replicate.com/v1";
const DEFAULT_MODEL = "adirik/grounding-dino";

async function pollPrediction(id, token, { timeoutMs = 25000, intervalMs = 1200 } = {}) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const res = await fetch(`${REPLICATE_API}/predictions/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json();
    if (json.status === "succeeded") return json;
    if (json.status === "failed" || json.status === "canceled") {
      throw new Error(`Replicate prediction ${json.status}: ${json.error || "unknown error"}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("Replicate prediction timed out");
}

/**
 * Detects a cricket ball in a single image using an open-vocabulary
 * bounding-box detector on Replicate.
 * @param {string} imageDataUrl - data:image/jpeg;base64,... frame
 * @returns {Promise<{x:number,y:number,confidence:number}|null>} normalized
 *   (0-1) center point of the highest-confidence box, or null if not found.
 */
export async function detectBallInFrame(imageDataUrl) {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not configured");
  const model = process.env.REPLICATE_BALL_MODEL || DEFAULT_MODEL;

  const createRes = await fetch(`${REPLICATE_API}/models/${model}/predictions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      input: {
        image: imageDataUrl,
        query: "cricket ball, red cricket ball, white cricket ball",
        box_threshold: 0.2,
        text_threshold: 0.2,
      },
    }),
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error(created?.detail || "Replicate request failed");

  const result = await pollPrediction(created.id, token);
  const boxes = result.output?.detections || result.output || [];
  if (!Array.isArray(boxes) || !boxes.length) return null;

  // Pick the highest-confidence box; grounding-dino returns [x1,y1,x2,y2]
  // normalized 0-1 plus a confidence score per detection.
  const best = boxes.reduce((a, b) => ((b.confidence ?? b.score ?? 0) > (a.confidence ?? a.score ?? 0) ? b : a));
  const box = best.bbox || best.box || [best.x1, best.y1, best.x2, best.y2];
  if (!box || box.some((v) => v == null)) return null;
  const [x1, y1, x2, y2] = box;
  return { x: (x1 + x2) / 2, y: (y1 + y2) / 2, confidence: best.confidence ?? best.score ?? 0.5 };
}
