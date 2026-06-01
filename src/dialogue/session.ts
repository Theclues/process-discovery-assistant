/**
 * Interview session management.
 * Each session encapsulates a complete dialogue with one user about one process.
 */

import { v4 as uuid } from "uuid";
import { ProcessGraph } from "../model/graph.js";
import type { SessionData, Turn, DialogueState as State, Gap } from "../model/schema.js";
import { getConfig } from "../config.js";

export class Session {
  id: string;
  state: State = "ONBOARDING";
  graph: ProcessGraph;
  turns: Turn[] = [];
  consecutiveQuestions = 0;
  /** Signatures of gaps already raised, to avoid re-asking the same question. */
  askedGapKeys = new Set<string>();
  organizationId?: string;
  employeeId?: string;
  engagementId?: string;
  createdAt: Date;
  updatedAt: Date;

  constructor(id?: string, processName?: string, context?: Pick<SessionData, "organizationId" | "employeeId" | "engagementId">) {
    this.id = id ?? uuid();
    this.graph = new ProcessGraph(processName ?? "未命名流程");
    this.organizationId = context?.organizationId;
    this.employeeId = context?.employeeId;
    this.engagementId = context?.engagementId;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  addTurn(role: Turn["role"], message: string, gaps?: Gap[]): Turn {
    const turn: Turn = {
      role,
      message,
      timestamp: new Date().toISOString(),
      gapsDetected: gaps,
    };
    this.turns.push(turn);
    this.updatedAt = new Date();

    if (role === "assistant" && gaps && gaps.length > 0) {
      this.consecutiveQuestions++;
    } else if (role === "user") {
      this.consecutiveQuestions = 0;
    }

    return turn;
  }

  setState(state: State): void {
    this.state = state;
    this.updatedAt = new Date();
  }

  canAskMore(): boolean {
    const config = getConfig();
    return this.consecutiveQuestions < config.consecutiveQuestionsMax;
  }

  shouldConclude(): boolean {
    const config = getConfig();
    return this.turns.length >= config.maxSessionTurns;
  }

  toData(): SessionData {
    return {
      id: this.id,
      state: this.state,
      turns: this.turns,
      graph: this.graph.toData(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      organizationId: this.organizationId,
      employeeId: this.employeeId,
      engagementId: this.engagementId,
    };
  }

  static fromData(data: SessionData): Session {
    const s = new Session(data.id, data.graph.metadata.processName, {
      organizationId: data.organizationId,
      employeeId: data.employeeId,
      engagementId: data.engagementId,
    });
    s.state = data.state;
    s.turns = data.turns;
    s.graph = ProcessGraph.fromData(data.graph);
    s.createdAt = new Date(data.createdAt);
    s.updatedAt = new Date(data.updatedAt);
    return s;
  }
}
