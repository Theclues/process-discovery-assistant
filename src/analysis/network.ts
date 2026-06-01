/**
 * Network analysis engine — Betweenness Centrality, community detection, enterprise network aggregation.
 * Engineering cybernetics: every metric is a feedback signal about the system's structure.
 */

import { ProcessGraph } from "../model/graph.js";
import type {
  Node, Edge, ProcessGraphData, SessionData,
} from "../model/schema.js";
import { listSessionsByOrg, listEmployees } from "../storage/database.js";
import { graphToReactFlow, type ReactFlowData } from "../viz/reactFlow.js";
import { getConfig } from "../config.js";
import { orgCacheGet, orgCacheSet } from "./orgCache.js";

// ─── Betweenness Centrality ──────────────────────────────────────

/** Beyond this node count, betweenness is skipped (returns zeros). It's an
 *  O(V·(V+E)) annotation; on very large enterprise graphs we trade this nicety
 *  for responsiveness. */
const BETWEENNESS_MAX_NODES = 1500;

export function betweennessCentrality(graph: ProcessGraph): Map<string, number> {
  const scores = new Map<string, number>();
  const nodeIds = [...graph.nodes.keys()];
  for (const nid of nodeIds) scores.set(nid, 0);

  if (nodeIds.length === 0) return scores;
  // Skip the expensive metric on very large graphs to keep requests responsive.
  if (nodeIds.length > BETWEENNESS_MAX_NODES) return scores;

  // Precompute adjacency ONCE (O(E)). Calling graph.outgoing() inside the BFS
  // would re-scan all edges every step → O(V²·E), unusable at scale.
  const adj = new Map<string, string[]>();
  for (const nid of nodeIds) adj.set(nid, []);
  for (const e of graph.edges.values()) {
    if (adj.has(e.from) && graph.nodes.has(e.to)) adj.get(e.from)!.push(e.to);
  }

  // Brandes' algorithm with O(1) dequeue (index pointer, not Array.shift).
  for (const s of nodeIds) {
    const stack: string[] = [];
    const pred = new Map<string, string[]>();
    const sigma = new Map<string, number>();
    const dist = new Map<string, number>();
    const delta = new Map<string, number>();

    for (const nid of nodeIds) {
      pred.set(nid, []);
      sigma.set(nid, 0);
      dist.set(nid, -1);
      delta.set(nid, 0);
    }

    sigma.set(s, 1);
    dist.set(s, 0);
    const queue: string[] = [s];
    let head = 0;

    while (head < queue.length) {
      const v = queue[head++];
      stack.push(v);
      const dv = dist.get(v)!;
      const sv = sigma.get(v)!;
      for (const w of adj.get(v)!) {
        if (dist.get(w)! < 0) {
          dist.set(w, dv + 1);
          queue.push(w);
        }
        if (dist.get(w) === dv + 1) {
          sigma.set(w, sigma.get(w)! + sv);
          pred.get(w)!.push(v);
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        const val = delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!);
        delta.set(v, val);
      }
      if (w !== s) {
        scores.set(w, scores.get(w)! + delta.get(w)!);
      }
    }
  }

  // Normalize
  const n = nodeIds.length;
  if (n > 2) {
    const scale = 1 / ((n - 1) * (n - 2));
    for (const [k, v] of scores) scores.set(k, v * scale);
  }

  return scores;
}

// ─── Shared Node Detection ───────────────────────────────────────

export interface EmployeePairRelation {
  emp1: string;
  emp2: string;
  sharedNodeLabels: string[];
  sharedEdgeKeys: string[];
  weight: number;
}

export function computeEmployeeRelations(orgId: string): {
  relations: EmployeePairRelation[];
  communities: string[][];
} {
  const cached = orgCacheGet<{ relations: EmployeePairRelation[]; communities: string[][] }>(orgId, "relations");
  if (cached) return cached;
  const result = computeEmployeeRelationsUncached(orgId);
  orgCacheSet(orgId, "relations", result);
  return result;
}

