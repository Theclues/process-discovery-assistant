/** Gap type definitions with metadata for scoring and reporting. */

import type { GapType, GapCategory } from "../model/schema.js";

export interface GapTypeInfo {
  type: GapType;
  category: GapCategory;
  label: string;
  description: string;
  defaultSeverity: number;   // 0..10
}

export const GAP_TYPE_INFO: Record<GapType, GapTypeInfo> = {
  // ─── Structural ──────────────────────────────────────────
  MISSING_SOURCE: {
    type: "MISSING_SOURCE",
    category: "structural",
    label: "缺失输入源",
    description: "节点有入边但入边来源节点不存在或未定义输入",
    defaultSeverity: 8,
  },
  MISSING_CONSUMER: {
    type: "MISSING_CONSUMER",
    category: "structural",
    label: "缺失消费者",
    description: "节点产出(Artifact)但没有下游消费节点",
    defaultSeverity: 7,
  },
  ORPHAN_NODE: {
    type: "ORPHAN_NODE",
    category: "structural",
    label: "孤立节点",
    description: "节点没有任何入边或出边，未连接到流程中",
    defaultSeverity: 6,
  },
  DANGLING_EDGE: {
    type: "DANGLING_EDGE",
    category: "structural",
    label: "悬空边",
    description: "边指向的节点不存在",
    defaultSeverity: 9,
  },

  // ─── Control Flow ───────────────────────────────────────
  BRANCH_WITHOUT_CONDITION: {
    type: "BRANCH_WITHOUT_CONDITION",
    category: "control_flow",
    label: "分支缺少条件",
    description: "DecisionPoint 节点缺少明确的分支条件描述",
    defaultSeverity: 7,
  },
  UNVERIFIED_CYCLE: {
    type: "UNVERIFIED_CYCLE",
    category: "control_flow",
    label: "未验证的循环",
    description: "图中存在循环但未被用户确认",
    defaultSeverity: 5,
  },
  IMPLICIT_DECISION: {
    type: "IMPLICIT_DECISION",
    category: "control_flow",
    label: "隐式决策",
    description: "ProcessStep 有多个出边但没有显式的 DecisionPoint",
    defaultSeverity: 6,
  },

  // ─── Temporal ───────────────────────────────────────────
  UNSPECIFIED_DURATION: {
    type: "UNSPECIFIED_DURATION",
    category: "temporal",
    label: "未指定时长",
    description: "ProcessStep 缺少处理时长信息",
    defaultSeverity: 4,
  },
  UNSPECIFIED_WAIT: {
    type: "UNSPECIFIED_WAIT",
    category: "temporal",
    label: "未指定等待时间",
    description: "WaitState 节点缺少等待时长",
    defaultSeverity: 5,
  },
  FREQUENCY_MISMATCH: {
    type: "FREQUENCY_MISMATCH",
    category: "temporal",
    label: "频率不匹配",
    description: "相邻步骤的处理频率不一致",
    defaultSeverity: 5,
  },
  WAIT_WITHOUT_CAUSE: {
    type: "WAIT_WITHOUT_CAUSE",
    category: "temporal",
    label: "等待无原因",
    description: "WaitState 节点缺少等待原因描述",
    defaultSeverity: 5,
  },

  // ─── Organizational ─────────────────────────────────────
  UNCHARACTERIZED_ROLE: {
    type: "UNCHARACTERIZED_ROLE",
    category: "organizational",
    label: "角色未刻画",
    description: "Role 节点缺少职责描述或关联步骤",
    defaultSeverity: 6,
  },
  DEPARTMENT_BOUNDARY: {
    type: "DEPARTMENT_BOUNDARY",
    category: "organizational",
    label: "部门边界未定义",
    description: "跨部门边中节点缺少部门归属",
    defaultSeverity: 5,
  },
  SINGLE_POINT_OF_FAILURE: {
    type: "SINGLE_POINT_OF_FAILURE",
    category: "organizational",
    label: "单点故障",
    description: "节点是流程必经之路，无替代路径",
    defaultSeverity: 8,
  },
  ROLE_OVERLAP: {
    type: "ROLE_OVERLAP",
    category: "organizational",
    label: "角色职责重叠",
    description: "两个角色节点高度相似",
    defaultSeverity: 4,
  },

  // ─── Information Quality ────────────────────────────────
  LOW_CONFIDENCE: {
    type: "LOW_CONFIDENCE",
    category: "information_quality",
    label: "低置信度",
    description: "节点或边的置信度低于阈值",
    defaultSeverity: 3,
  },
  PAIN_UNEXPLAINED: {
    type: "PAIN_UNEXPLAINED",
    category: "information_quality",
    label: "痛点未解释",
    description: "节点有高痛点评分但缺少说明",
    defaultSeverity: 4,
  },
};

export function getGapInfo(type: GapType): GapTypeInfo {
  return GAP_TYPE_INFO[type];
}

export function gapsByCategory(): Record<GapCategory, GapTypeInfo[]> {
  const result: Record<GapCategory, GapTypeInfo[]> = {
    structural: [],
    control_flow: [],
    temporal: [],
    organizational: [],
    information_quality: [],
  };
  for (const info of Object.values(GAP_TYPE_INFO)) {
    result[info.category].push(info);
  }
  return result;
}
