/**
 * HTTP request handlers for the Process Discovery Assistant web interface.
 */

import type { Request, Response } from "express";
import { DialogueEngine } from "../dialogue/engine.js";
import { Session } from "../dialogue/session.js";
import { SessionRepository } from "../storage/repository.js";
import { stateLabel } from "../dialogue/state.js";
import { generateMermaid } from "../viz/mermaid.js";
import { generateReport } from "../viz/report.js";
import { detectAllGaps } from "../analysis/detector.js";
import { graphToReactFlow } from "../viz/reactFlow.js";
import {
  createOrganization, getOrganization, listOrganizations,
  createEngagement, getEngagement, listEngagements,
  createEmployee, listEmployees,
  listSessionsByOrg,
  saveSession as dbSaveSession,
} from "../storage/database.js";
import { aggregateSessionsByProcess } from "../analysis/aggregator.js";
import { isDeepseekConfigured } from "../config.js";
import { getLLMClient } from "../llm/client.js";
import { invalidateOrg, orgCacheGet, orgCacheSet } from "../analysis/orgCache.js";
import { discoverPatterns } from "../analysis/patterns.js";
import { buildEnterpriseNetwork, buildEmployeeRelationsNetwork } from "../analysis/network.js";
import {
  generateDeliverable,
  generateFindings,
  generateHypotheses,
  getWorkbench,
} from "../consulting/workbench.js";

// In-memory session store (keyed by session ID)
const sessions = new Map<string, Session>();
const engine = new DialogueEngine();
const repo = new SessionRepository();

function routeParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

const startedAt = Date.now();

/**
 * Health / readiness probe. Observability surface for ops & the UI status pill:
 * uptime, dependency configuration and the LLM circuit-breaker state.
 */
export function handleHealth(_req: Request, res: Response): void {
  let circuit = "UNKNOWN";
  try { circuit = getLLMClient().getCircuitState(); } catch { /* not initialised */ }
  const llmConfigured = isDeepseekConfigured();
  const status = !llmConfigured ? "degraded" : circuit === "OPEN" ? "degraded" : "ok";
  res.json({
    status,
    uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
    llm: { configured: llmConfigured, circuit },
    activeSessions: sessions.size,
    timestamp: new Date().toISOString(),
  });
}

async function persistSession(session: Session): Promise<void> {
  const sessionData = session.toData();
  await repo.save(sessionData);

  if (sessionData.organizationId) {
    dbSaveSession(sessionData);
    // The org's aggregate analyses are now stale — drop the cache so the next
    // enterprise view recomputes from fresh data.
    invalidateOrg(sessionData.organizationId);
  }
}

/**
 * Resolve a session by id, transparently restoring it from the durable JSON
 * snapshot when it is not in the hot in-memory map (e.g. after a restart or
 * when load is spread across processes). Falls back to a fresh session.
 * Engineering cybernetics: closes the gap where active sessions used to be
 * silently lost on restart.
 */
async function getOrCreateSession(sessionId: string | undefined): Promise<Session> {
  if (sessionId) {
    const inMem = sessions.get(sessionId);
    if (inMem) return inMem;
    try {
      const data = await repo.load(sessionId);
      if (data) {
        const restored = Session.fromData(data);
        sessions.set(restored.id, restored);
        return restored;
      }
    } catch (err: unknown) {
      console.warn("Session restore failed:", err instanceof Error ? err.message : err);
    }
  }
  const created = new Session(sessionId);
  sessions.set(created.id, created);
  return created;
}

export async function handleChat(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId, message } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message required" });
      return;
    }

    // Get or create session (restores from snapshot on miss)
    const session = await getOrCreateSession(sessionId);

    // Process message
    const result = await engine.processMessage(session, message);

    // Generate Mermaid diagram if model has data
    let mermaid = "";
    if (session.graph.nodeCount() >= 3) {
      mermaid = generateMermaid(session.graph, {
        highlightGaps: result.gapsDetected,
        showPainScore: true,
        groupByDepartment: true,
      });
    }

    // Persist session to both the resumable JSON snapshot and the enterprise analysis store.
    try {
      await persistSession(session);
    } catch (err: unknown) {
      console.warn("Session persistence failed:", err instanceof Error ? err.message : err);
    }

    res.json({
      sessionId: session.id,
      message: result.message,
      state: result.state,
      stateLabel: stateLabel(result.state),
      mermaidDiagram: mermaid,
      gapCount: result.gapsDetected.length,
      nodeCount: session.graph.nodeCount(),
      edgeCount: session.graph.edgeCount(),
      confidence: Math.round(session.graph.averageConfidence() * 100),
      completeness: result.completeness ?? null,
    });
  } catch (err: any) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Internal error processing message" });
  }
}

