/* Real ball tracking from video motion (runs in the browser, free — no API cost).

   How it works:
   1. Video is sampled frame-by-frame (~25-30 fps) at small size, grayscale.
   2. Three-frame differencing: a pixel counts as "moving at time t" only if it
      changed between t-1 -> t AND t -> t+1. That isolates small fast objects
      (the ball) from slow/static background.
   3. Small, compact moving blobs are ball candidates.
   4. Candidates are linked into chains that follow a physically sensible path
      (steady velocity, allowing a bounce where vertical velocity flips).
   5. The best chain becomes the ball track. If no convincing chain exists we
      return NO track — we never invent a path.

   findBallTrack() is pure (testable without a browser). */

import { buildBallTrajectory } from "./ballTracking";

const DIFF_T = 20;

export function findBallTrack(grays, w, h, times) {
  const n = grays.length;
  if (n < 8) return null;
  const maxArea = Math.max(14, Math.round(w * h * 0.0016));
  const maxSide = Math.max(6, Math.round(w * 0.05));
  const cands = new Array(n).fill(null).map(() => []);

  const mask = new Uint8Array(w * h);
  const seen = new Uint8Array(w * h);
  for (let t = 1; t < n - 1; t++) {
    const a = grays[t - 1], b = grays[t], c = grays[t + 1];
    let moving = 0;
    for (let i = 0; i < w * h; i++) {
      const m = Math.abs(b[i] - a[i]) > DIFF_T && Math.abs(c[i] - b[i]) > DIFF_T ? 1 : 0;
      mask[i] = m; moving += m;
    }
    seen.fill(0);
    if (moving > w * h * 0.2) continue; // camera shake / scene cut
    const list = cands[t];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const s = y * w + x;
        if (!mask[s] || seen[s]) continue;
        const stack = [s]; seen[s] = 1;
        let cnt = 0, sx = 0, sy = 0, minX = x, maxX = x, minY = y, maxY = y, big = false;
        while (stack.length) {
          const p = stack.pop(); const px = p % w, py = (p - px) / w;
          cnt++; sx += px; sy += py;
          if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
          if (cnt > maxArea) { big = true; }
          const nb = [p - 1, p + 1, p - w, p + w];
          for (const q of nb) { if (q >= 0 && q < w * h && mask[q] && !seen[q]) { seen[q] = 1; if (!big) stack.push(q); } }
          if (big) { stack.length = 0; }
        }
        if (big || cnt < 2) continue;
        const bw = maxX - minX + 1, bh = maxY - minY + 1;
        if (bw > maxSide || bh > maxSide) continue;
        const compact = Math.min(bw, bh) / Math.max(bw, bh);
        const fill = cnt / (bw * bh);
        if (compact < 0.3 || fill < 0.35) continue;
        if (list.length < 25) list.push({ x: sx / cnt, y: sy / cnt, area: cnt });
      }
    }
  }

  // ---- chain linking ----
  const maxStep = w * 0.16, minStep = Math.max(1.2, w * 0.006);
  let best = null, bestScore = 0;
  for (let i = 1; i < n - 5; i++) {
    for (const s of cands[i]) {
      for (let g = 1; g <= 2; g++) {
        const j = i + g; if (j >= n - 1) continue;
        for (const s2 of cands[j]) {
          const dx = s2.x - s.x, dy = s2.y - s.y, d = Math.hypot(dx, dy);
          if (d > maxStep * g || d < minStep * g) continue;
          const chain = extend([{ ...s, f: i }, { ...s2, f: j }], cands, n, w, maxStep, minStep);
          const sc = scoreChain(chain, w);
          if (sc > bestScore) { bestScore = sc; best = chain; }
        }
      }
    }
  }
  if (!best || best.length < 6 || bestScore < 7) return null;

  // normalise + fill gaps (linear) so the drawn line is continuous
  const pts = [];
  for (let k = 0; k < best.length; k++) {
    const p = best[k];
    if (k > 0) {
      const q = best[k - 1];
      for (let f = q.f + 1; f < p.f; f++) {
        const u = (f - q.f) / (p.f - q.f);
        pts.push({ x: (q.x + (p.x - q.x) * u) / w, y: (q.y + (p.y - q.y) * u) / h, t: times[f], interpolated: true });
      }
    }
    pts.push({ x: p.x / w, y: p.y / h, t: times[p.f] });
  }
  const real = best.length;
  return { points: pts, confidence: real >= 12 ? "high" : real >= 8 ? "medium" : "low", detections: real };
}

