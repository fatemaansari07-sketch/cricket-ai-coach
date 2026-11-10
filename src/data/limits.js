// Local MediaPipe analysis limits. Paid AI/video credits are separate.
export const DAILY_LIMITS = { free: 5, pro_99: 30, video_499: 30, special_coach: 30 };
export const FREE_BATTING_SHOTS = [
  "Cover Drive", "Straight Drive", "On Drive", "Off Drive",
  "Pull Shot", "Square Cut", "Mid-Wicket Drive"
];
export const SHOT_TYPES = {
  batting: FREE_BATTING_SHOTS,
  bowling: ["Fast Bowling", "Inswinger", "Outswinger", "Yorker", "Bouncer", "Off Cutter", "Leg Cutter", "Spin Bowling"],
  fielding: ["Ground Fielding", "Catching", "Diving Stop", "Throw"],
};
export function needsQuotaReset(profile) {
  if (!profile?.videos_quota_reset_at) return true;
  const today = new Date().toISOString().slice(0, 10);
  return profile.videos_quota_reset_at !== today;
}
