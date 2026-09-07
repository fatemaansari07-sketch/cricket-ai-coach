import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarkerPromise = null;

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

/**
 * Loads Google's pose-landmark model once and reuses it.
 * This is the "eyes" — it just finds where the joints are in a picture.
 * The actual cricket coaching intelligence lives in `biomechanics.js`,
 * which is 100% ours: we decide what "correct" looks like for each shot.
 *
 * Tries GPU first (faster), falls back to CPU if the phone/browser doesn't
 * support it — and always fails loudly instead of hanging forever, which
 * is what was causing the "analyze karo" button to spin endlessly.
 */
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await withTimeout(
        FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"),
        15000,
        "AI model load nahi ho paya (internet slow ho sakta hai). Wifi/data check karke dubara try karo."
      );

      const baseOptions = {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
      };

      try {
        return await withTimeout(
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: { ...baseOptions, delegate: "GPU" },
            runningMode: "IMAGE",
            numPoses: 3,
          }),
          15000,
          "GPU timeout"
        );
      } catch {
        // Some phones/browsers don't support the GPU delegate — fall back to CPU.
        return await withTimeout(
          PoseLandmarker.createFromOptions(vision, {
            baseOptions: { ...baseOptions, delegate: "CPU" },
            runningMode: "IMAGE",
            numPoses: 3,
          }),
          20000,
          "AI model load nahi ho paya is phone/browser par. Chrome browser me try karo."
        );
      }
    })().catch((err) => {
      landmarkerPromise = null; // allow retry on next attempt instead of caching the failure forever
      throw err;
    });
  }
  return landmarkerPromise;
}

/** Grabs a single representative frame from a video file as a canvas. */
function grabFrame(videoFile, atSeconds = null) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    // Some mobile browsers won't reliably seek/decode a video that isn't
    // attached to the document — keep it in the DOM but invisible.
    video.style.position = "fixed";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    video.style.width = "1px";
    video.style.height = "1px";
    document.body.appendChild(video);

    const cleanup = () => {
      URL.revokeObjectURL(video.src);
      video.remove();
    };

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Video read karne me bahut time lag gaya — dusra video try karo."));
    }, 15000);

    video.src = URL.createObjectURL(videoFile);

    video.onloadedmetadata = () => {
      const target = atSeconds ?? video.duration / 2;
      video.currentTime = Math.min(target, Math.max(video.duration - 0.05, 0));
    };
    video.onseeked = () => {
      clearTimeout(timeoutId);
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      cleanup();
      resolve(canvas);
    };
    video.onerror = () => {
      clearTimeout(timeoutId);
      cleanup();
      reject(new Error("Video load nahi hua — file format check karo (MP4/MOV)."));
    };
  });
}

/** Same frame-grab as above, but returns a dataURL + its real pixel size.
 *  The size matters: the result screen must display this frame at its
 *  EXACT aspect ratio (no cropping), because the skeleton overlay's
 *  landmark coordinates are normalized against the full, uncropped frame.
 *  If the display box crops the image (object-fit: cover) the joints stop
 *  lining up with the body. */
/** Same frame-grab as above, but returns a dataURL + its real pixel size,
 *  plus (if landmarks are supplied) a skeleton "neutral" line color that
 *  contrasts with whatever the player is actually wearing — sampled from
 *  the real pixels at the torso, not guessed. Dark jersey -> light lines,
 *  light jersey -> dark lines, so the skeleton stays visible either way. */
export async function captureFrameDataUrl(videoFile, atSeconds, landmarksForContrast) {
  const canvas = await grabFrame(videoFile, atSeconds);
  let neutralColor = "#5B6472";

  if (landmarksForContrast) {
    try {
      const ctx = canvas.getContext("2d");
      const w = canvas.width, h = canvas.height;
      const Lsh = landmarksForContrast[LM.LEFT_SHOULDER], Rsh = landmarksForContrast[LM.RIGHT_SHOULDER];
      const Lhip = landmarksForContrast[LM.LEFT_HIP], Rhip = landmarksForContrast[LM.RIGHT_HIP];
      const cx = Math.round(((Lsh.x + Rsh.x + Lhip.x + Rhip.x) / 4) * w);
      const cy = Math.round((((Lsh.y + Rsh.y) / 2) * 0.65 + ((Lhip.y + Rhip.y) / 2) * 0.35) * h);
      const size = Math.max(8, Math.round(w * 0.07));
      const x0 = Math.max(0, Math.min(w - 1, cx - Math.floor(size / 2)));
      const y0 = Math.max(0, Math.min(h - 1, cy - Math.floor(size / 2)));
      const sw = Math.max(1, Math.min(size, w - x0));
      const sh = Math.max(1, Math.min(size, h - y0));
      const { data } = ctx.getImageData(x0, y0, sw, sh);
      let total = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        total += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        count++;
      }
      const avgLuminance = total / count / 255; // 0 (black) – 1 (white)
      neutralColor = avgLuminance > 0.55 ? "#0B0F17" : "#F1F5F9";
    } catch {
      // canvas read failed for some reason — fall back to the default gray
    }
  }

  return { dataUrl: canvas.toDataURL("image/jpeg", 0.85), width: canvas.width, height: canvas.height, neutralColor };
}

