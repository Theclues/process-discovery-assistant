/** JSON serialization for ProcessGraph and Session data. */

import { ProcessGraph } from "./graph.js";
import type { ProcessGraphData, SessionData } from "./schema.js";

export function graphToJSON(graph: ProcessGraph): string {
  return JSON.stringify(graph.toData(), null, 2);
}

export function graphFromJSON(json: string): ProcessGraph {
  const data: ProcessGraphData = JSON.parse(json);
  return ProcessGraph.fromData(data);
}

export function sessionToJSON(session: SessionData): string {
  return JSON.stringify(session, null, 2);
}

export function sessionFromJSON(json: string): SessionData {
  return JSON.parse(json);
}
