import { Lightbulb, Sparkles, FlaskConical, Target, FileSearch, CheckCircle2, XCircle, CircleDashed } from "lucide-react";
import type { HypothesisStatus, FindingSeverity } from "../types";
import { useWorkbench, useGenerateHypotheses, useGenerateFindings } from "../hooks/queries";
import { Button, Card, Badge, StatCard, EmptyState, CenterSpinner, ErrorState, useToast, Divider } from "../ui";

interface Props { engagementId: string }

const statusMeta: Record<HypothesisStatus, { label: string; tone: "neutral" | "success" | "danger"; icon: React.ReactNode }> = {
  open: { label: "待验证", tone: "neutral", icon: <CircleDashed size={12} /> },
  validated: { label: "已验证", tone: "success", icon: <CheckCircle2 size={12} /> },
  rejected: { label: "已证伪", tone: "danger", icon: <XCircle size={12} /> },
};
const severityMeta: Record<FindingSeverity, { label: string; tone: "danger" | "warning" | "neutral" }> = {
  high: { label: "高影响", tone: "danger" },
  medium: { label: "中影响", tone: "warning" },
  low: { label: "低影响", tone: "neutral" },
};

export default function ConsultingStrategyPanel({ engagementId }: Props) {
  const toast = useToast();
  const wb = useWorkbench(engagementId);
  const genHyp = useGenerateHypotheses(engagementId);
  const genFind = useGenerateFindings(engagementId);

  const runHyp = async () => {
    try { await genHyp.mutateAsync(); toast.success("假设已生成", "基于访谈证据的 AI 假设树已更新"); }
    catch (e) { toast.error("生成假设失败", e instanceof Error ? e.message : undefined); }
  };
  const runFind = async () => {
    try { await genFind.mutateAsync(); toast.success("洞察已生成", "关键发现与行动建议已更新"); }
    catch (e) { toast.error("生成洞察失败", e instanceof Error ? e.message : undefined); }
  };

  if (wb.isLoading) return <CenterSpinner label="加载战略工作台" />;
  if (wb.isError) return <div className="h-full flex items-center justify-center"><ErrorState message={(wb.error as Error)?.message} onRetry={() => wb.refetch()} /></div>;

  const data = wb.data!;
  const noData = data.stats.nodes === 0;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-6 py-6">
        <header className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-fg flex items-center gap-2"><Lightbulb size={22} className="text-accent" /> 战略工作台</h1>
            <p className="text-sm text-fg-secondary mt-1.5">假设驱动 · 证据综合 · 将访谈转化为董事会级洞察与行动。</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" loading={genHyp.isPending} disabled={noData} leftIcon={<Sparkles size={15} />} onClick={runHyp}>生成假设</Button>
            <Button size="sm" loading={genFind.isPending} disabled={noData} leftIcon={<FileSearch size={15} />} onClick={runFind}>生成洞察</Button>
          </div>
        </header>

        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 mb-6">
          <StatCard label="访谈" value={data.stats.sessions} />
          <StatCard label="节点" value={data.stats.nodes} />
          <StatCard label="连接" value={data.stats.edges} />
          <StatCard label="缺口" value={data.stats.gaps} tone={data.stats.gaps > 0 ? "warning" : "neutral"} />
          <StatCard label="假设" value={data.stats.hypotheses} tone="accent" />
          <StatCard label="洞察" value={data.stats.findings} tone="accent" />
        </div>

        {noData && (
          <Card><EmptyState icon={<FlaskConical size={22} />} title="尚无诊断证据" description="先在流程图谱视图通过访谈采集流程数据，再回到这里用 AI 生成假设与洞察。" /></Card>
        )}

        {!noData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Hypotheses */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Target size={17} className="text-accent" />
                <h2 className="text-[15px] font-semibold text-fg">核心假设</h2>
                <Badge tone="neutral" size="sm">{data.hypotheses.length}</Badge>
              </div>
              {data.hypotheses.length === 0 ? (
                <Card><EmptyState title="暂无假设" description="点击「生成假设」，AI 将基于 MECE 原则提出可证伪的根因假设。" /></Card>
              ) : (
                <div className="space-y-3">
                  {data.hypotheses.map((h, i) => {
                    const sm = statusMeta[h.status];
                    return (
                      <Card key={h.id} className="overflow-hidden">
                        <div className="px-4 py-3.5">
                          <div className="flex items-start gap-2.5">
                            <span className="shrink-0 h-6 w-6 rounded-md bg-accent-light text-accent text-xs font-bold flex items-center justify-center mt-0.5">H{i + 1}</span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[14px] font-semibold text-fg leading-snug">{h.statement}</p>
                              <p className="text-[12.5px] text-fg-secondary mt-1.5 leading-relaxed whitespace-pre-wrap">{h.rationale}</p>
                            </div>
                          </div>
                          <Divider className="my-3" />
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge tone={sm.tone} size="sm">{sm.icon}{sm.label}</Badge>
                            <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
                              <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                                <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(h.confidence * 100)}%` }} />
                              </div>
                              <span className="text-[11px] font-semibold text-fg-secondary tabular">{Math.round(h.confidence * 100)}%</span>
                            </div>
                            <span className="text-[11px] text-fg-tertiary">{h.evidenceSessionIds.length} 条证据</span>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Findings */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <FileSearch size={17} className="text-accent" />
                <h2 className="text-[15px] font-semibold text-fg">关键发现</h2>
                <Badge tone="neutral" size="sm">{data.findings.length}</Badge>
              </div>
              {data.findings.length === 0 ? (
                <Card><EmptyState title="暂无洞察" description="点击「生成洞察」，AI 将提炼带 So-What 影响与行动建议的关键发现。" /></Card>
              ) : (
                <div className="space-y-3">
                  {data.findings.map((f) => {
                    const sm = severityMeta[f.severity];
                    return (
                      <Card key={f.id}>
                        <div className="px-4 py-3.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-[14px] font-semibold text-fg leading-snug">{f.title}</h3>
                            <Badge tone={sm.tone} size="sm">{sm.label}</Badge>
                          </div>
                          <p className="text-[12.5px] text-fg-secondary mt-2 leading-relaxed">{f.insight}</p>
                          <div className="mt-3 p-3 rounded-lg bg-accent-light/60 border border-accent-muted/40">
                            <div className="text-[10.5px] font-bold text-accent uppercase tracking-wide mb-1">建议行动</div>
                            <p className="text-[12.5px] text-fg leading-relaxed">{f.recommendation}</p>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