/**
 * FIX: "skeleton jumps to whoever walks into frame" bug.
 *
 * We now ask MediaPipe for up to 3 people per frame instead of just 1
 * (numPoses: 3), then pick which one is actually OUR player ourselves —
 * instead of blindly trusting whichever person MediaPipe's internal
 * confidence ranking put first (which switches to a bowler/fielder/
 * umpire walking past the camera, since MediaPipe doesn't know who we
 * care about).
 *
 * How we choose:
 *  - First frame (no lock yet): pick whoever is most CENTERED in frame
 *    and has the largest, most complete pose — that's the framing
 *    convention every "10-15 sec, poora body frame me" upload follows,
 *    regardless of whether it's a batsman, bowler, or fielder video.
 *  - Every later frame: pick whoever's hip position is CLOSEST to where
 *    our locked player was last frame — a bowler/fielder walking in
 *    elsewhere in the shot will be far from that position and gets
 *    ignored, even if MediaPipe is more "confident" about them.
 */
function personCentroid(landmarks) {
  const l = landmarks[LM.LEFT_HIP];
  const r = landmarks[LM.RIGHT_HIP];
  if (!l || !r) return null;
  return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
}

function personSize(landmarks) {
  // Rough bounding-box diagonal across shoulders/hips — bigger = closer
  // to camera / more likely the intended subject rather than someone
  // small in the background.
  const pts = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP]
    .map((i) => landmarks[i])
    .filter(Boolean);
  if (pts.length < 2) return 0;
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  return Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
}

function pickTrackedPerson(candidateLandmarksList, lockedCentroid) {
  if (!candidateLandmarksList || candidateLandmarksList.length === 0) return null;

  const scored = candidateLandmarksList
    .map((landmarks) => ({ landmarks, centroid: personCentroid(landmarks), size: personSize(landmarks) }))
    .filter((c) => c.centroid !== null);

  if (scored.length === 0) return null;
  if (scored.length === 1) return scored[0];

  if (!lockedCentroid) {
    // No lock yet — prefer centered + large (the intended subject).
    let best = scored[0];
    let bestScore = -Infinity;
    for (const c of scored) {
      const centerDist = Math.abs(c.centroid.x - 0.5);
      const score = c.size - centerDist; // bigger is better, off-center is worse
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }

  // Locked — stick with whoever is nearest to our tracked player,
  // ignoring anyone else who wanders into frame.
  let best = scored[0];
  let bestDist = Infinity;
  for (const c of scored) {
    const d = Math.hypot(c.centroid.x - lockedCentroid.x, c.centroid.y - lockedCentroid.y);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

/**
 * Extracts 33 body keypoints (normalized 0–1 x/y) from one frame of the video.
 * Returns null if no person was clearly detected in that frame.
 */
export async function extractPoseFromVideo(videoFile, atSeconds = null) {
  const landmarker = await getLandmarker();
  const canvas = await grabFrame(videoFile, atSeconds);
  const result = landmarker.detect(canvas);
  if (!result.landmarks || result.landmarks.length === 0) return null;
  const picked = pickTrackedPerson(result.landmarks, null);
  return picked ? picked.landmarks : null;
}

/**
 * Samples several frames spread across the clip (not just the middle one)
 * and runs pose detection on each. This is the "multi-frame" upgrade:
 * a single frame can catch an odd moment (blink of motion blur, awkward
 * pose mid-transition) and produce a wildly wrong reading — averaging
 * several frames across the shot smooths that noise out.
 *
 * Samples between 10%–90% of the clip (skips the very start/end where the
 * player is often just getting ready or the clip is cutting off) and skips
 * any frame where no person was clearly detected.
 *
 * Returns an array of { t, landmarks } entries, oldest first.
 */
export async function extractPoseSequenceFromVideo(videoFile, numFrames = 20, hintTimestamps = null) {
  const landmarker = await getLandmarker();

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.style.position = "fixed";
  video.style.opacity = "0";
  video.style.pointerEvents = "none";
  video.style.width = "1px";
  video.style.height = "1px";
  document.body.appendChild(video);

  const cleanup = () => {
    URL.revokeObjectURL(video.src);
    video.remove();
  };

  try {
    const duration = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Video load nahi hua — dubara try karo.")), 15000);
      video.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        resolve(video.duration);
      };
      video.onerror = () => {
        clearTimeout(timeoutId);
        reject(new Error("Video load nahi hua — file format check karo (MP4/MOV)."));
      };
      video.src = URL.createObjectURL(videoFile);
    });

    const start = duration * 0.1;
    const end = duration * 0.9;
    const step = numFrames > 1 ? (end - start) / (numFrames - 1) : 0;
    let timestamps = Array.from({ length: numFrames }, (_, i) => start + step * i);

    // If Gemini told us exactly when stance/contact/follow-through happen,
    // make sure we grab a real frame AT those exact moments too — not just
    // whichever evenly-spaced sample happens to land closest.
    if (hintTimestamps) {
      const extra = [hintTimestamps.stanceSec, hintTimestamps.contactSec, hintTimestamps.followThroughSec]
        .filter((s) => typeof s === "number" && s >= 0 && s <= duration);
      timestamps = [...timestamps, ...extra];
    }
    timestamps = Array.from(new Set(timestamps.map((t) => Math.round(t * 1000) / 1000))).sort((a, b) => a - b);

    const frames = [];
    let lockedCentroid = null; // carried across frames — see pickTrackedPerson
    for (const t of timestamps) {
      const canvas = await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error("Frame read timeout")), 8000);
        video.onseeked = () => {
          clearTimeout(timeoutId);
          const c = document.createElement("canvas");
          c.width = video.videoWidth;
          c.height = video.videoHeight;
          c.getContext("2d").drawImage(video, 0, 0);
          resolve(c);
        };
        video.currentTime = Math.min(t, Math.max(duration - 0.05, 0));
      }).catch(() => null);

      if (!canvas) continue;
      const result = landmarker.detect(canvas);
      if (result.landmarks && result.landmarks.length > 0) {
        const picked = pickTrackedPerson(result.landmarks, lockedCentroid);
        if (picked) {
          frames.push({ t, landmarks: picked.landmarks });
          lockedCentroid = picked.centroid; // keep tracking the same person next frame
        }
      }
    }

    return frames;
  } finally {
    cleanup();
  }
}

