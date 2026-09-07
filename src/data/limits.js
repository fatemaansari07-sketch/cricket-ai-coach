// Local pose/video analysis limits. Gemini/video-generation credits are a
// separate paid resource and should be enforced server-side before production.
export const DAILY_LIMITS = { free: 5, basic: 30, pro: 30 };
export const SHOT_TYPES = {
  batting: ["Cover Drive", "Straight Drive", "Pull Shot", "Cut Shot", "Sweep Shot"],
  bowling: ["Yorker", "Bouncer", "Off Cutter", "Outswinger", "Inswinger"],
  fielding: ["Ground Fielding", "Catching", "Diving Stop", "Throw"],
};
export function needsQuotaReset(profile) {
  if (!profile?.videos_quota_reset_at) return true;
  const today = new Date().toISOString().slice(0, 10);
  return profile.videos_quota_reset_at !== today;
}
