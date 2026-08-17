// Free tier: 10 focused single-shot analyses/day (short clips, ad-supported).
// Paid tiers are generous/effectively unlimited for normal use.
export const DAILY_LIMITS = { free: 10, basic: 30, pro: 100 };

export const SHOT_TYPES = {
  batting: ["Cover Drive", "Straight Drive", "Pull Shot", "Cut Shot", "Sweep Shot"],
  bowling: ["Yorker", "Bouncer", "Off Cutter", "Outswinger", "Inswinger"],
  fielding: ["Ground Fielding", "Catching", "Diving Stop", "Throw"],
};

/** True if a fresh calendar day has started since the profile's last reset. */
export function needsQuotaReset(profile) {
  if (!profile?.videos_quota_reset_at) return true;
  const today = new Date().toISOString().slice(0, 10);
  return profile.videos_quota_reset_at !== today;
}
