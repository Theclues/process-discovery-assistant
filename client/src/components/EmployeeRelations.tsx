import { useMemo } from "react";
import { Users2, RefreshCw } from "lucide-react";
import { FlowCanvas } from "./flow/FlowCanvas";
import { EmployeeNode } from "./flow/EmployeeNode";
import { useEmployeeRelations } from "../hooks/queries";
import { Button, CenterSpinner, EmptyState, ErrorState } from "../ui";
import type { NodeTypes } from "@xyflow/react";

interface Props {
  orgId: string;
  onNodeClick: (n: Record<string, unknown>) => void;
  onInterviewEmployee: (id: string, name: string) => void;
}

const empNodeTypes: NodeTypes = { employee: EmployeeNode };

export default function EmployeeRelations({ orgId, onNodeClick, onInterviewEmployee }: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } = useEmployeeRelations(orgId);

  const empty = !data || (data.nodes ?? []).length === 0;

  const handleClick = useMemo(
    () => (n: Record<string, unknown>) => {
      onNodeClick({ ...n, name: n.label, nodeType: "Role", type: "employee" });
      const id = String(n.id ?? "");
      const name = String(n.label ?? "");
      if (id) onInterviewEmployee(id, name);
    },
    [onNodeClick, onInterviewEmployee],
  );

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0">
        <span className="text-[13px] font-semibold text-fg flex items-center gap-2">
          <Users2 size={16} className="text-accent" /> 员工协作网络
          <span className="text-[11px] font-normal text-fg-tertiary hidden sm:inline">· 基于共享流程节点 · 点击头像发起访谈</span>
        </span>
        <Button variant="ghost" size="icon-sm" loading={isFetching} onClick={() => refetch()} aria-label="刷新" title="刷新">
          {!isFetching && <RefreshCw size={15} />}
        </Button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {isLoading && <CenterSpinner label="分析员工关系中" />}
        {isError && <div className="h-full flex items-center justify-center"><ErrorState message={(error as Error)?.message} onRetry={() => refetch()} /></div>}
        {!isLoading && !isError && empty && (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={<Users2 size={24} />}
              title="协作网络尚未形成"
              description="至少需要 2 位员工完成访谈，系统才能基于共享流程节点计算协作强度与社区聚类。"
            />
          </div>
        )}
        {!isLoading && !isError && !empty && data && (
          <FlowCanvas data={data} kind="employee" nodeTypes={empNodeTypes} onNodeClick={handleClick} showMiniMap={false} />
        )}
      </div>
    </div>
  );
}
