/** Unit tests for gap detectors */
import { ProcessGraph } from "../src/model/graph.js";
import { detectAllGaps } from "../src/analysis/detector.js";
import { prioritizeGaps } from "../src/analysis/prioritizer.js";
import { EntityRegistry } from "../src/model/entity.js";

let g: ProcessGraph;

function reset() {
  g = new ProcessGraph("测试流程");
}

// ─── Structural Gaps ──────────────────────────────────────────

function testOrphanNode() {
  reset();
  g.addNode({ type: "ProcessStep", label: "OrphanStep", description: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const orphan = gaps.filter(gap => gap.type === "ORPHAN_NODE");
  console.assert(orphan.length === 1, `Expected 1 orphan gap, got ${orphan.length}`);
  console.log("  ✓ testOrphanNode");
}

function testDanglingEdge() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: "non-existent-id", label: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const dangling = gaps.filter(gap => gap.type === "DANGLING_EDGE");
  console.assert(dangling.length === 1, `Expected 1 dangling edge gap, got ${dangling.length}`);
  console.log("  ✓ testDanglingEdge");
}

function testMissingSource() {
  reset();
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: "non-existent", to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const missing = gaps.filter(gap => gap.type === "MISSING_SOURCE");
  console.assert(missing.length === 1, `Expected 1 missing source gap, got ${missing.length}`);
  console.log("  ✓ testMissingSource");
}

function testMissingConsumer() {
  reset();
  const step = g.addNode({ type: "ProcessStep", label: "Send Report", description: "", confidence: 1, source: "test", metadata: {} });
  const artifact = g.addNode({ type: "Artifact", label: "Report", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "PRODUCES", from: step.id, to: artifact.id, label: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const missing = gaps.filter(gap => gap.type === "MISSING_CONSUMER");
  console.assert(missing.length === 1, `Expected 1 missing consumer gap, got ${missing.length}`);
  console.log("  ✓ testMissingConsumer");
}

// ─── Control Flow Gaps ────────────────────────────────────────

function testBranchWithoutCondition() {
  reset();
  g.addNode({
    type: "DecisionPoint", label: "CheckAmount", description: "",
    confidence: 1, source: "test", metadata: {}, condition: "", branches: [],
  });
  const gaps = detectAllGaps(g);
  const branch = gaps.filter(gap => gap.type === "BRANCH_WITHOUT_CONDITION");
  console.assert(branch.length === 1, `Expected 1 branch without condition, got ${branch.length}`);
  console.log("  ✓ testBranchWithoutCondition");
}

function testImplicitDecision() {
  reset();
  const step = g.addNode({ type: "ProcessStep", label: "SortEmail", description: "", confidence: 1, source: "test", metadata: {} });
  const b1 = g.addNode({ type: "ProcessStep", label: "HandleUrgent", description: "", confidence: 1, source: "test", metadata: {} });
  const b2 = g.addNode({ type: "ProcessStep", label: "HandleNormal", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: step.id, to: b1.id, label: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: step.id, to: b2.id, label: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const implicit = gaps.filter(gap => gap.type === "IMPLICIT_DECISION");
  console.assert(implicit.length === 1, `Expected 1 implicit decision, got ${implicit.length}`);
  console.log("  ✓ testImplicitDecision");
}

function testUnverifiedCycle() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "Review", description: "", confidence: 1, source: "test", metadata: {} });
  const b = g.addNode({ type: "ProcessStep", label: "Revise", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: b.id, to: a.id, label: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const cycle = gaps.filter(gap => gap.type === "UNVERIFIED_CYCLE");
  console.assert(cycle.length === 1, `Expected 1 unverified cycle, got ${cycle.length}`);
  console.log("  ✓ testUnverifiedCycle");
}

// ─── Temporal Gaps ──────────────────────────────────────────

function testUnspecifiedDuration() {
  reset();
  g.addNode({ type: "ProcessStep", label: "Review", description: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const duration = gaps.filter(gap => gap.type === "UNSPECIFIED_DURATION");
  console.assert(duration.length === 1, `Expected 1 unspecified duration, got ${duration.length}`);
  console.log("  ✓ testUnspecifiedDuration");
}

function testWaitWithoutCause() {
  reset();
  g.addNode({ type: "WaitState", label: "Waiting", description: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const waitCause = gaps.filter(gap => gap.type === "WAIT_WITHOUT_CAUSE");
  console.assert(waitCause.length === 1, `Expected 1 wait without cause, got ${waitCause.length}`);
  console.log("  ✓ testWaitWithoutCause");
}

function testFrequencyMismatch() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {}, frequency: "daily" });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {}, frequency: "weekly" });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const freq = gaps.filter(gap => gap.type === "FREQUENCY_MISMATCH");
  console.assert(freq.length === 1, `Expected 1 frequency mismatch, got ${freq.length}`);
  console.log("  ✓ testFrequencyMismatch");
}

// ─── Organizational Gaps ──────────────────────────────────────

function testSinglePointOfFailure() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "Start", description: "", confidence: 1, source: "test", metadata: {} });
  const spof = g.addNode({ type: "ProcessStep", label: "CriticalReview", description: "", confidence: 1, source: "test", metadata: {} });
  const c = g.addNode({ type: "ProcessStep", label: "End", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: spof.id, label: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: spof.id, to: c.id, label: "", confidence: 1, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const spofGaps = gaps.filter(gap => gap.type === "SINGLE_POINT_OF_FAILURE");
  console.assert(spofGaps.length === 1, `Expected 1 SPOF, got ${spofGaps.length}`);
  console.log("  ✓ testSinglePointOfFailure");
}

// ─── Prioritizer ──────────────────────────────────────────────

function testPrioritizer() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 0.3, source: "test", metadata: {}, painScore: 8 });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 0.9, source: "test", metadata: {}, painScore: 2 });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 0.3, source: "test", metadata: {} });
  const gaps = detectAllGaps(g);
  const scored = prioritizeGaps(gaps, g);
  console.assert(scored.length > 0, "Should have scored gaps");
  console.assert(scored[0].score > 0, `Top gap should have positive score, got ${scored[0].score}`);
  // High-pain, low-confidence gaps should score higher
  console.log(`  Top gap: ${scored[0].gap.type} score=${scored[0].score.toFixed(2)}`);
  console.log("  ✓ testPrioritizer");
}

