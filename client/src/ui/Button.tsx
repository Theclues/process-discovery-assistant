import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "subtle";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-accent-fg shadow-sm hover:bg-accent-hover active:bg-accent-active",
  secondary:
    "bg-muted text-fg hover:bg-border-light active:bg-border",
  outline:
    "border border-border-strong bg-card text-fg hover:bg-muted active:bg-border-light",
  ghost:
    "text-fg-secondary hover:bg-muted hover:text-fg active:bg-border-light",
  danger:
    "bg-danger text-white shadow-sm hover:brightness-95 active:brightness-90",
  subtle:
    "bg-accent-light text-accent hover:brightness-[.97] active:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-md",
  md: "h-9.5 px-4 text-sm gap-2 rounded-md",
  lg: "h-11 px-6 text-[15px] gap-2 rounded-lg",
  icon: "h-9.5 w-9.5 rounded-md",
  "icon-sm": "h-8 w-8 rounded-md",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, leftIcon, rightIcon, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-semibold whitespace-nowrap select-none",
        "transition-all duration-150 ease-out cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        "disabled:opacity-50 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        leftIcon
      )}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