function extend(chain, cands, n, w, maxStep, minStep) {
  let vx = (chain[1].x - chain[0].x) / (chain[1].f - chain[0].f);
  let vy = (chain[1].y - chain[0].y) / (chain[1].f - chain[0].f);
  let misses = 0, last = chain[1], bounced = false;
  for (let f = last.f + 1; f < n - 1 && misses < 3; f++) {
    const gap = f - last.f;
    const hyps = [[last.x + vx * gap, last.y + vy * gap, false]];
    if (chain.length >= 4 && !bounced) hyps.push([last.x + vx * gap, last.y - vy * 0.7 * gap, true]);
    let pick = null, pickD = Infinity, pickBounce = false;
    const speed = Math.hypot(vx, vy);
    const tol = Math.max(w * 0.025, speed * 0.45 * gap);
    for (const c of cands[f]) {
      for (const [px, py, isB] of hyps) {
        const d = Math.hypot(c.x - px, c.y - py);
        const step = Math.hypot(c.x - last.x, c.y - last.y);
        if (d <= tol && step >= minStep * gap && step <= maxStep * gap && d < pickD) { pick = c; pickD = d; pickBounce = isB; }
      }
    }
    if (pick) {
      const nvx = (pick.x - last.x) / gap, nvy = (pick.y - last.y) / gap;
      if (pickBounce) { bounced = true; vx = nvx; vy = nvy; } else { vx = vx * 0.5 + nvx * 0.5; vy = vy * 0.5 + nvy * 0.5; }
      last = { ...pick, f }; chain.push(last); misses = 0;
    } else misses++;
  }
  return chain;
}

function scoreChain(chain, w) {
  if (chain.length < 4) return 0;
  let path = 0;
  for (let i = 1; i < chain.length; i++) path += Math.hypot(chain[i].x - chain[i - 1].x, chain[i].y - chain[i - 1].y);
  const disp = Math.hypot(chain.at(-1).x - chain[0].x, chain.at(-1).y - chain[0].y);
  if (disp < w * 0.12) return 0; // a ball in flight covers real distance
  const straight = disp / Math.max(1, path);
  if (straight < 0.55) return 0; // jittery wandering noise, not a ball
  return chain.length + (disp / w) * 6;
}

// ---- browser part: grab frames ----
export async function detectBallInVideo(file, { onProgress, maxFrames = 260, width = 320 } = {}) {
  if (!file || typeof document === "undefined") return emptyTrack();
  const video = document.createElement("video");
  video.muted = true; video.playsInline = true; video.preload = "auto";
  const url = URL.createObjectURL(file); video.src = url;
  try {
    await new Promise((res, rej) => { video.onloadedmetadata = res; video.onerror = () => rej(new Error("video load")); });
    const dur = Math.min(video.duration || 0, 20);
    if (!dur || !video.videoWidth) return emptyTrack();
    const w = Math.min(width, video.videoWidth);
    const h = Math.max(2, Math.round(w * (video.videoHeight / video.videoWidth)));
    const count = Math.min(maxFrames, Math.max(10, Math.floor(dur * 30)));
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const grays = [], times = [];
    for (let k = 0; k < count; k++) {
      const t = Math.min((k / count) * dur, Math.max(0, dur - 0.03));
      await new Promise((resolve) => {
        const done = () => { video.removeEventListener("seeked", done); resolve(); };
        video.addEventListener("seeked", done, { once: true });
        video.currentTime = t;
        setTimeout(done, 1500);
      });
      ctx.drawImage(video, 0, 0, w, h);
      const { data } = ctx.getImageData(0, 0, w, h);
      const g = new Uint8Array(w * h);
      for (let i = 0, p = 0; i < g.length; i++, p += 4) g[i] = (data[p] * 77 + data[p + 1] * 150 + data[p + 2] * 29) >> 8;
      grays.push(g); times.push(video.currentTime);
      if (onProgress && k % 10 === 0) onProgress(Math.round((k / count) * 100));
    }
    const found = findBallTrack(grays, w, h, times);
    if (!found) return emptyTrack();
    const trajectory = buildBallTrajectory(found.points);
    return { points: found.points, trajectory, speed: null, confidence: found.confidence, detections: found.detections, source: "motion" };
  } catch {
    return emptyTrack();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function emptyTrack() {
  return { points: [], trajectory: buildBallTrajectory([]), speed: null, confidence: "low", source: "motion" };
}
