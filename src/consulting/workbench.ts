import { detectAllGaps } from "../analysis/detector.js";
import { ProcessGraph } from "../model/graph.js";
import { getConfig } from "../config.js";
import type { Deliverable, Finding, Hypothesis, SessionData } from "../model/schema.js";
import {
  createDeliverable,
  getEngagement,
  listDeliverables,
  listFindings,
  listHypotheses,
  listSessionsByEngagement,
  listSessionsByOrg,
  replaceFindings,
  upsertHypothesis,
} from "../storage/database.js";
import { generateReport } from "../viz/report.js";
import {
  buildEvidenceBrief,
  synthesizeHypotheses,
  synthesizeFindings,
  synthesizeDeliverable,
} from "./synthesizer.js";

export interface ConsultingWorkbench {
  engagementId: string;
  stats: {
    sessions: number;
    nodes: number;
    edges: number;
    gaps: number;
    hypotheses: number;
    findings: number;
    deliverables: number;
  };
  hypotheses: Hypothesis[];
  findings: Finding[];
  deliverables: Deliverable[];
}

/**
 * Evidence sessions for an engagement.
 *
 * Product model: process knowledge is gathered org-wide by employees and
 * managers via self-service AI interviews (these sessions are org-scoped, with
 * no engagementId). A consultant's diagnostic engagement must analyse that
 * whole org evidence pool — not only the sessions the consultant personally
 * started. So we resolve evidence by the engagement's organization, falling
 * back to engagement-scoped sessions only when org context is unavailable.
 */
function sessionsForEngagement(engagementId: string): SessionData[] {
  const engagement = getEngagement(engagementId);
  if (engagement?.organizationId) {
    const orgSessions = listSessionsByOrg(engagement.organizationId);
    if (orgSessions.length > 0) return orgSessions;
  }
  return listSessionsByEngagement(engagementId);
}

function mergeGraphs(sessions: SessionData[]): ProcessGraph {
  const config = getConfig();
  const merged = new ProcessGraph("Engagement Diagnostic", {
    maxNodes: config.maxEnterpriseNodes,
    maxEdges: config.maxEnterpriseEdges,
  });
  for (const session of sessions) {
    const graph = ProcessGraph.fromData(session.graph);
    for (const node of graph.nodes.values()) {
      // Guard against the (high) enterprise ceiling: degrade gracefully, never crash.
      if (!merged.getNode(node.id)) { try { merged.addNode(node); } catch { break; } }
    }
    for (const edge of graph.edges.values()) {
      if (!merged.getEdge(edge.id)) {
        try { merged.addEdge(edge); } catch { /* edge ceiling reached */ }
      }
    }
  }
  return merged;
}

export function getWorkbench(engagementId: string): ConsultingWorkbench {
  const sessions = sessionsForEngagement(engagementId);
  const graph = mergeGraphs(sessions);
  const gaps = detectAllGaps(graph);
  const hypotheses = listHypotheses(engagementId);
  const findings = listFindings(engagementId);
  const deliverables = listDeliverables(engagementId);

  return {
    engagementId,
    stats: {
      sessions: sessions.length,
      nodes: graph.nodeCount(),
      edges: graph.edgeCount(),
      gaps: gaps.length,
      hypotheses: hypotheses.length,
      findings: findings.length,
      deliverables: deliverables.length,
    },
    hypotheses,
    findings,
    deliverables,
  };
}

