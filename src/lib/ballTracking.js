/** Lightweight, dependency-free cricket ball candidate tracker.
 * It is intentionally conservative: when the camera/background makes the
 * ball ambiguous, it returns null instead of inventing a trajectory.
 */
export function detectBallCandidate(canvas, previous = null) {
  if (!canvas) return null;
  const maxW = 320;
  const scale = Math.min(1, maxW / canvas.width);
  const w = Math.max(1, Math.round(canvas.width * scale));
  const h = Math.max(1, Math.round(canvas.height * scale));
  const small = document.createElement("canvas");
  small.width = w; small.height = h;
  const ctx = small.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const visited = new Uint8Array(w * h);
  const candidates = [];
  const isBright = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx > 175 && mx - mn < 65;
  };
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let y = 1; y < h - 1; y += 2) {
    for (let x = 1; x < w - 1; x += 2) {
      const idx = y * w + x;
      if (visited[idx] || !isBright(idx * 4)) continue;
      const q = [[x, y]]; visited[idx] = 1;
      let count = 0, sx = 0, sy = 0, minX = x, maxX = x, minY = y, maxY = y;
      while (q.length && count < 180) {
        const [cx, cy] = q.pop(); count++; sx += cx; sy += cy;
        minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
        minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
        for (const [dx, dy] of dirs) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 1 || nx >= w - 1 || ny < 1 || ny >= h - 1) continue;
          const ni = ny * w + nx;
          if (!visited[ni] && isBright(ni * 4)) { visited[ni] = 1; q.push([nx, ny]); }
        }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      const compact = Math.min(bw, bh) / Math.max(bw, bh);
      if (count >= 2 && count <= 90 && bw <= 18 && bh <= 18 && compact >= 0.45) {
        candidates.push({ x: sx / count / w, y: sy / count / h, area: count, compact });
      }
    }
  }
  if (!candidates.length) return null;
  let best = null, bestScore = -Infinity;
  for (const c of candidates) {
    let score = c.compact * 2 + Math.min(c.area / 20, 2);
    if (previous) {
      const d = Math.hypot(c.x - previous.x, c.y - previous.y);
      // Prefer candidates that continue the previous trajectory, but don't
      // reject a new candidate if the ball moved a long distance.
      score += Math.max(0, 2.5 - d * 5);
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best ? { x: best.x, y: best.y, confidence: Math.min(1, bestScore / 6) } : null;
}

export function smoothBallTrack(points) {
  const valid = points.filter(Boolean);
  if (valid.length < 2) return valid;
  return points.map((p, i) => {
    if (p) return p;
    let a = i - 1; while (a >= 0 && !points[a]) a--;
    let b = i + 1; while (b < points.length && !points[b]) b++;
    if (a < 0 || b >= points.length) return null;
    const t = (i - a) / (b - a);
    return { x: points[a].x + (points[b].x - points[a].x) * t, y: points[a].y + (points[b].y - points[a].y) * t, confidence: Math.min(points[a].confidence, points[b].confidence) * 0.75 };
  });
}
