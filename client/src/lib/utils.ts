import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatConfidence(c: number): string {
  return `${Math.round(c * 100)}%`;
}

export function formatScore(s: number, maxDecimals = 1): string {
  return s.toFixed(maxDecimals);
}

export function gapTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    MISSING_SOURCE: "缺少来源",
    MISSING_CONSUMER: "缺少消费者",
    ORPHAN_NODE: "孤立节点",
    DANGLING_EDGE: "悬挂边",
    BRANCH_WITHOUT_CONDITION: "无条件分支",
    UNVERIFIED_CYCLE: "未验证循环",
    IMPLICIT_DECISION: "隐式决策",
    UNSPECIFIED_DURATION: "未指定时长",
    UNSPECIFIED_WAIT: "未指定等待",
    FREQUENCY_MISMATCH: "频率不匹配",
    WAIT_WITHOUT_CAUSE: "等待无原因",
    UNCHARACTERIZED_ROLE: "未描述角色",
    DEPARTMENT_BOUNDARY: "部门边界",
    SINGLE_POINT_OF_FAILURE: "单点故障",
    ROLE_OVERLAP: "角色重叠",
    LOW_CONFIDENCE: "低置信度",
    PAIN_UNEXPLAINED: "痛点未解释",
  };
  return labels[type] ?? type;
}

export function nodeTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    ProcessStep: "⟿",
    DecisionPoint: "◇",
    WaitState: "⏳",
    Artifact: "📄",
    ExternalEntity: "🌐",
    Role: "👤",
    Department: "🏢",
  };
  return icons[type] ?? "○";
}

export const DEPARTMENT_COLORS = [
  { bg: "#E3F2FD", border: "#1E88E5", text: "#1565C0" },
  { bg: "#E8F5E9", border: "#43A047", text: "#2E7D32" },
  { bg: "#FFF3E0", border: "#FB8C00", text: "#E65100" },
  { bg: "#FCE4EC", border: "#E91E63", text: "#C2185B" },
  { bg: "#F3E5F5", border: "#8E24AA", text: "#6A1B9A" },
  { bg: "#E0F7FA", border: "#00ACC1", text: "#00838F" },
  { bg: "#FFF8E1", border: "#FDD835", text: "#F9A825" },
  { bg: "#EFEBE9", border: "#795548", text: "#4E342E" },
  { bg: "#E8EAF6", border: "#3949AB", text: "#283593" },
  { bg: "#F1F8E9", border: "#689F38", text: "#33691E" },
] as const;

export function getDepartmentColor(index: number) {
  return DEPARTMENT_COLORS[index % DEPARTMENT_COLORS.length];
}
