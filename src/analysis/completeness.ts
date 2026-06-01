/**
 * Consulting completeness assessment.
 *
 * The employee/manager interview AI behaves like a consultant sitting across the
 * table: it must gather a picture complete enough for a diagnosis. This module
 * encodes the "consulting requirements" — the dimensions a consultant needs
 * covered — and measures how well the current process graph satisfies them, so
 * the dialogue engine can summarise progress and guide the interviewee to fill
 * what is still missing.
 */

import type { ProcessGraph } from "../model/graph.js";
import type { Node } from "../model/schema.js";

export interface CompletenessDimension {
  key: string;
  label: string;        // short label for UI chips
  requirement: string;  // what the consultant needs
  guidance: string;     // consultant-style probing question used when missing
  covered: boolean;
}

export interface CompletenessResult {
  dimensions: CompletenessDimension[];
  coveredCount: number;
  total: number;
  score: number;          // 0..1
  met: boolean;           // sufficient for diagnosis
  missing: CompletenessDimension[];
  summary: string;        // one-line recap of what has been captured
}

const ACTOR_TYPES = new Set<Node["type"]>(["Role", "Department"]);
const IO_SOURCE_TYPES = new Set<Node["type"]>(["ExternalEntity", "Artifact", "Role", "Department"]);

export function assessCompleteness(g: ProcessGraph): CompletenessResult {
  const nodes = [...g.nodes.values()];

  const steps = g.findNodesByType("ProcessStep");
  const decisions = g.findNodesByType("DecisionPoint");
  const waits = g.findNodesByType("WaitState");
  const externals = g.findNodesByType("ExternalEntity");
  const actors = nodes.filter((n) => ACTOR_TYPES.has(n.type));
  const edges = [...g.edges.values()];

  const hasInputs = edges.some((e) => {
    if (e.type === "CONSUMES") return true;
    const from = g.getNode(e.from), to = g.getNode(e.to);
    return !!from && !!to && IO_SOURCE_TYPES.has(from.type) && to.type === "ProcessStep";
  });
  const hasOutputs = edges.some((e) => {
    if (e.type === "PRODUCES") return true;
    const from = g.getNode(e.from), to = g.getNode(e.to);
    return !!from && !!to && from.type === "ProcessStep" && IO_SOURCE_TYPES.has(to.type);
  });
  const hasTiming = steps.some((n) => (n.duration && n.duration.trim()) || (n.frequency && n.frequency.trim()));
  const hasPains = nodes.some((n) => (n.painScore ?? 0) >= 4) || waits.length > 0;

  const dims: CompletenessDimension[] = [
    {
      key: "steps", label: "关键步骤", requirement: "按顺序的主要工作步骤",
      guidance: "请按时间顺序说说你完成这项工作的主要步骤，从接到任务到最终完成。",
      covered: steps.length >= 3,
    },
    {
      key: "inputs", label: "输入来源", requirement: "上游输入与触发",
      guidance: "你开始这项工作之前，需要从谁、哪个部门或哪个系统拿到什么信息或材料？",
      covered: hasInputs,
    },
    {
      key: "outputs", label: "产出去向", requirement: "产出与下游交接",
      guidance: "这项工作完成后，你产出的是什么？交给谁或进入哪个下游环节？",
      covered: hasOutputs,
    },
    {
      key: "actors", label: "协作角色", requirement: "涉及的岗位/部门",
      guidance: "这个流程里还涉及哪些岗位或部门和你协作？分别负责什么？",
      covered: actors.length >= 1,
    },
    {
      key: "decisions", label: "决策规则", requirement: "判断/分支条件",
      guidance: "过程中你需要做判断或分情况处理吗？是依据什么条件决定怎么走的？",
      covered: decisions.length >= 1,
    },
    {
      key: "timing", label: "耗时频率", requirement: "时长与频率",
      guidance: "这些步骤通常各需要多长时间？这项工作多久做一次（每天/每周/按需）？",
      covered: hasTiming,
    },
    {
      key: "systems", label: "使用系统", requirement: "依赖的系统/工具",
      guidance: "你在这个流程里会用到哪些系统或工具来处理信息？",
      covered: externals.length >= 1,
    },
    {
      key: "pains", label: "痛点瓶颈", requirement: "痛点/等待/异常",
      guidance: "这个流程里哪个环节最慢、最容易出错，或者最让你头疼？遇到异常一般怎么处理？",
      covered: hasPains,
    },
  ];

  const coveredCount = dims.filter((d) => d.covered).length;
  const total = dims.length;
  const score = total > 0 ? coveredCount / total : 0;
  const stepsCovered = dims.find((d) => d.key === "steps")!.covered;
  // Sufficient for diagnosis: a real step flow + ≥70% of consulting dimensions.
  const met = stepsCovered && score >= 0.7;
  const missing = dims.filter((d) => !d.covered);

  const parts: string[] = [];
  if (steps.length) parts.push(`${steps.length} 个步骤`);
  if (decisions.length) parts.push(`${decisions.length} 个决策点`);
  if (actors.length) parts.push(`${actors.length} 个协作角色`);
  if (externals.length) parts.push(`${externals.length} 个系统`);
  if (waits.length) parts.push(`${waits.length} 个等待环节`);
  const summary = parts.length ? `目前已梳理出：${parts.join("、")}` : "目前还没有梳理出明确的流程信息";

  return { dimensions: dims, coveredCount, total, score, met, missing, summary };
}
