/**
 * Text report generator — produces human-readable analysis of the process model.
 */

import { ProcessGraph } from "../model/graph.js";
import type { Gap } from "../model/schema.js";
import { prioritizeGaps } from "../analysis/prioritizer.js";
import { gapsByCategory } from "../analysis/gaps.js";

export interface Report {
  summary: string;
  stats: {
    nodeCount: number;
    edgeCount: number;
    avgConfidence: number;
    departmentCount: number;
    crossDepartmentEdges: number;
    cycles: number;
    spofCount: number;
  };
  gapsByCategory: Record<string, number>;
  topGaps: { type: string; description: string; score: number }[];
  departmentSummary: { department: string; nodeCount: number; avgPain: number }[];
  recommendations: string[];
}

export function generateReport(graph: ProcessGraph, gaps: Gap[]): Report {
  const scored = prioritizeGaps(gaps, graph);

  // Department stats
  const deptMap = new Map<string, { count: number; totalPain: number }>();
  for (const node of graph.nodes.values()) {
    const dept = node.department ?? "未归属";
    const existing = deptMap.get(dept);
    if (existing) {
      existing.count++;
      existing.totalPain += node.painScore ?? 0;
    } else {
      deptMap.set(dept, { count: 1, totalPain: node.painScore ?? 0 });
    }
  }

  const departmentSummary = [...deptMap.entries()]
    .map(([department, { count, totalPain }]) => ({
      department,
      nodeCount: count,
      avgPain: count > 0 ? Math.round((totalPain / count) * 10) / 10 : 0,
    }))
    .sort((a, b) => b.avgPain - a.avgPain);

  // Gap category counts
  const gapByCat: Record<string, number> = {};
  for (const gap of gaps) {
    gapByCat[gap.category] = (gapByCat[gap.category] ?? 0) + 1;
  }

  // Cycle check
  const hasCycle = graph.detectCycle() !== null;

  // Single points of failure
  const spofs = graph.singlePointsOfFailure();

  // Cross-department edges
  const crossDept = graph.crossDepartmentEdges();

  // Department count
  const departments = new Set<string>();
  for (const node of graph.nodes.values()) {
    if (node.department) departments.add(node.department);
  }

  // Recommendations
  const recommendations: string[] = [];
  if (spofs.length > 0) {
    recommendations.push(`发现 ${spofs.length} 个单点故障节点，建议建立备选方案或交叉培训`);
  }
  if (hasCycle) {
    recommendations.push("流程中存在循环，建议确认循环终止条件和超时机制");
  }
  if (crossDept.length > 3) {
    recommendations.push(`跨部门交接较多（${crossDept.length} 处），建议检查交接效率和信息损耗`);
  }
  const highPain = [...graph.nodes.values()].filter(n => (n.painScore ?? 0) >= 7);
  if (highPain.length > 0) {
    recommendations.push(`${highPain.length} 个步骤痛点评分 >= 7，建议优先关注: ${highPain.map(n => n.label).join("、")}`);
  }
  const lowConfNodes = graph.lowConfidenceNodes(0.4);
  if (lowConfNodes.length > 0) {
    recommendations.push(`${lowConfNodes.length} 个节点置信度较低，建议与相关人员核实`);
  }

  return {
    summary: `「${graph.processName}」包含 ${graph.nodeCount()} 个节点和 ${graph.edgeCount()} 条边，涉及 ${departments.size} 个部门，整体置信度 ${(graph.averageConfidence() * 100).toFixed(0)}%。`,
    stats: {
      nodeCount: graph.nodeCount(),
      edgeCount: graph.edgeCount(),
      avgConfidence: graph.averageConfidence(),
      departmentCount: departments.size,
      crossDepartmentEdges: crossDept.length,
      cycles: hasCycle ? 1 : 0,
      spofCount: spofs.length,
    },
    gapsByCategory: gapByCat,
    topGaps: scored.slice(0, 10).map(s => ({
      type: s.gap.type,
      description: s.gap.description,
      score: Math.round(s.score * 100) / 100,
    })),
    departmentSummary,
    recommendations,
  };
}
