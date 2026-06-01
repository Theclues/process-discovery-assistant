/**
 * React Flow data generator — converts ProcessGraph to React Flow node/edge format.
 *
 * Layout algorithm: Kahn's topological sort for layering, with department grouping
 * within each layer. Sources at top, sinks at bottom.
 */

import { ProcessGraph } from "../model/graph.js";
import type { Gap, Node, EdgeType } from "../model/schema.js";

const DEPT_COLORS = [
  { bg: "#E3F2FD", border: "#1E88E5", text: "#1565C0" },
  { bg: "#E8F5E9", border: "#43A047", text: "#2E7D32" },
  { bg: "#FFF3E0", border: "#FB8C00", text: "#E65100" },
  { bg: "#FCE4EC", border: "#E91E63", text: "#C2185B" },
  { bg: "#F3E5F5", border: "#8E24AA", text: "#6A1B9A" },
  { bg: "#E0F7FA", border: "#00ACC1", text: "#00838F" },
  { bg: "#FFF8E1", border: "#FDD835", text: "#F9A825" },
  { bg: "#EFEBE9", border: "#795548", text: "#4E342E" },
  { bg: "#E8EAF6", border: "#3949AB", text: "#283593" },
  { bg: "#F1F8E9", border: "#689F38", text: "#33691E" },
];

const EDGE_COLORS: Record<string, string> = {
  FLOW: "#475569",
  INFORMS: "#1976D2",
  BLOCKS: "#D32F2F",
  PRODUCES: "#388E3C",
  CONSUMES: "#F57C00",
};

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;
const HORIZONTAL_GAP = 30;
const VERTICAL_GAP = 100;

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    nodeType: string;
    description: string;
    confidence: number;
    painScore?: number;
    department?: string;
    departmentColor: string;
    departmentBorder: string;
    isSource: boolean;
    isSink: boolean;
    isSpof: boolean;
    hasGaps: boolean;
    gapCount: number;
    duration?: string;
    frequency?: string;
    waitCause?: string;
    waitDuration?: string;
    condition?: string;
  };
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  animated?: boolean;
  style: { stroke: string; strokeWidth: number; strokeDasharray?: string };
  label?: string;
  data: { edgeType: string; confidence: number };
}

export interface ReactFlowData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export function graphToReactFlow(
  graph: ProcessGraph,
  options: { highlightGaps?: Gap[] } = {}
): ReactFlowData {
  const { highlightGaps = [] } = options;
  const highlightedNodeIds = new Set(highlightGaps.flatMap(g => g.nodeIds));
  const highlightedEdgeIds = new Set(highlightGaps.flatMap(g => g.edgeIds));

  const sourceIds = new Set(graph.sources().map(n => n.id));
  const sinkIds = new Set(graph.sinks().map(n => n.id));
  const spofIds = new Set(graph.singlePointsOfFailure().map(n => n.id));

  // Kahn's algorithm for layering
  const levels = graph.topologicalLevels();
  const maxLevel = Math.max(0, ...levels.values());

  // Assign department colors
  const deptColorMap = new Map<string, number>();
  let deptIdx = 0;
  for (const node of graph.nodes.values()) {
    const dept = node.department ?? "__none__";
    if (!deptColorMap.has(dept)) {
      deptColorMap.set(dept, deptIdx++);
    }
  }

  const getDeptColor = (dept?: string) => {
    const idx = deptColorMap.get(dept ?? "__none__") ?? 0;
    return DEPT_COLORS[idx % DEPT_COLORS.length];
  };

  // Group nodes by level, then by department within each level
  const levelNodes = new Map<number, Node[]>();
  for (const node of graph.nodes.values()) {
    const level = levels.get(node.id) ?? -1;
    const realLevel = level === -1 ? maxLevel + 1 : level;
    const existing = levelNodes.get(realLevel);
    if (existing) {
      existing.push(node);
    } else {
      levelNodes.set(realLevel, [node]);
    }
  }

  // Compute positions
  const nodes: ReactFlowNode[] = [];
  const sortedLevels = [...levelNodes.keys()].sort((a, b) => a - b);

  for (const level of sortedLevels) {
    const levelNodeList = levelNodes.get(level) ?? [];
    // Sort by department for visual clustering
    levelNodeList.sort((a, b) => (a.department ?? "").localeCompare(b.department ?? ""));

    const totalWidth = levelNodeList.length * (NODE_WIDTH + HORIZONTAL_GAP) - HORIZONTAL_GAP;
    const startX = -totalWidth / 2;

    levelNodeList.forEach((node, i) => {
      const deptColor = getDeptColor(node.department);
      nodes.push({
        id: node.id,
        type: nodeTypeToReactFlow(node.type),
        position: {
          x: startX + i * (NODE_WIDTH + HORIZONTAL_GAP),
          y: level * (NODE_HEIGHT + VERTICAL_GAP),
        },
        data: {
          label: node.label,
          nodeType: node.type,
          description: node.description,
          confidence: node.confidence,
          painScore: node.painScore,
          department: node.department,
          departmentColor: deptColor.bg,
          departmentBorder: deptColor.border,
          isSource: sourceIds.has(node.id),
          isSink: sinkIds.has(node.id),
          isSpof: spofIds.has(node.id),
          hasGaps: highlightedNodeIds.has(node.id),
          gapCount: highlightGaps.filter(g => g.nodeIds.includes(node.id)).length,
          duration: "duration" in node ? (node as { duration?: string }).duration : undefined,
          frequency: "frequency" in node ? (node as { frequency?: string }).frequency : undefined,
          waitCause: "waitCause" in node ? (node as { waitCause?: string }).waitCause : undefined,
          waitDuration: "waitDuration" in node ? (node as { waitDuration?: string }).waitDuration : undefined,
          condition: "condition" in node ? (node as { condition?: string }).condition : undefined,
        },
      });
    });
  }

  // Generate edges
  const edges: ReactFlowEdge[] = [];
  for (const edge of graph.edges.values()) {
    const color = EDGE_COLORS[edge.type] ?? "#999";
    const isHighlighted = highlightedEdgeIds.has(edge.id);
    edges.push({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      type: edgeTypeToReactFlow(edge.type),
      animated: edge.type === "FLOW",
      style: {
        stroke: color,
        strokeWidth: isHighlighted ? 3 : 1.5,
        strokeDasharray: edge.type === "INFORMS" ? "6 3" : undefined,
      },
      label: edge.label || undefined,
      data: { edgeType: edge.type, confidence: edge.confidence },
    });
  }

  return { nodes, edges };
}

function nodeTypeToReactFlow(nt: string): string {
  return nt.toLowerCase(); // custom node type name
}

function edgeTypeToReactFlow(et: EdgeType): string {
  switch (et) {
    case "INFORMS": return "smoothstep";
    case "BLOCKS": return "straight";
    default: return "smoothstep";
  }
}
