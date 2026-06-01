import { forwardRef } from "react";
import { cn } from "../lib/utils";

const fieldBase =
  "w-full bg-card text-fg placeholder:text-fg-tertiary border border-border rounded-md " +
  "transition-colors duration-150 focus:outline-none focus:border-accent focus:ring-4 focus:ring-[var(--ring)] " +
  "disabled:opacity-60 disabled:cursor-not-allowed";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, invalid, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      className={cn(fieldBase, "h-9.5 px-3 text-sm", invalid && "border-danger focus:border-danger", className)}
      {...props}
    />
  );
});

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cn(fieldBase, "px-3 py-2 text-sm resize-none leading-relaxed", invalid && "border-danger focus:border-danger", className)}
      {...props}
    />
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("block text-xs font-semibold text-fg-secondary mb-1.5", className)} {...props} />;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(fieldBase, "h-9.5 px-3 text-sm cursor-pointer appearance-none", invalid && "border-danger", className)}
      {...props}
    >
      {children}
    </select>
  );
});
