/**
 * ProcessGraph — directed graph with typed nodes/edges.
 * Core state space of the system. All mutations are explicit.
 *
 * Resource bounds: max 200 nodes, 500 edges (engineering cybernetics: bounded resources).
 */

import { v4 as uuid } from "uuid";
import type {
  Node, NodeType, Edge, EdgeType,
  ProcessStep, DecisionPoint, WaitState, Artifact, ExternalEntity, Role, Department,
  ProcessGraphData,
} from "./schema.js";
import { getConfig } from "../config.js";

export class ProcessGraph {
  nodes: Map<string, Node> = new Map();
  edges: Map<string, Edge> = new Map();
  processName: string;
  private nodeLimit?: number;
  private edgeLimit?: number;
  // Lazy adjacency index: rebuilt on demand after edge mutations so that
  // outgoing()/incoming() are O(1) instead of O(E). Critical at enterprise
  // scale where detectors/centrality/layout call them inside tight loops.
  private _outAdj: Map<string, Edge[]> = new Map();
  private _inAdj: Map<string, Edge[]> = new Map();
  private _adjDirty = true;

  private rebuildAdjacency(): void {
    this._outAdj = new Map();
    this._inAdj = new Map();
    for (const e of this.edges.values()) {
      let o = this._outAdj.get(e.from);
      if (!o) { o = []; this._outAdj.set(e.from, o); }
      o.push(e);
      let i = this._inAdj.get(e.to);
      if (!i) { i = []; this._inAdj.set(e.to, i); }
      i.push(e);
    }
    this._adjDirty = false;
  }

  constructor(processName = "Unnamed Process", opts?: { maxNodes?: number; maxEdges?: number }) {
    this.processName = processName;
    this.nodeLimit = opts?.maxNodes;
    this.edgeLimit = opts?.maxEdges;
  }

  // ─── Node CRUD ─────────────────────────────────────────────

  addNode(node: Omit<Node, "id"> & { id?: string }): Node {
    const limit = this.nodeLimit ?? getConfig().maxNodes;
    if (this.nodes.size >= limit) {
      throw new Error(`Node limit reached: ${limit}`);
    }
    const n: Node = {
      id: node.id ?? uuid(),
      ...node,
    } as Node;
    this.nodes.set(n.id, n);
    return n;
  }

  getNode(id: string): Node | undefined {
    return this.nodes.get(id);
  }

  updateNode(id: string, patch: Partial<Node>): Node {
    const existing = this.nodes.get(id);
    if (!existing) throw new Error(`Node not found: ${id}`);
    const updated = { ...existing, ...patch } as Node;
    this.nodes.set(id, updated);
    return updated;
  }

  removeNode(id: string): void {
    this.nodes.delete(id);
    // Cascade: remove all edges connected to this node
    for (const [eid, edge] of this.edges) {
      if (edge.from === id || edge.to === id) {
        this.edges.delete(eid);
      }
    }
    this._adjDirty = true;
  }

  findNodesByType<T extends NodeType>(type: T): Extract<Node, { type: T }>[] {
    return [...this.nodes.values()].filter(
      (n): n is Extract<Node, { type: T }> => n.type === type,
    );
  }

  findNodesByDepartment(department: string): Node[] {
    return [...this.nodes.values()].filter(n => n.department === department);
  }

  // ─── Edge CRUD ─────────────────────────────────────────────

  addEdge(edge: Omit<Edge, "id"> & { id?: string }): Edge {
    const limit = this.edgeLimit ?? getConfig().maxEdges;
    if (this.edges.size >= limit) {
      throw new Error(`Edge limit reached: ${limit}`);
    }
    const e: Edge = {
      id: edge.id ?? uuid(),
      ...edge,
    };
    this.edges.set(e.id, e);
    this._adjDirty = true;
    return e;
  }

  getEdge(id: string): Edge | undefined {
    return this.edges.get(id);
  }

  removeEdge(id: string): void {
    this.edges.delete(id);
    this._adjDirty = true;
  }

  // ─── Query ─────────────────────────────────────────────────

  /** Outgoing edges from a node (O(1) via lazy adjacency index) */
  outgoing(nodeId: string): Edge[] {
    if (this._adjDirty) this.rebuildAdjacency();
    return this._outAdj.get(nodeId) ?? [];
  }

  /** Incoming edges to a node (O(1) via lazy adjacency index) */
  incoming(nodeId: string): Edge[] {
    if (this._adjDirty) this.rebuildAdjacency();
    return this._inAdj.get(nodeId) ?? [];
  }

