import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

const HUES = [210, 160, 30, 340, 280, 190, 50, 100];
function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return HUES[h % HUES.length];
}

interface EmpData {
  label?: string;
  role?: string;
  department?: string;
  sharedCount?: number;
  [key: string]: unknown;
}

function EmployeeNodeImpl({ data, selected }: NodeProps) {
  const d = data as EmpData;
  const name = String(d.label ?? "?");
  const hue = hueFor(name);
  const shared = typeof d.sharedCount === "number" ? d.sharedCount : 0;

  return (
    <div className="flex flex-col items-center gap-1 cursor-pointer select-none" style={{ width: 120 }}>
      <Handle type="target" position={Position.Top} className="!opacity-0" />
      <div
        className="relative h-14 w-14 rounded-full flex items-center justify-center font-bold text-lg transition-transform"
        style={{
          background: `linear-gradient(135deg, hsl(${hue} 75% 60%), hsl(${hue} 70% 48%))`,
          color: "#fff",
          boxShadow: selected ? `0 0 0 4px hsl(${hue} 70% 60% / .35)` : `0 4px 12px hsl(${hue} 40% 30% / .3)`,
          transform: selected ? "scale(1.08)" : undefined,
        }}
      >
        {name.slice(0, 1).toUpperCase()}
        {shared > 0 && (
          <span className="absolute -bottom-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center border-2 border-[var(--bg)]">
            {shared}
          </span>
        )}
      </div>
      <div className="text-[11.5px] font-semibold text-fg text-center leading-tight">{name}</div>
      {d.role && <div className="text-[9.5px] text-fg-tertiary text-center leading-tight truncate max-w-[110px]">{String(d.role)}</div>}
      <Handle type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const EmployeeNode = memo(EmployeeNodeImpl);
