import { Component, type ReactNode } from "react";
import {
  BarChart3, AlertTriangle, Building2, Lightbulb, Users, GitBranch,
  Layers, ShieldAlert, Network,
} from "lucide-react";
import type { Report } from "../types";
import { Card, Badge, StatCard, EmptyState } from "../ui";
import { gapTypeLabel } from "../lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  structural: "结构性",
  control_flow: "控制流",
  temporal: "时序",
  organizational: "组织",
  information_quality: "信息质量",
};
const CATEGORY_COLOR: Record<string, string> = {
  structural: "#4f46e5",
  control_flow: "#d97706",
  temporal: "#0891b2",
  organizational: "#9333ea",
  information_quality: "#dc2626",
};

class ReportErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return <div className="p-8"><EmptyState title="报告渲染出错" description="数据格式异常，请重新生成报告。" /></div>;
    }
    return this.props.children;
  }
}

function Section({ icon, title, children, right }: { icon: ReactNode; title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <Card>
      <div className="px-5 py-3.5 border-b border-border-light flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg flex items-center gap-2">{icon}{title}</h2>
        {right}
      </div>
      <div className="px-5 py-4">{children}</div>
    </Card>
  );
}

function ReportPanelInner({ report }: { report: Report | null }) {
  if (!report) return <EmptyState title="暂无报告" />;
  const { stats, gapsByCategory, topGaps, departmentSummary, recommendations, crossSessionInsights } = report;

  const gapEntries = Object.entries(gapsByCategory ?? {}).sort((a, b) => b[1] - a[1]);
  const maxGap = Math.max(1, ...gapEntries.map(([, v]) => v));
  const maxPain = Math.max(1, ...(departmentSummary ?? []).map((d) => d.avgPain));
  const maxScore = Math.max(0.01, ...(topGaps ?? []).map((g) => g.score));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Summary hero */}
      <Card elevated>
        <div className="px-6 py-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={18} className="text-accent" />
            <h1 className="text-lg font-bold text-fg">综合诊断报告</h1>
          </div>
          <p className="text-[14px] text-fg-secondary leading-relaxed">{report.summary}</p>
        </div>
      </Card>

      {/* Stat grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <StatCard label="节点" value={stats.nodeCount} icon={<Layers size={14} />} />
        <StatCard label="连接" value={stats.edgeCount} icon={<GitBranch size={14} />} />
        <StatCard label="置信度" value={`${Math.round(stats.avgConfidence * 100)}%`} tone={stats.avgConfidence >= 0.6 ? "success" : "warning"} />
        <StatCard label="部门" value={stats.departmentCount} icon={<Building2 size={14} />} />
        <StatCard label="跨部门交接" value={stats.crossDepartmentEdges} tone={stats.crossDepartmentEdges > 3 ? "warning" : "neutral"} />
        <StatCard label="单点故障" value={stats.spofCount} tone={stats.spofCount > 0 ? "danger" : "success"} icon={<ShieldAlert size={14} />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Gap distribution */}
        <Section icon={<AlertTriangle size={16} className="text-warning" />} title="缺口分布">
          {gapEntries.length === 0 ? (
            <p className="text-sm text-fg-tertiary py-4 text-center">未检测到缺口</p>
          ) : (
            <div className="space-y-3">
              {gapEntries.map(([cat, count]) => (
                <div key={cat}>
                  <div className="flex justify-between text-[12.5px] mb-1">
                    <span className="text-fg-secondary font-medium">{CATEGORY_LABEL[cat] ?? cat}</span>
                    <span className="text-fg-tertiary tabular">{count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${(count / maxGap) * 100}%`, background: CATEGORY_COLOR[cat] ?? "#4f46e5" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Department pain */}
        <Section icon={<Building2 size={16} className="text-accent" />} title="部门痛点画像">
          {(departmentSummary ?? []).length === 0 ? (
            <p className="text-sm text-fg-tertiary py-4 text-center">暂无部门数据</p>
          ) : (
            <div className="space-y-3">
              {departmentSummary.slice(0, 8).map((d) => (
                <div key={d.department}>
                  <div className="flex justify-between text-[12.5px] mb-1">
                    <span className="text-fg-secondary font-medium truncate">{d.department}</span>
                    <span className="text-fg-tertiary tabular">{d.nodeCount} 节点 · 痛点 {d.avgPain.toFixed(1)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-danger transition-all" style={{ width: `${(d.avgPain / maxPain) * 100}%`, opacity: 0.4 + (d.avgPain / 10) * 0.6 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Top gaps */}
      <Section icon={<AlertTriangle size={16} className="text-danger" />} title="重点缺口" right={<Badge tone="neutral" size="sm">{(topGaps ?? []).length}</Badge>}>
        {(topGaps ?? []).length === 0 ? (
          <p className="text-sm text-fg-tertiary py-4 text-center">未检测到重点缺口</p>
        ) : (
          <div className="space-y-2.5">
            {topGaps.map((g, i) => {
              const ratio = g.score / maxScore;
              const tone = ratio >= 0.66 ? "danger" : ratio >= 0.33 ? "warning" : "info";
              return (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-subtle border border-border-light">
                  <Badge tone={tone} size="sm">{gapTypeLabel(g.type)}</Badge>
                  <p className="text-[13px] text-fg-secondary leading-snug flex-1">{g.description}</p>
                  <span className="text-[11px] font-semibold text-fg-tertiary tabular shrink-0">{g.score.toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* Recommendations */}
      {(recommendations ?? []).length > 0 && (
        <Section icon={<Lightbulb size={16} className="text-accent" />} title="行动建议">
          <ul className="space-y-2.5">
            {recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13.5px] text-fg-secondary leading-relaxed">
                <span className="shrink-0 mt-0.5 h-5 w-5 rounded-full bg-accent-light text-accent text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
                {r}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* Cross-session insights */}
      {crossSessionInsights && (
        <Section icon={<Network size={16} className="text-accent" />} title="跨员工洞察"
          right={<Badge tone="accent" size="sm">收敛度 {Math.round((crossSessionInsights.convergenceScore ?? 0) * 100)}%</Badge>}>
          <div className="space-y-4">
            {(crossSessionInsights.contributors ?? []).length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-fg-tertiary uppercase tracking-wide mb-2 flex items-center gap-1.5"><Users size={12} /> 贡献者</div>
                <div className="flex flex-wrap gap-1.5">
                  {crossSessionInsights.contributors.map((c, i) => (
                    <Badge key={i} tone="neutral" size="sm">{c.employeeName} · {c.sessionCount} 次</Badge>
                  ))}
                </div>
              </div>
            )}
            {(crossSessionInsights.agreements ?? []).length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-success uppercase tracking-wide mb-2">高共识节点</div>
                <div className="flex flex-wrap gap-1.5">
                  {crossSessionInsights.agreements.slice(0, 10).map((a, i) => (
                    <Badge key={i} tone="success" size="sm">{a.nodeLabel} ({a.contributorCount})</Badge>
                  ))}
                </div>
              </div>
            )}
            {(crossSessionInsights.disagreements ?? []).length > 0 && (
              <div>
                <div className="text-[11px] font-semibold text-warning uppercase tracking-wide mb-2">认知分歧</div>
                <div className="space-y-1.5">
                  {crossSessionInsights.disagreements.slice(0, 5).map((d, i) => (
                    <div key={i} className="text-[12.5px] text-fg-secondary">
                      <span className="font-semibold text-fg">{d.nodeLabel}</span>：{d.variants.map((v) => v.employeeName).join("、")} 描述不一致
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Section>
      )}
    </div>
  );
}

export default function ReportPanel({ report }: { report: Report | null }) {
  return <ReportErrorBoundary><ReportPanelInner report={report} /></ReportErrorBoundary>;
}
