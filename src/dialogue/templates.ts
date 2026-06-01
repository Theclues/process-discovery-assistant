/**
 * Socratic question templates — each gap type maps to a question generator.
 *
 * Engineering cybernetics: the "actuator" of the system.
 * Each template produces a minimal-information question that targets a specific gap.
 */

import type { Gap, GapType } from "../model/schema.js";
import { ProcessGraph } from "../model/graph.js";

export interface QuestionTemplate {
  generate: (gap: Gap, graph: ProcessGraph) => string;
  acknowledgment: (gap: Gap, graph: ProcessGraph) => string;
}

// ─── Helpers ──────────────────────────────────────────────────

function nodeLabel(graph: ProcessGraph, id: string): string {
  return graph.getNode(id)?.label ?? id;
}

function edgeLabel(graph: ProcessGraph, id: string): string {
  return graph.getEdge(id)?.label ?? id;
}

// ─── Structural ───────────────────────────────────────────────

function missingSourceQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "此节点";
  return `你提到「${node}」需要输入，这个输入具体是什么？来自哪个环节或谁提供的？`;
}

function missingConsumerQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个产出";
  return `「${node}」产生之后，接下来谁会用到它？`;
}

function orphanNodeQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个步骤";
  return `「${node}」在这个流程中是怎么和其他步骤衔接的？它的上一步和下一步分别是什么？`;
}

function danglingEdgeQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "此节点";
  return `你提到从「${node}」有流转出去，目的地是哪个步骤或角色？`;
}

// ─── Control Flow ─────────────────────────────────────────────

function branchNoConditionQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个决策点";
  return `在「${node}」，你是根据什么条件来判断走哪条分支的？`;
}

function unverifiedCycleQ(gap: Gap, graph: ProcessGraph): string {
  const labels = gap.nodeIds.map(id => nodeLabel(graph, id));
  const cycleStr = labels.join(" → ");
  return `我注意到流程可能形成循环（${cycleStr}），这个循环在什么情况下会终止？有没有退出条件？`;
}

function implicitDecisionQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个步骤";
  return `从「${node}」出来有几条不同的路径，在什么情况下走哪条路？这里是否有一个隐式的判断条件？`;
}

// ─── Temporal ─────────────────────────────────────────────────

function unspecifiedDurationQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个步骤";
  return `「${node}」通常需要多长时间完成？是一气呵成还是分几天？`;
}

function unspecifiedWaitQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个等待";
  return `在「${node}」这个环节，一般要等多久？`;
}

function frequencyMismatchQ(gap: Gap, graph: ProcessGraph): string {
  const a = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "步骤A";
  const b = gap.nodeIds[1] ? nodeLabel(graph, gap.nodeIds[1]) : "步骤B";
  return `「${a}」和「${b}」的处理频率好像不太一样，这个频率差是怎么处理的？是积攒到一定量再处理还是实时处理？`;
}

function waitWithoutCauseQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个等待";
  return `「${node}」是在等什么？是什么原因导致需要等？`;
}

// ─── Organizational ───────────────────────────────────────────

function uncharacterizedRoleQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个角色";
  return `「${node}」在这个流程中具体负责什么？ta 最主要的工作内容是什么？`;
}

function departmentBoundaryQ(gap: Gap, graph: ProcessGraph): string {
  const edge = gap.edgeIds[0] ? edgeLabel(graph, gap.edgeIds[0]) : "这个交接";
  const a = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "步骤A";
  const b = gap.nodeIds[1] ? nodeLabel(graph, gap.nodeIds[1]) : "步骤B";
  return `从「${a}」到「${b}」好像跨部门了，具体是怎么交接的？是通过系统、邮件、还是当面沟通？`;
}

function singlePointFailureQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个环节";
  return `「${node}」看起来是整个流程必经的环节，如果这里出问题了（比如负责人请假或系统挂了），有备选方案吗？`;
}

// ─── Information Quality ──────────────────────────────────────

function lowConfidenceQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个环节";
  return `关于「${node}」，你之前描述的时候好像不太确定，能再确认一下细节吗？`;
}

function painUnexplainedQ(gap: Gap, graph: ProcessGraph): string {
  const node = gap.nodeIds[0] ? nodeLabel(graph, gap.nodeIds[0]) : "这个环节";
  const score = graph.getNode(gap.nodeIds[0])?.painScore ?? 0;
  return `你提到「${node}」让你感觉很痛苦（评分 ${score}/10），能具体说说哪里让你觉得不舒服吗？`;
}

// ─── Question Template Registry ───────────────────────────────

const templates: Partial<Record<GapType, QuestionTemplate>> = {
  MISSING_SOURCE:           { generate: missingSourceQ,        acknowledgment: () => "好的，了解了输入来源。" },
  MISSING_CONSUMER:         { generate: missingConsumerQ,      acknowledgment: () => "明白，下游消费者很重要。" },
  ORPHAN_NODE:              { generate: orphanNodeQ,           acknowledgment: () => "好的，这样能看清衔接关系。" },
  DANGLING_EDGE:            { generate: danglingEdgeQ,         acknowledgment: () => "了解了，需要明确目标。" },
  BRANCH_WITHOUT_CONDITION: { generate: branchNoConditionQ,    acknowledgment: () => "明白了，条件清楚了。" },
  UNVERIFIED_CYCLE:         { generate: unverifiedCycleQ,      acknowledgment: () => "好的，循环有边界才完整。" },
  IMPLICIT_DECISION:        { generate: implicitDecisionQ,     acknowledgment: () => "现在明确了，这确实是个决策点。" },
  UNSPECIFIED_DURATION:     { generate: unspecifiedDurationQ,  acknowledgment: () => "好的，时间维度有了。" },
  UNSPECIFIED_WAIT:         { generate: unspecifiedWaitQ,      acknowledgment: () => "等待时间明确了。" },
  FREQUENCY_MISMATCH:       { generate: frequencyMismatchQ,    acknowledgment: () => "了解了，频率差是这样处理的。" },
  WAIT_WITHOUT_CAUSE:       { generate: waitWithoutCauseQ,     acknowledgment: () => "知道了等待的原因。" },
  UNCHARACTERIZED_ROLE:     { generate: uncharacterizedRoleQ,  acknowledgment: () => "角色职责清楚了。" },
  DEPARTMENT_BOUNDARY:      { generate: departmentBoundaryQ,   acknowledgment: () => "跨部门交接方式清楚了。" },
  SINGLE_POINT_OF_FAILURE:  { generate: singlePointFailureQ,   acknowledgment: () => "备选方案很重要，了解了。" },
  LOW_CONFIDENCE:           { generate: lowConfidenceQ,        acknowledgment: () => "谢谢确认，现在更准确了。" },
  PAIN_UNEXPLAINED:         { generate: painUnexplainedQ,      acknowledgment: () => "谢谢分享，这对理解瓶颈很有帮助。" },
};

export function getQuestionTemplate(type: GapType): QuestionTemplate | undefined {
  return templates[type];
}

/** List of generic acknowledgments for non-question turns */
const GENERIC_ACKNOWLEDGMENTS = [
  "了解了，这是很有用的信息。",
  "明白了，继续。",
  "好的，这个细节很有价值。",
  "谢谢，这样我就能更好地建模了。",
  "不错，这样流程就清晰多了。",
];

export function randomAcknowledgment(): string {
  return GENERIC_ACKNOWLEDGMENTS[Math.floor(Math.random() * GENERIC_ACKNOWLEDGMENTS.length)];
}
