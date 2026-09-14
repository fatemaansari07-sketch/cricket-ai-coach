export const TIERS = {
  FREE: "free",
  PRO_99: "pro_99",
  VIDEO_499: "video_499",
  SPECIAL_999: "special_999",
};

export const PLAN_META = {
  free: { name: "Free", price: "₹0", visualCredits: 0, videoCredits: 0 },
  pro_99: { name: "Pro", price: "₹99", visualCredits: 100, videoCredits: 0 },
  video_499: { name: "Video Visualization", price: "₹499", visualCredits: 100, videoCredits: 100 },
  special_999: { name: "Special Coaching", price: "₹999", visualCredits: 100, videoCredits: 100 },
};

export const CREDIT_COSTS = {
  PRO_VISUAL: 10,
  VIDEO_RENDER: 10,
};

export const isPro99 = (tier) => tier === TIERS.PRO_99;
export const hasVisualAI = (tier) => [TIERS.PRO_99, TIERS.VIDEO_499, TIERS.SPECIAL_999].includes(tier);
export const hasVideoVisualization = (tier) => [TIERS.VIDEO_499, TIERS.SPECIAL_999].includes(tier);
export const hasSpecialCoaching = (tier) => tier === TIERS.SPECIAL_999;
