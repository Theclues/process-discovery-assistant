/**
 * SQLite database layer for the memory system.
 * Stores organizations, employees, process definitions, sessions, and knowledge entries.
 *
 * Engineering cybernetics: bounded connections, explicit schema, migrations for evolution.
 */

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";
import { v4 as uuid } from "uuid";
import type {
  Organization, Engagement, Employee, ProcessDefinition,
  Hypothesis, HypothesisStatus, Finding, FindingSeverity,
  Deliverable, DeliverableType, KnowledgeEntry, KnowledgeEntryType, SessionData,
} from "../model/schema.js";

let db: Database.Database | null = null;

const SCHEMA_VERSION = 3;

function dataDir(): string {
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = path.join(dataDir(), "process-discovery.db");
  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  migrate(db);
  return db;
}

function migrate(database: Database.Database): void {
  // Version tracking
  database.exec(`
    CREATE TABLE IF NOT EXISTS _schema_version (
      version INTEGER NOT NULL
    );
  `);
  const currentVersion = database.prepare(
    "SELECT version FROM _schema_version"
  ).get() as { version: number } | undefined;

  const version = currentVersion?.version ?? 0;
  if (version < 1) {
    applyV1(database);
  }
  if (version < 2) {
    applyV2(database);
  }
  if (version < 3) {
    applyV3(database);
  }
}

