// Free tier is intentionally local-first: MediaPipe only, no Gemini/paid API call.
export const DAILY_LIMITS = { free: 5, pro_99: 30, video_499: 30, special_999: 30 };
export const FREE_SHOTS = ["Cover Drive", "Straight Drive", "On Drive", "Off Drive", "Cut Shot", "Pull Shot"];
export const SHOT_TYPES = {
  batting: FREE_SHOTS,
  bowling: ["Yorker", "Bouncer", "Off Cutter", "Outswinger", "Inswinger", "In Swing", "Slower Ball"],
  fielding: ["Ground Fielding", "Catching", "Diving Stop", "Throw"],
};
export function needsQuotaReset(profile) {
  if (!profile?.videos_quota_reset_at) return true;
  return profile.videos_quota_reset_at !== new Date().toISOString().slice(0, 10);
}
