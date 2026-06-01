/**
 * Client-side types mirroring the server API responses.
 */

export type NodeType = "ProcessStep" | "DecisionPoint" | "WaitState" | "Artifact" | "ExternalEntity" | "Role" | "Department";
export type EdgeType = "FLOW" | "INFORMS" | "BLOCKS" | "PRODUCES" | "CONSUMES";
export type GapCategory = "structural" | "control_flow" | "temporal" | "organizational" | "information_quality";
export type DialogueState = "ONBOARDING" | "ELICITING" | "CLARIFYING" | "MAPPING" | "GAP_DETECTING" | "QUESTIONING" | "VERIFYING" | "COMPLETE";
export type UserRole = "consultant" | "admin" | "employee";

export interface NodeBase {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  confidence: number;
  source: string;
  department?: string;
  painScore?: number;
  metadata: Record<string, string>;
}

export interface Edge {
  id: string;
  type: EdgeType;
  from: string;
  to: string;
  label: string;
  confidence: number;
  source: string;
  metadata: Record<string, string>;
}

export interface Gap {
  type: string;
  category: GapCategory;
  severity: number;
  description: string;
  nodeIds: string[];
  edgeIds: string[];
  painScore: number;
}

export interface GapTypeInfo {
  type: string;
  category: GapCategory;
  label: string;
  description: string;
  defaultSeverity: number;
}

export interface DepartmentSummary {
  department: string;
  nodeCount: number;
  avgPain: number;
}

export interface ReportStats {
  nodeCount: number;
  edgeCount: number;
  avgConfidence: number;
  departmentCount: number;
  crossDepartmentEdges: number;
  cycles: number;
  spofCount: number;
  employeeCount?: number;
}

export interface TopGap {
  type: string;
  description: string;
  score: number;
}

export interface Report {
  summary: string;
  stats: ReportStats;
  gapsByCategory: Record<string, number>;
  topGaps: TopGap[];
  departmentSummary: DepartmentSummary[];
  recommendations: string[];
  crossSessionInsights?: AggregationResult;
}

export interface SessionResponse {
  sessionId: string;
  message: string;
  state: DialogueState;
  stateLabel: string;
}

export interface CompletenessDimension {
  key: string;
  label: string;
  requirement: string;
  guidance: string;
  covered: boolean;
}

export interface Completeness {
  dimensions: CompletenessDimension[];
  coveredCount: number;
  total: number;
  score: number;
  met: boolean;
  missing: CompletenessDimension[];
  summary: string;
}

export interface ChatResponse {
  sessionId: string;
  message: string;
  state: DialogueState;
  stateLabel: string;
  mermaidDiagram?: string;
  reactFlowData?: ReactFlowData;
  gapCount: number;
  nodeCount: number;
  edgeCount: number;
  confidence: number;
  completeness?: Completeness | null;
}

export interface ConcludeResponse {
  message: string;
  state: string;
  stateLabel: string;
  mermaidDiagram: string;
  reactFlowData?: ReactFlowData;
  report: Report;
}

export interface ReactFlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    nodeType: NodeType;
    description: string;
    confidence: number;
    painScore?: number;
    department?: string;
    departmentColor: string;
    isSource: boolean;
    isSink: boolean;
    isSpof: boolean;
    hasGaps: boolean;
    gapCount: number;
    duration?: string;
    frequency?: string;
    waitCause?: string;
    waitDuration?: string;
  };
}

export interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  animated?: boolean;
  style?: { stroke: string; strokeWidth: number; strokeDasharray?: string };
  label?: string;
  data: { edgeType: EdgeType; confidence: number };
}

export interface ReactFlowData {
  nodes: ReactFlowNode[];
  edges: ReactFlowEdge[];
}

export interface Organization {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  createdAt: string;
}

export type EngagementPhase = "diagnosis" | "design" | "implementation";
export type EngagementStatus = "active" | "paused" | "completed";

export interface Engagement {
  id: string;
  organizationId: string;
  name: string;
  objective: string;
  phase: EngagementPhase;
  status: EngagementStatus;
  startDate: string;
  endDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type HypothesisStatus = "open" | "validated" | "rejected";

export interface Hypothesis {
  id: string;
  engagementId: string;
  statement: string;
  rationale: string;
  status: HypothesisStatus;
  confidence: number;
  evidenceSessionIds: string[];
  createdAt: string;
  updatedAt: string;
}

export type FindingSeverity = "low" | "medium" | "high";

export interface Finding {
  id: string;
  engagementId: string;
  title: string;
  insight: string;
  recommendation: string;
  severity: FindingSeverity;
  evidenceSessionIds: string[];
  createdAt: string;
}

export type DeliverableType = "executive_summary" | "diagnostic_report" | "implementation_roadmap";

export interface Deliverable {
  id: string;
  engagementId: string;
  type: DeliverableType;
  title: string;
  contentMarkdown: string;
  createdAt: string;
}

export interface ConsultingWorkbench {
  engagementId: string;
  stats: {
    sessions: number;
    nodes: number;
    edges: number;
    gaps: number;
    hypotheses: number;
    findings: number;
    deliverables: number;
  };
  hypotheses: Hypothesis[];
  findings: Finding[];
  deliverables: Deliverable[];
}

export interface Employee {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  department?: string;
}

export interface AggregationResult {
  consensusGraphNodes: number;
  consensusGraphEdges: number;
  contributors: { employeeId: string; employeeName: string; sessionCount: number }[];
  agreements: { nodeLabel: string; contributorCount: number; confidence: number }[];
  disagreements: { nodeLabel: string; variants: { employeeName: string; description: string }[] }[];
  uniqueInsights: { employeeName: string; insight: string }[];
  convergenceScore: number;
  patterns?: DiscoveredPattern[];
}

export interface DiscoveredPattern {
  type: string;
  description: string;
  frequency: number;
  confidence: number;
  affectedNodeLabels: string[];
  affectedDepartments: string[];
}
