import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

export function Spinner({ className, size = 18 }: { className?: string; size?: number }) {
  return <Loader2 className={cn("animate-spin text-fg-tertiary", className)} style={{ width: size, height: size }} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-shimmer rounded-md", className)} />;
}

export function CenterSpinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full gap-3 text-fg-tertiary">
      <Spinner size={24} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-6 py-12 gap-3", className)}>
      {icon && (
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center text-fg-tertiary mb-1">
          {icon}
        </div>
      )}
      <div className="max-w-sm">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {description && <p className="text-sm text-fg-tertiary mt-1.5 leading-relaxed">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ title = "出错了", message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-12 gap-3">
      <div className="h-14 w-14 rounded-2xl bg-danger-light flex items-center justify-center text-danger text-2xl">!</div>
      <div className="max-w-sm">
        <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
        {message && <p className="text-sm text-fg-tertiary mt-1.5 leading-relaxed break-words">{message}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 px-4 h-9 rounded-md bg-muted hover:bg-border-light text-sm font-semibold text-fg transition-colors cursor-pointer"
        >
          重试
        </button>
      )}
    </div>
  );
}
