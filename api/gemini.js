import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Thin wrapper around Gemini's video-understanding call. Nothing here
 * knows about Supabase, auth, or caching — it just takes bytes + a prompt
 * and returns raw text. That's what makes it swappable: analyze-video.js
 * doesn't care which provider produced the text.
 */
export async function generate({ base64, mimeType, prompt }) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const result = await model.generateContent([
    prompt,
    { inlineData: { data: base64, mimeType } },
  ]);

  return result.response.text();
}

export const name = "gemini-1.5-flash";
