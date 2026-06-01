import { cn } from "../lib/utils";

/* ── Tabs ─────────────────────────────────────────────────────────── */
export interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export function Tabs({ items, value, onChange, className }: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 border-b border-border", className)} role="tablist">
      {items.map((t) => {
        const active = t.id === value;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            className={cn(
              "relative inline-flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-semibold transition-colors cursor-pointer -mb-px border-b-2",
              active ? "text-accent border-accent" : "text-fg-tertiary border-transparent hover:text-fg",
            )}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span className={cn("text-[10.5px] rounded-full px-1.5 py-0.5 font-bold", active ? "bg-accent-light text-accent" : "bg-muted text-fg-tertiary")}>
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ── Avatar ───────────────────────────────────────────────────────── */
const AVATAR_HUES = [210, 160, 30, 340, 280, 190, 50, 100];
function hueFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase() || "?";
  const hue = hueFor(name);
  return (
    <div
      className={cn("inline-flex items-center justify-center rounded-full font-semibold shrink-0", className)}
      style={{
        width: size, height: size, fontSize: size * 0.4,
        background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 65% 32%)`,
      }}
      title={name}
    >
      {initials}
    </div>
  );
}

/* ── StatCard ─────────────────────────────────────────────────────── */
export function StatCard({ label, value, sub, tone = "neutral", icon }: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  icon?: React.ReactNode;
}) {
  const toneCls = {
    neutral: "text-fg",
    accent: "text-accent",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3.5 shadow-xs">
      <div className="flex items-center justify-between">
        <span className="text-[11.5px] font-semibold text-fg-tertiary uppercase tracking-wide">{label}</span>
        {icon && <span className="text-fg-tertiary">{icon}</span>}
      </div>
      <div className={cn("text-2xl font-bold mt-1.5 tabular leading-none", toneCls)}>{value}</div>
      {sub && <div className="text-[11.5px] text-fg-tertiary mt-1.5">{sub}</div>}
    </div>
  );
}

/* ── Divider ──────────────────────────────────────────────────────── */
export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px bg-border-light w-full", className)} />;
}
