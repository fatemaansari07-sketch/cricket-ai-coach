/* Grabs N evenly spaced JPEG frames (with their timestamps) from a video file.
   Used by Pro Deep Scan: sending ~12 small pictures to the AI is far faster and
   more reliable than uploading the whole video. */
export async function sampleFramesForAI(file, { count = 12, width = 512, quality = 0.6 } = {}) {
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto";
  const url = URL.createObjectURL(file); video.src = url;
  try {
    await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error("Video load nahi hua")); });
    const dur = video.duration;
    if (!dur || !video.videoWidth) throw new Error("Video ki length nahi mili");
    const w = Math.min(width, video.videoWidth);
    const h = Math.round(w * (video.videoHeight / video.videoWidth));
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    const frames = [];
    for (let k = 0; k < count; k++) {
      const t = Math.min(dur - 0.05, Math.max(0, ((k + 0.5) / count) * dur));
      await new Promise((resolve) => {
        const done = () => { video.removeEventListener("seeked", done); resolve(); };
        video.addEventListener("seeked", done, { once: true });
        video.currentTime = t;
        setTimeout(done, 1500);
      });
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      frames.push({ t: Number(video.currentTime.toFixed(2)), b64: dataUrl.split(",")[1] });
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
  }
}
