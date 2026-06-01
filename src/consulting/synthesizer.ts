/**
 * LLM-driven consulting synthesis (hypotheses / findings / executive deliverable).
 *
 * Engineering cybernetics:
 * - Every LLM call inherits the client's timeout + retry + circuit breaker.
 * - Graceful degradation: if the API key is missing, the circuit is open, or
 *   parsing fails, callers fall back to the deterministic rule engine. A failed
 *   synthesis must never break the workbench.
 * - Observability: synthesis attempts and outcomes are logged with latency.
 */

import { isDeepseekConfigured } from "../config.js";
import { getLLMClient } from "../llm/client.js";
import {
  HYPOTHESIS_SYSTEM_PROMPT,
  FINDINGS_SYSTEM_PROMPT,
  DELIVERABLE_SYSTEM_PROMPT,
} from "../llm/prompts.js";
import { extractJSON } from "../llm/extractors.js";
import type { ProcessGraph } from "../model/graph.js";
import type { Gap, Engagement, SessionData } from "../model/schema.js";
import type { Report } from "../viz/report.js";

export interface SynthHypothesis {
  statement: string;
  rationale: string;
  confidence: number;
  testApproach?: string;
}

export interface SynthFinding {
  title: string;
  insight: string;
  recommendation: string;
  severity: "low" | "medium" | "high";
}

function llmAvailable(): boolean {
  if (!isDeepseekConfigured()) return false;
  try {
    return getLLMClient().getCircuitState() !== "OPEN";
  } catch {
    return false;
  }
}

/** Compact, fact-dense evidence brief that grounds every LLM synthesis. */
export function buildEvidenceBrief(
  engagement: Engagement | null | undefined,
  sessions: SessionData[],
  graph: ProcessGraph,
  gaps: Gap[],
  report: Report,
): string {
  const nodes = [...graph.nodes.values()];
  const byType = new Map<string, number>();
  for (const n of nodes) byType.set(n.type, (byType.get(n.type) ?? 0) + 1);

  const depts = new Set<string>();
  for (const n of nodes) if (n.department) depts.add(n.department);

  const spof = graph.singlePointsOfFailure();
  const crossDept = graph.crossDepartmentEdges();
  const highPain = nodes
    .filter((n) => (n.painScore ?? 0) >= 6)
    .sort((a, b) => (b.painScore ?? 0) - (a.painScore ?? 0))
    .slice(0, 8);

  const gapByCat = new Map<string, number>();
  for (const g of gaps) gapByCat.set(g.category, (gapByCat.get(g.category) ?? 0) + 1);
  const topGaps = [...gaps].sort((a, b) => (b.severity * (b.painScore || 1)) - (a.severity * (a.painScore || 1))).slice(0, 8);

  const lines: string[] = [];
  lines.push(`# 诊断证据简报`);
  if (engagement) {
    lines.push(`项目：${engagement.name}`);
    lines.push(`咨询目标：${engagement.objective || "（未填写）"}`);
    lines.push(`当前阶段：${engagement.phase}`);
  }
  lines.push("");
  lines.push(`## 规模与覆盖`);
  lines.push(`- 已完成访谈会话：${sessions.length}`);
  lines.push(`- 流程节点：${graph.nodeCount()}，流程关系：${graph.edgeCount()}`);
  lines.push(`- 整体置信度：${Math.round(report.stats.avgConfidence * 100)}%`);
  lines.push(`- 涉及部门：${depts.size} 个${depts.size ? `（${[...depts].join("、")}）` : ""}`);
  lines.push(`- 节点类型分布：${[...byType.entries()].map(([t, c]) => `${t} ${c}`).join("，")}`);
  lines.push("");
  lines.push(`## 结构性信号`);
  lines.push(`- 跨部门交接：${crossDept.length} 处`);
  lines.push(`- 单点故障节点：${spof.length} 个${spof.length ? `（${spof.slice(0, 6).map((n) => n.label).join("、")}）` : ""}`);
  lines.push(`- 是否存在未验证循环：${report.stats.cycles ? "是" : "否"}`);
  lines.push("");
  if (highPain.length) {
    lines.push(`## 高痛点步骤（痛点≥6）`);
    for (const n of highPain) {
      lines.push(`- ${n.label}（痛点 ${n.painScore}/10${n.department ? `，${n.department}` : ""}）${n.description ? `：${n.description}` : ""}`);
    }
    lines.push("");
  }
  lines.push(`## 流程缺口（共 ${gaps.length} 个）`);
  lines.push(`- 按类别：${[...gapByCat.entries()].map(([c, n]) => `${c} ${n}`).join("，") || "无"}`);
  for (const g of topGaps) {
    lines.push(`- [${g.category}] ${g.description}（严重度 ${g.severity}/10）`);
  }
  if (report.departmentSummary?.length) {
    lines.push("");
    lines.push(`## 部门痛点画像`);
    for (const d of report.departmentSummary.slice(0, 8)) {
      lines.push(`- ${d.department}：${d.nodeCount} 节点，平均痛点 ${d.avgPain.toFixed(1)}`);
    }
  }
  return lines.join("\n");
}

