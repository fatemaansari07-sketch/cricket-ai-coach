import React, { useState } from "react";

export default function AnalyzeScreen() {
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [shotType, setShotType] = useState("Cover Drive");
  const [stance, setStance] = useState("Right-handed");

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 4.5 * 1024 * 1024) {
        setError("Video size 4MB se chhota rakhein.");
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
      fileReader.onload = () => resolve(fileReader.result.split(",")[1]);
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
    <div className="p-4 bg-[#0a0f1d] text-white min-h-screen pb-24">
      <h1 className="text-2xl font-bold mb-1">Analyze</h1>
      <p className="text-xs text-gray-400 mb-4">
        Ek shot select karo, video daalo, AI dekhega kya sahi kya galat hai
      </p>

      {/* Mode Selection */}
      <div className="flex gap-2 mb-3">
        <button className="px-3 py-1 bg-emerald-600 text-xs rounded text-white font-semibold">Batting</button>
        <button className="px-3 py-1 bg-slate-800 text-xs rounded text-gray-400">Bowling</button>
        <button className="px-3 py-1 bg-slate-800 text-xs rounded text-gray-400">Fielding</button>
      </div>

      <div className="mb-3">
        <select 
          value={shotType} 
          onChange={(e) => setShotType(e.target.value)}
          className="bg-[#162032] border border-gray-700 text-xs text-white p-2 rounded w-full"
        >
          <option value="Cover Drive">Cover Drive</option>
          <option value="Straight Drive">Straight Drive</option>
          <option value="Pull Shot">Pull Shot</option>
        </select>
      </div>

      <div className="flex gap-2 mb-4">
        <button 
          onClick={() => setStance("Right-handed")}
          className={`px-3 py-1 text-xs rounded ${stance === "Right-handed" ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400"}`}
        >
          Right-handed
        </button>
        <button 
          onClick={() => setStance("Left-handed")}
          className={`px-3 py-1 text-xs rounded ${stance === "Left-handed" ? "bg-emerald-600 text-white" : "bg-slate-800 text-gray-400"}`}
        >
          Left-handed
        </button>
      </div>

      {/* File Upload Area */}
      <div className="mb-4">
        <label className="block w-full bg-[#162032] border border-dashed border-emerald-500/40 p-3 rounded text-center cursor-pointer">
          <span className="text-xs text-emerald-400 font-medium">
            {videoFile ? videoFile.name : "Choose file (Max 4MB)"}
          </span>
          <input
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 rounded text-black font-semibold text-xs transition"
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
