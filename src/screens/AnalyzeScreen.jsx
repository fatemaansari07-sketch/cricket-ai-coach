import React, { useState } from "react";

export default function AnalyzeScreen() {
  const [videoFile, setVideoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
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
      fileReader.onerror = (error) => {
        reject(error);
      };
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
    <div className="p-4 bg-slate-900 text-white min-h-screen">
      <h1 className="text-xl font-bold mb-4">Analyze</h1>
      <p className="text-sm text-gray-300 mb-2">
        Ek shot select karo, video daalo, AI dekhega kya sahi kya galat hai
      </p>

      <div className="my-4">
        <input
          type="file"
          accept="video/*"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-emerald-500 file:text-white"
        />
        {videoFile && (
          <p className="mt-2 text-xs text-emerald-400">{videoFile.name}</p>
        )}
      </div>

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 rounded font-semibold text-black"
      >
        {loading ? "Analyzing Video..." : "▷ Analyze Karo"}
      </button>

      {error && (
        <div className="mt-4 p-2 bg-red-900/50 border border-red-500 text-red-200 text-sm rounded">
          ⚠️ {error}
        </div>
      )}

      {analysisResult && (
        <div className="mt-4 p-4 bg-slate-800 rounded">
          <h2 className="font-bold text-emerald-400 mb-2">Analysis Result:</h2>
          <p className="text-sm whitespace-pre-wrap">{analysisResult}</p>
        </div>
      )}
    </div>
  );
}
