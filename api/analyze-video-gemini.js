import { createClient } from "@supabase/supabase-js";
import * as geminiProvider from "./lib/providers/gemini.js";
import * as qwenProvider from "./lib/providers/qwen.js";
import { hashVideo, getCached, setCached } from "./lib/videoCache.js";
import { checkAndBumpGeminiQuota } from "./lib/geminiQuota.js";

/**
 * Pro-tier video analysis, provider-abstracted.
 *
 * Why this has to be a server route and not a direct browser call:
 * any env var prefixed VITE_ gets bundled into the public JS and anyone
 * can read it from devtools/network tab. Provider API keys live ONLY here
 * and never reach the client.
 *
 * Provider is chosen via AI_PROVIDER env var (defaults to "gemini"). Both
 * providers implement the same generate({base64,mimeType,prompt}) -> text
 * shape (see ./lib/providers/*.js), so switching to Qwen once it's
 * benchmarked and has a real inference endpoint is a config change, not a
 * rewrite of this route or anything downstream in the coaching loop.
 *
 * Cost controls (per the project's "limited infrastructure budget" rule):
 *   1. Identical video re-analyzed -> served from ai_analysis_cache, no
 *      provider call at all.
 *   2. A hard daily cap on provider calls per user (GEMINI_DAILY_CAP env,
 *      default 20), separate from the normal plan video-quota.
 */
export default async function handler(req, res) {
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
    return res.status(403).json({ error: "AI video analysis is a Pro-plan feature" });
  }

  if (!storagePath.startsWith(`${userData.user.id}/`)) {
    return res.status(403).json({ error: "That video does not belong to you" });
  }

  try {
    const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
      .from("videos")
      .download(storagePath);
    if (downloadError) throw downloadError;

    const arrayBuffer = await fileBlob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    if (base64.length > 18 * 1024 * 1024) {
      return res.status(413).json({ error: "Video too large for analysis — keep clips under ~15 seconds." });
    }

    // 1. Cache check — identical video already analyzed, don't pay again.
    const videoHash = hashVideo(base64);
    const cached = await getCached(supabaseAdmin, videoHash);
    if (cached) {
      return res.status(200).json({ ...cached, category, fromCache: true });
    }

    // 2. Daily cost cap, independent of the plan's video-count quota.
    const quota = await checkAndBumpGeminiQuota(supabaseAdmin, userData.user.id);
    if (!quota.allowed) {
      return res.status(429).json({ error: "Daily AI-analysis limit reached for today. Regular pose analysis is still unlimited — try that, or come back tomorrow." });
    }

    const prompt = `
You are a strict, objective cricket biomechanics coach. Analyze ONLY what is
visible in this video of a ${category} shot (${shotType || "general"}, player is ${handedness || "right"}-handed).

Judge purely on visible technique — do not assume a score based on who you
think the player might be, their fame, or the video's production quality.
If the camera angle makes something hard to judge, say so honestly instead
of guessing. If you cannot clearly see the player's body, give a low score
and explain why in "mistakes" instead of inventing detail.

Return STRICT JSON only, no markdown fences, no extra text, in this exact shape:
{
  "score": <integer 0-100>,
  "cameraAngleDetected": "<e.g. Front / Side-on / Back / Unclear>",
  "confidence": "<low | medium | high>",
  "correct": ["<specific, visible strength>", "..."],
  "incorrect": ["<specific flaw> — <why it matters / what it costs the player>", "..."]
}
`.trim();

    // 3. Pick the provider. Falls back to Gemini if Qwen isn't configured
    //    yet, so flipping the env var early doesn't break production.
    const useQwen = process.env.AI_PROVIDER === "qwen";
    let provider = useQwen ? qwenProvider : geminiProvider;
    let raw;
    try {
      raw = await provider.generate({ base64, mimeType: "video/mp4", prompt });
    } catch (providerErr) {
      if (useQwen) {
        console.warn("Qwen provider failed, falling back to Gemini:", providerErr.message);
        provider = geminiProvider;
        raw = await provider.generate({ base64, mimeType: "video/mp4", prompt });
      } else {
        throw providerErr;
      }
    }

    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: "AI response could not be parsed, try again." });
    }

    const responseBody = {
      category,
      score: parsed.score,
      correct: parsed.correct || [],
      incorrect: parsed.incorrect || [],
      cameraAngleDetected: parsed.cameraAngleDetected,
      confidence: parsed.confidence,
      engine: provider.name,
    };

    // Cache under the raw response (without the per-request "category"
    // field baked in, so a re-hit still works if reused across categories
    // is ever needed) — simplest correct approach is to just cache as-is.
    await setCached(supabaseAdmin, videoHash, provider.name, responseBody);

    return res.status(200).json(responseBody);
  } catch (err) {
    console.error("AI video analysis error:", err);
    return res.status(500).json({ error: "Analysis failed, try again in a moment." });
  }
}
