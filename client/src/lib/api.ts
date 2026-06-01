/**
 * Typed API client for the Process Discovery backend.
 * Engineering-cybernetics: every external call has a bounded timeout and a
 * structured error so the UI never fails silently.
 */
import type {
  Organization, Employee, Engagement, ConsultingWorkbench,
  Hypothesis, Finding, Deliverable, Report, ReactFlowData, AggregationResult,
  DiscoveredPattern,
} from "../types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const DEFAULT_TIMEOUT = 30_000;

async function request<T>(path: string, options: RequestInit & { timeout?: number } = {}): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...init } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(path, {
      ...init,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
    const text = await res.text();
    const data = text ? safeParse(text) : null;
    if (!res.ok) {
      const msg = (data && typeof data === "object" && "error" in data && typeof data.error === "string")
        ? data.error
        : `请求失败 (HTTP ${res.status})`;
      throw new ApiError(msg, res.status);
    }
    return data as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ApiError("请求超时，请检查网络或稍后重试", 408);
    }
    throw new ApiError(err instanceof Error ? err.message : "网络错误", 0);
  } finally {
    clearTimeout(timer);
  }
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return text; }
}

const get = <T>(path: string) => request<T>(path, { method: "GET" });
const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export const api = {
  // ── Organizations ──
  listOrganizations: () => get<Organization[]>("/api/organizations"),
  getOrganization: (id: string) => get<Organization>(`/api/organization/${id}`),
  createOrganization: (b: { name: string; industry?: string; size?: string }) =>
    post<Organization>("/api/organization/create", b),

  // ── Employees ──
  listEmployees: (orgId: string) => get<Employee[]>(`/api/employees/${orgId}`),
  createEmployee: (b: { organizationId: string; name: string; role: string; department?: string }) =>
    post<Employee>("/api/employee/create", b),

  // ── Engagements ──
  listEngagements: (orgId: string) => get<Engagement[]>(`/api/engagements/${orgId}`),
  getEngagement: (id: string) => get<Engagement>(`/api/engagement/${id}`),
  createEngagement: (b: {
    organizationId: string; name: string; objective?: string;
    phase?: string; status?: string; startDate?: string; endDate?: string;
  }) => post<Engagement>("/api/engagement/create", b),

  // ── Consulting workbench ──
  getWorkbench: (engagementId: string) =>
    get<ConsultingWorkbench>(`/api/engagement/${engagementId}/workbench`),
  generateHypotheses: (engagementId: string) =>
    post<{ hypotheses: Hypothesis[]; workbench: ConsultingWorkbench }>(`/api/engagement/${engagementId}/hypotheses/generate`),
  generateFindings: (engagementId: string) =>
    post<{ findings: Finding[]; workbench: ConsultingWorkbench }>(`/api/engagement/${engagementId}/findings/generate`),
  generateDeliverable: (engagementId: string) =>
    post<{ deliverable: Deliverable; workbench: ConsultingWorkbench }>(`/api/engagement/${engagementId}/deliverables/generate`),

  // ── Enterprise analysis ──
  enterpriseNetwork: (orgId: string) => get<ReactFlowData>(`/api/enterprise-network/${orgId}`),
  employeeRelations: (orgId: string) => get<ReactFlowData>(`/api/employee-relations/${orgId}`),
  enterpriseReport: (orgId: string) => get<Report>(`/api/report/enterprise/${orgId}`),
  aggregate: (organizationId: string) => post<AggregationResult>("/api/aggregate", { organizationId }),
  patterns: (orgId: string) => get<DiscoveredPattern[]>(`/api/patterns/${orgId}`),
  knowledge: (orgId: string) => get<unknown[]>(`/api/knowledge/${orgId}`),

  // ── Sessions ──
  sessionReactFlow: (sessionId: string) => get<ReactFlowData>(`/api/session/${sessionId}/graph/reactflow`),

  // ── Observability ──
  health: () => get<HealthStatus>("/api/health"),
};

export interface HealthStatus {
  status: "ok" | "degraded";
  uptimeSeconds: number;
  llm: { configured: boolean; circuit: string };
  activeSessions: number;
  timestamp: string;
}