  /** Nodes with no incoming edges (sources) */
  sources(): Node[] {
    const hasIncoming = new Set([...this.edges.values()].map(e => e.to));
    return [...this.nodes.values()].filter(n => !hasIncoming.has(n.id));
  }

  /** Nodes with no outgoing edges (sinks) */
  sinks(): Node[] {
    const hasOutgoing = new Set([...this.edges.values()].map(e => e.from));
    return [...this.nodes.values()].filter(n => !hasOutgoing.has(n.id));
  }

  /** Nodes that are orphaned (no incoming AND no outgoing edges) */
  orphans(): Node[] {
    const connected = new Set<string>();
    for (const e of this.edges.values()) {
      connected.add(e.from);
      connected.add(e.to);
    }
    return [...this.nodes.values()].filter(n => !connected.has(n.id));
  }

  /** Detect cycles using DFS coloring. Returns a cycle path or null. */
  detectCycle(): string[] | null {
    const WHITE = 0, GRAY = 1, BLACK = 2;
    const color = new Map<string, number>();
    const parent = new Map<string, string>();

    for (const nid of this.nodes.keys()) {
      color.set(nid, WHITE);
    }

    for (const nid of this.nodes.keys()) {
      if (color.get(nid) === WHITE) {
        const cycle = this._dfsCycle(nid, color, parent);
        if (cycle) return cycle;
      }
    }
    return null;
  }

  private _dfsCycle(
    u: string,
    color: Map<string, number>,
    parent: Map<string, string>,
  ): string[] | null {
    color.set(u, 1); // GRAY
    for (const e of this.outgoing(u)) {
      const v = e.to;
      const c = color.get(v);
      if (c === 1) {
        // Back edge found — extract cycle
        const cycle: string[] = [v, u];
        let cur = u;
        while (parent.has(cur) && cur !== v) {
          cur = parent.get(cur)!;
          cycle.push(cur);
        }
        cycle.reverse();
        return cycle;
      }
      if (c === 0) {
        parent.set(v, u);
        const cycle = this._dfsCycle(v, color, parent);
        if (cycle) return cycle;
      }
    }
    color.set(u, 2); // BLACK
    return null;
  }

  /** All paths between two nodes (BFS, limited to 200 paths) */
  findAllPaths(from: string, to: string, maxPaths = 200): string[][] {
    const paths: string[][] = [];
    const queue: string[][] = [[from]];
    while (queue.length > 0 && paths.length < maxPaths) {
      const path = queue.shift()!;
      const last = path[path.length - 1];
      if (last === to) {
        paths.push(path);
        continue;
      }
      for (const e of this.outgoing(last)) {
        if (!path.includes(e.to)) {
          queue.push([...path, e.to]);
        }
      }
    }
    return paths;
  }

  /** Nodes with confidence below threshold */
  lowConfidenceNodes(threshold = 0.5): Node[] {
    return [...this.nodes.values()].filter(n => n.confidence < threshold);
  }

  /** Edges with confidence below threshold */
  lowConfidenceEdges(threshold = 0.5): Edge[] {
    return [...this.edges.values()].filter(e => e.confidence < threshold);
  }

  /** Average graph confidence */
  averageConfidence(): number {
    const all = [...this.nodes.values(), ...this.edges.values()];
    if (all.length === 0) return 1;
    return all.reduce((sum, e) => sum + e.confidence, 0) / all.length;
  }

  /** Cross-department edge count */
  crossDepartmentEdges(): { edge: Edge; fromDept: string; toDept: string }[] {
    const result: { edge: Edge; fromDept: string; toDept: string }[] = [];
    for (const e of this.edges.values()) {
      const from = this.nodes.get(e.from);
      const to = this.nodes.get(e.to);
      if (from?.department && to?.department && from.department !== to.department) {
        result.push({ edge: e, fromDept: from.department, toDept: to.department });
      }
    }
    return result;
  }

  /** Single points of failure: nodes where all paths from source to sink go through */
  singlePointsOfFailure(): Node[] {
    const sources = this.sources();
    const sinks = this.sinks();
    if (sources.length === 0 || sinks.length === 0) return [];

    const spofs: Node[] = [];
    for (const node of this.nodes.values()) {
      // Skip source and sink nodes themselves
      if (sources.some(s => s.id === node.id)) continue;
      if (sinks.some(s => s.id === node.id)) continue;

      // Check if all paths from any source to any sink pass through this node
      let allPathsGoThrough = false;
      for (const src of sources) {
        for (const snk of sinks) {
          const paths = this.findAllPaths(src.id, snk.id, 50);
          if (paths.length > 0) {
            const allPass = paths.every(p => p.includes(node.id));
            if (allPass) {
              allPathsGoThrough = true;
              break;
            }
          }
        }
        if (allPathsGoThrough) break;
      }
      if (allPathsGoThrough) {
        spofs.push(node);
      }
    }
    return spofs;
  }