export async function generateHypotheses(engagementId: string): Promise<Hypothesis[]> {
  const sessions = sessionsForEngagement(engagementId);
  const graph = mergeGraphs(sessions);
  const gaps = detectAllGaps(graph);
  const evidenceSessionIds = sessions.map(s => s.id);
  const existing = listHypotheses(engagementId);

  // Preferred path: LLM-driven, McKinsey-style hypothesis generation.
  if (graph.nodeCount() > 0) {
    const report = generateReport(graph, gaps);
    const brief = buildEvidenceBrief(getEngagement(engagementId), sessions, graph, gaps, report);
    const synth = await synthesizeHypotheses(brief);
    if (synth && synth.length) {
      return synth.map(s => {
        const matched = existing.find(h => h.statement === s.statement);
        const rationale = s.testApproach ? `${s.rationale}\n\n验证方式：${s.testApproach}` : s.rationale;
        return upsertHypothesis({
          id: matched?.id,
          engagementId,
          statement: s.statement,
          rationale,
          status: matched?.status ?? "open",
          confidence: s.confidence,
          evidenceSessionIds,
        });
      });
    }
  }

  // Fallback: deterministic rule engine (graceful degradation).
  const candidates = [
    {
      statement: "跨部门交接是当前效率损失的主要来源",
      rationale: `项目已识别 ${graph.crossDepartmentEdges().length} 处跨部门交接，可能导致等待、返工和信息损耗。`,
      confidence: graph.crossDepartmentEdges().length >= 3 ? 0.78 : 0.55,
    },
    {
      statement: "关键流程存在单点人员或系统依赖，影响业务连续性",
      rationale: `当前流程图中检测到 ${graph.singlePointsOfFailure().length} 个潜在单点故障节点。`,
      confidence: graph.singlePointsOfFailure().length > 0 ? 0.74 : 0.45,
    },
    {
      statement: "流程数据质量不足正在限制管理层决策精度",
      rationale: `当前仍有 ${gaps.length} 个结构、时长、角色或信息质量缺口需要补证。`,
      confidence: gaps.length >= 5 ? 0.82 : 0.58,
    },
  ].filter(candidate => candidate.confidence >= 0.5);

  return candidates.map(candidate => {
    const matched = existing.find(h => h.statement === candidate.statement);
    return upsertHypothesis({
      id: matched?.id,
      engagementId,
      statement: candidate.statement,
      rationale: candidate.rationale,
      status: matched?.status ?? "open",
      confidence: candidate.confidence,
      evidenceSessionIds,
    });
  });
}

export async function generateFindings(engagementId: string): Promise<Finding[]> {
  const sessions = sessionsForEngagement(engagementId);
  const graph = mergeGraphs(sessions);
  const gaps = detectAllGaps(graph);
  const report = generateReport(graph, gaps);
  const evidenceSessionIds = sessions.map(s => s.id);

  // Preferred path: LLM-driven, "So What" findings synthesis.
  if (graph.nodeCount() > 0) {
    const brief = buildEvidenceBrief(getEngagement(engagementId), sessions, graph, gaps, report);
    const synth = await synthesizeFindings(brief);
    if (synth && synth.length) {
      return replaceFindings(engagementId, synth.map(s => ({
        title: s.title,
        insight: s.insight,
        recommendation: s.recommendation,
        severity: s.severity,
        evidenceSessionIds,
      })));
    }
  }

  // Fallback: deterministic rule engine.
  const findings: Omit<Finding, "id" | "engagementId" | "createdAt">[] = [];
  const spofCount = graph.singlePointsOfFailure().length;
  const crossDeptCount = graph.crossDepartmentEdges().length;
  const highPain = [...graph.nodes.values()].filter(n => (n.painScore ?? 0) >= 7);

  if (crossDeptCount > 0) {
    findings.push({
      title: "跨部门协作存在效率损耗",
      insight: `流程中存在 ${crossDeptCount} 处跨部门交接。交接越多，信息损失和责任漂移的概率越高。`,
      recommendation: "设立端到端流程 Owner，并把交接节点改造成可度量的服务级协议。",
      severity: crossDeptCount >= 4 ? "high" : "medium",
      evidenceSessionIds,
    });
  }

  if (spofCount > 0) {
    findings.push({
      title: "关键节点存在单点故障风险",
      insight: `当前模型识别出 ${spofCount} 个可能影响连续性的单点节点。`,
      recommendation: "建立备份角色、交叉培训和异常升级路径，降低关键个人或系统依赖。",
      severity: spofCount >= 2 ? "high" : "medium",
      evidenceSessionIds,
    });
  }

  if (highPain.length > 0) {
    findings.push({
      title: "高痛点步骤应进入优先改造池",
      insight: `${highPain.length} 个步骤痛点评分达到 7 分以上，集中在 ${highPain.slice(0, 4).map(n => n.label).join("、")}。`,
      recommendation: "按影响面和改造难度建立 30/60/90 天路线图，优先处理高痛点低复杂度事项。",
      severity: "high",
      evidenceSessionIds,
    });
  }

  if (findings.length === 0) {
    findings.push({
      title: "项目仍处于证据积累阶段",
      insight: report.summary,
      recommendation: "继续访谈更多角色，直到流程图、时长、责任人和痛点证据足以支撑管理层决策。",
      severity: "low",
      evidenceSessionIds,
    });
  }

  return replaceFindings(engagementId, findings);
}