function applyV1(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      industry TEXT,
      size TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      department TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id);

    CREATE TABLE IF NOT EXISTS process_definitions (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      consensus_graph TEXT NOT NULL,
      contributor_count INTEGER DEFAULT 0,
      total_sessions INTEGER DEFAULT 0,
      last_updated TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_process_defs_org ON process_definitions(organization_id);

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      organization_id TEXT,
      employee_id TEXT,
      process_name TEXT,
      state TEXT NOT NULL,
      turns TEXT NOT NULL,
      graph TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_org ON sessions(organization_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_employee ON sessions(employee_id);

    CREATE TABLE IF NOT EXISTS knowledge_entries (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      process_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      confidence REAL DEFAULT 0.5,
      supporting_session_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_org ON knowledge_entries(organization_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_process ON knowledge_entries(process_id);

    INSERT OR REPLACE INTO _schema_version (version) VALUES (1);
  `);
}

function tableHasColumn(database: Database.Database, table: string, column: string): boolean {
  const rows = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.some(row => row.name === column);
}

function setSchemaVersion(database: Database.Database, version: number): void {
  database.exec("DELETE FROM _schema_version;");
  database.prepare("INSERT INTO _schema_version (version) VALUES (?)").run(version);
}

function applyV2(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS engagements (
      id TEXT PRIMARY KEY,
      organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      objective TEXT DEFAULT '',
      phase TEXT NOT NULL DEFAULT 'diagnosis',
      status TEXT NOT NULL DEFAULT 'active',
      start_date TEXT NOT NULL,
      end_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_engagements_org ON engagements(organization_id);
    CREATE INDEX IF NOT EXISTS idx_engagements_status ON engagements(status);
  `);

  if (!tableHasColumn(database, "sessions", "engagement_id")) {
    database.exec("ALTER TABLE sessions ADD COLUMN engagement_id TEXT;");
  }
  database.exec("CREATE INDEX IF NOT EXISTS idx_sessions_engagement ON sessions(engagement_id);");
  setSchemaVersion(database, SCHEMA_VERSION);
}

function applyV3(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS hypotheses (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      statement TEXT NOT NULL,
      rationale TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      confidence REAL DEFAULT 0.5,
      evidence_session_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_hypotheses_engagement ON hypotheses(engagement_id);
    CREATE INDEX IF NOT EXISTS idx_hypotheses_status ON hypotheses(status);

    CREATE TABLE IF NOT EXISTS findings (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      insight TEXT NOT NULL,
      recommendation TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'medium',
      evidence_session_ids TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_findings_engagement ON findings(engagement_id);

    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY,
      engagement_id TEXT NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content_markdown TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deliverables_engagement ON deliverables(engagement_id);
  `);
  setSchemaVersion(database, SCHEMA_VERSION);
}

// ─── Organization CRUD ──────────────────────────────────────────

export function createOrganization(data: Omit<Organization, "id" | "createdAt" | "updatedAt">): Organization {
  const now = new Date().toISOString();
  const org: Organization = {
    id: uuid(),
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  const db = getDb();
  db.prepare(
    "INSERT INTO organizations (id, name, industry, size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(org.id, org.name, org.industry ?? null, org.size ?? null, org.createdAt, org.updatedAt);
  return org;
}

export function getOrganization(id: string): Organization | undefined {
  const row = getDb().prepare("SELECT * FROM organizations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToOrg(row) : undefined;
}

export function listOrganizations(): Organization[] {
  const rows = getDb().prepare("SELECT * FROM organizations ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map(rowToOrg);
}

function rowToOrg(row: Record<string, unknown>): Organization {
  return {
    id: row.id as string,
    name: row.name as string,
    industry: (row.industry as string) || undefined,
    size: (row.size as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Engagement CRUD ─────────────────────────────────────────────

export function createEngagement(data: {
  organizationId: string;
  name: string;
  objective?: string;
  phase?: Engagement["phase"];
  status?: Engagement["status"];
  startDate?: string;
  endDate?: string;
}): Engagement {
  const now = new Date().toISOString();
  const engagement: Engagement = {
    id: uuid(),
    organizationId: data.organizationId,
    name: data.name,
    objective: data.objective ?? "",
    phase: data.phase ?? "diagnosis",
    status: data.status ?? "active",
    startDate: data.startDate ?? now.slice(0, 10),
    endDate: data.endDate,
    createdAt: now,
    updatedAt: now,
  };

  getDb().prepare(`
    INSERT INTO engagements (id, organization_id, name, objective, phase, status, start_date, end_date, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    engagement.id,
    engagement.organizationId,
    engagement.name,
    engagement.objective,
    engagement.phase,
    engagement.status,
    engagement.startDate,
    engagement.endDate ?? null,
    engagement.createdAt,
    engagement.updatedAt,
  );
  return engagement;
}

export function getEngagement(id: string): Engagement | undefined {
  const row = getDb().prepare("SELECT * FROM engagements WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? rowToEngagement(row) : undefined;
}

export function listEngagements(organizationId: string): Engagement[] {
  const rows = getDb().prepare(
    "SELECT * FROM engagements WHERE organization_id = ? ORDER BY updated_at DESC"
  ).all(organizationId) as Record<string, unknown>[];
  return rows.map(rowToEngagement);
}

function rowToEngagement(row: Record<string, unknown>): Engagement {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    name: row.name as string,
    objective: (row.objective as string) || "",
    phase: row.phase as Engagement["phase"],
    status: row.status as Engagement["status"],
    startDate: row.start_date as string,
    endDate: (row.end_date as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Consulting Work Product CRUD ────────────────────────────────

export function upsertHypothesis(data: {
  id?: string;
  engagementId: string;
  statement: string;
  rationale?: string;
  status?: HypothesisStatus;
  confidence?: number;
  evidenceSessionIds?: string[];
}): Hypothesis {
  const now = new Date().toISOString();
  const id = data.id ?? uuid();
  const hypothesis: Hypothesis = {
    id,
    engagementId: data.engagementId,
    statement: data.statement,
    rationale: data.rationale ?? "",
    status: data.status ?? "open",
    confidence: data.confidence ?? 0.5,
    evidenceSessionIds: data.evidenceSessionIds ?? [],
    createdAt: now,
    updatedAt: now,
  };

  getDb().prepare(`
    INSERT INTO hypotheses (id, engagement_id, statement, rationale, status, confidence, evidence_session_ids, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      statement = excluded.statement,
      rationale = excluded.rationale,
      status = excluded.status,
      confidence = excluded.confidence,
      evidence_session_ids = excluded.evidence_session_ids,
      updated_at = excluded.updated_at
  `).run(
    hypothesis.id,
    hypothesis.engagementId,
    hypothesis.statement,
    hypothesis.rationale,
    hypothesis.status,
    hypothesis.confidence,
    JSON.stringify(hypothesis.evidenceSessionIds),
    hypothesis.createdAt,
    hypothesis.updatedAt,
  );
  return hypothesis;
}

export function listHypotheses(engagementId: string): Hypothesis[] {
  const rows = getDb().prepare(
    "SELECT * FROM hypotheses WHERE engagement_id = ? ORDER BY updated_at DESC"
  ).all(engagementId) as Record<string, unknown>[];
  return rows.map(rowToHypothesis);
}

function rowToHypothesis(row: Record<string, unknown>): Hypothesis {
  return {
    id: row.id as string,
    engagementId: row.engagement_id as string,
    statement: row.statement as string,
    rationale: (row.rationale as string) || "",
    status: row.status as HypothesisStatus,
    confidence: row.confidence as number,
    evidenceSessionIds: JSON.parse(row.evidence_session_ids as string),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function createFinding(data: {
  engagementId: string;
  title: string;
  insight: string;
  recommendation: string;
  severity?: FindingSeverity;
  evidenceSessionIds?: string[];
}): Finding {
  const finding: Finding = {
    id: uuid(),
    engagementId: data.engagementId,
    title: data.title,
    insight: data.insight,
    recommendation: data.recommendation,
    severity: data.severity ?? "medium",
    evidenceSessionIds: data.evidenceSessionIds ?? [],
    createdAt: new Date().toISOString(),
  };
  getDb().prepare(`
    INSERT INTO findings (id, engagement_id, title, insight, recommendation, severity, evidence_session_ids, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    finding.id,
    finding.engagementId,
    finding.title,
    finding.insight,
    finding.recommendation,
    finding.severity,
    JSON.stringify(finding.evidenceSessionIds),
    finding.createdAt,
  );
  return finding;
}

export function replaceFindings(engagementId: string, findings: Omit<Finding, "id" | "engagementId" | "createdAt">[]): Finding[] {
  const db = getDb();
  const insert = db.transaction(() => {
    db.prepare("DELETE FROM findings WHERE engagement_id = ?").run(engagementId);
    return findings.map(f => createFinding({ ...f, engagementId }));
  });
  return insert();
}

export function listFindings(engagementId: string): Finding[] {
  const rows = getDb().prepare(
    "SELECT * FROM findings WHERE engagement_id = ? ORDER BY created_at DESC"
  ).all(engagementId) as Record<string, unknown>[];
  return rows.map(rowToFinding);
}

function rowToFinding(row: Record<string, unknown>): Finding {
  return {
    id: row.id as string,
    engagementId: row.engagement_id as string,
    title: row.title as string,
    insight: row.insight as string,
    recommendation: row.recommendation as string,
    severity: row.severity as FindingSeverity,
    evidenceSessionIds: JSON.parse(row.evidence_session_ids as string),
    createdAt: row.created_at as string,
  };
}

export function createDeliverable(data: {
  engagementId: string;
  type: DeliverableType;
  title: string;
  contentMarkdown: string;
}): Deliverable {
  const deliverable: Deliverable = {
    id: uuid(),
    engagementId: data.engagementId,
    type: data.type,
    title: data.title,
    contentMarkdown: data.contentMarkdown,
    createdAt: new Date().toISOString(),
  };
  getDb().prepare(`
    INSERT INTO deliverables (id, engagement_id, type, title, content_markdown, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    deliverable.id,
    deliverable.engagementId,
    deliverable.type,
    deliverable.title,
    deliverable.contentMarkdown,
    deliverable.createdAt,
  );
  return deliverable;
}

export function listDeliverables(engagementId: string): Deliverable[] {
  const rows = getDb().prepare(
    "SELECT * FROM deliverables WHERE engagement_id = ? ORDER BY created_at DESC"
  ).all(engagementId) as Record<string, unknown>[];
  return rows.map(rowToDeliverable);
}

function rowToDeliverable(row: Record<string, unknown>): Deliverable {
  return {
    id: row.id as string,
    engagementId: row.engagement_id as string,
    type: row.type as DeliverableType,
    title: row.title as string,
    contentMarkdown: row.content_markdown as string,
    createdAt: row.created_at as string,
  };
}

// ─── Employee CRUD ──────────────────────────────────────────────

export function createEmployee(data: Omit<Employee, "id" | "createdAt">): Employee {
  const emp: Employee = {
    id: uuid(),
    ...data,
    createdAt: new Date().toISOString(),
  };
  getDb().prepare(
    "INSERT INTO employees (id, organization_id, name, role, department, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(emp.id, emp.organizationId, emp.name, emp.role, emp.department ?? null, emp.createdAt);
  return emp;
}

export function listEmployees(organizationId: string): Employee[] {
  const rows = getDb().prepare(
    "SELECT * FROM employees WHERE organization_id = ? ORDER BY created_at DESC"
  ).all(organizationId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    organizationId: r.organization_id as string,
    name: r.name as string,
    role: r.role as string,
    department: (r.department as string) || undefined,
    createdAt: r.created_at as string,
  }));
}

export function getEmployee(id: string): Employee | undefined {
  const r = getDb().prepare("SELECT * FROM employees WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!r) return undefined;
  return {
    id: r.id as string,
    organizationId: r.organization_id as string,
    name: r.name as string,
    role: r.role as string,
    department: (r.department as string) || undefined,
    createdAt: r.created_at as string,
  };
}

// ─── Process Definition CRUD ────────────────────────────────────

export function upsertProcessDefinition(data: {
  id?: string;
  organizationId: string;
  name: string;
  description?: string;
  consensusGraph: string;
  contributorCount: number;
  totalSessions: number;
}): ProcessDefinition {
  const now = new Date().toISOString();
  const id = data.id ?? uuid();
  getDb().prepare(`
    INSERT INTO process_definitions (id, organization_id, name, description, consensus_graph, contributor_count, total_sessions, last_updated)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      consensus_graph = excluded.consensus_graph,
      contributor_count = excluded.contributor_count,
      total_sessions = excluded.total_sessions,
      last_updated = excluded.last_updated
  `).run(id, data.organizationId, data.name, data.description ?? "",
    data.consensusGraph, data.contributorCount, data.totalSessions, now);
  return {
    id,
    organizationId: data.organizationId,
    name: data.name,
    description: data.description ?? "",
    consensusGraph: JSON.parse(data.consensusGraph),
    contributorCount: data.contributorCount,
    totalSessions: data.totalSessions,
    lastUpdated: now,
  };
}

export function listProcessDefinitions(organizationId: string): ProcessDefinition[] {
  const rows = getDb().prepare(
    "SELECT * FROM process_definitions WHERE organization_id = ? ORDER BY last_updated DESC"
  ).all(organizationId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    organizationId: r.organization_id as string,
    name: r.name as string,
    description: r.description as string,
    consensusGraph: JSON.parse(r.consensus_graph as string),
    contributorCount: r.contributor_count as number,
    totalSessions: r.total_sessions as number,
    lastUpdated: r.last_updated as string,
  }));
}

// ─── Knowledge Entry CRUD ───────────────────────────────────────

export function createKnowledgeEntry(data: {
  organizationId: string;
  processId: string;
  type: KnowledgeEntryType;
  content: string;
  confidence?: number;
  supportingSessionIds?: string[];
}): KnowledgeEntry {
  const entry: KnowledgeEntry = {
    id: uuid(),
    ...data,
    confidence: data.confidence ?? 0.5,
    supportingSessionIds: data.supportingSessionIds ?? [],
    createdAt: new Date().toISOString(),
  };
  getDb().prepare(
    "INSERT INTO knowledge_entries (id, organization_id, process_id, type, content, confidence, supporting_session_ids, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(entry.id, entry.organizationId, entry.processId, entry.type, entry.content, entry.confidence,
    JSON.stringify(entry.supportingSessionIds), entry.createdAt);
  return entry;
}

export function listKnowledge(organizationId: string): KnowledgeEntry[] {
  const rows = getDb().prepare(
    "SELECT * FROM knowledge_entries WHERE organization_id = ? ORDER BY created_at DESC"
  ).all(organizationId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    organizationId: r.organization_id as string,
    processId: r.process_id as string,
    type: r.type as KnowledgeEntryType,
    content: r.content as string,
    confidence: r.confidence as number,
    supportingSessionIds: JSON.parse(r.supporting_session_ids as string),
    createdAt: r.created_at as string,
  }));
}

// ─── Session Persistence (SQLite) ───────────────────────────────

export function saveSession(session: SessionData): void {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM sessions WHERE id = ?").get(session.id);
  const turns = JSON.stringify(session.turns);
  const graph = JSON.stringify(session.graph);
  if (existing) {
    db.prepare(
      "UPDATE sessions SET organization_id=?, employee_id=?, engagement_id=?, process_name=?, state=?, turns=?, graph=?, updated_at=? WHERE id=?"
    ).run(session.organizationId ?? null, session.employeeId ?? null, session.engagementId ?? null,
      session.graph.metadata.processName, session.state, turns, graph,
      new Date().toISOString(), session.id);
  } else {
    db.prepare(
      "INSERT INTO sessions (id, organization_id, employee_id, engagement_id, process_name, state, turns, graph, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(session.id, session.organizationId ?? null, session.employeeId ?? null, session.engagementId ?? null,
      session.graph.metadata.processName, session.state, turns, graph,
      session.createdAt, new Date().toISOString());
  }
}

export function loadSession(id: string): SessionData | undefined {
  const r = getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!r) return undefined;
  return {
    id: r.id as string,
    state: r.state as SessionData["state"],
    turns: JSON.parse(r.turns as string),
    graph: JSON.parse(r.graph as string),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    organizationId: (r.organization_id as string) || undefined,
    employeeId: (r.employee_id as string) || undefined,
    engagementId: (r.engagement_id as string) || undefined,
  };
}

export function listSessionsByOrg(organizationId: string): SessionData[] {
  const rows = getDb().prepare(
    "SELECT * FROM sessions WHERE organization_id = ? ORDER BY updated_at DESC"
  ).all(organizationId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    state: r.state as SessionData["state"],
    turns: JSON.parse(r.turns as string),
    graph: JSON.parse(r.graph as string),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    organizationId: (r.organization_id as string) || undefined,
    employeeId: (r.employee_id as string) || undefined,
    engagementId: (r.engagement_id as string) || undefined,
  }));
}

export function listSessionsByEngagement(engagementId: string): SessionData[] {
  const rows = getDb().prepare(
    "SELECT * FROM sessions WHERE engagement_id = ? ORDER BY updated_at DESC"
  ).all(engagementId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    state: r.state as SessionData["state"],
    turns: JSON.parse(r.turns as string),
    graph: JSON.parse(r.graph as string),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    organizationId: (r.organization_id as string) || undefined,
    employeeId: (r.employee_id as string) || undefined,
    engagementId: (r.engagement_id as string) || undefined,
  }));
}

export function listSessionsByEmployee(employeeId: string): SessionData[] {
  const rows = getDb().prepare(
    "SELECT * FROM sessions WHERE employee_id = ? ORDER BY updated_at DESC"
  ).all(employeeId) as Record<string, unknown>[];
  return rows.map(r => ({
    id: r.id as string,
    state: r.state as SessionData["state"],
    turns: JSON.parse(r.turns as string),
    graph: JSON.parse(r.graph as string),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    organizationId: (r.organization_id as string) || undefined,
    employeeId: (r.employee_id as string) || undefined,
    engagementId: (r.engagement_id as string) || undefined,
  }));
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
