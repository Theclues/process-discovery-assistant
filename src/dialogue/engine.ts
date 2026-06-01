/**
 * Core Dialogue Engine — the decision loop that drives the conversation.
 *
 * Each turn:
 *   1. Parse user input via NLU → extract entities/edges
 *   2. Update the provisional model
 *   3. Run gap detection
 *   4. Prioritize gaps
 *   5. Decide next action (CLARIFYING / QUESTIONING / ELICITING / VERIFYING)
 *
 * Engineering cybernetics: This is the feedback controller.
 * Every decision is based on the latest model state (closed loop).
 */

import { v4 as uuid } from "uuid";
import { Session } from "./session.js";
import { ProcessGraph } from "../model/graph.js";
import { EntityRegistry } from "../model/entity.js";
import { getLLMClient } from "../llm/client.js";
import { NLU_SYSTEM_PROMPT, SOCRATIC_SYSTEM_PROMPT } from "../llm/prompts.js";
import { parseNLUResult, parseSocraticResult, isValidNodeType, isValidEdgeType } from "../llm/extractors.js";
import type { NLUExtractionResult, SocraticQuestionResult } from "../llm/extractors.js";
import { detectAllGaps } from "../analysis/detector.js";
import { selectForQuestioning } from "../analysis/prioritizer.js";
import { assessCompleteness, type CompletenessResult } from "../analysis/completeness.js";
import { getQuestionTemplate, randomAcknowledgment } from "./templates.js";
import { stateLabel } from "./state.js";
import { getConfig } from "../config.js";
import type { Gap, Node, Edge, DialogueState } from "../model/schema.js";

export interface EngineResponse {
  message: string;
  state: DialogueState;
  gapsDetected: Gap[];
  mermaidDiagram?: string;
  graphData?: ReturnType<ProcessGraph["toData"]>;
  completeness?: CompletenessResult;
}

/** Stable signature for a gap, used to avoid asking the same question twice. */
function gapKey(gap: Gap): string {
  return `${gap.type}:${[...gap.nodeIds].sort().join(",")}`;
}

/**
 * True for short yes/no/negative replies that answer the prior question but
 * add no process structure. Keeps such answers from being mis-extracted into
 * fabricated nodes.
 */
function isShortReply(message: string): boolean {
  const t = message.trim().replace(/[。.!！~,，\s]/g, "");
  if (t.length === 0 || t.length > 12) return false;
  return /^(没有(了|别的|备选|其他)?|没别的了?|无(备选|了)?|不(需要|用|清楚)?|暂时没有|应该没有|是的?|对的?|嗯+|好的?|可以|没问题|ok|yes|no|没了)$/i.test(t);
}

export class DialogueEngine {
  private entityRegistry = new EntityRegistry();
  private client = getLLMClient();

  /** Process a user message and return the assistant's response */
  async processMessage(session: Session, userMessage: string): Promise<EngineResponse> {
    // 1. Add user turn
    session.addTurn("user", userMessage);

    // 1b. Short yes/no/negative replies (e.g. "没有备选", "没别的了") answer the
    //     previous question but carry no new structure. Don't run them through
    //     NLU — that used to fabricate junk nodes like "无备选处理". Just advance.
    if (isShortReply(userMessage)) {
      return this.decideNext(session);
    }

    // 2. NLU parse
    let extraction: NLUExtractionResult | null = null;
    try {
      const llmRes = await this.client.complete(NLU_SYSTEM_PROMPT, userMessage, { jsonMode: true });
      extraction = parseNLUResult(llmRes.content);
    } catch {
      // If NLU fails, use a simple eliciting response
      return this.elicitMore(session, "我没太理解，能再详细描述一下这个流程吗？");
    }

    // 3. Update model with extracted entities
    this.mergeExtraction(session.graph, extraction);

    // 4. State transition: ONBOARDING → ELICITING
    if (session.state === "ONBOARDING") {
      session.setState("ELICITING");
    }

    // 5. If minimal model built, transition to MAPPING → GAP_DETECTING
    if (session.graph.nodeCount() >= 3 && (session.state === "ELICITING" || session.state === "CLARIFYING")) {
      session.setState("MAPPING");
    }

    if (session.state === "MAPPING" || session.state === "GAP_DETECTING" || session.state === "QUESTIONING") {
      session.setState("GAP_DETECTING");
    }

    return this.decideNext(session);
  }