/**
 * MOTION-BASED PHASE DETECTION — this replaces the old "first 2 frames =
 * stance, last 2 frames = follow-through" guess, which was just picking
 * frames by their POSITION in the clip (10%, 90%...) with no idea whether
 * the player had even started moving yet. That's why "stance" frames were
 * sometimes already mid-shot in the screenshots — the guess had nothing to
 * do with what the body was actually doing.
 *
 * Real approach: track how fast the bat hand (leading wrist) is moving,
 * frame to frame.
 *   - STANCE  = the last "quiet" frame before the hands start accelerating
 *               into the shot (batsman standing, waiting for the ball).
 *   - CONTACT = the frame of PEAK hand speed. For a normal cricket shot,
 *               bat speed peaks at/around the moment it meets the ball —
 *               this is the same heuristic used in sports-motion analysis
 *               when there's no separate ball-tracking signal available.
 *   - FOLLOW-THROUGH = the next "quiet again" frame after contact, once
 *               the swing has decelerated — shows where the body/bat
 *               ended up and how balanced the finish was.
 *
 * Speed is normalized by hip-width (torso scale) so it's comparable
 * whether the camera is close or far, and by the real time gap between
 * frames (not just frame count) so uneven sampling doesn't skew it.
 */
export function detectShotPhases(frames, handedness = "right") {
  const last = Math.max(0, frames.length - 1);

  if (!frames || frames.length < 5) {
    // Not enough frames to read real motion from — fall back to a plain
    // position-based guess instead of crashing, but flag it as such.
    return { stanceIdx: 0, contactIdx: Math.floor(last / 2), followThroughIdx: last, method: "fallback" };
  }

  // Leading (bat) hand: right-handed batsman leads with the LEFT hand low
  // on the bat, and vice versa for left-handed.
  const wristIdx = handedness === "left" ? LM.RIGHT_WRIST : LM.LEFT_WRIST;

  const speeds = [0];
  for (let i = 1; i < frames.length; i++) {
    const prev = frames[i - 1].landmarks[wristIdx];
    const curr = frames[i].landmarks[wristIdx];
    const hipL = frames[i].landmarks[LM.LEFT_HIP];
    const hipR = frames[i].landmarks[LM.RIGHT_HIP];
    if (!prev || !curr || !hipL || !hipR) { speeds.push(speeds[i - 1] || 0); continue; }

    const dt = Math.max(0.01, frames[i].t - frames[i - 1].t);
    const torsoScale = Math.max(0.05, Math.hypot(hipL.x - hipR.x, hipL.y - hipR.y));
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y) / torsoScale;
    speeds.push(dist / dt);
  }

  let contactIdx = 0;
  for (let i = 1; i < speeds.length; i++) {
    if (speeds[i] > speeds[contactIdx]) contactIdx = i;
  }

  const quietThreshold = Math.max(0.001, speeds[contactIdx] * 0.25);

  let stanceIdx = 0;
  for (let i = contactIdx; i >= 0; i--) {
    if (speeds[i] <= quietThreshold) { stanceIdx = i; break; }
  }

  let followThroughIdx = last;
  for (let i = contactIdx; i < speeds.length; i++) {
    if (speeds[i] <= quietThreshold && i > contactIdx) { followThroughIdx = i; break; }
  }

  // Keep the three phases in order and never let two collapse onto the
  // same frame — downstream code assumes they're distinct.
  if (stanceIdx >= contactIdx) stanceIdx = Math.max(0, contactIdx - 1);
  if (followThroughIdx <= contactIdx) followThroughIdx = Math.min(last, contactIdx + 1);

  return { stanceIdx, contactIdx, followThroughIdx, speeds, method: "motion" };
}

// Landmark index reference (MediaPipe Pose):
export const LM = {
  NOSE: 0,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};
