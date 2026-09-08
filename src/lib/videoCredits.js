const KEY = "cricket_ai_coach_video_credits_v1";
const LIMITS = { free: 3, basic: 0, pro: 3 };

function read() {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
}
function write(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }

/** Prototype-only client ledger. Production must move this check to a
 * trusted API/database transaction so users cannot reset it by clearing data. */
export function consumeVideoCredit(planTier) {
  const limit = LIMITS[planTier] ?? 0;
  if (!limit) return { allowed: false, remaining: 0 };
  const month = new Date().toISOString().slice(0, 7);
  const data = read();
  const used = data.month === month ? (data.used || 0) : 0;
  if (used >= limit) return { allowed: false, remaining: 0 };
  const next = used + 1; write({ month, used: next });
  return { allowed: true, remaining: limit - next };
}
export function getVideoCreditStatus(planTier) {
  const limit = LIMITS[planTier] ?? 0; const month = new Date().toISOString().slice(0, 7); const data=read();
  const used=data.month===month?(data.used||0):0; return {limit,used,remaining:Math.max(0,limit-used)};
}
