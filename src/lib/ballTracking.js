/** Lightweight, dependency-free cricket ball candidate tracker.
 * It is intentionally conservative: when the camera/background makes the
 * ball ambiguous, it returns null instead of inventing a trajectory.
 *
 * `options.roi` restricts the search to a normalized (0-1) box of the
 * frame — e.g. the pitch corridor for the Speed Gun, so a car or person
 * moving near the edges of the shot can never be mistaken for the ball.
 *
 * `options.requireBallColor` additionally requires the blob to be either
 * near-white/cream (a white/pink cricket ball) or reddish (a red leather
 * ball) — not just "bright", which used to match car headlights, skin,
 * or any pale background patch.
 */
export function detectBallCandidate(canvas, previous = null, options = {}) {
  if (!canvas) return null;
  const roi = options.roi || { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
  const requireBallColor = !!options.requireBallColor;

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

  const xLo = Math.round(roi.xMin * w), xHi = Math.round(roi.xMax * w);
  const yLo = Math.round(roi.yMin * h), yHi = Math.round(roi.yMax * h);

  const isWhiteBall = (r, g, b) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return mx > 175 && mx - mn < 65;
  };
  const isRedBall = (r, g, b) => r > 110 && r - g > 40 && r - b > 40;
  const matchesBall = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    if (requireBallColor) return isWhiteBall(r, g, b) || isRedBall(r, g, b);
    return isWhiteBall(r, g, b); // looser check used by pose-analysis ball tracking
  };

  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let y = Math.max(1, yLo); y < Math.min(h - 1, yHi); y += 2) {
    for (let x = Math.max(1, xLo); x < Math.min(w - 1, xHi); x += 2) {
      const idx = y * w + x;
      if (visited[idx] || !matchesBall(idx * 4)) continue;
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
          if (!visited[ni] && matchesBall(ni * 4)) { visited[ni] = 1; q.push([nx, ny]); }
        }
      }
      const bw = maxX - minX + 1, bh = maxY - minY + 1;
      const compact = Math.min(bw, bh) / Math.max(bw, bh);
      const minCompact = requireBallColor ? 0.6 : 0.45; // stricter "must look round" when it matters for speed
      if (count >= 2 && count <= 90 && bw <= 18 && bh <= 18 && compact >= minCompact) {
        candidates.push({ x: sx / count / w, y: sy / count / h, area: count, compact, radiusFrac: Math.sqrt(count / (w * h) / Math.PI) });
      }
    }
  }
  if (!candidates.length) return null;

  let best = null, bestScore = -Infinity;
  for (const c of candidates) {
    let score = c.compact * 2 + Math.min(c.area / 20, 2);
    if (previous) {
      const d = Math.hypot(c.x - previous.x, c.y - previous.y);
      score += Math.max(0, 2.5 - d * 5);
      if (requireBallColor) {
        // A real ball's apparent size changes gradually frame to frame.
        // A sudden 3x+ jump in size is almost always a DIFFERENT object
        // (a car, a hand) getting picked up, not the same ball — reject it.
        const ratio = c.area / Math.max(1, previous.area);
        if (ratio > 3 || ratio < 0.33) score -= 10;
      }
    }
    if (score > bestScore) { bestScore = score; best = c; }
  }
  if (requireBallColor && bestScore < 1.5) return null; // too weak a match to trust for a speed reading
  return best ? { x: best.x, y: best.y, area: best.area, radiusFrac: best.radiusFrac, confidence: Math.min(1, bestScore / 6) } : null;
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

/**
 * SPEED-GUN FIX ("211 km/h from a passing car" bug).
 *
 * The old formula only measured HOW LONG something bright stayed on
 * screen, then divided a fixed assumed pitch distance by that time — it
 * never checked whether the tracked blob actually behaved like a ball
 * coming toward the camera. A car crossing the frame for 200ms produced
 * exactly this kind of nonsense reading.
 *
 * A ball bowled AT the camera has one distinctive, checkable signature:
 * its apparent size in the frame grows steadily as it gets closer. This
 * function requires that signature — a real approach trend across enough
 * samples — before it will report a number at all, and hard-caps the
 * result to a physically realistic bowling-speed range so an isolated
 * bad reading can't slip through as "211 km/h".
 *
 * `samples`: array of { t (ms), radiusFrac } from consecutive
 * detectBallCandidate() calls during one tracked delivery.
 * `distanceMeters`: the user-selected pitch/run-up distance.
 * Returns { kmh, confidence } or null if the evidence doesn't hold up.
 */
