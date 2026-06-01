/**
 * Pattern discovery engine — finds recurring patterns across multiple sessions.
 *
 * Engineering cybernetics: each pattern is a signal extracted from noise.
 * Confidence is based on frequency and signal-to-noise ratio.
 */

import { ProcessGraph } from "../model/graph.js";
import type { SessionData, DiscoveredPattern } from "../model/schema.js";
import {
  listSessionsByOrg,
  createKnowledgeEntry,
} from "../storage/database.js";

export function discoverPatterns(organizationId: string): DiscoveredPattern[] {
  const sessions = listSessionsByOrg(organizationId);
  if (sessions.length < 2) return [];

  const patterns: DiscoveredPattern[] = [];

  // 1. Recurring bottleneck: same node label with painScore >= 7 across sessions
  const painNodeMap = new Map<string, { count: number; sessionIds: string[]; departments: string[] }>();
  for (const s of sessions) {
    for (const node of s.graph.nodes) {
      if (node.painScore && node.painScore >= 7) {
        const key = node.label.trim().toLowerCase();
        const existing = painNodeMap.get(key);
        if (existing) {
          existing.count++;
          existing.sessionIds.push(s.id);
          if (node.department && !existing.departments.includes(node.department)) {
            existing.departments.push(node.department);
          }
        } else {
          painNodeMap.set(key, {
            count: 1,
            sessionIds: [s.id],
            departments: node.department ? [node.department] : [],
          });
        }
      }
    }
  }
  for (const [label, info] of painNodeMap) {
    if (info.count >= 2) {
      patterns.push({
        type: "recurring_bottleneck",
        description: `多个会话中「${label}」被标记为高痛点 (≥7/10)，出现 ${info.count} 次`,
        frequency: info.count,
        confidence: Math.min(1, info.count / sessions.length),
        affectedNodeLabels: [label],
        affectedDepartments: info.departments,
        sessionIds: info.sessionIds,
      });
    }
  }

  // 2. Departmental friction: cross-dept edges with low confidence
  const frictionMap = new Map<string, { count: number; sessionIds: string[] }>();
  for (const s of sessions) {
    const g = ProcessGraph.fromData(s.graph);
    const crossEdges = g.crossDepartmentEdges();
    for (const ce of crossEdges) {
      if (ce.edge.confidence < 0.6) {
        const key = `cross:${ce.fromDept}->${ce.toDept}`;
        const existing = frictionMap.get(key);
        if (existing) {
          existing.count++;
          existing.sessionIds.push(s.id);
        } else {
          frictionMap.set(key, { count: 1, sessionIds: [s.id] });
        }
      }
    }
  }
  for (const [key, info] of frictionMap) {
    if (info.count >= 2) {
      const [fromDept, toDept] = key.replace("cross:", "").split("->");
      patterns.push({
        type: "departmental_friction",
        description: `${fromDept} → ${toDept} 的跨部门协作在 ${info.count} 个会话中置信度低 (<0.6)，可能存在沟通障碍`,
        frequency: info.count,
        confidence: Math.min(1, info.count / sessions.length),
        affectedNodeLabels: [],
        affectedDepartments: [fromDept, toDept],
        sessionIds: info.sessionIds,
      });
    }
  }

  // 3. Temporal patterns: WaitState with similar durations across sessions
  const waitMap = new Map<string, { durations: string[]; count: number; sessionIds: string[] }>();
  for (const s of sessions) {
    for (const node of s.graph.nodes) {
      if (node.type === "WaitState" && "waitDuration" in node) {
        const duration = (node as { waitDuration?: string }).waitDuration;
        if (duration) {
          const key = `${node.label.trim().toLowerCase()}:${duration}`;
          const existing = waitMap.get(key);
          if (existing) {
            existing.count++;
            existing.durations.push(duration);
            existing.sessionIds.push(s.id);
          } else {
            waitMap.set(key, { durations: [duration], count: 1, sessionIds: [s.id] });
          }
        }
      }
    }
  }
  for (const [key, info] of waitMap) {
    if (info.count >= 2) {
      patterns.push({
        type: "temporal_pattern",
        description: `「${key.split(":")[0]}」在 ${info.count} 个会话中存在相同的等待时间 (${info.durations[0]})`,
        frequency: info.count,
        confidence: Math.min(1, info.count / sessions.length),
        affectedNodeLabels: [key.split(":")[0]],
        affectedDepartments: [],
        sessionIds: info.sessionIds,
      });
    }
  }

  // 4. System dependency: ExternalEntity appearing as source/sink in multiple sessions
  const extEntityMap = new Map<string, { count: number; sessionIds: string[] }>();
  for (const s of sessions) {
    const g = ProcessGraph.fromData(s.graph);
    const sources = g.sources();
    const sinks = g.sinks();
    for (const n of [...sources, ...sinks]) {
      if (n.type === "ExternalEntity") {
        const key = n.label.trim().toLowerCase();
        const existing = extEntityMap.get(key);
        if (existing) {
          existing.count++;
          existing.sessionIds.push(s.id);
        } else {
          extEntityMap.set(key, { count: 1, sessionIds: [s.id] });
        }
      }
    }
  }
  for (const [label, info] of extEntityMap) {
    if (info.count >= 2) {
      patterns.push({
        type: "system_dependency",
        description: `「${label}」在 ${info.count} 个会话中作为上游或下游系统依赖出现`,
        frequency: info.count,
        confidence: Math.min(1, info.count / sessions.length),
        affectedNodeLabels: [label],
        affectedDepartments: [],
        sessionIds: info.sessionIds,
      });
    }
  }

  // Store significant patterns as knowledge
  for (const p of patterns) {
    if (p.confidence >= 0.5) {
      createKnowledgeEntry({
        organizationId,
        processId: p.sessionIds[0],
        type: "pattern",
        content: p.description,
        confidence: p.confidence,
        supportingSessionIds: p.sessionIds,
      });
    }
  }

  return patterns;
}
