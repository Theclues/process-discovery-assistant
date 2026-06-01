import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Send, Sparkles, CheckCircle2, ListChecks } from "lucide-react";
import { useChat } from "../hooks/useChat";
import { api } from "../lib/api";
import { Avatar, Button, Dialog, Textarea, Badge, Spinner, useToast } from "../ui";
import { nodeTypeIcon } from "../lib/utils";
import { cn } from "../lib/utils";
import type { ReactFlowData } from "../types";

const NT_LABEL: Record<string, string> = {
  ProcessStep: "流程步骤", DecisionPoint: "决策点", WaitState: "等待环节", Artifact: "文档/数据",
  ExternalEntity: "外部系统", Role: "角色", Department: "部门",
};

interface Props {
  orgId: string;
  empId?: string;
  engagementId?: string;
  title?: string;
  subtitle?: string;
  placeholder?: string;
  /** Show the "confirm AI summary" flow (for the interviewee to validate). */
  enableConfirm?: boolean;
  onConfirmed?: () => void;
}

export default function InterviewChat({
  orgId, empId, engagementId, title = "AI 信息采集助手", subtitle = "用自己的话描述，AI 会自动整理归类",
  placeholder = "例如：我每天先从系统导出订单，再核对库存…", enableConfirm = true, onConfirmed,
}: Props) {
  const toast = useToast();
  const chat = useChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [summary, setSummary] = useState<ReactFlowData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    chat.initSession(orgId, empId || undefined, engagementId);
  }, [orgId, empId, engagementId, chat]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [chat.messages]);

  const send = async () => {
    const v = input.trim();
    if (!v || chat.isProcessing) return;
    setInput("");
    await chat.sendMessage(v);
  };

  const openConfirm = async () => {
    if (!chat.sessionId) return;
    setConfirmOpen(true);
    setSummaryLoading(true);
    try {
      setSummary(await api.sessionReactFlow(chat.sessionId));
    } catch {
      setSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  };

  const confirm = async () => {
    await chat.concludeSession();
    setConfirmOpen(false);
    toast.success("已确认", "感谢确认，AI 整理的内容已纳入企业知识库");
    onConfirmed?.();
  };

  const hasModel = chat.nodeCount > 0;

  // Group nodes by type for the confirmation summary.
  const grouped = new Map<string, string[]>();
  for (const n of summary?.nodes ?? []) {
    const t = n.data?.nodeType ?? "ProcessStep";
    const arr = grouped.get(t) ?? [];
    arr.push(n.data?.label ?? "未命名");
    grouped.set(t, arr);
  }

  return (
    <div className="h-full flex flex-col bg-card min-h-0">
      <div className="px-5 py-3 border-b border-border-light flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-accent-light flex items-center justify-center text-accent"><Sparkles size={16} /></div>
          <div>
            <div className="text-sm font-semibold text-fg">{title}</div>
            <div className="text-[11px] text-fg-tertiary">{subtitle}</div>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          {chat.completeness && (
            <div className="hidden sm:flex items-center gap-1.5" title={`对照咨询要求已覆盖 ${chat.completeness.coveredCount}/${chat.completeness.total} 项`}>
              <span className="text-[11px] font-medium text-fg-tertiary">完整度</span>
              <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", chat.completeness.met ? "bg-success" : "bg-accent")}
                  style={{ width: `${Math.round(chat.completeness.score * 100)}%` }} />
              </div>
              <span className="text-[11px] font-semibold text-fg-secondary tabular">{Math.round(chat.completeness.score * 100)}%</span>
            </div>
          )}
          {!chat.completeness && hasModel && <Badge tone="neutral" size="sm">{chat.nodeCount} 节点 · {chat.edgeCount} 关系</Badge>}
          {enableConfirm && (
            <Button size="sm" variant={chat.completeness?.met ? "primary" : hasModel ? "subtle" : "secondary"} disabled={!hasModel || chat.isProcessing}
              leftIcon={<ListChecks size={14} />} onClick={openConfirm}>
              确认 AI 整理结果
            </Button>
          )}
        </div>
      </div>

      {chat.completeness && !chat.completeness.met && chat.completeness.missing.length > 0 && (
        <div className="px-5 py-2 border-b border-border-light bg-subtle flex items-center gap-2 flex-wrap shrink-0">
          <span className="text-[11px] font-medium text-fg-tertiary shrink-0">顾问还想了解：</span>
          {chat.completeness.missing.slice(0, 5).map((m) => (
            <Badge key={m.key} tone="warning" size="sm">{m.label}</Badge>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
        {chat.messages.map((m, i) => (
          <div key={i} className={cn("flex gap-2.5 max-w-[80%]", m.role === "user" ? "ml-auto flex-row-reverse" : "")}>
            {m.role === "assistant" && <Avatar name="AI" size={28} className="mt-0.5" />}
            <div className={cn(
              "px-3.5 py-2.5 rounded-xl text-[13.5px] leading-relaxed",
              m.role === "user" ? "bg-accent text-white rounded-tr-sm" : "bg-muted text-fg rounded-tl-sm prose-chat",
            )}>
              {m.role === "assistant" ? <ReactMarkdown>{m.content}</ReactMarkdown> : <span className="whitespace-pre-wrap">{m.content}</span>}
              {m.isStreaming && <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent ml-1 align-middle animate-blink" />}
            </div>
          </div>
        ))}
        {chat.error && <div className="px-3.5 py-2.5 rounded-lg bg-danger-light text-danger text-[12.5px] border-l-2 border-danger">{chat.error}</div>}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-border-light shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            disabled={chat.isProcessing && !chat.isStreaming}
            placeholder={placeholder}
            className="min-h-[76px] max-h-48 py-3 text-[14px] leading-relaxed"
          />
          <Button size="lg" className="h-[76px] w-12 shrink-0" disabled={!input.trim() || chat.isProcessing} onClick={send} aria-label="发送">
            <Send size={18} />
          </Button>
        </div>
        <div className="text-[11px] text-fg-tertiary mt-1.5 px-1">按 Enter 发送 · Shift+Enter 换行</div>
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="请确认 AI 整理的内容"
        description="以下是 AI 从你的描述中整理归类的流程信息。请确认是否准确——如有遗漏或错误，可关闭后继续补充说明。"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>继续补充</Button>
            <Button loading={chat.isProcessing} leftIcon={<CheckCircle2 size={15} />} onClick={confirm}>确认无误</Button>
          </>
        }
      >
        {summaryLoading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : grouped.size === 0 ? (
          <p className="text-sm text-fg-tertiary py-6 text-center">还没有可确认的内容，请先描述你的工作流程。</p>
        ) : (
          <div className="space-y-4 py-1">
            {chat.completeness && (
              <div className="rounded-lg border border-border-light bg-subtle px-3.5 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[12px] font-semibold text-fg">对照咨询诊断要求</span>
                  <span className={cn("text-[12px] font-bold tabular", chat.completeness.met ? "text-success" : "text-warning")}>
                    {chat.completeness.coveredCount}/{chat.completeness.total} 项
                  </span>
                </div>
                {chat.completeness.missing.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11.5px] text-fg-tertiary">尚可补充：</span>
                    {chat.completeness.missing.map((m) => <Badge key={m.key} tone="warning" size="sm">{m.label}</Badge>)}
                  </div>
                ) : (
                  <div className="text-[11.5px] text-success">关键维度均已覆盖，资料满足诊断要求。</div>
                )}
              </div>
            )}
            {[...grouped.entries()].map(([type, labels]) => (
              <div key={type}>
                <div className="text-[12px] font-semibold text-fg-secondary mb-2 flex items-center gap-1.5">
                  <span className="text-base">{nodeTypeIcon(type)}</span>{NT_LABEL[type] ?? type}
                  <Badge tone="neutral" size="sm">{labels.length}</Badge>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {labels.map((l, i) => <Badge key={i} tone="accent" size="sm">{l}</Badge>)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Dialog>
    </div>
  );
}
