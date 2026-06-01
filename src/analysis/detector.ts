/**
 * Gap Detector — 16 pure functions that analyze a ProcessGraph and produce Gap lists.
 *
 * Engineering cybernetics principle: The detector is the "sensor" of the system.
 * It measures the gap between the current model and a complete model.
 */

import { ProcessGraph } from "../model/graph.js";
import type { Gap, GapType, Node } from "../model/schema.js";
import { GAP_TYPE_INFO } from "./gaps.js";
import { getConfig } from "../config.js";

// ─── Helper ───────────────────────────────────────────────────

function makeGap(type: GapType, nodeIds: string[], edgeIds: string[], description?: string): Gap {
  const info = GAP_TYPE_INFO[type];
  const painScore = 0; // updated below if nodes have pain scores
  return {
    type,
    category: info.category,
    severity: info.defaultSeverity,
    description: description ?? info.description,
    nodeIds,
    edgeIds,
    painScore,
  };
}

function avgPain(nodes: (Node | undefined)[]): number {
  const scores = nodes.filter(n => n?.painScore != null).map(n => n!.painScore!);
  if (scores.length === 0) return 0;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}

// ─── Structural Gaps ──────────────────────────────────────────

/** Nodes with incoming edges whose source nodes don't exist */
function detectMissingSource(g: ProcessGraph): Gap[] {
  const gaps: Gap[] = [];
  for (const edge of g.edges.values()) {
    if (!g.nodes.has(edge.from)) {
      const gap = makeGap("MISSING_SOURCE", [edge.to], [edge.id],
        `边 "${edge.label}" 的来源节点 "${edge.from}" 不存在`);
      gap.severity = 9;
      gaps.push(gap);
    }
  }
  return gaps;
}

/** Artifact/PRODUCES nodes without downstream consumers */
function detectMissingConsumer(g: ProcessGraph): Gap[] {
  const gaps: Gap[] = [];
  for (const node of g.nodes.values()) {
    if (node.type === "Artifact") {
      const out = g.outgoing(node.id);
      const consumed = out.some(e => e.type === "CONSUMES" || e.type === "FLOW");
      const producedTo = g.incoming(node.id).filter(e => e.type === "PRODUCES");
      if (!consumed && producedTo.length > 0) {
        const gap = makeGap("MISSING_CONSUMER", [node.id], [],
          `产出 "${node.label}" 缺少下游使用者`);
        gap.painScore = node.painScore ?? 0;
        gaps.push(gap);
      }
    }
  }
  return gaps;
}

/** Nodes with zero connections */
function detectOrphanNode(g: ProcessGraph): Gap[] {
  return g.orphans().map(node => {
    const gap = makeGap("ORPHAN_NODE", [node.id], [],
      `节点 "${node.label}" 未连接到流程中的任何其他节点`);
    gap.painScore = node.painScore ?? 0;
    return gap;
  });
}

/** Edges pointing to non-existent nodes */
function detectDanglingEdge(g: ProcessGraph): Gap[] {
  const gaps: Gap[] = [];
  for (const edge of g.edges.values()) {
    if (!g.nodes.has(edge.to)) {
      const gap = makeGap("DANGLING_EDGE", [edge.from], [edge.id],
        `边 "${edge.label}" 指向不存在的节点 "${edge.to}"`);
      gap.severity = 9;
      gaps.push(gap);
    }
  }
  return gaps;
}

// ─── Control Flow Gaps ────────────────────────────────────────

/** DecisionPoint without explicit condition */
function detectBranchWithoutCondition(g: ProcessGraph): Gap[] {
  return g.findNodesByType("DecisionPoint")
    .filter(n => !n.condition || n.condition.trim() === "")
    .map(n => {
      const gap = makeGap("BRANCH_WITHOUT_CONDITION", [n.id], [],
        `决策点 "${n.label}" 缺少分支条件`);
      gap.painScore = n.painScore ?? 0;
      return gap;
    });
}

/** Unverified cycle in graph */
function detectUnverifiedCycle(g: ProcessGraph): Gap[] {
  const cycle = g.detectCycle();
  if (!cycle) return [];
  const cycleStrs = cycle.map(id => g.getNode(id)?.label ?? id);
  const gap = makeGap("UNVERIFIED_CYCLE", cycle, [],
    `发现未验证的循环: ${cycleStrs.join(" → ")}`);
  gap.severity = 5;
  return [gap];
}

