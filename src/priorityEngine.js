// src/lib/priorityEngine.js

export function determineMainFocus(detectedFlaws = []) {
  if (!detectedFlaws || detectedFlaws.length === 0) {
    return {
      mainFocus: "Technique Alignment Maintain Rakhna",
      whyItMatters: "Aapki basic biomechanics balanced hain. Rhythm maintain rakhne ke liye base drills karein.",
      drills: [
        { name: "Shadow Drives", reps: "3 sets x 15 reps" },
        { name: "Hanging Ball Contact Point", reps: "20 shots" }
      ],
      targetScore: 85
    };
  }

  // Priority Weights Definition
  const priorityWeights = {
    HEAD_POSITION: 10,
    FRONT_FOOT: 9,
    KNEE_COLLAPSE: 8,
    BAT_PATH: 7,
    FOLLOW_THROUGH: 5
  };

  // Sort by highest priority weight
  const sorted = [...detectedFlaws].sort((a, b) => {
    const weightA = priorityWeights[a.type] || 4;
    const weightB = priorityWeights[b.type] || 4;
    return weightB - weightA;
  });

  const topIssue = sorted[0];

  return {
    mainFocus: topIssue.title || topIssue.flaw,
    whyItMatters: topIssue.rootCause || topIssue.why,
    drills: topIssue.drills || [
      { name: "Focus Drill 1", reps: "3 sets x 10" },
      { name: "Targeted Shadow Swing", reps: "20 reps" }
    ],
    targetScore: Math.min(90, (topIssue.currentMetricScore || 65) + 12)
  };
}
