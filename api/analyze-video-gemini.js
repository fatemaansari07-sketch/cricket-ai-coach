import { analyzeVideoWithGemini } from "./lib/providers/gemini.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { videoBase64, mimeType, planType = "free", userCredits = 0 } = req.body;

    if (!videoBase64) {
      return res.status(400).json({ error: "No video provided" });
    }

    const videoBuffer = Buffer.from(videoBase64, "base64");

    // Credit Check for Paid Tiers
    if (planType !== "free" && userCredits < 10) {
      return res.status(402).json({ error: "Insufficient credits. Please recharge your plan." });
    }

    // 1. Core Gemini Flash Biomechanics Analysis
    const aiAnalysis = await analyzeVideoWithGemini(videoBuffer, mimeType);

    // 2. Free Tier Response
    if (planType === "free") {
      return res.status(200).json({
        success: true,
        tier: "free",
        analysis: {
          shotType: aiAnalysis.shot_type,
          good: aiAnalysis.what_was_good,
          wrong: aiAnalysis.what_was_wrong
        },
        upgradePrompt: "Switch to Pro (₹99) for 3-Keyframe Skeleton Analysis & Weekly Progress Tests!"
      });
    }

    // 3. Pro Tier (₹99) Response
    if (planType === "pro_99") {
      return res.status(200).json({
        success: true,
        tier: "pro_99",
        keyframes: {
          stance: aiAnalysis.stance_time,
          impact: aiAnalysis.impact_time,
          followThrough: aiAnalysis.follow_through_time
        },
        analysis: aiAnalysis,
        deductCredits: 10
      });
    }

    // 4. Video Visualization (₹120) & Special Coaching Response
    if (planType === "video_120" || planType === "special_coach") {
      // Trigger external GPU Worker for Ball Trajectory & Watermark video export
      const modalWorkerUrl = process.env.MODAL_WORKER_URL;
      let renderedVideoUrl = null;

      if (modalWorkerUrl) {
        const renderRes = await fetch(modalWorkerUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoBase64,
            timestamps: aiAnalysis,
            watermark: "Cricket AI Coach"
          })
        });
        const renderData = await renderRes.json();
        renderedVideoUrl = renderData.video_url;
      }

      return res.status(200).json({
        success: true,
        tier: planType,
        renderedVideoUrl: renderedVideoUrl || "https://your-fallback-cdn.com/preview.mp4",
        analysis: aiAnalysis,
        deductCredits: 10
      });
    }

    return res.status(400).json({ error: "Invalid plan selected" });

  } catch (err) {
    console.error("Handler Error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
