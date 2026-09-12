import React, { useState } from "react";

export default function AnalyzeScreen() {
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Vercel 4.5MB limit check
      if (file.size > 4.5 * 1024 * 1024) {
        setError("Video size 4MB se chhota hona chahiye (Vercel Serverless limit).");
        setVideoFile(null);
        return;
      }
      setVideoFile(file);
      setError(null);
    }
  };

  const convertBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const fileReader = new FileReader();
      fileReader.readAsDataURL(file);
      fileReader.onload = () => {
        resolve(fileReader.result.split(",")[1]);
      };
      fileReader.onerror = (err) => reject(err);
    });
  };

  const handleAnalyze = async () => {
    if (!videoFile) {
      setError("No video provided");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const base64Data = await convertBase64(videoFile);

      const response = await fetch("/api/analyze-video-gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoBase64: base64Data,
          mimeType: videoFile.type || "video/mp4",
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Video file ka size Vercel API limits se bada hai.");
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Analysis failed");
      }

      setAnalysisResult(data.analysis);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 bg-[#0a0f1d] text-white min-h-screen">
      <h1 className="text-2xl font-bold mb-2">Analyze</h1>
      <p className="text-xs text-gray-400 mb-4">
        Ek shot select karo, video daalo, AI dekhega kya sahi kya galat hai
      </p>

      <div className="mb-4">
        <label className="inline-block bg-[#162032] border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded cursor-pointer">
          Choose file
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        {videoFile && (
          <span className="ml-2 text-xs text-gray-300">{videoFile.name}</span>
        )}
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded text-black font-semibold text-xs flex items-center gap-1"
      >
        ▷ {loading ? "Analyzing..." : "Analyze Karo"}
      </button>

      {error && (
        <div className="mt-4 p-2 bg-red-900/60 border border-red-500 text-red-200 text-xs rounded">
          ⚠️ {error}
        </div>
      )}

      {analysisResult && (
        <div className="mt-4 p-3 bg-[#111827] border border-emerald-500/30 rounded">
          <h2 className="font-bold text-emerald-400 text-sm mb-1">Analysis Result:</h2>
          <p className="text-xs text-gray-300 whitespace-pre-wrap">{analysisResult}</p>
        </div>
      )}
    </div>
  );
}
