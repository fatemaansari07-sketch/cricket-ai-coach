import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function analyzeVideoWithGemini(videoBuffer, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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