  /**
   * Decision loop (the feedback controller): assess gaps + consulting
   * completeness on the current graph and choose the next action — guide toward
   * a missing requirement, ask one fresh structural question, or wrap up.
   */
  private async decideNext(session: Session): Promise<EngineResponse> {
    const allGaps = detectAllGaps(session.graph);
    const completeness = assessCompleteness(session.graph);

    // Requirements not yet met → summarise progress and guide toward the most
    // important missing consulting dimension (consultant-led).
    if (!completeness.met) {
      return this.guideToCompleteness(session, completeness);
    }

    // Requirements met. Probe a remaining high-value structural gap — but only
    // one we have NOT already raised (avoids re-asking the same question when
    // the user's answer doesn't change the graph). One focused question per turn.
    const selected = selectForQuestioning(allGaps, session.graph, session.consecutiveQuestions);
    const fresh = selected.map(s => s.gap).filter(g => !session.askedGapKeys.has(gapKey(g)));
    if (fresh.length > 0) {
      session.setState("QUESTIONING");
      const ask = fresh.slice(0, 1);
      for (const g of ask) session.askedGapKeys.add(gapKey(g));
      const r = await this.askQuestions(session, ask);
      return { ...r, completeness };
    }

    // Nothing new to ask. First time → full summary + invite confirmation.
    // If we've already summarised (still VERIFYING), give a short nudge instead
    // of repeating the whole recap verbatim.
    if (session.state === "VERIFYING") {
      const nudge = "资料已经整理完毕。如果没有补充了，点击右上角「确认 AI 整理结果」即可完成；如果还想补充，直接说就好。";
      session.addTurn("assistant", nudge);
      return { message: nudge, state: "VERIFYING", gapsDetected: allGaps, completeness };
    }
    return this.verifyModel(session, allGaps, completeness);
  }

  /**
   * Consultant-style guidance: acknowledge + summarise what's captured, then ask
   * for the single most important missing consulting dimension. This embodies
   * "顾问与员工面对面" — checking completeness and guiding until satisfied.
   */
  private guideToCompleteness(session: Session, completeness: CompletenessResult): EngineResponse {
    session.setState(session.graph.nodeCount() >= 3 ? "QUESTIONING" : "ELICITING");
    const target = completeness.missing[0];

    const lead = session.graph.nodeCount() === 0
      ? "好的，我们开始。我会像顾问一样，帮你把这项工作梳理清楚。"
      : `${completeness.summary}。`;

    const ask = target
      ? target.guidance
      : "还有哪些细节是你觉得重要、但我们还没聊到的？";

    const message = `${lead}\n\n${ask}`;
    session.addTurn("assistant", message);
    return { message, state: session.state, gapsDetected: [], completeness };
  }

  /** Merge NLU extraction into the graph, resolving entity conflicts */
  private mergeExtraction(
    graph: ProcessGraph,
    extraction: NLUExtractionResult,
  ): Map<string, string> {
    const labelToId = new Map<string, string>();
    const existingNodes = [...graph.nodes.values()];

    for (const en of extraction.nodes) {
      if (!isValidNodeType(en.type)) continue;

      // Entity resolution
      const resolved = this.entityRegistry.resolve(en.label, existingNodes);

      let nodeId: string;
      if (resolved.action === "merge" && resolved.existingNode) {
        nodeId = resolved.existingNode.id;
        // Boost confidence on matched node
        graph.updateNode(nodeId, {
          confidence: Math.min(1, (resolved.existingNode.confidence ?? 0.5) + 0.1),
        });
      } else if (resolved.action === "ask" && resolved.existingNode) {
        // Treat as new for now; resolution happens when user answers
        const node = graph.addNode({
          type: en.type as Node["type"],
          label: en.label,
          description: en.description ?? "",
          confidence: en.confidence ?? 0.5,
          painScore: en.painScore,
          department: en.department,
          duration: en.duration,
          frequency: en.frequency,
          condition: en.condition,
          waitCause: en.waitCause,
          waitDuration: en.waitDuration,
        } as any);
        nodeId = node.id;
      } else {
        const node = graph.addNode({
          type: en.type as Node["type"],
          label: en.label,
          description: en.description ?? "",
          confidence: en.confidence ?? 0.5,
          painScore: en.painScore,
          department: en.department,
          duration: en.duration,
          frequency: en.frequency,
          condition: en.condition,
          waitCause: en.waitCause,
          waitDuration: en.waitDuration,
        } as any);
        nodeId = node.id;
      }

      labelToId.set(en.label, nodeId);
      existingNodes.push(graph.getNode(nodeId)!);
    }

    // Add edges
    for (const ee of extraction.edges) {
      if (!isValidEdgeType(ee.type)) continue;
      const fromId = labelToId.get(ee.from);
      const toId = labelToId.get(ee.to);
      if (fromId && toId) {
        // Check for duplicate edges
        const existing = [...graph.edges.values()].find(
          e => e.from === fromId && e.to === toId && e.type === ee.type,
        );
        if (!existing) {
          graph.addEdge({
            type: ee.type as Edge["type"],
            from: fromId,
            to: toId,
            label: ee.label ?? "",
            confidence: ee.confidence ?? 0.5,
            source: "nlu_extracted",
            metadata: {},
          });
        }
      }
    }

    return labelToId;
  }

