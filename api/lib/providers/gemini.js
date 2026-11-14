import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const name = "gemini";

// Google retires old models for new accounts (e.g. "gemini-2.5-flash is no longer
// available to new users"). So unless GEMINI_MODEL is set, ask Google which flash
// models this key can use and take the newest one.
let cachedModels = null;
export async function pickModel() {
  return (await pickModels())[0];
}

export async function pickModels() {
  if (process.env.GEMINI_MODEL) return [process.env.GEMINI_MODEL, "gemini-flash-latest"];
  if (cachedModels) return cachedModels;
  let list = [];
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${process.env.GEMINI_API_KEY}`);
    const j = await r.json();
    list = (j.models || [])
      .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map((m) => String(m.name).replace("models/", ""))
      .filter((n) => /^gemini-\d+(\.\d+)?-flash$/.test(n))
      .sort((a, b) => parseFloat(b.split("-")[1]) - parseFloat(a.split("-")[1]));
  } catch { /* fall through to alias */ }
  // newest flash models first, then the stable alias as the last resort
  const out = [...list.slice(0, 3), "gemini-flash-latest"].filter((m, i, a) => a.indexOf(m) === i);
  if (list.length) cachedModels = out;
  return out;
}

const isBusy = (e) => /503|429|overload|high demand|unavailable|quota|timeout|fetch failed/i.test(String(e?.message || e));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Try each model; on "busy" errors retry with backoff, then fall back to the next model. */
export async function generateWithFallback(parts, deadline = Date.now() + 45000) {
  const models = await pickModels();
  let lastErr;
  for (const m of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 6000) throw lastErr || new Error("Gemini abhi busy hai (503) — thodi der baad try karo");
      try {
        const model = genAI.getGenerativeModel({ model: m }, { timeout: Math.min(30000, left - 2000) });
        return await model.generateContent(parts);
      } catch (e) {
        lastErr = e;
        if (!isBusy(e)) throw e;
        await sleep(Math.min(2000 * (attempt + 1), Math.max(0, deadline - Date.now() - 6000)));
      }
    }
  }
  throw lastErr;
}

/**
 * Generic entry point used by api/detect-shot-phases.js (and any other
 * caller that just wants raw text back from Gemini for a given base64
 * video + prompt). Same {base64,mimeType,prompt} -> text shape as
 * api/lib/providers/qwen.js, so routes can switch providers freely.
 */
export async function generate({ base64, mimeType, prompt }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  const result = await generateWithFallback([
    prompt,
    { inlineData: { data: base64, mimeType } },
  ]);
  return result.response.text();
}

export async function analyzeVideoWithGemini(videoBuffer, mimeType) {
  const deadline = Date.now() + 50000; // Vercel function limit is 60s
  try {
    const prompt = `
      You are an expert cricket biomechanics coach. Analyze this batting video carefully.
      1. Identify exact timestamps (in seconds as floats, e.g. 1.25) for 3 keyframes:
         - stance_time
         - impact_time
         - follow_through_time
      2. Provide structured feedback:
         - shot_type (e.g. Cover Drive, Lofted Shot, Defense)
         - what_was_good (array of strings)
         - what_was_wrong (array of strings)
         - key_joint_angles_estimate (head tilt, front elbow, front knee)
         - score (integer 0-100, overall technique score)
         - confidence ("high"|"medium"|"low" — how clearly the body/shot was visible)
         - camera_angle (short string, e.g. "side-on", "front-on", "behind")

      Return ONLY valid raw JSON format without markdown blocks.
    `;

    // Gemini inline requests are capped (~20 MB incl. base64 overhead), so bigger
    // videos go through the Files API instead.
    let videoPart, uploaded = null, fileManager = null;
    if (videoBuffer.length > 9 * 1024 * 1024) {
      const { GoogleAIFileManager } = await import("@google/generative-ai/server");
      const { writeFile, unlink } = await import("node:fs/promises");
      const tmp = `/tmp/cricket-${Date.now()}-${Math.random().toString(36).slice(2)}.${(mimeType.split("/")[1] || "mp4").replace(/[^a-z0-9]/gi, "")}`;
      await writeFile(tmp, videoBuffer);
      fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);
      try {
        const up = await fileManager.uploadFile(tmp, { mimeType, displayName: "cricket-video" });
        uploaded = up.file;
      } finally { await unlink(tmp).catch(() => {}); }
      for (let i = 0; i < 30 && uploaded.state === "PROCESSING"; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        uploaded = await fileManager.getFile(uploaded.name);
      }
      if (uploaded.state !== "ACTIVE") throw new Error("Gemini video process nahi kar paya (file state: " + uploaded.state + ")");
      videoPart = { fileData: { mimeType: uploaded.mimeType || mimeType, fileUri: uploaded.uri } };
    } else {
      videoPart = { inlineData: { data: videoBuffer.toString("base64"), mimeType } };
    }

    let result;
    try {
      result = await generateWithFallback([prompt, videoPart], deadline);
    } finally {
      if (uploaded && fileManager) fileManager.deleteFile(uploaded.name).catch(() => {});
    }

    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