export function estimateDeliverySpeedKmh(samples, distanceMeters) {
  const clean = samples.filter((s) => s && s.radiusFrac > 0);
  if (clean.length < 5) return null; // not enough evidence to trust any number

  const first = clean[0], last = clean[clean.length - 1];
  const seconds = (last.t - first.t) / 1000;
  if (seconds < 0.15 || seconds > 3) return null; // too short to be real flight time, or too long (lost/re-found the ball)

  // Growth check: a ball coming at the camera should be noticeably bigger
  // at the end than the start. Require at least 30% growth — filters out
  // sideways-moving objects (cars, hands) that don't approach the lens.
  const growth = last.radiusFrac / Math.max(0.0001, first.radiusFrac);
  if (growth < 1.3) return null;

  // Monotonicity check: allow a little noise, but the overall trend must
  // be growing, not jumping around (which would suggest we re-latched
  // onto a different object partway through).
  let reversals = 0;
  for (let i = 1; i < clean.length; i++) {
    if (clean[i].radiusFrac < clean[i - 1].radiusFrac * 0.85) reversals++;
  }
  if (reversals > Math.ceil(clean.length * 0.3)) return null;

  const kmh = (distanceMeters / seconds) * 3.6;

  // Hard-capped to realistic human bowling speed — anything outside this
  // is reported as "no reliable reading" instead of a guessed number.
  if (kmh < 40 || kmh > 165) return null;

  const confidence = clean.length >= 8 && reversals === 0 ? "high" : clean.length >= 6 ? "medium" : "low";
  return { kmh: Math.round(kmh), confidence };
}

/**
 * BALL TRAJECTORY FIX (straight jagged line -> real bounce arc).
 *
 * Fits a separate parabola (y = a*x² + b*x + c, in normalized 0-1 screen
 * space) to the points BEFORE the bounce and the points AFTER it, instead
 * of connecting raw noisy detections with straight dashed segments. This
 * is what actually produces the smooth "comes down, hits the pitch,
 * kicks back up toward the batsman" arc instead of a jittery zig-zag.
 */
function fitParabola(points) {
  const n = points.length;
  if (n < 3) return null;
  // Least-squares fit for y = a*x^2 + b*x + c
  let Sx=0,Sx2=0,Sx3=0,Sx4=0,Sy=0,Sxy=0,Sx2y=0;
  for (const p of points) {
    const x=p.x, y=p.y, x2=x*x;
    Sx+=x; Sx2+=x2; Sx3+=x2*x; Sx4+=x2*x2; Sy+=y; Sxy+=x*y; Sx2y+=x2*y;
  }
  // Solve the 3x3 normal-equations system directly (Cramer's rule).
  const A = [[Sx4,Sx3,Sx2],[Sx3,Sx2,Sx],[Sx2,Sx,n]];
  const B = [Sx2y,Sxy,Sy];
  const det3 = (m) => m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1]) - m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0]) + m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
  const D = det3(A);
  if (Math.abs(D) < 1e-9) return null;
  const withCol = (col) => A.map((row, i) => row.map((v, j) => (j === col ? B[i] : v)));
  const a = det3(withCol(0)) / D, b = det3(withCol(1)) / D, c = det3(withCol(2)) / D;
  return { a, b, c, evaluate: (x) => a*x*x + b*x + c };
}

/**
 * Given the full, de-duplicated ball trail for a clip, returns a smooth
 * trajectory description: the bounce point (if any) and one or two fitted
 * arc curves (pre-bounce / post-bounce) ready to be drawn.
 */
export function buildBallTrajectory(trail) {
  const pts = trail.filter(Boolean);
  if (pts.length < 4) return { bounceIndex: -1, curves: [], points: pts };

  // Bounce = the point where the ball is at its lowest on screen (largest
  // y) and clearly turns back upward on both sides — found on a smoothed
  // signal so single noisy detections don't get mistaken for the bounce.
  const smoothY = pts.map((_, i) => {
    const win = pts.slice(Math.max(0, i - 1), Math.min(pts.length, i + 2));
    return win.reduce((s, p) => s + p.y, 0) / win.length;
  });
  let bounceIndex = -1, maxY = -Infinity;
  for (let i = 1; i < pts.length - 1; i++) {
    if (smoothY[i] > smoothY[i - 1] && smoothY[i] >= smoothY[i + 1] && smoothY[i] > maxY) {
      maxY = smoothY[i]; bounceIndex = i;
    }
  }

  const curves = [];
  if (bounceIndex > 1) {
    const before = fitParabola(pts.slice(0, bounceIndex + 1));
    if (before) curves.push({ from: pts[0].x, to: pts[bounceIndex].x, fn: before });
  }
  const afterStart = bounceIndex > 1 ? bounceIndex : 0;
  if (pts.length - afterStart >= 3) {
    const after = fitParabola(pts.slice(afterStart));
    if (after) curves.push({ from: pts[afterStart].x, to: pts[pts.length - 1].x, fn: after });
  }
  if (curves.length === 0) {
    // Not enough points to fit two segments — one smooth curve over everything.
    const whole = fitParabola(pts);
    if (whole) curves.push({ from: pts[0].x, to: pts[pts.length - 1].x, fn: whole });
  }

  return { bounceIndex, curves, points: pts };
}
