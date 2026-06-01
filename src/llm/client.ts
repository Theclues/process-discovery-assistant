/**
 * DeepSeek API client with timeout, retry, and circuit breaker.
 *
 * Engineering cybernetics:
 * - Timeout: 30s (prevents unbounded wait)
 * - Retry: 3 attempts with exponential backoff
 * - Circuit breaker: 5 failures → open → 60s recovery → half-open (max 3 probes)
 * - Idempotency: retry only on idempotent-safe status codes (429, 5xx)
 */

import OpenAI from "openai";
import { getConfig } from "../config.js";

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  state: CircuitState = "CLOSED";
  failureCount = 0;
  lastFailureTime = 0;
  halfOpenCount = 0;

  allow(): boolean {
    const config = getConfig();
    const now = Date.now();

    if (this.state === "OPEN") {
      if (now - this.lastFailureTime > config.cbRecoveryTimeout) {
        this.state = "HALF_OPEN";
        this.halfOpenCount = 0;
      } else {
        return false;
      }
    }

    if (this.state === "HALF_OPEN") {
      return this.halfOpenCount < config.cbHalfOpenMax;
    }

    return true;
  }

  recordSuccess(): void {
    if (this.state === "HALF_OPEN") {
      this.halfOpenCount++;
    }
    this.failureCount = 0;
    if (this.state === "HALF_OPEN" && this.halfOpenCount >= getConfig().cbHalfOpenMax) {
      this.state = "CLOSED";
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === "CLOSED" && this.failureCount >= getConfig().cbFailureThreshold) {
      this.state = "OPEN";
    }
    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
    }
  }
}

// ─── DeepSeek Client ───────────────────────────────────────────

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number };
  latencyMs: number;
}

export class DeepSeekClient {
  private client: OpenAI | null = null;
  private circuitBreaker = new CircuitBreaker();

  private getClient(): OpenAI {
    if (!this.client) {
      const config = getConfig();
      const apiKey = config.deepseekApiKey;
      if (!apiKey) {
        throw new Error("DeepSeek API key not configured — set deepseekApiKey in config.json");
      }
      this.client = new OpenAI({
        baseURL: config.deepseekBaseUrl,
        apiKey,
        timeout: config.deepseekTimeout,
        maxRetries: 0, // we handle retries manually
      });
    }
    return this.client;
  }

  /** Main chat completion with retry + circuit breaker */
  async chat(
    messages: ChatMessage[],
    options?: {
      temperature?: number;
      maxTokens?: number;
      responseFormat?: { type: "json_object" };
    },
  ): Promise<LLMResponse> {
    const config = getConfig();
    const start = Date.now();

    if (!this.circuitBreaker.allow()) {
      throw new Error("Circuit breaker is OPEN — API calls temporarily disabled");
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.deepseekMaxRetries; attempt++) {
      try {
        if (attempt > 0) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        const response = await this.getClient().chat.completions.create({
          model: config.deepseekModel,
          messages,
          temperature: options?.temperature ?? 0.3,
          max_tokens: options?.maxTokens ?? config.deepseekMaxTokens,
          response_format: options?.responseFormat,
        });

        const latencyMs = Date.now() - start;
        this.circuitBreaker.recordSuccess();

        return {
          content: response.choices[0]?.message?.content ?? "",
          model: response.model,
          usage: response.usage ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          } : undefined,
          latencyMs,
        };
      } catch (err: any) {
        lastError = err;
        const status = err?.status ?? err?.response?.status;

        // Don't retry on 4xx (except 429)
        if (status && status !== 429 && status < 500) {
          this.circuitBreaker.recordFailure();
          throw new Error(`DeepSeek API error (${status}): ${err.message}`);
        }

        this.circuitBreaker.recordFailure();
      }
    }

    throw new Error(`DeepSeek API failed after ${config.deepseekMaxRetries + 1} attempts: ${lastError?.message}`);
  }

  /** Convenience: single-turn completion */
  async complete(
    systemPrompt: string,
    userMessage: string,
    options?: { temperature?: number; jsonMode?: boolean },
  ): Promise<LLMResponse> {
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ];
    return this.chat(messages, {
      temperature: options?.temperature,
      responseFormat: options?.jsonMode ? { type: "json_object" } : undefined,
    });
  }

  getCircuitState(): CircuitState {
    return this.circuitBreaker.state;
  }
}

// Singleton
let _client: DeepSeekClient | undefined;

export function getLLMClient(): DeepSeekClient {
  if (!_client) {
    _client = new DeepSeekClient();
  }
  return _client;
}
