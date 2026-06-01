import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { FileStack, Sparkles, Download, Printer, FileText } from "lucide-react";
import { useWorkbench, useGenerateDeliverable } from "../hooks/queries";
import { Button, Card, EmptyState, CenterSpinner, ErrorState, useToast, Badge } from "../ui";
import { cn } from "../lib/utils";

interface Props { engagementId: string }

function downloadMarkdown(title: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[\\/:*?"<>|]/g, "_")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function printDeliverable(title: string, html: string) {
  const w = window.open("", "_blank", "width=900,height=1200");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>
    <style>
      body{font-family:-apple-system,'Segoe UI','Noto Sans SC',sans-serif;max-width:760px;margin:48px auto;padding:0 24px;color:#111827;line-height:1.7}
      h1{font-size:26px;border-bottom:2px solid #4f46e5;padding-bottom:10px}
      h2{font-size:19px;margin-top:28px;color:#0a1f44}
      h3{font-size:15px;margin-top:18px}
      ul,ol{padding-left:22px} li{margin:4px 0}
      code{background:#f1f5f9;padding:2px 5px;border-radius:4px;font-size:13px}
      blockquote{border-left:3px solid #c7d2fe;padding-left:14px;color:#475569;margin-left:0}
      table{border-collapse:collapse;width:100%} td,th{border:1px solid #e2e8f0;padding:6px 10px;text-align:left}
    </style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => { w.focus(); w.print(); }, 300);
}

export default function DeliverablesPanel({ engagementId }: Props) {
  const toast = useToast();
  const wb = useWorkbench(engagementId);
  const genDeliv = useGenerateDeliverable(engagementId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (wb.data && !selectedId && wb.data.deliverables[0]) setSelectedId(wb.data.deliverables[0].id);
  }, [wb.data, selectedId]);

  const generate = async () => {
    try {
      const { deliverable } = await genDeliv.mutateAsync();
      setSelectedId(deliverable.id);
      toast.success("交付物已生成", "AI 撰写的高管诊断简报已就绪");
    } catch (e) {
      toast.error("生成交付物失败", e instanceof Error ? e.message : undefined);
    }
  };

  if (wb.isLoading) return <CenterSpinner label="加载交付物" />;
  if (wb.isError) return <div className="h-full flex items-center justify-center"><ErrorState message={(wb.error as Error)?.message} onRetry={() => wb.refetch()} /></div>;

  const data = wb.data!;
  const selected = data.deliverables.find((d) => d.id === selectedId) ?? data.deliverables[0];
  const noData = data.stats.nodes === 0;

  return (
    <div className="h-full grid grid-cols-1 lg:grid-cols-[300px_1fr] bg-bg">
      <aside className="border-r border-border bg-card p-4 overflow-y-auto flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <FileStack size={18} className="text-accent" />
          <h2 className="text-base font-semibold text-fg">交付物</h2>
        </div>
        <p className="text-[11.5px] text-fg-tertiary mb-3">董事会级输出资产 · 金字塔原理</p>
        <Button className="w-full mb-3" loading={genDeliv.isPending} disabled={noData} leftIcon={<Sparkles size={15} />} onClick={generate}>
          生成高管简报
        </Button>
        {data.deliverables.length === 0 && (
          <div className="text-[12.5px] text-fg-tertiary text-center py-8">暂无交付物</div>
        )}
        <div className="space-y-2">
          {data.deliverables.map((d) => (
            <button key={d.id} onClick={() => setSelectedId(d.id)}
              className={cn("w-full text-left p-3 rounded-lg border transition-all cursor-pointer",
                selected?.id === d.id ? "border-accent bg-accent-light" : "border-border bg-card hover:border-border-strong")}>
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-accent shrink-0" />
                <div className="text-[13px] font-semibold text-fg truncate">{d.title}</div>
              </div>
              <div className="text-[11px] text-fg-tertiary mt-1">{new Date(d.createdAt).toLocaleString("zh-CN")}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="overflow-y-auto">
        {!selected ? (
          <div className="h-full flex items-center justify-center">
            <EmptyState icon={<FileStack size={22} />} title="还没有交付物"
              description={noData ? "先采集访谈数据，再生成 AI 撰写的高管简报。" : "点击「生成高管简报」，AI 将基于证据、假设与发现撰写金字塔结构的董事会简报。"} />
          </div>
        ) : (
          <div className="max-w-3xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2 min-w-0">
                <Badge tone="accent" size="sm">高管简报</Badge>
                <span className="text-[12px] text-fg-tertiary truncate">{new Date(selected.createdAt).toLocaleString("zh-CN")}</span>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" leftIcon={<Download size={14} />} onClick={() => downloadMarkdown(selected.title, selected.contentMarkdown)}>Markdown</Button>
                <Button variant="outline" size="sm" leftIcon={<Printer size={14} />} onClick={() => printDeliverable(selected.title, document.getElementById("deliverable-body")?.innerHTML ?? "")}>导出 PDF</Button>
              </div>
            </div>
            <Card elevated>
              <div id="deliverable-body" className="prose-doc px-8 py-7">
                <ReactMarkdown>{selected.contentMarkdown}</ReactMarkdown>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
