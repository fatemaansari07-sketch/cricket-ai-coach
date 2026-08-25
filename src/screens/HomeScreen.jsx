// src/screens/HomeScreen.jsx
import React, { useState, useEffect } from 'react';
import { determineMainFocus } from '../lib/priorityEngine';
import { Button, Card, Progress } from '../components/ui';

export default function HomeScreen({ onStartUpload, recentAnalysisData }) {
  const [currentFocus, setCurrentFocus] = useState(null);

  useEffect(() => {
    // Existing history ya recent analysis se priority issues fetch karna
    const flaws = recentAnalysisData?.flaws || [];
    const focusData = determineMainFocus(flaws);
    setCurrentFocus(focusData);
  }, [recentAnalysisData]);

  if (!currentFocus) return <div className="p-4 text-center">Loading Practice Dashboard...</div>;

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      {/* Header Section */}
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">TODAY'S PRACTICE</h1>
        <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-800 rounded-full">
          Active Session
        </span>
      </div>

      {/* Main Priority Target Card */}
      <Card className="p-5 border-2 border-indigo-500 bg-indigo-50/30">
        <div className="flex items-center space-x-2 text-indigo-600 font-bold mb-2">
          <span>🎯</span>
          <span>MAIN FOCUS</span>
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 mb-2">
          {currentFocus.mainFocus}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {currentFocus.whyItMatters}
        </p>

        {/* Target Metric / Score Goal */}
        <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4">
          <div className="flex justify-between text-xs font-semibold mb-1">
            <span>Target Session Score</span>
            <span className="text-indigo-600">{currentFocus.targetScore} / 100</span>
          </div>
          <Progress value={currentFocus.targetScore} className="h-2" />
        </div>

        {/* Actionable Drills */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Recommended Drills</h3>
          {currentFocus.drills.map((drill, idx) => (
            <div key={idx} className="flex justify-between items-center text-sm bg-white p-2.5 rounded border border-gray-100">
              <span className="font-medium text-gray-800">{drill.name}</span>
              <span className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{drill.reps}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Primary CTA */}
      <div className="pt-2">
        <Button 
          onClick={onStartUpload}
          className="w-full py-4 text-lg font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg flex items-center justify-center space-x-2"
        >
          <span>📹</span>
          <span>RECORD / RE-TEST NOW</span>
        </Button>
        <p className="text-center text-xs text-gray-400 mt-2">
          Record 5 balls to test if your focus area improved
        </p>
      </div>
    </div>
  );
}
