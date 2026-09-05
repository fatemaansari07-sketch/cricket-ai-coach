import React from "react";
import { LM } from "../lib/poseEstimation";
import { C } from "./ui";

/**
 * Draws the real MediaPipe skeleton on top of the analyzed video frame,
 * color-coded per joint using the SAME pass/fail the score is built from
 * (jointStatus) — this isn't decorative, it's a literal visualization of
 * biomechanics.js's judgment. Green = within our ideal range (shows the
 * actual angle), red = the issue driving the coaching feedback below
 * (shows actual angle vs the ideal range it should be in).
 *
 * All positioning here uses INLINE styles, not Tailwind classes — this
 * overlay must render pixel-perfect on top of the image every time, so it
 * can't depend on utility classes being present in a given build.
 *
 * landmarks: 33 MediaPipe points ({x,y} normalized 0-1)
 * jointStatus: { headTiltDeg, frontElbowDeg, frontKneeDeg } -> boolean (true = ok)
 * jointDetail: { headTiltDeg: {value,min,max}, ... } -> the actual numbers
 */
export default function SkeletonOverlay({ landmarks, jointStatus, jointDetail, handedness = "right" }) {
  if (!landmarks || !jointStatus) return null;

  const pt = (i) => ({ x: landmarks[i].x * 100, y: landmarks[i].y * 100 });
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

  const headOk = jointStatus.headTiltDeg !== false;
  const elbowOk = jointStatus.frontElbowDeg !== false;
  const kneeOk = jointStatus.frontKneeDeg !== false;

  const midShoulder = { x: (pt(LM.LEFT_SHOULDER).x + pt(LM.RIGHT_SHOULDER).x) / 2, y: (pt(LM.LEFT_SHOULDER).y + pt(LM.RIGHT_SHOULDER).y) / 2 };
  const midHip = { x: (pt(LM.LEFT_HIP).x + pt(LM.RIGHT_HIP).x) / 2, y: (pt(LM.LEFT_HIP).y + pt(LM.RIGHT_HIP).y) / 2 };

  const line = (a, b, color, width = 0.6) => (
    <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={width} strokeLinecap="round" filter="url(#skeleton-glow)" />
  );
  const dot = (p, color, r = 0.9) => <circle cx={p.x} cy={p.y} r={r} fill={color} filter="url(#skeleton-glow)" />;

  /** Small "92°" / "120° (ideal 80-100)" label anchored near a joint. */
  const label = (p, key, ok, dx = 3, dy = -2) => {
    const d = jointDetail?.[key];
    if (!d) return null;
    const text = ok ? `✓ ${d.value}°` : `✗ ${d.value}° (${d.min}-${d.max}°)`;
    const color = ok ? okColor : badColor;
    const anchor = dx >= 0 ? "start" : "end";
    return (
      <g>
        <rect x={p.x + dx - 0.5} y={p.y + dy - 3.2} width={text.length * 1.75 + 1} height={4.2} rx="1" fill="rgba(5,7,11,0.75)" />
        <text x={p.x + dx} y={p.y + dy} fontSize="3" fontWeight="700" fill={color} textAnchor={anchor} fontFamily="monospace">
          {text}
        </text>
      </g>
    );
  };

  return (
    <svg
      style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", pointerEvents: "none" }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <defs>
        <filter id="skeleton-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Neutral torso + back-side limbs for context */}
      {line(midShoulder, midHip, neutralColor)}
      {line(pt(back.shoulder), pt(back.hip), neutralColor)}
      {line(pt(back.hip), pt(back.knee), neutralColor)}
      {line(pt(back.knee), pt(back.ankle), neutralColor)}
      {line(pt(LM.LEFT_SHOULDER), pt(LM.RIGHT_SHOULDER), neutralColor)}
      {line(pt(LM.LEFT_HIP), pt(LM.RIGHT_HIP), neutralColor)}

      {/* Head — nose to mid-shoulder, colored + labeled by headTiltDeg */}
      {line(pt(LM.NOSE), midShoulder, headOk ? okColor : badColor, 0.8)}
      {dot(pt(LM.NOSE), headOk ? okColor : badColor, 1.3)}
      {label(pt(LM.NOSE), "headTiltDeg", headOk, 3, -3)}

      {/* Front arm — colored + labeled by frontElbowDeg */}
      {line(pt(front.shoulder), pt(front.elbow), elbowOk ? okColor : badColor, 0.8)}
      {line(pt(front.elbow), pt(front.wrist), elbowOk ? okColor : badColor, 0.8)}
      {dot(pt(front.elbow), elbowOk ? okColor : badColor)}
      {dot(pt(front.wrist), elbowOk ? okColor : badColor)}
      {label(pt(front.elbow), "frontElbowDeg", elbowOk, 3, 1)}

      {/* Front leg — colored + labeled by frontKneeDeg */}
      {line(pt(front.hip), pt(front.knee), kneeOk ? okColor : badColor, 0.8)}
      {line(pt(front.knee), pt(front.ankle), kneeOk ? okColor : badColor, 0.8)}
      {dot(pt(front.knee), kneeOk ? okColor : badColor)}
      {dot(pt(front.ankle), kneeOk ? okColor : badColor)}
      {label(pt(front.knee), "frontKneeDeg", kneeOk, 3, 1)}

      {dot(pt(front.shoulder), neutralColor, 0.7)}
      {dot(midHip, neutralColor, 0.7)}
    </svg>
  );
}
