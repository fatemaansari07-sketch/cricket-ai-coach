import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

let landmarkerPromise = null;

/**
 * Loads Google's pose-landmark model once and reuses it.
 * This is the "eyes" — it just finds where the joints are in a picture.
 * The actual cricket coaching intelligence lives in `biomechanics.js`,
 * which is 100% ours: we decide what "correct" looks like for each shot.
 */
function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
    ).then((vision) =>
      PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
          delegate: "GPU",
        },
        runningMode: "IMAGE",
        numPoses: 1,
      })
    );
  }
  return landmarkerPromise;
}

/** Grabs a single representative frame from a video file as an <img>-like canvas. */
function grabFrame(videoFile, atSeconds = null) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.src = URL.createObjectURL(videoFile);

    video.onloadedmetadata = () => {
      const target = atSeconds ?? video.duration / 2;
      video.currentTime = Math.min(target, Math.max(video.duration - 0.05, 0));
    };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0);
      URL.revokeObjectURL(video.src);
      resolve(canvas);
    };
    video.onerror = () => reject(new Error("Video load nahi hua — file format check karo (MP4/MOV)."));
  });
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
  return result.landmarks[0]; // array of 33 {x, y, z, visibility}
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
