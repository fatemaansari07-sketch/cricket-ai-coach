import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export const name = "gemini";

/**
 * Generic entry point used by api/detect-shot-phases.js (and any other
 * caller that just wants raw text back from Gemini for a given base64
 * video + prompt). Same {base64,mimeType,prompt} -> text shape as
 * api/lib/providers/qwen.js, so routes can switch providers freely.
 */
export async function generate({ base64, mimeType, prompt }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
  const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });
  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType } },
  ]);
  return result.response.text();
}

export async function analyzeVideoWithGemini(videoBuffer, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-2.5-flash" });

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

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: videoBuffer.toString("base64"),
          mimeType: mimeType
        }
      }
    ]);

    const responseText = result.response.text();
    const cleanJson = responseText.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanJson);
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
}
