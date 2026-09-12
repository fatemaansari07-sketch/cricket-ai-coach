import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { imageUrl, prompt } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: "Image/Frame URL is required" });
    }

    // Grounding DINO model call for precision detection
    const output = await replicate.run(
      "adirik/grounding-dino:efd10a8ddc57ea3277ddab105b6b0b217070282190c6a4f0d76b1a62d3a8a309",
      {
        input: {
          image: imageUrl,
          prompt: prompt || "cricket ball, cricket bat, batsman stance",
          box_threshold: 0.25,
          text_threshold: 0.25
        }
      }
    );

    return res.status(200).json({
      success: true,
      detections: output,
      message: "Grounding DINO trajectory detection complete!"
    });
  } catch (error) {
    console.error("Replicate Grounding DINO Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