function computeEmployeeRelationsUncached(orgId: string): {
  relations: EmployeePairRelation[];
  communities: string[][];
} {
  const sessions = listSessionsByOrg(orgId);
  const employees = listEmployees(orgId);
  const empSessionMap = new Map<string, ProcessGraph[]>();

  for (const s of sessions) {
    if (!s.employeeId) continue;
    const graphs = empSessionMap.get(s.employeeId) ?? [];
    graphs.push(ProcessGraph.fromData(s.graph));
    empSessionMap.set(s.employeeId, graphs);
  }

  const empIds = [...empSessionMap.keys()];
  if (empIds.length < 2) return { relations: [], communities: [empIds] };

  // Build per-employee label sets
  const empLabels = new Map<string, Set<string>>();
  for (const [eid, graphs] of empSessionMap) {
    const labels = new Set<string>();
    for (const g of graphs) {
      for (const n of g.nodes.values()) {
        labels.add(n.label.trim().toLowerCase());
      }
    }
    empLabels.set(eid, labels);
  }

  // Compute pairwise shared labels
  const relations: EmployeePairRelation[] = [];
  const checked = new Set<string>();
  for (let i = 0; i < empIds.length; i++) {
    for (let j = i + 1; j < empIds.length; j++) {
      const e1 = empIds[i], e2 = empIds[j];
      const key = [e1, e2].sort().join("::");
      if (checked.has(key)) continue;
      checked.add(key);

      const labels1 = empLabels.get(e1) ?? new Set();
      const labels2 = empLabels.get(e2) ?? new Set();
      const shared: string[] = [];
      for (const l of labels1) {
        if (labels2.has(l)) shared.push(l);
      }

      if (shared.length > 0) {
        // Also count shared edges
        const sharedEdges: string[] = [];
        for (const g1 of empSessionMap.get(e1) ?? []) {
          for (const g2 of empSessionMap.get(e2) ?? []) {
            for (const edge of g1.edges.values()) {
              const fn1 = g1.getNode(edge.from);
              const tn1 = g1.getNode(edge.to);
              if (!fn1 || !tn1) continue;
              for (const edge2 of g2.edges.values()) {
                const fn2 = g2.getNode(edge2.from);
                const tn2 = g2.getNode(edge2.to);
                if (!fn2 || !tn2) continue;
                if (fn1.label.trim().toLowerCase() === fn2.label.trim().toLowerCase() &&
                    tn1.label.trim().toLowerCase() === tn2.label.trim().toLowerCase() &&
                    edge.type === edge2.type) {
                  sharedEdges.push(`${fn1.label}→${tn1.label}`);
                }
              }
            }
          }
        }

        relations.push({
          emp1: e1, emp2: e2,
          sharedNodeLabels: shared,
          sharedEdgeKeys: [...new Set(sharedEdges)],
          weight: shared.length + [...new Set(sharedEdges)].length * 2,
        });
      }
    }
  }

  // Simple community detection: group by shared density
  const communities = simpleCommunityClusters(empIds, relations);

  return { relations, communities };
}

function simpleCommunityClusters(empIds: string[], relations: EmployeePairRelation[]): string[][] {
  if (empIds.length <= 2) return [empIds];

  // Build adjacency map
  const adj = new Map<string, Set<string>>();
  for (const eid of empIds) adj.set(eid, new Set());

  for (const r of relations) {
    adj.get(r.emp1)?.add(r.emp2);
    adj.get(r.emp2)?.add(r.emp1);
  }

  // BFS-based connected components
  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const eid of empIds) {
    if (visited.has(eid)) continue;
    const cluster: string[] = [];
    const queue = [eid];
    visited.add(eid);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      cluster.push(cur);
      for (const neighbor of adj.get(cur)!) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    clusters.push(cluster);
  }

  return clusters;
}

// ─── Enterprise Network Aggregation ──────────────────────────────

export function buildEnterpriseNetwork(orgId: string): {
  reactFlow: ReactFlowData;
  stats: { nodeCount: number; edgeCount: number; employeeCount: number };
} {
  const cached = orgCacheGet<{ reactFlow: ReactFlowData; stats: { nodeCount: number; edgeCount: number; employeeCount: number } }>(orgId, "network");
  if (cached) return cached;
  const result = buildEnterpriseNetworkUncached(orgId);
  orgCacheSet(orgId, "network", result);
  return result;
}