export async function handleReport(req: Request, res: Response): Promise<void> {
  const sessionId = routeParam(req.params.sessionId);
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const gaps = detectAllGaps(session.graph);
  const report = generateReport(session.graph, gaps);
  const mermaid = generateMermaid(session.graph, {
    showPainScore: true,
    groupByDepartment: true,
  });

  res.json({ ...report, mermaidDiagram: mermaid });
}

export async function handleConclude(req: Request, res: Response): Promise<void> {
  const sessionId = req.body.sessionId;
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const result = await engine.concludeSession(session);
  const gaps = detectAllGaps(session.graph);
  const report = generateReport(session.graph, gaps);
  const mermaid = generateMermaid(session.graph, {
    showPainScore: true,
    groupByDepartment: true,
  });

  try {
    await persistSession(session);
  } catch (err: unknown) {
    console.warn("Session persistence failed:", err instanceof Error ? err.message : err);
  }

  // Aggregate across employees if the completed session has org context.
  const orgId = session.organizationId;
  if (orgId) {
    try {
      const allSessions = listSessionsByOrg(orgId);
      if (allSessions.length >= 2) {
        const aggregation = aggregateSessionsByProcess(allSessions, orgId);
        (report as unknown as Record<string, unknown>).crossSessionInsights = aggregation;
      }
    } catch (err: unknown) {
      console.warn("Cross-session aggregation failed:", err instanceof Error ? err.message : err);
    }
  }

  res.json({
    ...result,
    report,
    mermaidDiagram: mermaid,
  });
}

export async function handleNewSession(req: Request, res: Response): Promise<void> {
  const { organizationId, employeeId, engagementId } = req.body ?? {};
  const session = new Session(undefined, undefined, { organizationId, employeeId, engagementId });
  sessions.set(session.id, session);

  let greeting = "你好！我是流程发现助手。请开始描述你的日常工作流程，我会帮你梳理出完整的业务流程模型。你想从哪个工作流程开始？";

  // If org context exists, customize greeting
  if (organizationId) {
    const org = getOrganization(organizationId);
    if (org) {
      greeting = `你好！欢迎回到${org.name}的流程发现助手。请继续描述你的工作流程，我会结合已有的知识库进行分析。`;
    }
  }

  res.json({
    sessionId: session.id,
    message: greeting,
    state: "ONBOARDING",
    stateLabel: "引导",
  });
}

export async function handleCreateEngagement(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, name, objective, phase, status, startDate, endDate } = req.body ?? {};
    if (!organizationId || !name || typeof name !== "string") {
      res.status(400).json({ error: "organizationId and name required" });
      return;
    }

    const org = getOrganization(organizationId);
    if (!org) {
      res.status(404).json({ error: "Organization not found" });
      return;
    }

    const engagement = createEngagement({
      organizationId,
      name: name.trim(),
      objective: typeof objective === "string" ? objective.trim() : undefined,
      phase,
      status,
      startDate,
      endDate,
    });
    res.json(engagement);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleGetEngagement(req: Request, res: Response): Promise<void> {
  const engagement = getEngagement(routeParam(req.params.id));
  if (!engagement) { res.status(404).json({ error: "Not found" }); return; }
  res.json(engagement);
}

export async function handleListEngagements(req: Request, res: Response): Promise<void> {
  res.json(listEngagements(routeParam(req.params.orgId)));
}

