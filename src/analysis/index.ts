export { GAP_TYPE_INFO, getGapInfo, gapsByCategory } from "./gaps.js";
export type { GapTypeInfo } from "./gaps.js";
export { detectAllGaps, ALL_DETECTORS } from "./detector.js";
export type { DetectorFn } from "./detector.js";
export { prioritizeGaps, actionableGaps, selectForQuestioning, scoreGap } from "./prioritizer.js";
export type { ScoredGap } from "./prioritizer.js";
