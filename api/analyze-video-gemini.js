import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4.5mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { videoBase64, mimeType } = req.body;

    if (!videoBase64) {
      return res.status(400).json({ error: "No video provided" });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY environment variable missing" });
    }

    // Updated to latest working model string
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

    const result = await model.generateContent([
      {
        inlineData: {
          data: videoBase64,
          mimeType: mimeType || "video/mp4",
        },
      },
      "Analyze this cricket shot biomechanics: elbow angle, stance, head position, and impact point.",
    ]);

    const responseText = result.response?.text() || "Analysis complete.";
    return res.status(200).json({ success: true, analysis: responseText });
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return res.status(500).json({ error: error.message || "Internal server error" });
  }
}
