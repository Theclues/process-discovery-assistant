import { X } from "lucide-react";
import { Badge } from "../ui";
import { nodeTypeIcon } from "../lib/utils";

const NT_LABELS: Record<string, string> = {
  ProcessStep: "流程步骤", DecisionPoint: "决策点", WaitState: "等待中", Artifact: "文档/数据",
  ExternalEntity: "外部系统", Role: "角色", Department: "部门",
};

function str(v: unknown): string | undefined {
  if (v == null || v === "") return undefined;
  return String(v);
}
function num(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider mb-1.5">{label}</div>
      {children}
    </div>
  );
}

export default function DetailPanel({ node, onClose }: { node: Record<string, unknown>; onClose: () => void }) {
  const label = str(node.label) ?? str(node.name) ?? "—";
  const nodeType = str(node.nodeType);
  const department = str(node.department);
  const description = str(node.description);
  const confidence = num(node.confidence);
  const painScore = num(node.painScore);
  const duration = str(node.duration);
  const employees = Array.isArray(node.employees) ? (node.employees as unknown[]).map(String) : [];

  const confColor = confidence == null ? "" : confidence >= 0.7 ? "bg-success" : confidence >= 0.4 ? "bg-warning" : "bg-danger";

  return (
    <div className="absolute right-0 top-0 h-full w-[320px] border-l border-border bg-card shadow-lg flex flex-col z-20 animate-slide-right">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border-light shrink-0">
        <span className="text-[13px] font-semibold text-fg flex items-center gap-2">
          <span className="text-base">{nodeTypeIcon(nodeType ?? "")}</span> 节点详情
        </span>
        <button onClick={onClose} aria-label="关闭"
          className="h-7 w-7 rounded-md flex items-center justify-center text-fg-tertiary hover:text-fg hover:bg-muted transition-colors cursor-pointer">
          <X size={15} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4 overflow-y-auto">
        <Field label="名称"><div className="text-[15px] font-bold text-fg leading-snug">{label}</div></Field>

        {nodeType && (
          <Field label="类型"><Badge tone="accent">{NT_LABELS[nodeType] ?? nodeType}</Badge></Field>
        )}
        {department && <Field label="部门"><div className="text-[13px] text-fg-secondary">{department}</div></Field>}
        {description && <Field label="描述"><div className="text-[12.5px] text-fg-secondary leading-relaxed">{description}</div></Field>}

        {confidence != null && (
          <Field label="置信度">
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                <div className={`h-full rounded-full transition-all ${confColor}`} style={{ width: `${Math.round(confidence * 100)}%` }} />
              </div>
              <span className="text-xs font-semibold text-fg-secondary tabular">{Math.round(confidence * 100)}%</span>
            </div>
          </Field>
        )}

        {painScore != null && painScore > 0 && (
          <Field label="痛点评分">
            <div className={`flex items-center gap-1.5 text-xl font-bold ${painScore >= 7 ? "text-danger" : "text-warning"}`}>
              <span>🔥</span> {painScore}/10
            </div>
          </Field>
        )}

        {duration && nodeType === "ProcessStep" && (
          <Field label="耗时"><div className="text-[13px] text-fg-secondary">{duration}</div></Field>
        )}

        {employees.length > 0 && (
          <Field label={`关联员工 (${employees.length}人)`}>
            <div className="flex flex-wrap gap-1.5">
              {employees.map((e) => <Badge key={e} tone="neutral" size="sm">{e}</Badge>)}
            </div>
          </Field>
        )}
      </div>
    </div>
  );
}