function buildEnterpriseNetworkUncached(orgId: string): {
  reactFlow: ReactFlowData;
  stats: { nodeCount: number; edgeCount: number; employeeCount: number };
} {
  const sessions = listSessionsByOrg(orgId);
  if (sessions.length === 0) {
    return { reactFlow: { nodes: [], edges: [] }, stats: { nodeCount: 0, edgeCount: 0, employeeCount: 0 } };
  }

  const employees = listEmployees(orgId);
  const empSet = new Set(employees.map(e => e.id));
  const contributingEmps = new Set(sessions.filter(s => s.employeeId && empSet.has(s.employeeId)).map(s => s.employeeId!));

  // Merge all graphs. O(1) label de-duplication via maps (not O(N²) scans) so
  // this scales to 100+ employees, with enterprise bounds + graceful degradation.
  const config = getConfig();
  const merged = new ProcessGraph("Enterprise Network", {
    maxNodes: config.maxEnterpriseNodes,
    maxEdges: config.maxEnterpriseEdges,
  });
  const nodeEmployees = new Map<string, Set<string>>(); // label key → employee ids
  const labelToId = new Map<string, string>();          // label key → merged node id
  const edgeKeyToId = new Map<string, string>();         // from|to|type → merged edge id

  for (const s of sessions) {
    if (!s.employeeId) continue;
    const g = ProcessGraph.fromData(s.graph);
    for (const node of g.nodes.values()) {
      const key = node.label.trim().toLowerCase();
      const existingId = labelToId.get(key);
      if (existingId) {
        const existing = merged.getNode(existingId)!;
        existing.confidence = Math.min(1, existing.confidence + 0.05);
        if (node.painScore && (!existing.painScore || node.painScore > existing.painScore)) {
          existing.painScore = node.painScore;
        }
        nodeEmployees.get(key)?.add(s.employeeId);
      } else {
        try {
          const added = merged.addNode({ ...node });
          labelToId.set(key, added.id);
          nodeEmployees.set(key, new Set([s.employeeId]));
        } catch {
          break; // enterprise node ceiling reached — degrade gracefully
        }
      }
    }

    for (const edge of g.edges.values()) {
      const fn = g.getNode(edge.from);
      const tn = g.getNode(edge.to);
      if (!fn || !tn) continue;
      const fk = fn.label.trim().toLowerCase();
      const tk = tn.label.trim().toLowerCase();
      const fromId = labelToId.get(fk);
      const toId = labelToId.get(tk);
      if (!fromId || !toId) continue; // endpoint dropped at ceiling
      const ekey = `${fk}|${tk}|${edge.type}`;
      const dupId = edgeKeyToId.get(ekey);
      if (dupId) {
        const dup = merged.getEdge(dupId);
        if (dup) dup.confidence = Math.min(1, dup.confidence + 0.05);
      } else {
        try {
          const added = merged.addEdge({ ...edge, from: fromId, to: toId });
          edgeKeyToId.set(ekey, added.id);
        } catch { /* edge ceiling reached */ }
      }
    }
  }

  // Compute betweenness centrality
  const centrality = betweennessCentrality(merged);

  // Generate React Flow data
  const rfData = graphToReactFlow(merged);

  // Annotate nodes with employee associations and centrality
  for (const node of rfData.nodes) {
    const key = node.data.label.trim().toLowerCase();
    const emps = nodeEmployees.get(key);
    if (emps) {
      (node.data as Record<string, unknown>).employees = [...emps].map(eid => {
        const emp = employees.find(e => e.id === eid);
        return emp?.name ?? eid;
      });
    }
    const bc = centrality.get(node.id);
    if (bc !== undefined) {
      (node.data as Record<string, unknown>).centrality = bc;
    }
  }

  // Scale node size by centrality
  const maxBC = Math.max(0.001, ...centrality.values());
  for (const node of rfData.nodes) {
    const bc = centrality.get(node.id) ?? 0;
    const scale = 0.6 + (bc / maxBC) * 1.4;
    // Adjust position spacing
    node.position = {
      x: node.position.x * scale,
      y: node.position.y * scale,
    };
  }

  return {
    reactFlow: rfData,
    stats: {
      nodeCount: merged.nodeCount(),
      edgeCount: merged.edgeCount(),
      employeeCount: contributingEmps.size,
    },
  };
}

// ─── Employee Relations React Flow Generation ────────────────────

export function buildEmployeeRelationsNetwork(orgId: string): ReactFlowData {
  const { relations, communities } = computeEmployeeRelations(orgId);
  const employees = listEmployees(orgId);

  if (employees.length === 0) return { nodes: [], edges: [] };

  // Position nodes: same community → clustered, different communities → spread
  const nodes: ReactFlowData["nodes"] = [];
  const edges: ReactFlowData["edges"] = [];
  const empMap = new Map(employees.map(e => [e.id, e]));

  // Simple layout: arrange in a circle, same community adjacent
  const allEmpIds = employees.map(e => e.id);
  const n = allEmpIds.length;
  const cx = 300, cy = 250, r = 180;

  for (let i = 0; i < n; i++) {
    const eid = allEmpIds[i];
    const emp = empMap.get(eid);
    const angle = (2 * Math.PI * i) / n;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);

    // Count total shared nodes
    let sharedCount = 0;
    for (const rel of relations) {
      if (rel.emp1 === eid || rel.emp2 === eid) {
        sharedCount += rel.sharedNodeLabels.length;
      }
    }

    nodes.push({
      id: eid,
      type: "employee",
      position: { x: x - 30, y: y - 30 },
      data: {
        label: emp?.name ?? eid,
        nodeType: "Role",
        description: emp?.role ?? "",
        confidence: 1,
        department: emp?.department,
        departmentColor: "#eef2ff",
        departmentBorder: "#6366f1",
        isSource: false, isSink: false, isSpof: false, hasGaps: false, gapCount: 0,
        sharedCount,
        role: emp?.role,
      } as unknown as ReactFlowData["nodes"][0]["data"],
    });
  }

  // Edges for shared nodes
  for (const rel of relations) {
    const e1 = empMap.get(rel.emp1);
    const e2 = empMap.get(rel.emp2);
    edges.push({
      id: `${rel.emp1}-${rel.emp2}`,
      source: rel.emp1,
      target: rel.emp2,
      type: "smoothstep",
      animated: false,
      style: {
        stroke: "#c7d2fe",
        strokeWidth: Math.min(6, Math.max(1, rel.weight)),
        strokeDasharray: undefined,
      },
      label: rel.sharedNodeLabels.length > 0 ? `${rel.sharedNodeLabels.length} 共享节点` : undefined,
      data: { edgeType: "INFORMS", confidence: 0.8 },
    });
  }

  return { nodes, edges };
}
