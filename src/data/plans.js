export const TIERS = {
  FREE: 'free',
  PRO_99: 'pro_99',
  VIDEO_499: 'video_499',
  SPECIAL_COACH: 'special_999',
};

export const CREDIT_COSTS = { PRO_ANALYSIS: 10, VIDEO_RENDER: 10 };
export const PLAN_LIMITS = {
  free: { visual: 0, video: 0 },
  pro_99: { visual: 100, video: 0 },
  video_499: { visual: 100, video: 100 },
  special_999: { visual: 100, video: 100 },
};

export function normalizePlanTier(tier) {
  if (tier === 'basic') return 'pro_99';
  if (tier === 'pro' || tier === 'video_120') return 'video_499';
  if (tier === 'special_coach') return 'special_999';
  return PLAN_LIMITS[tier] ? tier : 'free';
}

export function hasVisualAI(tier) {
  return normalizePlanTier(tier) !== 'free';
}

export function hasVideoVisualization(tier) {
  const t = normalizePlanTier(tier);
  return t === 'video_499' || t === 'special_999';
}