export async function handleConsultingWorkbench(req: Request, res: Response): Promise<void> {
  try {
    res.json(getWorkbench(routeParam(req.params.engagementId)));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleGenerateHypotheses(req: Request, res: Response): Promise<void> {
  try {
    const engagementId = routeParam(req.params.engagementId);
    const hypotheses = await generateHypotheses(engagementId);
    res.json({ hypotheses, workbench: getWorkbench(engagementId) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleGenerateFindings(req: Request, res: Response): Promise<void> {
  try {
    const engagementId = routeParam(req.params.engagementId);
    const findings = await generateFindings(engagementId);
    res.json({ findings, workbench: getWorkbench(engagementId) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleGenerateDeliverable(req: Request, res: Response): Promise<void> {
  try {
    const engagementId = routeParam(req.params.engagementId);
    const deliverable = await generateDeliverable(engagementId);
    res.json({ deliverable, workbench: getWorkbench(engagementId) });
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleChatStream(req: Request, res: Response): Promise<void> {
  try {
    const { sessionId, message } = req.body;

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "message required" });
      return;
    }

    // Get or create session (restores from snapshot on miss)
    const session = await getOrCreateSession(sessionId);

    // Set SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    // Process message
    const result = await engine.processMessage(session, message);

    // Stream the response text character by character for visual effect
    const text = result.message;
    const chunkSize = 3; // characters per chunk
    for (let i = 0; i < text.length; i += chunkSize) {
      const chunk = text.slice(i, i + chunkSize);
      res.write(`data: ${JSON.stringify({ type: "token", token: chunk })}\n\n`);
      // Small delay for streaming effect
      await new Promise(resolve => setTimeout(resolve, 20));
    }

    // Generate Mermaid diagram if model has data
    let mermaid = "";
    let reactFlow = undefined;
    if (session.graph.nodeCount() >= 3) {
      const gaps = detectAllGaps(session.graph);
      mermaid = generateMermaid(session.graph, {
        highlightGaps: result.gapsDetected,
        showPainScore: true,
        groupByDepartment: true,
      });
      reactFlow = graphToReactFlow(session.graph, {
        highlightGaps: result.gapsDetected,
      });
    }

    // Send final event with all structured data
    const finalData = {
      type: "final",
      sessionId: session.id,
      message: result.message,
      state: result.state,
      stateLabel: stateLabel(result.state),
      mermaidDiagram: mermaid,
      reactFlowData: reactFlow,
      gapCount: result.gapsDetected.length,
      nodeCount: session.graph.nodeCount(),
      edgeCount: session.graph.edgeCount(),
      confidence: Math.round(session.graph.averageConfidence() * 100),
      completeness: result.completeness ?? null,
    };
    res.write(`data: ${JSON.stringify(finalData)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();

    // Persist session to both the resumable JSON snapshot and the enterprise analysis store.
    try {
      await persistSession(session);
    } catch (err: unknown) {
      console.warn("Session persistence failed:", err instanceof Error ? err.message : err);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
    res.end();
  }
}

export async function handleReactFlowGraph(req: Request, res: Response): Promise<void> {
  const sessionId = routeParam(req.params.sessionId);
  const session = sessions.get(sessionId);
  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const gaps = detectAllGaps(session.graph);
  const data = graphToReactFlow(session.graph, { highlightGaps: gaps });
  res.json(data);
}

export async function handleListSessions(_req: Request, res: Response): Promise<void> {
  const list = await repo.list();
  const active = [...sessions.keys()];
  res.json({ persisted: list, active });
}

export async function handleLoadSession(req: Request, res: Response): Promise<void> {
  const sessionId = routeParam(req.params.sessionId);
  const data = await repo.load(sessionId);
  if (!data) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  const session = Session.fromData(data);
  sessions.set(session.id, session);

  const mermaid = session.graph.nodeCount() >= 3
    ? generateMermaid(session.graph, { showPainScore: true, groupByDepartment: true })
    : "";

  res.json({
    sessionId: session.id,
    state: session.state,
    stateLabel: stateLabel(session.state),
    turns: session.turns,
    nodeCount: session.graph.nodeCount(),
    edgeCount: session.graph.edgeCount(),
    mermaidDiagram: mermaid,
  });
}

// ─── Organization & Employee Handlers ───────────────────────────

export async function handleCreateOrganization(req: Request, res: Response): Promise<void> {
  try {
    const { name, industry, size } = req.body;
    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "Organization name required" });
      return;
    }
    const org = createOrganization({ name, industry, size });
    res.json(org);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleGetOrganization(req: Request, res: Response): Promise<void> {
  const org = getOrganization(routeParam(req.params.id));
  if (!org) { res.status(404).json({ error: "Not found" }); return; }
  res.json(org);
}

export async function handleListOrganizations(_req: Request, res: Response): Promise<void> {
  res.json(listOrganizations());
}

export async function handleCreateEmployee(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId, name, role, department } = req.body;
    if (!organizationId || !name || !role) {
      res.status(400).json({ error: "organizationId, name, and role required" });
      return;
    }
    const emp = createEmployee({ organizationId, name, role, department });
    res.json(emp);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleListEmployees(req: Request, res: Response): Promise<void> {
  res.json(listEmployees(routeParam(req.params.orgId)));
}

export async function handleAggregate(req: Request, res: Response): Promise<void> {
  try {
    const { organizationId } = req.body;
    if (!organizationId) {
      res.status(400).json({ error: "organizationId required" });
      return;
    }
    const sessions = listSessionsByOrg(organizationId);
    const result = aggregateSessionsByProcess(sessions, organizationId);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handlePatterns(req: Request, res: Response): Promise<void> {
  try {
    const orgId = routeParam(req.params.orgId);
    const patterns = discoverPatterns(orgId);
    res.json(patterns);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleKnowledge(req: Request, res: Response): Promise<void> {
  try {
    const { listKnowledge } = await import("../storage/database.js");
    const orgId = routeParam(req.params.orgId);
    res.json(listKnowledge(orgId));
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

// ─── Enterprise Network & Employee Relations ────────────────────

export async function handleEnterpriseNetwork(req: Request, res: Response): Promise<void> {
  try {
    const orgId = routeParam(req.params.orgId);
    const result = buildEnterpriseNetwork(orgId);
    res.json(result.reactFlow);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleEmployeeRelations(req: Request, res: Response): Promise<void> {
  try {
    const orgId = routeParam(req.params.orgId);
    const result = buildEmployeeRelationsNetwork(orgId);
    res.json(result);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}

export async function handleEnterpriseReport(req: Request, res: Response): Promise<void> {
  try {
    const orgId = routeParam(req.params.orgId);
    const cachedReport = orgCacheGet<Record<string, unknown>>(orgId, "report");
    if (cachedReport) { res.json(cachedReport); return; }

    const sessions = listSessionsByOrg(orgId);
    if (sessions.length === 0) {
      res.status(404).json({ error: "No sessions found for this organization" });
      return;
    }
    const aggregation = aggregateSessionsByProcess(sessions, orgId);
    const patterns = discoverPatterns(orgId);
    const network = buildEnterpriseNetwork(orgId);
    const { relations, communities } = await import("../analysis/network.js").then(m => m.computeEmployeeRelations(orgId));

    // Build merged graph to compute full stats (enterprise-bounded, never crashes)
    const { ProcessGraph } = await import("../model/graph.js");
    const { getConfig } = await import("../config.js");
    const cfg = getConfig();
    const merged = new ProcessGraph("Enterprise", {
      maxNodes: cfg.maxEnterpriseNodes,
      maxEdges: cfg.maxEnterpriseEdges,
    });
    for (const s of sessions) {
      const g = ProcessGraph.fromData(s.graph);
      for (const n of g.nodes.values()) {
        if (!merged.getNode(n.id)) { try { merged.addNode(n); } catch { break; } }
      }
      for (const e of g.edges.values()) {
        if (!merged.getEdge(e.id)) { try { merged.addEdge(e); } catch { /* ceiling */ } }
      }
    }
    const gaps = detectAllGaps(merged);
    const baseReport = generateReport(merged, gaps);

    // Enrich with enterprise data
    const allDepts = new Set<string>();
    for (const n of merged.nodes.values()) { if (n.department) allDepts.add(n.department); }

    const payload = {
      ...baseReport,
      summary: `企业流程分析报告 — ${network.stats.nodeCount} 节点, ${network.stats.edgeCount} 边, ${network.stats.employeeCount} 位员工参与`,
      stats: {
        ...baseReport.stats,
        employeeCount: network.stats.employeeCount,
      },
      crossSessionInsights: { ...aggregation, patterns },
      employeeRelations: { relations, communities },
    };
    orgCacheSet(orgId, "report", payload);
    res.json(payload);
  } catch (err: unknown) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Internal error" });
  }
}
