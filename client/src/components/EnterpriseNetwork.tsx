import { useMemo } from "react";
import { Network, RefreshCw, Flame, AlertTriangle } from "lucide-react";
import { FlowCanvas } from "./flow/FlowCanvas";
import { useEnterpriseNetwork } from "../hooks/queries";
import { Button, CenterSpinner, EmptyState, ErrorState, Badge } from "../ui";

interface Props {
  orgId: string;
  onNodeClick: (n: Record<string, unknown>) => void;
  onInterviewEmployee: (id: string, name: string) => void;
}

const LEGEND: [string, string][] = [
  ["步骤", "#4f46e5"], ["决策", "#d97706"], ["等待", "#dc2626"],
  ["文档", "#0f9d6b"], ["外部", "#0891b2"], ["角色", "#9333ea"],
];

export default function EnterpriseNetwork({ orgId, onNodeClick }: Props) {
  const { data, isLoading, isError, error, refetch, isFetching } = useEnterpriseNetwork(orgId);

  const stats = useMemo(() => {
    if (!data) return null;
    const nodes = data.nodes ?? [];
    const spof = nodes.filter((n) => n.data?.isSpof).length;
    const pain = nodes.filter((n) => (n.data?.painScore ?? 0) >= 7).length;
    const gaps = nodes.reduce((s, n) => s + (n.data?.gapCount ?? 0), 0);
    return { nodeCount: nodes.length, edgeCount: (data.edges ?? []).length, spof, pain, gaps };
  }, [data]);

  return (
    <div className="h-full flex flex-col bg-bg">
      <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[13px] font-semibold text-fg flex items-center gap-2">
            <Network size={16} className="text-accent" /> 企业流程数字孪生
          </span>
          {stats && stats.nodeCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Badge tone="neutral" size="sm">{stats.nodeCount} 节点 · {stats.edgeCount} 边</Badge>
              {stats.pain > 0 && <Badge tone="danger" size="sm"><Flame size={10} /> {stats.pain} 高痛点</Badge>}
              {stats.gaps > 0 && <Badge tone="warning" size="sm"><AlertTriangle size={10} /> {stats.gaps} 缺口</Badge>}
              {stats.spof > 0 && <Badge tone="danger" size="sm" dot>{stats.spof} 单点故障</Badge>}
            </div>
          )}
        </div>
        <Button variant="ghost" size="icon-sm" loading={isFetching} onClick={() => refetch()} aria-label="刷新" title="刷新">
          {!isFetching && <RefreshCw size={15} />}
        </Button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {isLoading && <CenterSpinner label="加载企业流程网" />}
        {isError && <div className="h-full flex items-center justify-center"><ErrorState message={(error as Error)?.message} onRetry={() => refetch()} /></div>}
        {!isLoading && !isError && (!data || (data.nodes ?? []).length === 0) && (
          <div className="h-full flex items-center justify-center">
            <EmptyState
              icon={<Network size={24} />}
              title="暂无流程数据"
              description="在下方访谈栏开始员工访谈，系统将自动从对话中抽取流程节点，实时构建企业流程数字孪生。"
            />
          </div>
        )}
        {!isLoading && !isError && data && (data.nodes ?? []).length > 0 && (
          <>
            <FlowCanvas data={data} onNodeClick={onNodeClick} />
            <div className="absolute bottom-4 left-4 z-10 flex flex-wrap gap-x-3 gap-y-1.5 px-3 py-2 rounded-lg glass glass-border shadow-sm max-w-[280px]">
              {LEGEND.map(([label, color]) => (
                <span key={label} className="flex items-center gap-1.5 text-[10.5px] font-medium text-fg-secondary">
                  <span className="h-2 w-2 rounded-full" style={{ background: color }} />{label}
                </span>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
