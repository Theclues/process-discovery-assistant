import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from "lucide-react";
import { cn } from "../lib/utils";

type ToastTone = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone: ToastTone;
}

interface ToastApi {
  toast: (t: { title: string; description?: string; tone?: ToastTone }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const toneConfig: Record<ToastTone, { icon: React.ReactNode; cls: string }> = {
  success: { icon: <CheckCircle2 size={18} />, cls: "text-success" },
  error: { icon: <XCircle size={18} />, cls: "text-danger" },
  warning: { icon: <AlertTriangle size={18} />, cls: "text-warning" },
  info: { icon: <Info size={18} />, cls: "text-info" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback<ToastApi["toast"]>(({ title, description, tone = "info" }) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev.slice(-3), { id, title, description, tone }]);
    const timer = setTimeout(() => dismiss(id), tone === "error" ? 6000 : 4000);
    timers.current.set(id, timer);
  }, [dismiss]);

  const success = useCallback((title: string, description?: string) => toast({ title, description, tone: "success" }), [toast]);
  const error = useCallback((title: string, description?: string) => toast({ title, description, tone: "error" }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 w-[min(380px,calc(100vw-2.5rem))]">
        {toasts.map((t) => {
          const cfg = toneConfig[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="glass glass-border rounded-lg shadow-lg px-4 py-3 flex items-start gap-3 animate-slide-up"
            >
              <span className={cn("mt-0.5 shrink-0", cfg.cls)}>{cfg.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg leading-snug">{t.title}</p>
                {t.description && <p className="text-[13px] text-fg-tertiary mt-0.5 leading-snug break-words">{t.description}</p>}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className="shrink-0 text-fg-tertiary hover:text-fg transition-colors cursor-pointer"
                aria-label="关闭"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
