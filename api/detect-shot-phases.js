import { createClient } from "@supabase/supabase-js";
import * as geminiProvider from "./lib/providers/gemini.js";

/**
 * "Pro Deep Scan" — hybrid accuracy mode.
 *
 * This endpoint does NOT ask Gemini to judge the shot or invent angles —
 * that's exactly what was producing unreliable results before (a
 * vision-language model guessing numbers from pixels instead of actually
 * measuring them). All Gemini is asked to do here is watch the clip and
 * point at three moments in TIME:
 *   - stance:         batsman set, before the bowler releases the ball
 *   - contact:        the instant bat meets ball
 *   - follow-through: just after impact, once the swing has finished
 *
 * That's a task video-understanding models are actually good at (finding
 * WHEN something happens). The frontend then hands those exact
 * timestamps to MediaPipe, which does 100% of the real ANGLE measurement
 * — MediaPipe's job never changes, it just now measures the right
 * moments instead of a motion-speed guess or a fixed clip position.
 */
export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { storagePath, category, shotType, handedness } = req.body || {};
    if (!storagePath || !category) {
      return res.status(400).json({ error: "storagePath and category are required" });
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const supabaseAuth = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    if (userError || !userData?.user) return res.status(401).json({ error: "Invalid session" });

    const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan_tier")
      .eq("id", userData.user.id)
      .single();

    if (profile?.plan_tier !== "pro") {
      return res.status(403).json({ error: "Pro Deep Scan is a Pro-plan feature" });
    }

    if (!storagePath.startsWith(`${userData.user.id}/`)) {
      return res.status(403).json({ error: "That video does not belong to you" });
    }

    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from("videos")
      .download(storagePath);
    if (downloadError) throw downloadError;

    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    if (base64.length > 18 * 1024 * 1024) {
      return res.status(413).json({ error: "Video too large — keep clips under ~15 seconds." });
    }

    const isBatting = category === "batting";
    const subject = isBatting ? "batsman" : category === "bowling" ? "bowler" : "fielder";

    const prompt = `
You are watching a cricket ${category} video (${shotType || "general"}, ${handedness || "right"}-handed ${subject}).
Find the exact TIMESTAMPS (in seconds, decimals allowed, from the very start of this clip) for these three moments:

1. "stanceSec" — the ${subject} is set/ready, BEFORE the key action starts (before the bowler releases the ball, for a batting/fielding clip; or the moment just before the bowler's delivery stride, for a bowling clip).
2. "contactSec" — the instant of bat-ball contact (batting), ball release from the hand (bowling), or ball meeting hands/ground (fielding).
3. "followThroughSec" — just after that instant, once the movement has finished and the body has settled.

Only report the ${subject} — ignore any other player who appears in frame (bowler running in during a batting clip, fielders in the background, etc).
If you genuinely cannot identify a moment, use null for that field instead of guessing.

Return STRICT JSON only, no markdown fences, no extra text, in this exact shape:
{ "stanceSec": <number|null>, "contactSec": <number|null>, "followThroughSec": <number|null>, "confidence": "<low|medium|high>" }
`.trim();

    const raw = await geminiProvider.generate({ base64, mimeType: "video/mp4", prompt });
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: "Phase detection response could not be parsed." });
    }

    return res.status(200).json({
      stanceSec: typeof parsed.stanceSec === "number" ? parsed.stanceSec : null,
      contactSec: typeof parsed.contactSec === "number" ? parsed.contactSec : null,
      followThroughSec: typeof parsed.followThroughSec === "number" ? parsed.followThroughSec : null,
      confidence: parsed.confidence || "low",
      engine: geminiProvider.name,
    });
  } catch (err) {
    console.error("Shot-phase detection error:", err);
    return res.status(500).json({ error: err?.message || "Phase detection failed." });
  }
}
