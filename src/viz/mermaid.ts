/**
 * Mermaid diagram generator — produces Mermaid flowchart syntax from ProcessGraph.
 *
 * Features:
 * - Topological ordering (upstream nodes first, sinks last)
 * - Source/sink visual highlighting
 * - Department-colored subgraphs
 * - Pain score indicators (🔥)
 * - Gap highlighting
 * - Cross-department edge styling
 */

import { ProcessGraph } from "../model/graph.js";
import type { Gap, Node, Edge } from "../model/schema.js";

// Department color palette
const DEPT_COLORS = [
  "#E3F2FD", "#E8F5E9", "#FFF3E0", "#FCE4EC", "#F3E5F5",
  "#E0F7FA", "#FFF9C4", "#F1F8E9", "#E8EAF6", "#EFEBE9",
];

const DEPT_BORDER = [
  "#1E88E5", "#43A047", "#FB8C00", "#E53935", "#8E24AA",
  "#00ACC1", "#FDD835", "#7CB342", "#3949AB", "#6D4C41",
];

const EDGE_COLORS: Record<string, string> = {
  FLOW: "#333",
  INFORMS: "#1976D2",
  BLOCKS: "#D32F2F",
  PRODUCES: "#388E3C",
  CONSUMES: "#F57C00",
};

export interface MermaidOptions {
  highlightGaps?: Gap[];
  showPainScore?: boolean;
  showConfidence?: boolean;
  groupByDepartment?: boolean;
}

export function generateMermaid(graph: ProcessGraph, options: MermaidOptions = {}): string {
  const {
    highlightGaps = [],
    showPainScore = true,
    showConfidence = false,
    groupByDepartment = true,
  } = options;

  const highlightedNodeIds = new Set(highlightGaps.flatMap(g => g.nodeIds));
  const highlightedEdgeIds = new Set(highlightGaps.flatMap(g => g.edgeIds));

  // Topological ordering: sources first, sinks last
  const sourceSet = new Set(graph.sources().map(n => n.id));
  const sinkSet = new Set(graph.sinks().map(n => n.id));
  const topoSorted = graph.topologicalSort();

  const lines: string[] = [
    "graph TD",
    "  %% Topologically sorted: upstream sources → downstream sinks",
    "",
  ];

  // Helper: sanitize Mermaid ID
  const mid = (s: string) => s.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, "_");

  // Helper: node label with optional indicators
  const nodeLabel = (node: Node): string => {
    const parts: string[] = [];
    if (showPainScore && node.painScore && node.painScore >= 5) {
      parts.push(`🔥${node.painScore}`);
    }
    parts.push(node.label);
    if (showConfidence && node.confidence < 0.7) {
      parts.push(`[${(node.confidence * 100).toFixed(0)}%]`);
    }
    return parts.join(" ");
  };

  // Node type shapes
  const nodeShape = (node: Node): [string, string] => {
    switch (node.type) {
      case "DecisionPoint": return ["{{", "}}"]; // diamond
      case "WaitState": return ["[(", ")]"];     // stadium
      case "Artifact": return ["[", "]"];         // rectangle
      case "ExternalEntity": return ["[/", "/]"]; // parallelogram
      case "Role": return ["[", "]"];
      case "Department": return ["[", "]"];
      case "ProcessStep":
      default: return ["[", "]"];                 // rectangle
    }
  };

  // Collect nodes by department, preserving topological order
  const nodeIdsByDept = new Map<string, Node[]>();
  const noDept: Node[] = [];
  const topoSortedIds = new Set(topoSorted.map(n => n.id));

  for (const node of topoSorted) {
    if (node.department && groupByDepartment) {
      const existing = nodeIdsByDept.get(node.department);
      if (existing) {
        existing.push(node);
      } else {
        nodeIdsByDept.set(node.department, [node]);
      }
    } else {
      noDept.push(node);
    }
  }

  // Generate nodes by department
  let deptIdx = 0;
  for (const [dept, nodes] of nodeIdsByDept) {
    const color = DEPT_COLORS[deptIdx % DEPT_COLORS.length];
    const border = DEPT_BORDER[deptIdx % DEPT_BORDER.length];
    lines.push(`  subgraph ${mid(dept)}["${dept}"]`);
    lines.push(`    style ${mid(dept)} fill:${color},stroke:${border}`);
    for (const node of nodes) {
      const [open, close] = nodeShape(node);
      const cssClasses: string[] = [];
      if (highlightedNodeIds.has(node.id)) cssClasses.push("highlighted");
      if (sourceSet.has(node.id)) cssClasses.push("sourceNode");
      if (sinkSet.has(node.id)) cssClasses.push("sinkNode");
      const classStr = cssClasses.length > 0 ? `:::${cssClasses.join(",")}` : "";
      lines.push(`    ${mid(node.id)}${open}"${nodeLabel(node)}"${close}${classStr}`);
    }
    lines.push("  end");
    lines.push("");
    deptIdx++;
  }

  // Nodes without department (still topologically sorted)
  for (const node of noDept) {
    const [open, close] = nodeShape(node);
    const cssClasses: string[] = [];
    if (highlightedNodeIds.has(node.id)) cssClasses.push("highlighted");
    if (sourceSet.has(node.id)) cssClasses.push("sourceNode");
    if (sinkSet.has(node.id)) cssClasses.push("sinkNode");
    const classStr = cssClasses.length > 0 ? `:::${cssClasses.join(",")}` : "";
    lines.push(`  ${mid(node.id)}${open}"${nodeLabel(node)}"${close}${classStr}`);
  }
  lines.push("");

  // Generate edges
  for (const edge of graph.edges.values()) {
    const from = graph.getNode(edge.from);
    const to = graph.getNode(edge.to);
    if (!from || !to) continue;

    const color = EDGE_COLORS[edge.type] ?? "#999";

    let arrow = "-->";
    if (edge.type === "INFORMS") arrow = "-.->";
    if (edge.type === "BLOCKS") arrow = "--x";

    const lbl = edge.label ? `|"${edge.label}"|` : "";
    lines.push(`  ${mid(edge.from)} ${arrow}${lbl} ${mid(edge.to)}`);
  }

  // Class definitions
  lines.push("");
  lines.push("  classDef highlighted fill:#FFEB3B,stroke:#F57F17,stroke-width:3px,stroke-dasharray:5 5");
  lines.push("  classDef sourceNode fill:#C8E6C9,stroke:#2E7D32,stroke-width:2px");
  lines.push("  classDef sinkNode fill:#BBDEFB,stroke:#1565C0,stroke-width:2px");
  lines.push("");
  lines.push("  %% Legend: 🟢 Green border = Source (upstream) | 🔵 Blue border = Sink (downstream) | 🟡 Yellow = Gap detected");

  return lines.join("\n");
}
