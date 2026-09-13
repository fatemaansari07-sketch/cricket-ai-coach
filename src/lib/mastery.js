import { MASTERY_LEVELS } from "../data/masteryLevels";

export function getCurrentLevel(profile) {
  return profile?.current_level || 1;
}
export function getPassedLevels(profile) {
  return (profile?.passed_levels || []).map(String);
}
export function isLevelPassed(profile, levelId) {
  return getPassedLevels(profile).includes(String(levelId));
}
export function isLevelUnlocked(profile, levelId) {
  if (levelId === 1) return true;
  return isLevelPassed(profile, levelId - 1) || getCurrentLevel(profile) >= levelId;
}
export function levelForShotType(shotType) {
  return MASTERY_LEVELS.find((l) => l.shotTypes.includes(shotType));
}
/** Only batting has a mastery tree right now — bowling/fielding are never gated. */
export function isShotTypeLocked(profile, category, shotType) {
  if (category !== "batting") return false;
  const level = levelForShotType(shotType);
  if (!level) return false;
  return !isLevelUnlocked(profile, level.id);
}
export function checkLevelPass(levelId, score) {
  const level = MASTERY_LEVELS.find((l) => l.id === levelId);
  if (!level) return false;
  return score >= level.passScore;
}
export function firstUnlockedShotType(profile, category, shotTypes) {
  if (category !== "batting") return shotTypes[0];
  return shotTypes.find((s) => !isShotTypeLocked(profile, category, s)) || shotTypes[0];
}
