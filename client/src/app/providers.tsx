import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { ThemeProvider } from "./ThemeProvider";
import { SessionProvider } from "./SessionContext";
import { ToastProvider } from "../ui";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
