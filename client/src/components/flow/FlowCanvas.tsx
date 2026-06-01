import { useCallback, useEffect, useMemo } from "react";
import {
  ReactFlow, Background, BackgroundVariant, Controls, MiniMap,
  useNodesState, useEdgesState, MarkerType,
  type Node, type Edge, type NodeMouseHandler, type NodeTypes,
} from "@xyflow/react";
import { ProcessNode } from "./ProcessNode";
import type { ReactFlowData } from "../../types";
import { useTheme } from "../../app/ThemeProvider";

const defaultNodeTypes: NodeTypes = { process: ProcessNode };

function toFlowNodes(data: ReactFlowData, kind: string): Node[] {
  return (data.nodes ?? []).map((n) => ({
    id: n.id,
    type: kind,
    position: n.position ?? { x: 0, y: 0 },
    data: { ...(n.data as unknown as Record<string, unknown>), label: (n as { label?: string }).label ?? (n.data as { label?: string })?.label },
  }));
}

function toFlowEdges(data: ReactFlowData): Edge[] {
  return (data.edges ?? []).map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated,
    style: e.style,
    labelStyle: { fontSize: 10, fill: "var(--fg-tertiary)", fontWeight: 600 },
    labelBgStyle: { fill: "var(--bg-card)", fillOpacity: 0.85 },
    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: e.style?.stroke ?? "#94a3b8" },
  }));
}

export interface FlowCanvasProps {
  data: ReactFlowData;
  onNodeClick?: (node: Record<string, unknown>) => void;
  kind?: string;
  nodeTypes?: NodeTypes;
  showMiniMap?: boolean;
}

export function FlowCanvas({ data, onNodeClick, kind = "process", nodeTypes = defaultNodeTypes, showMiniMap = true }: FlowCanvasProps) {
  const { resolved } = useTheme();
  const initialNodes = useMemo(() => toFlowNodes(data, kind), [data, kind]);
  const initialEdges = useMemo(() => toFlowEdges(data), [data]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => { setNodes(initialNodes); }, [initialNodes, setNodes]);
  useEffect(() => { setEdges(initialEdges); }, [initialEdges, setEdges]);

  const handleNodeClick = useCallback<NodeMouseHandler>((_e, node) => {
    onNodeClick?.({ ...(node.data as Record<string, unknown>), id: node.id });
  }, [onNodeClick]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={handleNodeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2, maxZoom: 1.1 }}
      minZoom={0.15}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
      colorMode={resolved}
      defaultEdgeOptions={{ markerEnd: { type: MarkerType.ArrowClosed } }}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
      <Controls showInteractive={false} className="!shadow-md !border !border-border !rounded-lg overflow-hidden" />
      {showMiniMap && (
        <MiniMap
          pannable zoomable
          className="!bg-card !border !border-border !rounded-lg"
          maskColor="color-mix(in srgb, var(--bg) 70%, transparent)"
          nodeColor={(n) => {
            const t = String((n.data as Record<string, unknown>)?.nodeType ?? "").toLowerCase();
            return ({ processstep: "#4f46e5", decisionpoint: "#d97706", waitstate: "#dc2626", artifact: "#0f9d6b", externalentity: "#0891b2", role: "#9333ea", department: "#475569" } as Record<string, string>)[t] ?? "#818cf8";
          }}
        />
      )}
    </ReactFlow>
  );
}