/** ProcessStep with multiple outgoing FLOW edges but no DecisionPoint */
function detectImplicitDecision(g: ProcessGraph): Gap[] {
  const gaps: Gap[] = [];
  for (const node of g.findNodesByType("ProcessStep")) {
    const outFlows = g.outgoing(node.id).filter(e => e.type === "FLOW");
    if (outFlows.length > 1) {
      // Check if there's a DecisionPoint between
      const hasDecisionBefore = outFlows.some(e => g.getNode(e.to)?.type === "DecisionPoint");
      if (!hasDecisionBefore) {
        const gap = makeGap("IMPLICIT_DECISION", [node.id], outFlows.map(e => e.id),
          `步骤 "${node.label}" 有 ${outFlows.length} 条流出的 FLOW 边但无明确的 DecisionPoint`);
        gap.painScore = node.painScore ?? 0;
        gaps.push(gap);
      }
    }
  }
  return gaps;
}

// ─── Temporal Gaps ────────────────────────────────────────────

/** ProcessStep without duration */
function detectUnspecifiedDuration(g: ProcessGraph): Gap[] {
  return g.findNodesByType("ProcessStep")
    .filter(n => !n.duration || n.duration.trim() === "")
    .map(n => {
      const gap = makeGap("UNSPECIFIED_DURATION", [n.id], [],
        `步骤 "${n.label}" 缺少处理时长信息`);
      gap.severity = n.painScore && n.painScore > 5 ? 6 : 4;
      gap.painScore = n.painScore ?? 0;
      return gap;
    });
}

/** WaitState without duration */
function detectUnspecifiedWait(g: ProcessGraph): Gap[] {
  return g.findNodesByType("WaitState")
    .filter(n => !n.waitDuration || n.waitDuration.trim() === "")
    .map(n => {
      const gap = makeGap("UNSPECIFIED_WAIT", [n.id], [],
        `等待节点 "${n.label}" 缺少等待时长`);
      gap.painScore = n.painScore ?? 0;
      return gap;
    });
}

/** Adjacent ProcessSteps with frequency mismatch */
function detectFrequencyMismatch(g: ProcessGraph): Gap[] {
  const gaps: Gap[] = [];
  for (const edge of g.edges.values()) {
    if (edge.type === "FLOW") {
      const from = g.getNode(edge.from);
      const to = g.getNode(edge.to);
      if (from?.type === "ProcessStep" && to?.type === "ProcessStep") {
        if (from.frequency && to.frequency && from.frequency !== to.frequency) {
          const gap = makeGap("FREQUENCY_MISMATCH", [from.id, to.id], [edge.id],
            `步骤 "${from.label}" (${from.frequency}) 到 "${to.label}" (${to.frequency}) 频率不一致`);
          gap.painScore = avgPain([from, to]);
          gaps.push(gap);
        }
      }
    }
  }
  return gaps;
}

/** WaitState without cause */
function detectWaitWithoutCause(g: ProcessGraph): Gap[] {
  return g.findNodesByType("WaitState")
    .filter(n => !n.waitCause || n.waitCause.trim() === "")
    .map(n => {
      const gap = makeGap("WAIT_WITHOUT_CAUSE", [n.id], [],
        `等待节点 "${n.label}" 缺少等待原因`);
      gap.painScore = n.painScore ?? 0;
      return gap;
    });
}

// ─── Organizational Gaps ──────────────────────────────────────

/** Role nodes without sufficient description or linked steps */
function detectUncharacterizedRole(g: ProcessGraph): Gap[] {
  return g.findNodesByType("Role")
    .filter(n => {
      const linkedSteps = g.outgoing(n.id).length + g.incoming(n.id).length;
      return linkedSteps === 0 || !n.description || n.description.trim() === "";
    })
    .map(n => {
      const gap = makeGap("UNCHARACTERIZED_ROLE", [n.id], [],
        `角色 "${n.label}" 缺少职责描述或关联步骤`);
      gap.painScore = n.painScore ?? 0;
      return gap;
    });
}

/** Cross-department edges where nodes lack department assignment */
function detectDepartmentBoundary(g: ProcessGraph): Gap[] {
  const gaps: Gap[] = [];
  const crossDept = g.crossDepartmentEdges();
  for (const { edge, fromDept, toDept } of crossDept) {
    const from = g.getNode(edge.from);
    const to = g.getNode(edge.to);
    if (!from?.department || !to?.department) {
      const missing = [];
      if (!from?.department) missing.push(edge.from);
      if (!to?.department) missing.push(edge.to);
      const gap = makeGap("DEPARTMENT_BOUNDARY", missing, [edge.id],
        `跨部门边 "${edge.label}" (${fromDept} → ${toDept}) 中有节点缺少部门归属`);
      gap.painScore = avgPain([from, to]);
      gaps.push(gap);
    }
  }
  return gaps;
}

/** Nodes that are single points of failure */
function detectSinglePointOfFailure(g: ProcessGraph): Gap[] {
  return g.singlePointsOfFailure().map(node => {
    const gap = makeGap("SINGLE_POINT_OF_FAILURE", [node.id], [],
      `节点 "${node.label}" 是流程必经之路，无替代路径`);
    gap.severity = 8;
    gap.painScore = node.painScore ?? 0;
    return gap;
  });
}

