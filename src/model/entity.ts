/**
 * Entity Registry — entity resolution with string-similarity-based dedup.
 *
 * Three-tier threshold:
 *   - > 0.92: auto-merge
 *   - 0.75-0.92: ask user (human-in-the-loop)
 *   - < 0.75: create new entity
 *
 * Uses Levenshtein + Jaccard similarity since we may not have embeddings available.
 * Embedding support can be added by implementing the Embedder interface.
 */

import type { Node } from "./schema.js";
import { getConfig } from "../config.js";

export interface Embedder {
  embed(text: string): Promise<number[]>;
}

export interface ResolutionResult {
  action: "merge" | "ask" | "create";
  existingNode?: Node;
  similarity: number;
}

// ─── String Similarity ────────────────────────────────────────

/** Levenshtein distance */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Levenshtein-based similarity */
function levSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Jaccard similarity on character bigrams */
function jaccardSimilarity(a: string, b: string): number {
  const bigramsA = new Set<string>();
  const bigramsB = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.substring(i, i + 2));
  for (let i = 0; i < b.length - 1; i++) bigramsB.add(b.substring(i, i + 2));
  const intersection = new Set([...bigramsA].filter(x => bigramsB.has(x)));
  const union = new Set([...bigramsA, ...bigramsB]);
  return union.size === 0 ? 1 : intersection.size / union.size;
}

/** Combined similarity score */
function textSimilarity(a: string, b: string): number {
  return 0.5 * levSimilarity(a, b) + 0.5 * jaccardSimilarity(a, b);
}

// ─── Entity Registry ──────────────────────────────────────────

export class EntityRegistry {
  private embedder?: Embedder;

  setEmbedder(embedder: Embedder): void {
    this.embedder = embedder;
  }

  /**
   * Resolve a candidate label against existing nodes.
   * Returns the recommended action and the best-matching existing node (if any).
   */
  resolve(
    label: string,
    existingNodes: Node[],
  ): ResolutionResult {
    const config = getConfig();
    let bestSim = 0;
    let bestNode: Node | undefined;

    for (const node of existingNodes) {
      const sim = textSimilarity(label, node.label);
      if (sim > bestSim) {
        bestSim = sim;
        bestNode = node;
      }
    }

    if (bestSim >= config.embedAutoMerge) {
      return { action: "merge", existingNode: bestNode, similarity: bestSim };
    } else if (bestSim >= config.embedAskThreshold) {
      return { action: "ask", existingNode: bestNode, similarity: bestSim };
    }
    return { action: "create", similarity: bestSim };
  }

  /**
   * Resolve with embedding similarity (async, if embedder is configured).
   */
  async resolveAsync(
    label: string,
    existingNodes: Node[],
  ): Promise<ResolutionResult> {
    if (!this.embedder) {
      return this.resolve(label, existingNodes);
    }
    // TODO: implement embedding-based similarity when embedder is available
    return this.resolve(label, existingNodes);
  }

  /**
   * Find potential duplicates among existing nodes.
   */
  findDuplicates(nodes: Node[]): { a: Node; b: Node; similarity: number }[] {
    const config = getConfig();
    const dups: { a: Node; b: Node; similarity: number }[] = [];
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const sim = textSimilarity(nodes[i].label, nodes[j].label);
        if (sim >= config.embedAskThreshold) {
          dups.push({ a: nodes[i], b: nodes[j], similarity: sim });
        }
      }
    }
    return dups;
  }
}
