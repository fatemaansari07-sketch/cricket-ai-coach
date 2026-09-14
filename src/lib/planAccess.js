export const PLAN_TIERS = { FREE: 'free', PRO_99: 'pro_99', VIDEO_499: 'video_499', SPECIAL_COACH: 'special_coach' };
export const PLAN_ORDER = ['free', 'pro_99', 'video_499', 'special_coach'];
export const PLAN_INFO = {
  free: { name: 'Free', price: 0, visual: false, video: false, progress: false, compare: 'basic', coachChat: false },
  pro_99: { name: 'Pro', price: 99, visual: true, video: false, progress: true, compare: 'advanced', coachChat: false },
  video_499: { name: 'Video Visualization', price: 499, visual: true, video: true, progress: true, compare: 'advanced', coachChat: false },
  special_coach: { name: 'Special Coaching', price: 999, visual: true, video: true, progress: true, compare: 'advanced', coachChat: true },
};
export function normalizePlanTier(tier) {
  if (tier === 'basic') return 'pro_99';
  if (tier === 'pro' || tier === 'video_120') return 'video_499';
  return PLAN_INFO[tier] ? tier : 'free';
}
export function hasFeature(tier, feature) { return !!PLAN_INFO[normalizePlanTier(tier)]?.[feature]; }
export function canUseThreeFrameVisual(tier) { return hasFeature(tier, 'visual'); }
export function canGenerateVideo(tier) { return hasFeature(tier, 'video'); }
export function canUseCoachChat(tier) { return hasFeature(tier, 'coachChat'); }
export function isAtLeast(tier, minimum) { return PLAN_ORDER.indexOf(normalizePlanTier(tier)) >= PLAN_ORDER.indexOf(normalizePlanTier(minimum)); }