/** Character bigram set for lightweight label similarity. */
function bigrams(s: string): Set<string> {
  const norm = s.toLowerCase().replace(/\s+/g, "");
  const out = new Set<string>();
  if (norm.length < 2) { if (norm) out.add(norm); return out; }
  for (let i = 0; i < norm.length - 1; i++) out.add(norm.slice(i, i + 2));
  return out;
}

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Overlapping role nodes: pairs of Role nodes whose names are highly similar OR
 * which share a large fraction of the same linked process steps (ambiguous
 * responsibility boundaries). Surfaces organizational accountability gaps.
 */
function detectRoleOverlap(g: ProcessGraph): Gap[] {
  const roles = g.findNodesByType("Role");
  if (roles.length < 2) return [];

  const neighborsOf = (id: string): Set<string> => {
    const ids = new Set<string>();
    for (const e of g.outgoing(id)) ids.add(e.to);
    for (const e of g.incoming(id)) ids.add(e.from);
    return ids;
  };

  const gaps: Gap[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const a = roles[i], b = roles[j];
      const labelSim = jaccard(bigrams(a.label), bigrams(b.label));
      const na = neighborsOf(a.id), nb = neighborsOf(b.id);
      const neighborSim = na.size >= 2 && nb.size >= 2 ? jaccard(na, nb) : 0;

      if (labelSim >= 0.6 || neighborSim >= 0.5) {
        const key = [a.id, b.id].sort().join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        const reason = labelSim >= 0.6
          ? `名称高度相似（${Math.round(labelSim * 100)}%）`
          : `共享 ${Math.round(neighborSim * 100)}% 的关联步骤`;
        const gap = makeGap("ROLE_OVERLAP", [a.id, b.id], [],
          `角色 "${a.label}" 与 "${b.label}" 可能职责重叠：${reason}`);
        gap.severity = 4;
        gap.painScore = Math.max(a.painScore ?? 0, b.painScore ?? 0);
        gaps.push(gap);
      }
    }
  }
  return gaps;
}

// ─── Information Quality Gaps ─────────────────────────────────

/** Low confidence nodes/edges */
function detectLowConfidence(g: ProcessGraph): Gap[] {
  const config = getConfig();
  const threshold = 0.4;
  const gaps: Gap[] = [];
  for (const node of g.lowConfidenceNodes(threshold)) {
    const gap = makeGap("LOW_CONFIDENCE", [node.id], [],
      `节点 "${node.label}" 置信度仅 ${(node.confidence * 100).toFixed(0)}%`);
    gap.severity = node.confidence < 0.3 ? 5 : 3;
    gap.painScore = node.painScore ?? 0;
    gaps.push(gap);
  }
  for (const edge of g.lowConfidenceEdges(threshold)) {
    const gap = makeGap("LOW_CONFIDENCE", [edge.from, edge.to], [edge.id],
      `边 "${edge.label}" 置信度仅 ${(edge.confidence * 100).toFixed(0)}%`);
    gap.severity = edge.confidence < 0.3 ? 5 : 3;
    gaps.push(gap);
  }
  return gaps;
}

/** High pain score nodes without description */
function detectPainUnexplained(g: ProcessGraph): Gap[] {
  return [...g.nodes.values()]
    .filter(n => (n.painScore ?? 0) >= 6 && (!n.description || n.description.trim() === ""))
    .map(n => {
      const gap = makeGap("PAIN_UNEXPLAINED", [n.id], [],
        `节点 "${n.label}" 痛点评分 ${n.painScore} 但没有说明原因`);
      gap.severity = 4;
      gap.painScore = n.painScore ?? 0;
      return gap;
    });
}

// ─── Detector API ──────────────────────────────────────────────

export type DetectorFn = (g: ProcessGraph) => Gap[];

/** All 16 detection rules in order of execution */
export const ALL_DETECTORS: DetectorFn[] = [
  detectMissingSource,
  detectMissingConsumer,
  detectOrphanNode,
  detectDanglingEdge,
  detectBranchWithoutCondition,
  detectUnverifiedCycle,
  detectImplicitDecision,
  detectUnspecifiedDuration,
  detectUnspecifiedWait,
  detectFrequencyMismatch,
  detectWaitWithoutCause,
  detectUncharacterizedRole,
  detectDepartmentBoundary,
  detectSinglePointOfFailure,
  detectRoleOverlap,
  detectLowConfidence,
  detectPainUnexplained,
];

/** Run all detectors and return consolidated gap list */
export function detectAllGaps(g: ProcessGraph): Gap[] {
  const gaps: Gap[] = [];
  for (const detector of ALL_DETECTORS) {
    gaps.push(...detector(g));
  }
  return gaps;
}
