/** Unit tests for ProcessGraph */
import { ProcessGraph } from "../src/model/graph.js";

let g: ProcessGraph;

function reset() {
  g = new ProcessGraph("测试流程");
}

// ─── Node Operations ──────────────────────────────────────────

function testAddNode() {
  reset();
  const n = g.addNode({ type: "ProcessStep", label: "查看邮件", description: "每天早上查看邮件", confidence: 0.9, source: "test", metadata: {} });
  console.assert(n.id !== "", "Node should have id");
  console.assert(g.nodeCount() === 1, `Expected 1 node, got ${g.nodeCount()}`);

  // Duplicate insert
  const n2 = g.addNode({ id: n.id, type: "ProcessStep", label: "查看邮件", description: "updated", confidence: 0.8, source: "test", metadata: {} });
  console.assert(g.nodeCount() === 1, "Should not duplicate node");
  console.log("  ✓ testAddNode");
}

function testAddEdge() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {} });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {} });
  const e = g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  console.assert(g.edgeCount() === 1, `Expected 1 edge, got ${g.edgeCount()}`);
  console.log("  ✓ testAddEdge");
}

function testRemoveNode() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {} });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  g.removeNode(a.id);
  console.assert(g.nodeCount() === 1, `Expected 1 node after remove, got ${g.nodeCount()}`);
  console.assert(g.edgeCount() === 0, `Expected 0 edges after cascading remove, got ${g.edgeCount()}`);
  console.log("  ✓ testRemoveNode");
}

// ─── Query ────────────────────────────────────────────────────

function testSourcesSinks() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {} });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {} });
  const c = g.addNode({ type: "ProcessStep", label: "C", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: b.id, to: c.id, label: "", confidence: 1, source: "test", metadata: {} });
  console.assert(g.sources().length === 1, `Expected 1 source, got ${g.sources().length}`);
  console.assert(g.sources()[0].id === a.id, `Expected source to be A`);
  console.assert(g.sinks().length === 1, `Expected 1 sink, got ${g.sinks().length}`);
  console.assert(g.sinks()[0].id === c.id, `Expected sink to be C`);
  console.log("  ✓ testSourcesSinks");
}

function testOrphans() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {} });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  g.addNode({ type: "ProcessStep", label: "Orphan", description: "", confidence: 1, source: "test", metadata: {} });
  console.assert(g.orphans().length === 1, `Expected 1 orphan, got ${g.orphans().length}`);
  console.log("  ✓ testOrphans");
}

function testDetectCycle() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {} });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  console.assert(g.detectCycle() === null, "Should not detect cycle in acyclic graph");

  g.addEdge({ type: "FLOW", from: b.id, to: a.id, label: "", confidence: 1, source: "test", metadata: {} });
  const cycle = g.detectCycle();
  console.assert(cycle !== null, "Should detect cycle");
  console.assert(cycle!.length >= 2, `Cycle should have at least 2 nodes, got ${cycle!.length}`);
  console.log("  ✓ testDetectCycle");
}

function testFindAllPaths() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {} });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {} });
  const c = g.addNode({ type: "ProcessStep", label: "C", description: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: b.id, to: c.id, label: "", confidence: 1, source: "test", metadata: {} });
  g.addEdge({ type: "FLOW", from: a.id, to: c.id, label: "", confidence: 1, source: "test", metadata: {} });
  const paths = g.findAllPaths(a.id, c.id);
  console.assert(paths.length === 2, `Expected 2 paths, got ${paths.length}`);
  console.log("  ✓ testFindAllPaths");
}

function testCrossDepartmentEdges() {
  reset();
  const a = g.addNode({ type: "ProcessStep", label: "A", description: "", confidence: 1, source: "test", metadata: {}, department: "财务部" });
  const b = g.addNode({ type: "ProcessStep", label: "B", description: "", confidence: 1, source: "test", metadata: {}, department: "技术部" });
  g.addEdge({ type: "FLOW", from: a.id, to: b.id, label: "", confidence: 1, source: "test", metadata: {} });
  const cross = g.crossDepartmentEdges();
  console.assert(cross.length === 1, `Expected 1 cross-dept edge, got ${cross.length}`);
  console.log("  ✓ testCrossDepartmentEdges");
}

function testNodeLimits() {
  reset();
  // Should not throw under limit
  for (let i = 0; i < 200; i++) {
    g.addNode({ type: "ProcessStep", label: `Step ${i}`, description: "", confidence: 1, source: "test", metadata: {} });
  }
  console.assert(g.nodeCount() === 200, `Expected 200 nodes, got ${g.nodeCount()}`);

  // Should throw over limit
  try {
    g.addNode({ type: "ProcessStep", label: "Overflow", description: "", confidence: 1, source: "test", metadata: {} });
    console.assert(false, "Should have thrown on node limit");
  } catch (e: any) {
    console.assert(e.message.includes("limit"), `Expected limit error, got: ${e.message}`);
  }
  console.log("  ✓ testNodeLimits");
}

// ─── Run ──────────────────────────────────────────────────────

function runTests() {
  console.log("ProcessGraph Tests:");
  testAddNode();
  testAddEdge();
  testRemoveNode();
  testSourcesSinks();
  testOrphans();
  testDetectCycle();
  testFindAllPaths();
  testCrossDepartmentEdges();
  testNodeLimits();
  console.log("All graph tests passed!\n");
}

runTests();
