import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { videoUrl, trajectoryCoords } = req.body;

    // Call Object Detection / Video Processing on Replicate
    const output = await replicate.run(
      "cjwbw/yolov8:a81d4329241517409f5822f676450f9cd349479b0c268a7e089d7fa9a826bc56",
      {
        input: {
          image: videoUrl,
          model_size: "m"
        }
      }
    );

    return res.status(200).json({
      success: true,
      processedData: output,
      message: "Replicate connection successful!"
    });
  } catch (error) {
    console.error("Replicate Error:", error);
    return res.status(500).json({ error: error.message });
  }
}
