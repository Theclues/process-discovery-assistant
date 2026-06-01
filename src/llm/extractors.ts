/**
 * Structured output extractors — parse JSON from LLM responses.
 * Handles partial/broken JSON gracefully with defensive parsing.
 */

import type { Node, Edge } from "../model/schema.js";

// ─── NLU Extraction Result ────────────────────────────────────

export interface NLUExtractedNode {
  type: string;
  label: string;
  description?: string;
  confidence?: number;
  painScore?: number;
  department?: string;
  duration?: string;
  frequency?: string;
  condition?: string;
  branches?: string[];
  waitCause?: string;
  waitDuration?: string;
  artifactType?: string;
  entityType?: string;
  roleName?: string;
  deptName?: string;
}

export interface NLUExtractedEdge {
  type: string;
  from: string;
  to: string;
  label?: string;
  confidence?: number;
}

export interface NLUExtractionResult {
  nodes: NLUExtractedNode[];
  edges: NLUExtractedEdge[];
  summary: string;
}

// ─── Socratic Question Result ─────────────────────────────────

export interface SocraticQuestionResult {
  question: string;
  acknowledgment: string;
  targetGapType: string;
  targetNodeIds: string[];
  rationale: string;
  shouldElicit?: boolean;
}

// ─── Entity Normalizer Result ─────────────────────────────────

export interface NormalizerResult {
  action: "match" | "new" | "related";
  canonicalName: string;
  reasoning: string;
}

// ─── Process Summary Result ──────────────────────────────────

export interface SummaryResult {
  summary: string;
  keyFindings: string[];
  bottlenecks: string[];
  crossDepartmentHandoffs: number;
  estimatedTotalDuration: string;
  confidenceLevel: "高" | "中" | "低";
}

// ─── Core Extractor ───────────────────────────────────────────

/** Extract JSON from potentially messy LLM output */
export function extractJSON<T>(content: string): T {
  // Try direct parse
  try {
    return JSON.parse(content) as T;
  } catch {
    // Try to find JSON block in markdown
    const jsonBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlock) {
      try {
        return JSON.parse(jsonBlock[1].trim()) as T;
      } catch {
        // continue
      }
    }
    // Try to find the outermost { } or [ ]
    const braceStart = content.indexOf("{");
    const bracketStart = content.indexOf("[");
    if (braceStart >= 0) {
      const braceEnd = content.lastIndexOf("}");
      if (braceEnd > braceStart) {
        try {
          return JSON.parse(content.substring(braceStart, braceEnd + 1)) as T;
        } catch {
          // fail through
        }
      }
    }
    if (bracketStart >= 0) {
      const bracketEnd = content.lastIndexOf("]");
      if (bracketEnd > bracketStart) {
        try {
          return JSON.parse(content.substring(bracketStart, bracketEnd + 1)) as T;
        } catch {
          // fail through
        }
      }
    }
    throw new Error(`Failed to extract JSON from LLM response: ${content.substring(0, 200)}...`);
  }
}

/** Parse NLU extraction result */
export function parseNLUResult(content: string): NLUExtractionResult {
  const raw = extractJSON<{
    nodes?: NLUExtractedNode[];
    edges?: NLUExtractedEdge[];
    summary?: string;
  }>(content);

  return {
    nodes: (raw.nodes ?? []).map(n => ({
      ...n,
      confidence: clamp(n.confidence, 0, 1),
      painScore: clamp(n.painScore, 0, 10),
    })),
    edges: (raw.edges ?? []).map(e => ({
      ...e,
      confidence: clamp(e.confidence, 0, 1),
    })),
    summary: raw.summary ?? "",
  };
}

/** Parse Socratic question result */
export function parseSocraticResult(content: string): SocraticQuestionResult {
  return extractJSON<SocraticQuestionResult>(content);
}

/** Parse normalizer result */
export function parseNormalizerResult(content: string): NormalizerResult {
  return extractJSON<NormalizerResult>(content);
}

/** Parse summary result */
export function parseSummaryResult(content: string): SummaryResult {
  return extractJSON<SummaryResult>(content);
}

// ─── Helpers ──────────────────────────────────────────────────

function clamp(val: number | undefined, min: number, max: number): number {
  if (val == null) return 0;
  return Math.max(min, Math.min(max, val));
}

/** Validate that a node type string is a valid NodeType */
export function isValidNodeType(t: string): boolean {
  return ["ProcessStep", "DecisionPoint", "WaitState", "Artifact", "ExternalEntity", "Role", "Department"].includes(t);
}

/** Validate that an edge type string is a valid EdgeType */
export function isValidEdgeType(t: string): boolean {
  return ["FLOW", "INFORMS", "BLOCKS", "PRODUCES", "CONSUMES"].includes(t);
}
