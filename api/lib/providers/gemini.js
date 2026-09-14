import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * Gemini Provider for Video / Analysis Tasks
 */

// Models to try in order of preference
// Note: 'gemini-1.5-flash-latest' alias is deprecated in some endpoints, using 'gemini-1.5-flash' instead.
const PRIMARY_MODEL = 'gemini-1.5-flash';
const FALLBACK_MODEL = 'gemini-1.5-pro';

/**
 * Helper to execute Gemini generation with automatic fallback
 */
async function generateWithFallback(apiKey, prompt, parts = []) {
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const model = genAI.getGenerativeModel({ model: PRIMARY_MODEL });
    const result = await model.generateContent([prompt, ...parts]);
    return await result.response.text();
  } catch (err) {
    console.warn(`[Gemini Provider] Primary model ${PRIMARY_MODEL} failed, trying fallback ${FALLBACK_MODEL}:`, err.message);
    try {
      const fallbackModel = genAI.getGenerativeModel({ model: FALLBACK_MODEL });
      const result = await fallbackModel.generateContent([prompt, ...parts]);
      return await result.response.text();
    } catch (fallbackErr) {
      console.error(`[Gemini Provider] Fallback model ${FALLBACK_MODEL} also failed:`, fallbackErr.message);
      throw fallbackErr;
    }
  }
}

/**
 * Direct REST API call helper (if SDK is not used)
 */
export async function analyzeVideoWithGeminiRest({ apiKey, prompt, inlineData }) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${PRIMARY_MODEL}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          { text: prompt },
          ...(inlineData ? [{ inlineData }] : [])
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(`[Gemini API Error]: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`);
  }

  const data = await response.json();
  return data;
}

export default {
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  generateWithFallback,
  analyzeVideoWithGeminiRest
};