  // ─── Topological Ordering ───────────────────────────────────

  /** Kahn's algorithm: returns each node's topological level.
   *  Level 0 = sources (no incoming edges), max level = sinks.
   *  Nodes in cycles get -1 (could not be ordered).
   *  Complexity: O(V + E). */
  topologicalLevels(): Map<string, number> {
    const levels = new Map<string, number>();
    const inDegree = new Map<string, number>();

    // Initialize
    for (const nid of this.nodes.keys()) {
      inDegree.set(nid, 0);
    }
    for (const e of this.edges.values()) {
      // Only count FLOW edges for topological ordering
      if (e.type === "FLOW" || e.type === "PRODUCES" || e.type === "CONSUMES") {
        inDegree.set(e.to, (inDegree.get(e.to) ?? 0) + 1);
      }
    }

    // Queue nodes with in-degree 0 (sources)
    const queue: { id: string; level: number }[] = [];
    for (const nid of this.nodes.keys()) {
      if ((inDegree.get(nid) ?? 0) === 0) {
        queue.push({ id: nid, level: 0 });
      }
    }

    let processed = 0;
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      levels.set(id, level);
      processed++;

      for (const e of this.outgoing(id)) {
        if (e.type === "FLOW" || e.type === "PRODUCES" || e.type === "CONSUMES") {
          const newDegree = (inDegree.get(e.to) ?? 1) - 1;
          inDegree.set(e.to, newDegree);
          if (newDegree === 0) {
            queue.push({ id: e.to, level: level + 1 });
          }
        }
      }
    }

    // Nodes still in cycles get -1
    if (processed < this.nodes.size) {
      for (const nid of this.nodes.keys()) {
        if (!levels.has(nid)) {
          levels.set(nid, -1);
        }
      }
    }

    return levels;
  }

  /** Nodes sorted by topological level (upstream first, sinks last, cycles at end). */
  topologicalSort(): Node[] {
    const levels = this.topologicalLevels();
    return [...this.nodes.values()].sort((a, b) => {
      const la = levels.get(a.id) ?? -1;
      const lb = levels.get(b.id) ?? -1;
      return la - lb;
    });
  }

  /** Transitive closure: all upstream nodes (nodes that can reach this one via FLOW edges).
   *  Uses reverse BFS following incoming edges. */
  upstreamOf(nodeId: string): Node[] {
    const visited = new Set<string>();
    const queue = [nodeId];
    visited.add(nodeId);
    const result: Node[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const e of this.incoming(current)) {
        if (e.type === "FLOW" || e.type === "PRODUCES" || e.type === "CONSUMES") {
          if (!visited.has(e.from)) {
            visited.add(e.from);
            queue.push(e.from);
            const node = this.nodes.get(e.from);
            if (node) result.push(node);
          }
        }
      }
    }
    return result;
  }

  /** Transitive closure: all downstream nodes (nodes reachable from this one via FLOW edges).
   *  Uses BFS following outgoing edges. */
  downstreamOf(nodeId: string): Node[] {
    const visited = new Set<string>();
    const queue = [nodeId];
    visited.add(nodeId);
    const result: Node[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      for (const e of this.outgoing(current)) {
        if (e.type === "FLOW" || e.type === "PRODUCES" || e.type === "CONSUMES") {
          if (!visited.has(e.to)) {
            visited.add(e.to);
            queue.push(e.to);
            const node = this.nodes.get(e.to);
            if (node) result.push(node);
          }
        }
      }
    }
    return result;
  }

  // ─── Serialization ──────────────────────────────────────────

  toData(): ProcessGraphData {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      metadata: {
        processName: this.processName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
        confidence: this.averageConfidence(),
      },
    };
  }

  static fromData(data: ProcessGraphData): ProcessGraph {
    const g = new ProcessGraph(data.metadata.processName);
    for (const n of data.nodes) {
      g.nodes.set(n.id, n);
    }
    for (const e of data.edges) {
      g.edges.set(e.id, e);
    }
    return g;
  }

  // ─── Helpers ────────────────────────────────────────────────

  nodeCount(): number { return this.nodes.size; }
  edgeCount(): number { return this.edges.size; }
}
