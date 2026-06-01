/**
 * Dialogue state machine — states and transition logic.
 *
 * States:
 *   ONBOARDING → ELICITING ⇄ CLARIFYING
 *                  ↓            ↓
 *               MAPPING → GAP_DETECTING
 *                  ↑            ↓
 *                  ←←←  QUESTIONING
 *                         ↓
 *                    VERIFYING → COMPLETE
 */

export type State =
  | "ONBOARDING"
  | "ELICITING"
  | "CLARIFYING"
  | "MAPPING"
  | "GAP_DETECTING"
  | "QUESTIONING"
  | "VERIFYING"
  | "COMPLETE";

export const STATES: readonly State[] = [
  "ONBOARDING", "ELICITING", "CLARIFYING", "MAPPING",
  "GAP_DETECTING", "QUESTIONING", "VERIFYING", "COMPLETE",
];

export interface TransitionRule {
  from: State;
  to: State;
  condition: string;
}

const TRANSITIONS: TransitionRule[] = [
  { from: "ONBOARDING", to: "ELICITING", condition: "user has provided initial process description" },
  { from: "ELICITING", to: "MAPPING", condition: "sufficient info collected for provisional model" },
  { from: "ELICITING", to: "CLARIFYING", condition: "user input needs clarification" },
  { from: "CLARIFYING", to: "MAPPING", condition: "clarification received" },
  { from: "MAPPING", to: "GAP_DETECTING", condition: "provisional model built" },
  { from: "GAP_DETECTING", to: "QUESTIONING", condition: "actionable gaps found" },
  { from: "GAP_DETECTING", to: "VERIFYING", condition: "no more actionable gaps" },
  { from: "GAP_DETECTING", to: "ELICITING", condition: "gap detection suggests more elicitation needed" },
  { from: "QUESTIONING", to: "ELICITING", condition: "user answered questions" },
  { from: "QUESTIONING", to: "CLARIFYING", condition: "user answer needs clarification" },
  { from: "QUESTIONING", to: "QUESTIONING", condition: "follow-up question needed (within limit)" },
  { from: "VERIFYING", to: "ELICITING", condition: "user wants to add/modify" },
  { from: "VERIFYING", to: "COMPLETE", condition: "user confirms model is complete" },
];

export function validTransitions(from: State): State[] {
  return TRANSITIONS.filter(t => t.from === from).map(t => t.to);
}

export function isValidTransition(from: State, to: State): boolean {
  return validTransitions(from).includes(to);
}

export function stateLabel(state: State): string {
  const labels: Record<State, string> = {
    ONBOARDING: "引导",
    ELICITING: "采集",
    CLARIFYING: "澄清",
    MAPPING: "建模",
    GAP_DETECTING: "缺口检测",
    QUESTIONING: "提问",
    VERIFYING: "验证",
    COMPLETE: "完成",
  };
  return labels[state];
}
