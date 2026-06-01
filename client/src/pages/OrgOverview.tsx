import { useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { Network, Users2, BarChart3, MessagesSquare } from "lucide-react";
import EnterpriseNetwork from "../components/EnterpriseNetwork";
import EmployeeRelations from "../components/EmployeeRelations";
import DetailPanel from "../components/DetailPanel";
import ReportPanel from "../components/ReportPanel";
import InterviewChat from "../components/InterviewChat";
import { AppShell } from "../components/AppShell";
import { useSession } from "../app/SessionContext";
import { useEnterpriseReport, qk } from "../hooks/queries";
import { CenterSpinner, EmptyState, ErrorState } from "../ui";
import { cn } from "../lib/utils";

type View = "capture" | "enterprise" | "relations" | "report";

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "capture", label: "信息采集", icon: <MessagesSquare size={19} /> },
  { id: "enterprise", label: "流程图谱", icon: <Network size={19} /> },
  { id: "relations", label: "关系网络", icon: <Users2 size={19} /> },
  { id: "report", label: "分析报告", icon: <BarChart3 size={19} /> },
];

export default function OrgOverview() {
  const { view: viewParam } = useParams<{ view?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { identity } = useSession();
  const orgId = identity!.orgId;

  const view = (NAV.find((n) => n.id === viewParam)?.id ?? "enterprise") as View;
  const setView = useCallback((v: View) => navigate(`/overview/${v}`), [navigate]);

  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const report = useEnterpriseReport(orgId, view === "report");

  const onCaptured = useCallback(() => {
    qc.invalidateQueries({ queryKey: qk.enterpriseNetwork(orgId) });
    qc.invalidateQueries({ queryKey: qk.employeeRelations(orgId) });
    qc.invalidateQueries({ queryKey: qk.enterpriseReport(orgId) });
  }, [qc, orgId]);

  return (
    <AppShell scroll={false} title="企业总览" subtitle={identity!.orgName}>
      <div className="h-full flex">
        <nav className="w-[68px] shrink-0 border-r border-border bg-card flex flex-col items-center py-3 gap-1">
          {NAV.map((n) => {
            const active = view === n.id;
            return (
              <button key={n.id} onClick={() => setView(n.id)} title={n.label}
                className={cn(
                  "w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all cursor-pointer",
                  active ? "bg-accent-light text-accent" : "text-fg-tertiary hover:bg-muted hover:text-fg",
                )}>
                {n.icon}
                <span className="text-[9.5px] font-semibold leading-none">{n.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex-1 min-w-0 relative">
          {view === "capture" && (
            <InterviewChat
              orgId={orgId}
              title="企业流程信息采集"
              subtitle="作为管理者，描述企业整体流程、跨部门协作与关键瓶颈"
              placeholder="例如：销售接到订单后转给运营，运营排产再通知采购…"
              enableConfirm
              onConfirmed={onCaptured}
            />
          )}
          {view === "enterprise" && (
            <EnterpriseNetwork orgId={orgId} onNodeClick={setSelectedNode} onInterviewEmployee={() => {}} />
          )}
          {view === "relations" && (
            <EmployeeRelations orgId={orgId} onNodeClick={setSelectedNode} onInterviewEmployee={() => {}} />
          )}
          {view === "report" && (
            <div className="h-full overflow-y-auto p-5">
              {report.isLoading && <CenterSpinner label="生成综合报告" />}
              {report.isError && (
                <div className="h-full flex items-center justify-center">
                  <ErrorState
                    title="暂无报告数据"
                    message="该企业还没有完成任何员工访谈，无法生成综合报告。"
                    onRetry={() => report.refetch()}
                  />
                </div>
              )}
              {report.isSuccess && (report.data ? <ReportPanel report={report.data} /> : <EmptyState title="暂无报告" />)}
            </div>
          )}

          {selectedNode && <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
        </div>
      </div>
    </AppShell>
  );
}
