import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, Flame } from "lucide-react";

const NT_META: Record<string, { label: string; color: string; bg: string }> = {
  processstep: { label: "步骤", color: "#4f46e5", bg: "#eef2ff" },
  decisionpoint: { label: "决策", color: "#d97706", bg: "#fffbeb" },
  waitstate: { label: "等待", color: "#dc2626", bg: "#fef2f2" },
  artifact: { label: "文档", color: "#0f9d6b", bg: "#ecfdf5" },
  externalentity: { label: "外部", color: "#0891b2", bg: "#ecfeff" },
  role: { label: "角色", color: "#9333ea", bg: "#faf5ff" },
  department: { label: "部门", color: "#475569", bg: "#f1f5f9" },
};

export interface ProcessNodeData {
  label: string;
  nodeType: string;
  painScore?: number;
  isSpof?: boolean;
  hasGaps?: boolean;
  gapCount?: number;
  department?: string;
  departmentColor?: string;
  confidence?: number;
  employees?: string[];
  [key: string]: unknown;
}

function ProcessNodeImpl({ data, selected }: NodeProps) {
  const d = data as ProcessNodeData;
  const meta = NT_META[String(d.nodeType ?? "").toLowerCase()] ?? NT_META.processstep;
  const pain = typeof d.painScore === "number" ? d.painScore : undefined;
  const empCount = Array.isArray(d.employees) ? d.employees.length : 0;

  return (
    <div
      className="group relative rounded-lg border bg-card shadow-sm transition-all"
      style={{
        minWidth: 150,
        maxWidth: 200,
        borderColor: selected ? meta.color : d.isSpof ? "#dc2626" : "var(--border-strong)",
        borderWidth: selected || d.isSpof ? 2 : 1,
        boxShadow: selected ? `0 0 0 4px ${meta.color}22` : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-[var(--fg-tertiary)] !border-0" />
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg" style={{ background: meta.color }} />

      <div className="pl-3 pr-2.5 py-2">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[9.5px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5" style={{ color: meta.color, background: meta.bg }}>
            {meta.label}
          </span>
          {d.department && (
            <span className="text-[9.5px] text-fg-tertiary truncate max-w-[70px]" title={d.department}>
              {d.department}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            {pain != null && pain >= 5 && (
              <span className="flex items-center gap-0.5 text-[10px] font-bold text-danger"><Flame size={11} />{pain}</span>
            )}
            {d.isSpof && <span title="单点故障" className="h-2 w-2 rounded-full bg-danger" />}
          </div>
        </div>
        <div className="text-[12.5px] font-semibold text-fg leading-snug line-clamp-2">{String(d.label ?? "未命名")}</div>
        {(d.hasGaps || empCount > 0) && (
          <div className="flex items-center gap-2 mt-1.5">
            {d.hasGaps && (
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-warning">
                <AlertTriangle size={10} /> {d.gapCount ?? 0} 缺口
              </span>
            )}
            {empCount > 0 && <span className="text-[10px] text-fg-tertiary">{empCount} 人</span>}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-[var(--fg-tertiary)] !border-0" />
    </div>
  );
}

export const ProcessNode = memo(ProcessNodeImpl);
