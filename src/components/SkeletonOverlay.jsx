import React from "react";
import { LM } from "../lib/poseEstimation";
import { C } from "./ui";

/**
 * Draws the real MediaPipe skeleton on top of the analyzed video frame,
 * color-coded per joint using the SAME pass/fail the score is built from
 * (jointStatus) — this isn't decorative, it's a literal visualization of
 * biomechanics.js's judgment. Green = within our ideal range, red = the
 * issue driving the coaching feedback below.
 *
 * landmarks: 33 MediaPipe points ({x,y} normalized 0-1)
 * jointStatus: { headTiltDeg, frontElbowDeg, frontKneeDeg } -> boolean (true = ok)
 */
export default function SkeletonOverlay({ landmarks, jointStatus, handedness = "right" }) {
  if (!landmarks || !jointStatus) return null;

  const p = (i) => ({ x: landmarks[i].x * 100, y: landmarks[i].y * 100 });
  const isLeft = handedness !== "left"; // right-handed player's front side is their LEFT

  const front = isLeft
    ? { shoulder: LM.LEFT_SHOULDER, elbow: LM.LEFT_ELBOW, wrist: LM.LEFT_WRIST, hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE }
    : { shoulder: LM.RIGHT_SHOULDER, elbow: LM.RIGHT_ELBOW, wrist: LM.RIGHT_WRIST, hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE };
  const back = isLeft
    ? { shoulder: LM.RIGHT_SHOULDER, hip: LM.RIGHT_HIP, knee: LM.RIGHT_KNEE, ankle: LM.RIGHT_ANKLE }
    : { shoulder: LM.LEFT_SHOULDER, hip: LM.LEFT_HIP, knee: LM.LEFT_KNEE, ankle: LM.LEFT_ANKLE };

  const okColor = C.green;
  const badColor = C.red;
  const neutralColor = "#5B6472";

  const headColor = jointStatus.headTiltDeg === false ? badColor : okColor;
  const elbowColor = jointStatus.frontElbowDeg === false ? badColor : okColor;
  const kneeColor = jointStatus.frontKneeDeg === false ? badColor : okColor;

  const midShoulder = { x: (p(LM.LEFT_SHOULDER).x + p(LM.RIGHT_SHOULDER).x) / 2, y: (p(LM.LEFT_SHOULDER).y + p(LM.RIGHT_SHOULDER).y) / 2 };
  const midHip = { x: (p(LM.LEFT_HIP).x + p(LM.RIGHT_HIP).x) / 2, y: (p(LM.LEFT_HIP).y + p(LM.RIGHT_HIP).y) / 2 };

  const line = (a, b, color, width = 0.6) => (
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeLinecap="round" filter="url(#glow)" />
  );
  const dot = (pt, color, r = 0.9) => <circle cx={pt.x} cy={pt.y} r={r} fill={color} filter="url(#glow)" />;

  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.6" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Neutral torso + back-side limbs for context */}
      {line(midShoulder, midHip, neutralColor)}
      {line(p(back.shoulder), p(back.hip), neutralColor)}
      {line(p(back.hip), p(back.knee), neutralColor)}
      {line(p(back.knee), p(back.ankle), neutralColor)}
      {line(p(LM.LEFT_SHOULDER), p(LM.RIGHT_SHOULDER), neutralColor)}
      {line(p(LM.LEFT_HIP), p(LM.RIGHT_HIP), neutralColor)}

      {/* Head — nose to mid-shoulder, colored by headTiltDeg */}
      {line(p(LM.NOSE), midShoulder, headColor, 0.8)}
      {dot(p(LM.NOSE), headColor, 1.3)}

      {/* Front arm — colored by frontElbowDeg */}
      {line(p(front.shoulder), p(front.elbow), elbowColor, 0.8)}
      {line(p(front.elbow), p(front.wrist), elbowColor, 0.8)}
      {dot(p(front.elbow), elbowColor)}
      {dot(p(front.wrist), elbowColor)}

      {/* Front leg — colored by frontKneeDeg */}
      {line(p(front.hip), p(front.knee), kneeColor, 0.8)}
      {line(p(front.knee), p(front.ankle), kneeColor, 0.8)}
      {dot(p(front.knee), kneeColor)}
      {dot(p(front.ankle), kneeColor)}

      {dot(p(front.shoulder), neutralColor, 0.7)}
      {dot(midHip, neutralColor, 0.7)}
    </svg>
  );
}