export async function generateDeliverable(engagementId: string): Promise<Deliverable> {
  const engagement = getEngagement(engagementId);
  const sessions = sessionsForEngagement(engagementId);
  const graph = mergeGraphs(sessions);
  const gaps = detectAllGaps(graph);
  const report = generateReport(graph, gaps);
  const hypotheses = listHypotheses(engagementId);
  const findings = listFindings(engagementId);

  // Preferred path: LLM-authored, pyramid-principle executive brief that also
  // weaves in the already-generated hypotheses and findings.
  if (graph.nodeCount() > 0) {
    let brief = buildEvidenceBrief(engagement, sessions, graph, gaps, report);
    if (hypotheses.length) {
      brief += `\n\n## 已生成假设\n` + hypotheses.map(h => `- ${h.statement}（置信度 ${Math.round(h.confidence * 100)}%）：${h.rationale}`).join("\n");
    }
    if (findings.length) {
      brief += `\n\n## 已生成发现\n` + findings.map(f => `- [${f.severity}] ${f.title}：${f.insight} → ${f.recommendation}`).join("\n");
    }
    const synth = await synthesizeDeliverable(brief);
    if (synth) {
      return createDeliverable({
        engagementId,
        type: "executive_summary",
        title: `${engagement?.name ?? "咨询项目"} · ${synth.title}`,
        contentMarkdown: synth.markdown,
      });
    }
  }

  // Fallback: deterministic template.
  const title = `${engagement?.name ?? "咨询项目"} - 高管诊断简报`;
  const contentMarkdown = [
    `# ${title}`,
    "",
    `## 1. 项目目标`,
    engagement?.objective || "尚未填写项目目标。",
    "",
    "## 2. 关键事实",
    `- 已完成访谈会话：${sessions.length}`,
    `- 流程节点：${graph.nodeCount()}`,
    `- 流程边：${graph.edgeCount()}`,
    `- 待补证缺口：${gaps.length}`,
    `- 整体置信度：${Math.round(report.stats.avgConfidence * 100)}%`,
    "",
    "## 3. 核心假设",
    ...(hypotheses.length ? hypotheses.map(h => `- ${h.statement}（置信度 ${Math.round(h.confidence * 100)}%）`) : ["- 暂无假设，请先生成假设树。"]),
    "",
    "## 4. 关键发现",
    ...(findings.length ? findings.map(f => `- ${f.title}：${f.insight}`) : ["- 暂无发现，请先生成洞察。"]),
    "",
    "## 5. 建议行动",
    ...(findings.length ? findings.map(f => `- ${f.recommendation}`) : report.recommendations.map(r => `- ${r}`)),
    "",
    "## 6. 下一步",
    "- 补齐低置信度节点的访谈证据",
    "- 对高痛点流程开展根因分析",
    "- 将行动项拆解为 30/60/90 天实施路线图",
  ].join("\n");

  return createDeliverable({
    engagementId,
    type: "executive_summary",
    title,
    contentMarkdown,
  });
}
