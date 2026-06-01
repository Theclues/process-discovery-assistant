import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl" };

export function Dialog({ open, onClose, title, description, children, footer, size = "md", className }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full bg-card border border-border rounded-xl shadow-xl animate-scale-in flex flex-col max-h-[90vh]",
          sizes[size],
          className,
        )}
      >
        {(title || description) && (
          <div className="px-5 pt-5 pb-3 pr-12">
            {title && <h2 className="text-lg font-semibold text-fg leading-tight">{title}</h2>}
            {description && <p className="text-sm text-fg-tertiary mt-1 leading-relaxed">{description}</p>}
          </div>
        )}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 h-8 w-8 rounded-md flex items-center justify-center text-fg-tertiary hover:text-fg hover:bg-muted transition-colors cursor-pointer"
          aria-label="关闭"
        >
          <X size={17} />
        </button>
        <div className="px-5 py-2 overflow-y-auto flex-1">{children}</div>
        {footer && <div className="px-5 py-4 border-t border-border-light flex items-center justify-end gap-2">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