// ─── Entity Resolution ────────────────────────────────────────

function testEntityResolution() {
  const registry = new EntityRegistry();
  const nodes = [
    { id: "1", type: "ProcessStep" as const, label: "查看邮件", description: "", confidence: 1, source: "test", metadata: {} },
    { id: "2", type: "ProcessStep" as const, label: "发送邮件", description: "", confidence: 1, source: "test", metadata: {} },
  ];

  // Exact match
  const r1 = registry.resolve("查看邮件", nodes);
  console.assert(r1.action === "merge", `Expected merge for exact match, got ${r1.action}`);

  // Different
  const r2 = registry.resolve("审批合同", nodes);
  console.assert(r2.action === "create", `Expected create for new entity, got ${r2.action}`);

  console.log("  ✓ testEntityResolution");
}

// ─── Run ──────────────────────────────────────────────────────

function runTests() {
  console.log("Gap Detector Tests:");
  testOrphanNode();
  testDanglingEdge();
  testMissingSource();
  testMissingConsumer();
  testBranchWithoutCondition();
  testImplicitDecision();
  testUnverifiedCycle();
  testUnspecifiedDuration();
  testWaitWithoutCause();
  testFrequencyMismatch();
  testSinglePointOfFailure();
  testPrioritizer();
  testEntityResolution();
  console.log("All detector tests passed!\n");
}

runTests();
