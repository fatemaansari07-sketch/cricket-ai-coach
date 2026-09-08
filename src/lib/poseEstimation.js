import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";
import { detectBallCandidate } from "./ballTracking";

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
 * FIX: "skeleton jumps to whoever walks into frame" bug — MediaPipe was
 * only asked for 1 person and just returns whoever it's most confident
 * about, which switches to a bowler/fielder walking past the camera.
 * Now we ask for up to 3 people (numPoses: 3 above) and pick which one is
 * OUR player ourselves: most centered+largest on the first frame, then
 * whoever stays closest to that locked position on every frame after.
 */
function personCentroid(landmarks) {
  const l = landmarks[LM.LEFT_HIP], r = landmarks[LM.RIGHT_HIP];
  if (!l || !r) return null;
  return { x: (l.x + r.x) / 2, y: (l.y + r.y) / 2 };
}
function personSize(landmarks) {
  const pts = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP].map((i) => landmarks[i]).filter(Boolean);
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
    let best = scored[0], bestScore = -Infinity;
    for (const c of scored) {
      const score = c.size - Math.abs(c.centroid.x - 0.5);
      if (score > bestScore) { bestScore = score; best = c; }
    }
    return best;
  }
  let best = scored[0], bestDist = Infinity;
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

    // ROOT-CAUSE FIX for "stance/impact/follow-through galat hai": the old
    // version SEEKS to N target timestamps (video.currentTime = t). Real
    // phone video seeking snaps to the nearest keyframe, which can be a
    // full second away from the time you asked for — so the frames being
    // measured were often NOT actually at the moment they claimed to be,
    // no matter how good the phase-detection math was.
    //
    // Fix: PLAY the video and read frames via requestVideoFrameCallback
    // (rVFC), which hands back the REAL decoded frame with its accurate
    // `mediaTime` — not a timestamp we merely hoped landed correctly.
    const canvas = document.createElement("canvas");
    let ctx = null;
    const frames = [];
    let lockedCentroid = null; // keeps the same player tracked across frames
    let previousBall = null;

    const supportsRVFC = typeof video.requestVideoFrameCallback === "function";

    if (supportsRVFC) {
      await new Promise((resolve, reject) => {
        const hardStop = setTimeout(() => resolve(), 25000);
        let done = false;
        const finish = () => { if (done) return; done = true; clearTimeout(hardStop); video.pause(); resolve(); };
        video.onerror = () => { clearTimeout(hardStop); reject(new Error("Video play nahi ho paya — file format check karo.")); };

        const onFrame = (_now, metadata) => {
          if (done) return;
          const t = metadata.mediaTime;

          if (t >= duration * 0.08 && t <= duration * 0.95) {
            if (!ctx) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; ctx = canvas.getContext("2d"); }
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const result = landmarker.detect(canvas);
            const ball = detectBallCandidate(canvas, previousBall, { requireBallColor: true, roi: { xMin: 0.06, xMax: 0.94, yMin: 0.05, yMax: 0.96 } });
            if (ball) previousBall = ball;
            if (result.landmarks && result.landmarks.length > 0) {
              const picked = pickTrackedPerson(result.landmarks, lockedCentroid);
              if (picked) {
                frames.push({ t, landmarks: picked.landmarks, ball });
                lockedCentroid = picked.centroid;
              }
            }
          }

          if (video.ended || t >= duration * 0.95) { finish(); return; }
          video.requestVideoFrameCallback(onFrame);
        };

        video.requestVideoFrameCallback(onFrame);
        video.playbackRate = 0.75; // gives the pose model more time per frame on weaker phones
        video.play().catch((err) => { clearTimeout(hardStop); reject(err); });
      });

      // rVFC delivers roughly every rendered frame (200-400+ for a 10-15s
      // clip) — thin down to ~numFrames evenly spread, keeping any
      // Gemini-hinted moments if we landed close to them.
      if (frames.length > numFrames) {
        const thinned = [];
        const strideStep = (frames.length - 1) / (numFrames - 1);
        for (let i = 0; i < numFrames; i++) thinned.push(frames[Math.round(i * strideStep)]);

        if (hintTimestamps) {
          for (const hint of [hintTimestamps.stanceSec, hintTimestamps.contactSec, hintTimestamps.followThroughSec]) {
            if (typeof hint !== "number") continue;
            let closest = frames[0], bestDiff = Infinity;
            for (const f of frames) { const d = Math.abs(f.t - hint); if (d < bestDiff) { bestDiff = d; closest = f; } }
            if (!thinned.includes(closest)) thinned.push(closest);
          }
        }
        return Array.from(new Map(thinned.map((f) => [f.t, f])).values()).sort((a, b) => a.t - b.t);
      }
      return frames;
    }

    // Fallback for browsers without requestVideoFrameCallback (rare).
    const start = duration * 0.1;
    const end = duration * 0.9;
    const step = numFrames > 1 ? (end - start) / (numFrames - 1) : 0;
    const timestamps = Array.from({ length: numFrames }, (_, i) => start + step * i);

    for (const t of timestamps) {
      const frameCanvas = await new Promise((resolve, reject) => {
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

      if (!frameCanvas) continue;
      const result = landmarker.detect(frameCanvas);
      const ball = detectBallCandidate(frameCanvas, previousBall, { requireBallColor: true, roi: { xMin: 0.06, xMax: 0.94, yMin: 0.05, yMax: 0.96 } });
      if (ball) previousBall = ball;
      if (result.landmarks && result.landmarks.length > 0) {
        const picked = pickTrackedPerson(result.landmarks, lockedCentroid);
        if (picked) {
          frames.push({ t, landmarks: picked.landmarks, ball });
          lockedCentroid = picked.centroid;
        }
      }
    }

    return frames;
  } finally {
    cleanup();
  }
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
