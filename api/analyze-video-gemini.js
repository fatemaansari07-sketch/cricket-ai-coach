import { createClient } from "@supabase/supabase-js";
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Pro-tier video analysis using Gemini's video understanding.
 *
 * Why this has to be a server route and not a direct browser call:
 * any env var prefixed VITE_ gets bundled into the public JS and anyone
 * can read it from devtools/network tab. The Gemini key lives ONLY here
 * (GEMINI_API_KEY, no VITE_ prefix) and never reaches the client.
 *
 * Flow: client uploads video to Supabase Storage (as it already does),
 * then calls this route with the storage path. This route downloads the
 * file server-side with the service-role key, sends it to Gemini, and
 * returns a structured JSON verdict.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { storagePath, category, shotType, handedness } = req.body || {};
  if (!storagePath || !category) {
    return res.status(400).json({ error: "storagePath and category are required" });
  }

  // Verify the caller is signed in and actually on the Pro plan — this
  // endpoint costs real money per call, so it must not be open to anyone.
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
    return res.status(403).json({ error: "Gemini analysis is a Pro-plan feature" });
  }

  // storagePath must belong to the requesting user — prevents anyone from
  // passing someone else's video path and getting a free analysis of it.
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

    // Vercel serverless functions have a request/response size ceiling —
    // keep clips short (this matches the app's existing "10-15 sec" guidance).
    if (base64.length > 18 * 1024 * 1024) {
      return res.status(413).json({ error: "Video too large for analysis — keep clips under ~15 seconds." });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Deliberately NOT told to favor "famous players" or hand out high
    // scores — that would make it praise recognition, not technique.
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

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64, mimeType: "video/mp4" } },
    ]);

    const raw = result.response.text();
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return res.status(502).json({ error: "AI response could not be parsed, try again." });
    }

    return res.status(200).json({
      category,
      score: parsed.score,
      correct: parsed.correct || [],
      incorrect: parsed.incorrect || [],
      cameraAngleDetected: parsed.cameraAngleDetected,
      confidence: parsed.confidence,
      engine: "gemini-1.5-flash",
    });
  } catch (err) {
    console.error("Gemini analysis error:", err);
    return res.status(500).json({ error: "Analysis failed, try again in a moment." });
  }
}