  /** Generate Socratic questions for prioritized gaps */
  private async askQuestions(session: Session, gaps: Gap[]): Promise<EngineResponse> {
    const messages: string[] = [];
    const acknowledgments: string[] = [];

    for (const gap of gaps) {
      const tmpl = getQuestionTemplate(gap.type);
      if (tmpl) {
        const ack = tmpl.acknowledgment(gap, session.graph);
        const q = tmpl.generate(gap, session.graph);
        if (ack) acknowledgments.push(ack);
        messages.push(q);
      } else {
        // Fallback: use LLM
        try {
          const prompt = `基于以下缺口信息生成一个苏格拉底式提问:\n缺口类型: ${gap.type}\n描述: ${gap.description}`;
          const llmRes = await this.client.complete(SOCRATIC_SYSTEM_PROMPT, prompt, { jsonMode: true });
          const parsed = parseSocraticResult(llmRes.content);
          if (parsed.question) messages.push(parsed.question);
          if (parsed.acknowledgment) acknowledgments.push(parsed.acknowledgment);
        } catch {
          messages.push(`关于「${gap.description}」，你能再详细说说吗？`);
        }
      }
    }

    if (messages.length === 0) {
      messages.push("关于这个流程，还有什么需要补充的吗？");
    }

    const response = [...acknowledgments.slice(0, 1), ...messages].join("\n\n");
    session.addTurn("assistant", response, gaps);

    return {
      message: response,
      state: "QUESTIONING",
      gapsDetected: gaps,
    };
  }

  /** Elicit more information */
  private elicitMore(session: Session, customMessage?: string): EngineResponse {
    const msg = customMessage ?? `${randomAcknowledgment()} 请继续描述你的工作流程，还有什么步骤或细节？`;
    session.addTurn("assistant", msg);
    return {
      message: msg,
      state: "ELICITING",
      gapsDetected: [],
    };
  }

  /** Transition to verification phase — consultant summarises and confirms readiness. */
  private verifyModel(session: Session, allGaps: Gap[], completeness?: CompletenessResult): EngineResponse {
    session.setState("VERIFYING");

    const c = completeness ?? assessCompleteness(session.graph);
    const msg = [
      `${c.summary}。`,
      `对照咨询诊断要求，你提供的资料已基本完整（覆盖 ${c.coveredCount}/${c.total} 项关键维度）。`,
      c.missing.length > 0
        ? `如果方便，还可以补充：${c.missing.map(m => m.label).join("、")}。`
        : "信息已相当充分。",
      "请点击「确认 AI 整理结果」，检查我整理的内容是否准确——确认后即完成。",
    ].join("\n");

    session.addTurn("assistant", msg, allGaps);

    return {
      message: msg,
      state: "VERIFYING",
      gapsDetected: allGaps,
      graphData: session.graph.toData(),
      completeness: c,
    };
  }

  /** Mark session as complete */
  async concludeSession(session: Session): Promise<EngineResponse> {
    session.setState("COMPLETE");
    const msg = "流程模型已完成！你可以在下方查看可视化的流程图和报告。";
    session.addTurn("assistant", msg);
    return {
      message: msg,
      state: "COMPLETE",
      gapsDetected: [],
      graphData: session.graph.toData(),
    };
  }
}
