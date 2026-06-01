import { cn } from "../lib/utils";

/** Brand mark for 智策 / Strategist AI — an "AI McKinsey" consulting workspace. */
export function Logo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <div
      className={cn("relative flex items-center justify-center rounded-xl shrink-0 overflow-hidden", className)}
      style={{
        width: size, height: size,
        background: "linear-gradient(135deg, var(--brand-navy) 0%, var(--accent) 100%)",
        boxShadow: "0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent)",
      }}
      aria-hidden
    >
      <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 24 24" fill="none">
        {/* Stylised "Z" rising-bars — strategy / ascent */}
        <path d="M5 18.5 L11 12 L8.5 9.5 L19 5.5" stroke="white" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" opacity="0.95" />
        <circle cx="19" cy="5.5" r="2.1" fill="white" />
        <circle cx="5" cy="18.5" r="1.6" fill="white" opacity="0.85" />
      </svg>
    </div>
  );
}

export function Wordmark({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn("leading-none", className)}>
      <div className="text-[15px] font-bold text-fg tracking-tight">
        智策<span className="text-accent"> AI</span>
      </div>
      {!compact && (
        <div className="text-[10px] font-medium text-fg-tertiary mt-1 tracking-[0.08em] uppercase">
          Strategist · 战略诊断工作台
        </div>
      )}
    </div>
  );
}

export function Brand({ size = 36, compact, className }: { size?: number; compact?: boolean; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <Wordmark compact={compact} />
    </div>
  );
}