export async function synthesizeHypotheses(brief: string): Promise<SynthHypothesis[] | null> {
  if (!llmAvailable()) return null;
  try {
    const res = await getLLMClient().complete(HYPOTHESIS_SYSTEM_PROMPT, brief, { jsonMode: true, temperature: 0.4 });
    const parsed = extractJSON(res.content) as { hypotheses?: unknown[] } | null;
    const arr = parsed?.hypotheses;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    console.log(`[synthesizer] hypotheses ok (${arr.length}) in ${res.latencyMs}ms, tokens=${res.usage?.totalTokens ?? "?"}`);
    return arr
      .map((h) => h as Record<string, unknown>)
      .filter((h) => typeof h.statement === "string")
      .map((h) => ({
        statement: String(h.statement),
        rationale: String(h.rationale ?? ""),
        confidence: clamp01(typeof h.confidence === "number" ? h.confidence : 0.6),
        testApproach: typeof h.testApproach === "string" ? h.testApproach : undefined,
      }));
  } catch (err) {
    console.warn("[synthesizer] hypotheses failed, falling back:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function synthesizeFindings(brief: string): Promise<SynthFinding[] | null> {
  if (!llmAvailable()) return null;
  try {
    const res = await getLLMClient().complete(FINDINGS_SYSTEM_PROMPT, brief, { jsonMode: true, temperature: 0.4 });
    const parsed = extractJSON(res.content) as { findings?: unknown[] } | null;
    const arr = parsed?.findings;
    if (!Array.isArray(arr) || arr.length === 0) return null;
    console.log(`[synthesizer] findings ok (${arr.length}) in ${res.latencyMs}ms, tokens=${res.usage?.totalTokens ?? "?"}`);
    return arr
      .map((f) => f as Record<string, unknown>)
      .filter((f) => typeof f.title === "string")
      .map((f) => ({
        title: String(f.title),
        insight: String(f.insight ?? ""),
        recommendation: String(f.recommendation ?? ""),
        severity: normalizeSeverity(f.severity),
      }));
  } catch (err) {
    console.warn("[synthesizer] findings failed, falling back:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function synthesizeDeliverable(brief: string): Promise<{ title: string; markdown: string } | null> {
  if (!llmAvailable()) return null;
  try {
    const res = await getLLMClient().complete(DELIVERABLE_SYSTEM_PROMPT, brief, { jsonMode: true, temperature: 0.5 });
    const parsed = extractJSON(res.content) as { title?: unknown; markdown?: unknown } | null;
    if (!parsed || typeof parsed.markdown !== "string" || !parsed.markdown.trim()) return null;
    console.log(`[synthesizer] deliverable ok in ${res.latencyMs}ms, tokens=${res.usage?.totalTokens ?? "?"}`);
    return {
      title: typeof parsed.title === "string" && parsed.title.trim() ? parsed.title : "高管诊断简报",
      markdown: parsed.markdown,
    };
  } catch (err) {
    console.warn("[synthesizer] deliverable failed, falling back:", err instanceof Error ? err.message : err);
    return null;
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function normalizeSeverity(v: unknown): "low" | "medium" | "high" {
  const s = String(v).toLowerCase();
  if (s === "high" || s === "高") return "high";
  if (s === "low" || s === "低") return "low";
  return "medium";
}
