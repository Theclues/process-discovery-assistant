import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export const qk = {
  organizations: ["organizations"] as const,
  employees: (orgId: string) => ["employees", orgId] as const,
  engagements: (orgId: string) => ["engagements", orgId] as const,
  engagement: (id: string) => ["engagement", id] as const,
  workbench: (id: string) => ["workbench", id] as const,
  enterpriseNetwork: (orgId: string) => ["enterprise-network", orgId] as const,
  employeeRelations: (orgId: string) => ["employee-relations", orgId] as const,
  enterpriseReport: (orgId: string) => ["enterprise-report", orgId] as const,
  patterns: (orgId: string) => ["patterns", orgId] as const,
};

export const useHealth = () =>
  useQuery({ queryKey: ["health"], queryFn: api.health, refetchInterval: 30_000, staleTime: 15_000 });

export const useOrganizations = () =>
  useQuery({ queryKey: qk.organizations, queryFn: api.listOrganizations });

export const useEmployees = (orgId: string | undefined) =>
  useQuery({ queryKey: qk.employees(orgId ?? ""), queryFn: () => api.listEmployees(orgId!), enabled: !!orgId });

export const useEngagements = (orgId: string | undefined) =>
  useQuery({ queryKey: qk.engagements(orgId ?? ""), queryFn: () => api.listEngagements(orgId!), enabled: !!orgId });

export const useEngagement = (id: string | undefined) =>
  useQuery({ queryKey: qk.engagement(id ?? ""), queryFn: () => api.getEngagement(id!), enabled: !!id });

export const useWorkbench = (engagementId: string | undefined) =>
  useQuery({ queryKey: qk.workbench(engagementId ?? ""), queryFn: () => api.getWorkbench(engagementId!), enabled: !!engagementId });

export const useEnterpriseNetwork = (orgId: string | undefined) =>
  useQuery({ queryKey: qk.enterpriseNetwork(orgId ?? ""), queryFn: () => api.enterpriseNetwork(orgId!), enabled: !!orgId });

export const useEmployeeRelations = (orgId: string | undefined) =>
  useQuery({ queryKey: qk.employeeRelations(orgId ?? ""), queryFn: () => api.employeeRelations(orgId!), enabled: !!orgId });

export const useEnterpriseReport = (orgId: string | undefined, enabled = true) =>
  useQuery({ queryKey: qk.enterpriseReport(orgId ?? ""), queryFn: () => api.enterpriseReport(orgId!), enabled: !!orgId && enabled });

export const usePatterns = (orgId: string | undefined) =>
  useQuery({ queryKey: qk.patterns(orgId ?? ""), queryFn: () => api.patterns(orgId!), enabled: !!orgId });

// ── Mutations ──
export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createOrganization,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.organizations }),
  });
}

export function useCreateEmployee(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createEmployee,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.employees(orgId) }),
  });
}

export function useCreateEngagement(orgId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.createEngagement,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.engagements(orgId) }),
  });
}

export function useGenerateHypotheses(engagementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.generateHypotheses(engagementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workbench(engagementId) }),
  });
}

export function useGenerateFindings(engagementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.generateFindings(engagementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workbench(engagementId) }),
  });
}

export function useGenerateDeliverable(engagementId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.generateDeliverable(engagementId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.workbench(engagementId) }),
  });
}
