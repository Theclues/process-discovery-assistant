/**
 * Gap Prioritizer — rank gaps by severity × pain_score × (1 - confidence).
 *
 * Engineering cybernetics: this is the control signal generator.
 * The function maps detected gaps → prioritized intervention list.
 */

import type { Gap } from "../model/schema.js";
import { ProcessGraph } from "../model/graph.js";
import { getConfig } from "../config.js";

export interface ScoredGap {
  gap: Gap;
  score: number;
}

/** Compute priority score: severity × pain_score × (1 - avg_confidence).
 *  We use max(painScore, 1) so painless gaps still get considered.
 */
export function scoreGap(gap: Gap, graph: ProcessGraph): ScoredGap {
  const painScore = Math.max(gap.painScore, 1);
  const confidences: number[] = [];
  for (const nid of gap.nodeIds) {
    const n = graph.getNode(nid);
    if (n) confidences.push(n.confidence);
  }
  for (const eid of gap.edgeIds) {
    const e = graph.getEdge(eid);
    if (e) confidences.push(e.confidence);
  }
  const avgConf = confidences.length > 0
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0.5;
  const inverseConf = 1 - avgConf;
  const score = gap.severity * painScore * inverseConf;
  return { gap, score };
}

/** Score and sort gaps by descending priority */
export function prioritizeGaps(gaps: Gap[], graph: ProcessGraph): ScoredGap[] {
  const scored = gaps.map(g => scoreGap(g, graph));
  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Filter gaps above minimum score threshold */
export function actionableGaps(
  gaps: Gap[],
  graph: ProcessGraph,
): ScoredGap[] {
  const config = getConfig();
  const scored = prioritizeGaps(gaps, graph);
  return scored.filter(s => s.score >= config.minGapScoreToAsk);
}

/** Select top N gaps for questioning, respecting consecutive question limits */
export function selectForQuestioning(
  gaps: Gap[],
  graph: ProcessGraph,
  consecutiveCount: number,
): ScoredGap[] {
  const config = getConfig();
  if (consecutiveCount >= config.consecutiveQuestionsMax) {
    return []; // must intersperse an eliciting turn
  }
  const scored = actionableGaps(gaps, graph);
  return scored.slice(0, config.questionsPerRound);
}
