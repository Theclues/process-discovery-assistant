import { Router } from "express";
import {
  handleChat,
  handleChatStream,
  handleReport,
  handleConclude,
  handleNewSession,
  handleListSessions,
  handleLoadSession,
  handleReactFlowGraph,
  handleCreateOrganization,
  handleGetOrganization,
  handleListOrganizations,
  handleCreateEngagement,
  handleGetEngagement,
  handleListEngagements,
  handleConsultingWorkbench,
  handleGenerateHypotheses,
  handleGenerateFindings,
  handleGenerateDeliverable,
  handleCreateEmployee,
  handleListEmployees,
  handleAggregate,
  handlePatterns,
  handleKnowledge,
  handleEnterpriseNetwork,
  handleEmployeeRelations,
  handleEnterpriseReport,
  handleHealth,
} from "./handlers.js";

const router = Router();

// Observability
router.get("/api/health", handleHealth);

// API routes
router.post("/api/session/new", handleNewSession);
router.get("/api/sessions", handleListSessions);
router.get("/api/session/:sessionId", handleLoadSession);
router.get("/api/session/:sessionId/graph/reactflow", handleReactFlowGraph);
router.post("/api/chat", handleChat);
router.post("/api/chat/stream", handleChatStream);
router.get("/api/report/:sessionId", handleReport);
router.post("/api/conclude", handleConclude);

// Organization & Employee routes
router.post("/api/organization/create", handleCreateOrganization);
router.get("/api/organization/:id", handleGetOrganization);
router.get("/api/organizations", handleListOrganizations);
router.post("/api/engagement/create", handleCreateEngagement);
router.get("/api/engagement/:id", handleGetEngagement);
router.get("/api/engagements/:orgId", handleListEngagements);
router.get("/api/engagement/:engagementId/workbench", handleConsultingWorkbench);
router.post("/api/engagement/:engagementId/hypotheses/generate", handleGenerateHypotheses);
router.post("/api/engagement/:engagementId/findings/generate", handleGenerateFindings);
router.post("/api/engagement/:engagementId/deliverables/generate", handleGenerateDeliverable);
router.post("/api/employee/create", handleCreateEmployee);
router.get("/api/employees/:orgId", handleListEmployees);

// Aggregation & Analysis routes
router.post("/api/aggregate", handleAggregate);
router.get("/api/patterns/:orgId", handlePatterns);
router.get("/api/knowledge/:orgId", handleKnowledge);

// Enterprise Network & Employee Relations
router.get("/api/enterprise-network/:orgId", handleEnterpriseNetwork);
router.get("/api/employee-relations/:orgId", handleEmployeeRelations);
router.get("/api/report/enterprise/:orgId", handleEnterpriseReport);

export { router };
