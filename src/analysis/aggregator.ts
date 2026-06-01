/**
 * Aggregation engine — merges multiple employees' workflow descriptions
 * about the same enterprise process into a consensus graph.
 *
 * Engineering cybernetics: explicit convergence score as feedback signal.
 * The aggregation reveals what information is consensus vs. unique perspective.
 */

import { ProcessGraph } from "../model/graph.js";
import { EntityRegistry } from "../model/entity.js";
import type {
  SessionData, Node, Edge, ProcessGraphData,
  AggregationResult,
} from "../model/schema.js";
import {
  listSessionsByOrg,
  getEmployee,
  createKnowledgeEntry,
} from "../storage/database.js";

export function aggregateSessionsByProcess(
  sessions: SessionData[],
  organizationId: string,
): AggregationResult {
  if (sessions.length === 0) {
    return {
      consensusGraphNodes: 0,
      consensusGraphEdges: 0,
      contributors: [],
      agreements: [],
      disagreements: [],
      uniqueInsights: [],
      convergenceScore: 0,
    };
  }

  const groupByProcess = new Map<string, SessionData[]>();
  for (const s of sessions) {
    const name = s.graph.metadata.processName || "Unnamed";
    const existing = groupByProcess.get(name);
    if (existing) existing.push(s);
    else groupByProcess.set(name, [s]);
  }

  // Take the largest process group for analysis
  let largestGroup: SessionData[] = [];
  for (const group of groupByProcess.values()) {
    if (group.length > largestGroup.length) largestGroup = group;
  }

  return aggregateGraphs(largestGroup, organizationId);
}

function aggregateGraphs(sessions: SessionData[], organizationId: string): AggregationResult {
  const registry = new EntityRegistry();
  const contributorMap = new Map<string, { employeeId: string; sessionCount: number }>();
  const nodeOccurrence = new Map<string, { node: Node; sessionIds: string[] }>();
  const edgeOccurrence = new Map<string, { edge: Edge; sessionIds: string[] }>();

  // Collect contributions
  for (const s of sessions) {
    if (s.employeeId) {
      const existing = contributorMap.get(s.employeeId);
      if (existing) existing.sessionCount++;
      else contributorMap.set(s.employeeId, { employeeId: s.employeeId, sessionCount: 1 });
    }

    const g = ProcessGraph.fromData(s.graph);
    for (const node of g.nodes.values()) {
      const key = normalizeLabel(node.label);
      const existing = nodeOccurrence.get(key);
      if (existing) {
        // Merge: boost confidence for consensus
        existing.node.confidence = Math.min(1, existing.node.confidence + 0.1);
        if (node.painScore !== undefined) {
          existing.node.painScore = Math.max(existing.node.painScore ?? 0, node.painScore);
        }
        if (node.description && node.description.length > existing.node.description.length) {
          existing.node.description = node.description;
        }
        existing.sessionIds.push(s.id);
      } else {
        nodeOccurrence.set(key, { node: { ...node }, sessionIds: [s.id] });
      }
    }

    for (const edge of g.edges.values()) {
      const fromNode = g.getNode(edge.from);
      const toNode = g.getNode(edge.to);
      if (!fromNode || !toNode) continue;
      const key = `${normalizeLabel(fromNode.label)}->${normalizeLabel(toNode.label)}:${edge.type}`;
      const existing = edgeOccurrence.get(key);
      if (existing) {
        existing.edge.confidence = Math.min(1, existing.edge.confidence + 0.1);
        existing.sessionIds.push(s.id);
      } else {
        edgeOccurrence.set(key, { edge: { ...edge }, sessionIds: [s.id] });
      }
    }
  }

  const totalSessions = sessions.length;
  const consensusThreshold = Math.max(2, Math.ceil(totalSessions * 0.5));

  // Classify nodes
  const agreements: AggregationResult["agreements"] = [];
  const disagreements: AggregationResult["disagreements"] = [];
  let consensusNodeCount = 0;
  let consensusEdgeCount = 0;

  for (const [, info] of nodeOccurrence) {
    if (info.sessionIds.length >= consensusThreshold) {
      consensusNodeCount++;
      agreements.push({
        nodeLabel: info.node.label,
        contributorCount: info.sessionIds.length,
        confidence: info.node.confidence,
      });
    } else if (info.sessionIds.length === 1) {
      // Unique contribution
      disagreements.push({
        nodeLabel: info.node.label,
        variants: [{
          employeeName: sessions.find(s => s.id === info.sessionIds[0])?.employeeId ?? "unknown",
          description: info.node.description || info.node.label,
        }],
      });
    }
  }

  for (const [, info] of edgeOccurrence) {
    if (info.sessionIds.length >= consensusThreshold) {
      consensusEdgeCount++;
    }
  }

  // Unique insights
  const uniqueInsights: AggregationResult["uniqueInsights"] = [];
  for (const [key, info] of nodeOccurrence) {
    if (info.sessionIds.length === 1) {
      const s = sessions.find(s => s.id === info.sessionIds[0]);
      const empId = s?.employeeId;
      const emp = empId ? getEmployee(empId) : undefined;
      uniqueInsights.push({
        employeeName: emp?.name ?? empId ?? "unknown",
        insight: `${emp?.name ?? "某员工"} 描述了独特的步骤: ${info.node.label}`,
      });
    }
  }

  // Convergence score: ratio of consensus nodes to total unique nodes
  const uniqueNodeCount = nodeOccurrence.size;
  const convergenceScore = uniqueNodeCount > 0 ? consensusNodeCount / uniqueNodeCount : 0;

  // Store knowledge entries for discovered patterns
  if (agreements.length > 0) {
    createKnowledgeEntry({
      organizationId,
      processId: sessions[0].id,
      type: "insight",
      content: `${agreements.length} 个步骤被 ${consensusThreshold}+ 位员工确认`,
      confidence: convergenceScore,
      supportingSessionIds: sessions.map(s => s.id),
    });
  }
  if (disagreements.length > 0) {
    const totalDisagreements = disagreements.length;
    if (totalDisagreements >= 2) {
      createKnowledgeEntry({
        organizationId,
        processId: sessions[0].id,
        type: "risk",
        content: `${totalDisagreements} 个步骤的描述不一致，可能需要进一步对齐`,
        confidence: 0.7,
        supportingSessionIds: sessions.map(s => s.id),
      });
    }
  }

  // Build consensus graph
  const consensusGraph = new ProcessGraph(sessions[0].graph.metadata.processName);
  for (const [, info] of nodeOccurrence) {
    if (info.sessionIds.length >= consensusThreshold) {
      consensusGraph.addNode(info.node);
    }
  }
  for (const [, info] of edgeOccurrence) {
    if (info.sessionIds.length >= consensusThreshold) {
      try { consensusGraph.addEdge(info.edge); } catch { /* skip orphaned edges */ }
    }
  }

  const contributors = [...contributorMap.values()].map(c => {
    const emp = getEmployee(c.employeeId);
    return { ...c, employeeName: emp?.name ?? c.employeeId };
  });

  return {
    consensusGraphNodes: consensusNodeCount,
    consensusGraphEdges: consensusEdgeCount,
    contributors,
    agreements,
    disagreements,
    uniqueInsights,
    convergenceScore,
  };
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}
