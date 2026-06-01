import { useCallback, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Network, Users2, Lightbulb, FileStack, BarChart3, ArrowLeft } from "lucide-react";
import EnterpriseNetwork from "../components/EnterpriseNetwork";
import EmployeeRelations from "../components/EmployeeRelations";
import DetailPanel from "../components/DetailPanel";
import ReportPanel from "../components/ReportPanel";
import ConsultingStrategyPanel from "../components/ConsultingStrategyPanel";
import DeliverablesPanel from "../components/DeliverablesPanel";
import { AppShell } from "../components/AppShell";
import { useSession } from "../app/SessionContext";
import { useEngagement, useEmployees } from "../hooks/queries";
import { Badge, Button, EmptyState, CenterSpinner, useToast } from "../ui";
import { api } from "../lib/api";
import type { EngagementPhase, Report } from "../types";
import { cn } from "../lib/utils";

type View = "enterprise" | "relations" | "strategy" | "deliverables" | "report";

const phaseLabel: Record<EngagementPhase, string> = { diagnosis: "诊断", design: "方案设计", implementation: "落地实施" };

const NAV: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: "enterprise", label: "流程图谱", icon: <Network size={19} /> },
  { id: "relations", label: "关系网络", icon: <Users2 size={19} /> },
  { id: "strategy", label: "战略工作台", icon: <Lightbulb size={19} /> },
  { id: "deliverables", label: "交付物", icon: <FileStack size={19} /> },
  { id: "report", label: "分析报告", icon: <BarChart3 size={19} /> },
];

export default function Workspace() {
  const { engagementId, view: viewParam } = useParams<{ engagementId: string; view?: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { identity } = useSession();
  const orgId = identity!.orgId;

  const engagement = useEngagement(engagementId);
  const employees = useEmployees(orgId).data ?? [];

  const view = (NAV.find((n) => n.id === viewParam)?.id ?? "enterprise") as View;
  const setView = useCallback((v: View) => navigate(`/engagements/${engagementId}/${v}`), [engagementId, navigate]);

  const [selectedNode, setSelectedNode] = useState<Record<string, unknown> | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const loadReport = useCallback(async () => {
    setReportLoading(true);
    try {
      setReport(await api.enterpriseReport(orgId));
    } catch (e) {
      toast.error("生成报告失败", e instanceof Error ? e.message : undefined);
    } finally {
      setReportLoading(false);
    }
  }, [orgId, toast]);

  return (
    <AppShell
      scroll={false}
      title={engagement.data?.name ?? "加载中…"}
      subtitle={
        <span className="flex items-center gap-1.5">
          {identity!.orgName} · {employees.length} 位成员
          {engagement.data && <Badge tone="accent" size="sm">{phaseLabel[engagement.data.phase]}</Badge>}
        </span>
      }
      actions={
        <Button variant="ghost" size="sm" leftIcon={<ArrowLeft size={14} />} onClick={() => navigate("/engagements")}>
          <span className="hidden sm:inline">项目中心</span>
        </Button>
      }
    >
      <div className="h-full flex">
        {/* Vertical nav rail */}
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

        {/* Canvas */}
        <div className="flex-1 min-w-0 relative">
          {engagement.isLoading && <CenterSpinner label="加载项目" />}
          {!engagement.isLoading && (
            <div className="h-full">
              {view === "enterprise" && <EnterpriseNetwork orgId={orgId} onNodeClick={setSelectedNode} onInterviewEmployee={() => {}} />}
              {view === "relations" && <EmployeeRelations orgId={orgId} onNodeClick={setSelectedNode} onInterviewEmployee={() => {}} />}
              {view === "strategy" && <ConsultingStrategyPanel engagementId={engagementId!} />}
              {view === "deliverables" && <DeliverablesPanel engagementId={engagementId!} />}
              {view === "report" && (
                report ? (
                  <div className="h-full overflow-y-auto p-5"><ReportPanel report={report} /></div>
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <EmptyState
                      icon={<BarChart3 size={22} />}
                      title="还没有综合分析报告"
                      description="待企业成员完成 AI 信息采集后，在此生成企业级综合诊断报告。"
                      action={<Button loading={reportLoading} onClick={loadReport}>生成报告</Button>}
                    />
                  </div>
                )
              )}
            </div>
          )}

          {selectedNode && <DetailPanel node={selectedNode} onClose={() => setSelectedNode(null)} />}
        </div>
      </div>
    </AppShell>
  );
}
