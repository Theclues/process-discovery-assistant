/** Core data types for the Process Discovery Assistant.
 *
 * State space definition (engineering cybernetics principle: explicit state variables).
 * Every node/edge carries confidence and source for observability.
 */

// ─── Node Types ────────────────────────────────────────────────

export type NodeType = "ProcessStep" | "DecisionPoint" | "WaitState" | "Artifact" | "ExternalEntity" | "Role" | "Department";

export interface NodeBase {
  id: string;
  type: NodeType;
  label: string;
  description: string;
  confidence: number;       // 0..1
  source: string;           // e.g. "user_stated", "inferred", "resolved"
  department?: string;       // department name
  painScore?: number;        // 0..10, how painful is this step
  metadata: Record<string, string>;
}

export interface ProcessStep extends NodeBase {
  type: "ProcessStep";
  duration?: string;         // e.g. "30min", "2d"
  frequency?: string;        // e.g. "daily", "per_request"
}

export interface DecisionPoint extends NodeBase {
  type: "DecisionPoint";
  condition?: string;        // e.g. "amount > 10000"
  branches: string[];        // possible outcomes
}

export interface WaitState extends NodeBase {
  type: "WaitState";
  waitCause?: string;        // why waiting
  waitDuration?: string;     // how long
}

export interface Artifact extends NodeBase {
  type: "Artifact";
  artifactType?: string;     // e.g. "form", "report", "email"
}

export interface ExternalEntity extends NodeBase {
  type: "ExternalEntity";
  entityType?: string;       // e.g. "vendor", "regulator", "customer"
}

export interface Role extends NodeBase {
  type: "Role";
  roleName?: string;
}

export interface Department extends NodeBase {
  type: "Department";
  deptName?: string;
}

export type Node = ProcessStep | DecisionPoint | WaitState | Artifact | ExternalEntity | Role | Department;

// ─── Edge Types ─────────────────────────────────────────────────

export type EdgeType = "FLOW" | "INFORMS" | "BLOCKS" | "PRODUCES" | "CONSUMES";

export interface Edge {
  id: string;
  type: EdgeType;
  from: string;              // node id
  to: string;                // node id
  label: string;
  confidence: number;        // 0..1
  source: string;
  metadata: Record<string, string>;
}

// ─── Gap Types ──────────────────────────────────────────────────

export type GapCategory = "structural" | "control_flow" | "temporal" | "organizational" | "information_quality";

export type GapType =
  // Structural
  | "MISSING_SOURCE" | "MISSING_CONSUMER" | "ORPHAN_NODE" | "DANGLING_EDGE"
  // Control flow
  | "BRANCH_WITHOUT_CONDITION" | "UNVERIFIED_CYCLE" | "IMPLICIT_DECISION"
  // Temporal
  | "UNSPECIFIED_DURATION" | "UNSPECIFIED_WAIT" | "FREQUENCY_MISMATCH" | "WAIT_WITHOUT_CAUSE"
  // Organizational
  | "UNCHARACTERIZED_ROLE" | "DEPARTMENT_BOUNDARY" | "SINGLE_POINT_OF_FAILURE" | "ROLE_OVERLAP"
  // Information quality
  | "LOW_CONFIDENCE" | "PAIN_UNEXPLAINED";

export interface Gap {
  type: GapType;
  category: GapCategory;
  severity: number;          // 0..10
  description: string;
  nodeIds: string[];         // involved nodes
  edgeIds: string[];         // involved edges
  painScore: number;         // 0..10, from affected nodes
}

// ─── Process Graph ──────────────────────────────────────────────

export interface ProcessGraphData {
  nodes: Node[];
  edges: Edge[];
  metadata: {
    processName: string;
    createdAt: string;
    updatedAt: string;
    version: number;
    confidence: number;      // average confidence across all elements
  };
}

// ─── Session ────────────────────────────────────────────────────

export type DialogueState = "ONBOARDING" | "ELICITING" | "CLARIFYING" | "MAPPING" | "GAP_DETECTING" | "QUESTIONING" | "VERIFYING" | "COMPLETE";

export interface Turn {
  role: "user" | "assistant" | "system";
  message: string;
  timestamp: string;
  gapsDetected?: Gap[];
  modelSnapshot?: ProcessGraphData;
}

export interface SessionData {
  id: string;
  state: DialogueState;
  turns: Turn[];
  graph: ProcessGraphData;
  createdAt: string;
  updatedAt: string;
  organizationId?: string;
  employeeId?: string;
  engagementId?: string;
}

// ─── Commercial Workspace: Organization, Engagement, Employee ───

export interface Organization {
  id: string;
  name: string;
  industry?: string;
  size?: string;
  createdAt: string;
  updatedAt: string;
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

export interface Employee {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  department?: string;
  createdAt: string;
}

export interface ProcessDefinition {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  consensusGraph: ProcessGraphData;
  contributorCount: number;
  totalSessions: number;
  lastUpdated: string;
}

export type KnowledgeEntryType = "pattern" | "insight" | "risk" | "best_practice";

export interface KnowledgeEntry {
  id: string;
  organizationId: string;
  processId: string;
  type: KnowledgeEntryType;
  content: string;
  confidence: number;
  supportingSessionIds: string[];
  createdAt: string;
}

export interface DiscoveredPattern {
  type: "recurring_bottleneck" | "common_workaround" | "departmental_friction"
    | "temporal_pattern" | "role_ambiguity" | "system_dependency";
  description: string;
  frequency: number;
  confidence: number;
  affectedNodeLabels: string[];
  affectedDepartments: string[];
  sessionIds: string[];
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
