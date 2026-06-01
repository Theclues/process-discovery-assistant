import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, ArrowRight, Briefcase, Target, Activity, ShieldCheck } from "lucide-react";
import type { Engagement, EngagementPhase } from "../types";
import { useEngagements, useCreateEngagement } from "../hooks/queries";
import { useSession } from "../app/SessionContext";
import { AppShell } from "../components/AppShell";
import {
  Button, Input, Textarea, Label, Select, Card, Badge, StatCard,
  EmptyState, CenterSpinner, ErrorState, useToast,
} from "../ui";

const phaseLabel: Record<EngagementPhase, string> = { diagnosis: "诊断", design: "方案设计", implementation: "落地实施" };
const statusLabel: Record<Engagement["status"], string> = { active: "进行中", paused: "暂停", completed: "已完成" };
const statusTone: Record<Engagement["status"], "success" | "neutral" | "accent"> = { active: "success", paused: "neutral", completed: "accent" };

export default function EngagementHub() {
  const navigate = useNavigate();
  const toast = useToast();
  const { identity } = useSession();
  const orgId = identity!.orgId;
  const isConsultant = identity!.role === "consultant";

  const engagements = useEngagements(orgId);
  const createEngagement = useCreateEngagement(orgId);

  const [name, setName] = useState("运营效率诊断项目");
  const [objective, setObjective] = useState("识别跨部门流程瓶颈，形成可落地的效率提升路线图");
  const [phase, setPhase] = useState<EngagementPhase>("diagnosis");

  const list = engagements.data ?? [];
  const activeCount = useMemo(() => list.filter((e) => e.status === "active").length, [list]);

  const create = async () => {
    if (!name.trim()) return;
    try {
      const e = await createEngagement.mutateAsync({ organizationId: orgId, name: name.trim(), objective: objective.trim(), phase });
      toast.success("项目已创建", e.name);
      navigate(`/engagements/${e.id}`);
    } catch (err) {
      toast.error("创建项目失败", err instanceof Error ? err.message : undefined);
    }
  };

  return (
    <AppShell
      title={isConsultant ? "AI 咨询项目中心" : "企业管理视图"}
      subtitle={`${identity!.orgName} · ${identity!.empName}`}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
        <div className={isConsultant ? "grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-7" : ""}>
          <section className="min-w-0">
            <header className="mb-6">
              <h1 className="text-3xl font-bold tracking-tight text-fg text-balance">
                {isConsultant ? "从访谈到董事会级交付物" : "企业流程与组织协作总览"}
              </h1>
              <p className="text-fg-secondary mt-2 leading-relaxed max-w-2xl">
                {isConsultant
                  ? "每个项目承载一个完整咨询 Engagement：诊断范围、访谈证据、流程图谱、关键发现与最终交付物。"
                  : "管理员可查看已创建项目的企业流程图、员工关系网与综合报告。"}
              </p>
            </header>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard label="活跃项目" value={activeCount} icon={<Activity size={15} />} tone="success" />
              <StatCard label="项目总数" value={list.length} icon={<Briefcase size={15} />} />
              <StatCard label="工作重心" value="诊断优先" icon={<Target size={15} />} tone="accent" />
            </div>

            <Card>
              <div className="px-5 py-3.5 border-b border-border-light flex items-center justify-between">
                <h2 className="text-sm font-semibold text-fg">咨询项目</h2>
                <span className="text-xs text-fg-tertiary">选择一个项目进入工作台</span>
              </div>

              {engagements.isLoading && <div className="py-16"><CenterSpinner label="加载项目中" /></div>}
              {engagements.isError && <ErrorState message={(engagements.error as Error)?.message} onRetry={() => engagements.refetch()} />}
              {engagements.isSuccess && list.length === 0 && (
                <EmptyState
                  icon={<Briefcase size={22} />}
                  title={isConsultant ? "还没有项目" : "暂无可查看项目"}
                  description={isConsultant ? "在右侧创建你的第一个商业化咨询项目，开始诊断之旅。" : "请先由咨询顾问创建项目。"}
                />
              )}

              <div className="divide-y divide-border-light">
                {list.map((p) => (
                  <button key={p.id} onClick={() => navigate(`/engagements/${p.id}`)}
                    className="w-full group flex items-center gap-4 p-5 text-left hover:bg-muted/60 transition-colors cursor-pointer">
                    <div className="min-w-0 flex-1">
                      <div className="text-[15px] font-semibold text-fg">{p.name}</div>
                      <div className="text-[13px] text-fg-tertiary mt-1 leading-relaxed line-clamp-2">{p.objective || "未填写项目目标"}</div>
                      <div className="flex gap-2 mt-2.5">
                        <Badge tone="accent" size="sm">{phaseLabel[p.phase]}</Badge>
                        <Badge tone={statusTone[p.status]} size="sm" dot>{statusLabel[p.status]}</Badge>
                      </div>
                    </div>
                    <ArrowRight size={18} className="text-fg-tertiary group-hover:text-accent group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                ))}
              </div>
            </Card>
          </section>

          {isConsultant && (
            <aside className="lg:sticky lg:top-6 h-fit">
              <Card elevated>
                <div className="px-5 pt-5 pb-2">
                  <h2 className="text-base font-semibold text-fg">新建 Engagement</h2>
                  <p className="text-[12.5px] text-fg-tertiary mt-1 leading-relaxed">
                    商业化边界从项目开始：客户目标、阶段、证据链与交付物都归属于一个项目。
                  </p>
                </div>
                <div className="px-5 py-4 space-y-3.5">
                  <div>
                    <Label>项目名称</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div>
                    <Label>咨询目标</Label>
                    <Textarea rows={4} value={objective} onChange={(e) => setObjective(e.target.value)} />
                  </div>
                  <div>
                    <Label>当前阶段</Label>
                    <Select value={phase} onChange={(e) => setPhase(e.target.value as EngagementPhase)}>
                      <option value="diagnosis">诊断</option>
                      <option value="design">方案设计</option>
                      <option value="implementation">落地实施</option>
                    </Select>
                  </div>
                  <Button className="w-full" loading={createEngagement.isPending} disabled={!name.trim()} leftIcon={<Plus size={16} />} onClick={create}>
                    创建并进入
                  </Button>
                </div>
              </Card>
            </aside>
          )}

          {!isConsultant && (
            <aside className="lg:sticky lg:top-6 h-fit mt-6 lg:mt-0">
              <Card>
                <div className="px-5 py-5">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck size={18} className="text-accent" />
                    <h2 className="text-base font-semibold text-fg">管理员权限</h2>
                  </div>
                  <p className="text-[12.5px] text-fg-tertiary leading-relaxed mb-3">
                    你当前是企业管理员，只能查看企业级流程、关系与报告。项目创建、访谈采集、假设与交付物生成属于咨询顾问权限。
                  </p>
                  <div className="p-3 rounded-lg bg-accent-light text-accent text-[12.5px] leading-relaxed font-medium">
                    可用功能：企业流程网、员工关系网、分析报告。
                  </div>
                </div>
              </Card>
            </aside>
          )}
        </div>
      </div>
    </AppShell>
  );
}
