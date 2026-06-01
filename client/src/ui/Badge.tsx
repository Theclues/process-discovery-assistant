import { cn } from "../lib/utils";

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";
type BadgeSize = "sm" | "md";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-fg-secondary",
  accent: "bg-accent-light text-accent",
  success: "bg-success-light text-success",
  warning: "bg-warning-light text-warning",
  danger: "bg-danger-light text-danger",
  info: "bg-info-light text-info",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone;
  size?: BadgeSize;
  dot?: boolean;
}

export function Badge({ tone = "neutral", size = "md", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
