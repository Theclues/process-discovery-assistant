import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Moon, Sun, Monitor, LogOut, ChevronDown } from "lucide-react";
import { Brand } from "./Brand";
import { Avatar } from "../ui";
import { useTheme } from "../app/ThemeProvider";
import { useSession } from "../app/SessionContext";
import { useHealth } from "../hooks/queries";
import { cn } from "../lib/utils";

function StatusPill() {
  const { data, isError } = useHealth();
  const ok = !isError && data?.status === "ok";
  const degraded = !isError && data?.status === "degraded";
  const tone = ok ? "bg-success" : degraded ? "bg-warning" : "bg-danger";
  const label = ok ? "AI 在线" : degraded ? "AI 降级" : "离线";
  const title = data
    ? `状态：${data.status} · LLM ${data.llm.configured ? "已配置" : "未配置"}（${data.llm.circuit}）· 活跃会话 ${data.activeSessions}`
    : "正在检查服务状态";
  return (
    <div className="hidden md:flex items-center gap-1.5 px-2.5 h-7 rounded-full bg-muted" title={title}>
      <span className={cn("h-1.5 w-1.5 rounded-full", tone, ok && "animate-pulse")} />
      <span className="text-[11px] font-semibold text-fg-secondary">{label}</span>
    </div>
  );
}

const roleLabel: Record<string, string> = {
  consultant: "咨询顾问",
  admin: "企业管理员",
  employee: "员工",
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options = [
    { id: "light", icon: <Sun size={15} />, label: "亮色" },
    { id: "dark", icon: <Moon size={15} />, label: "暗色" },
    { id: "system", icon: <Monitor size={15} />, label: "跟随系统" },
  ] as const;
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-muted">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => setTheme(o.id)}
          title={o.label}
          aria-label={o.label}
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center transition-all cursor-pointer",
            theme === o.id ? "bg-card text-accent shadow-xs" : "text-fg-tertiary hover:text-fg",
          )}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

function UserMenu() {
  const { identity, signOut } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  if (!identity) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 pl-1 pr-2 h-9 rounded-lg hover:bg-muted transition-colors cursor-pointer"
      >
        <Avatar name={identity.empName} size={28} />
        <div className="hidden sm:block text-left leading-tight">
          <div className="text-[12.5px] font-semibold text-fg">{identity.empName}</div>
          <div className="text-[10.5px] text-fg-tertiary">{roleLabel[identity.role]}</div>
        </div>
        <ChevronDown size={14} className="text-fg-tertiary" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-60 bg-card border border-border rounded-xl shadow-lg py-1.5 z-50 animate-scale-in origin-top-right">
          <div className="px-3.5 py-2.5 border-b border-border-light">
            <div className="text-sm font-semibold text-fg">{identity.empName}</div>
            <div className="text-xs text-fg-tertiary mt-0.5">{identity.orgName} · {roleLabel[identity.role]}</div>
          </div>
          <button
            onClick={() => { signOut(); navigate("/login", { replace: true }); }}
            className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-[13px] font-medium text-fg-secondary hover:bg-muted hover:text-danger transition-colors cursor-pointer"
          >
            <LogOut size={15} /> 退出登录
          </button>
        </div>
      )}
    </div>
  );
}

export interface AppShellProps {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  onBrandClick?: () => void;
  /** When true the content area scrolls; when false it fills the viewport (e.g. canvas). */
  scroll?: boolean;
}

export function AppShell({ title, subtitle, actions, children, onBrandClick, scroll = true }: AppShellProps) {
  const navigate = useNavigate();
  return (
    <div className="h-screen flex flex-col bg-bg">
      <header className="h-14 shrink-0 flex items-center justify-between px-4 sm:px-6 border-b border-border glass z-30">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onBrandClick ?? (() => navigate("/"))}
            className="cursor-pointer shrink-0 rounded-lg focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Brand size={34} compact />
          </button>
          {title && (
            <>
              <div className="h-6 w-px bg-border hidden sm:block" />
              <div className="min-w-0 hidden sm:block">
                <div className="text-sm font-semibold text-fg truncate">{title}</div>
                {subtitle && <div className="text-[11px] text-fg-tertiary truncate">{subtitle}</div>}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {actions}
          <StatusPill />
          <ThemeToggle />
          <div className="h-6 w-px bg-border hidden sm:block" />
          <UserMenu />
        </div>
      </header>
      <main className={cn("flex-1 min-h-0", scroll ? "overflow-y-auto" : "overflow-hidden")}>{children}</main>
    </div>
  );
}
