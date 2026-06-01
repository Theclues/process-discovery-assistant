import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../lib/api";

/**
 * Shared QueryClient. Bounded retries + sane staleness so the UI is resilient
 * without hammering the backend (engineering-cybernetics: bounded resources).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Do not retry client errors (4xx); retry transient/server errors up to 2x.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: { retry: 0 },
  },
});
