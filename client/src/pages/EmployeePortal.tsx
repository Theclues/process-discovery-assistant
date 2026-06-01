import { useSession } from "../app/SessionContext";
import { useEmployees } from "../hooks/queries";
import { AppShell } from "../components/AppShell";
import InterviewChat from "../components/InterviewChat";
import { Card } from "../ui";
import { ClipboardList, MessageSquare, ListChecks } from "lucide-react";

export default function EmployeePortal() {
  const { identity } = useSession();
  const { orgId, empId } = identity!;
  const employees = useEmployees(orgId);
  const employee = employees.data?.find((e) => e.id === empId);

  return (
    <AppShell title="我的工作梳理" subtitle={`${identity!.orgName}${employee?.role ? ` · ${employee.role}` : ""}`} scroll={false}>
      <div className="h-full max-w-6xl mx-auto w-full px-4 sm:px-6 py-5 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 min-h-0">
        {/* Guidance sidebar */}
        <aside className="hidden lg:flex flex-col gap-4 min-h-0 overflow-y-auto">
          <Card>
            <div className="px-5 py-5">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList size={18} className="text-accent" />
                <h2 className="text-base font-semibold text-fg">你只需要做两件事</h2>
              </div>
              <ol className="space-y-3 mt-3">
                <li className="flex gap-2.5">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-accent-light text-accent text-xs font-bold flex items-center justify-center"><MessageSquare size={13} /></span>
                  <div className="text-[13px] text-fg-secondary leading-relaxed">用大白话描述你的日常工作，AI 会自动追问并整理。</div>
                </li>
                <li className="flex gap-2.5">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-accent-light text-accent text-xs font-bold flex items-center justify-center"><ListChecks size={13} /></span>
                  <div className="text-[13px] text-fg-secondary leading-relaxed">检查 AI 整理的内容，确认是否准确无误。</div>
                </li>
              </ol>
            </div>
          </Card>
          <div className="p-3.5 rounded-lg bg-accent-light text-accent text-[12.5px] leading-relaxed">
            建议说明：你负责什么、从哪里接收信息、使用哪些系统、交给谁、哪里最慢或最痛。
          </div>
          <div className="text-[11.5px] text-fg-tertiary leading-relaxed px-1">
            你的描述只用于梳理流程，不会生成评价报告。报告与分析由咨询顾问统一完成。
          </div>
        </aside>

        {/* Chat */}
        <Card className="min-h-0 overflow-hidden">
          <InterviewChat
            orgId={orgId}
            empId={empId}
            title="AI 资料采集助手"
            subtitle="面向你本人的自助梳理"
            enableConfirm
          />
        </Card>
      </div>
    </AppShell>
  );
}
