/** Global configuration with resource bounds (engineering cybernetics: bounded resources). */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface Config {
  maxNodes: number;
  maxEdges: number;
  /** Higher bounds for the merged enterprise graph (many employees aggregated). */
  maxEnterpriseNodes: number;
  maxEnterpriseEdges: number;
  embedAutoMerge: number;
  embedAskThreshold: number;
  /** DeepSeek API key — set in config.json (see config.example.json). */
  deepseekApiKey: string;
  deepseekModel: string;
  deepseekBaseUrl: string;
  deepseekTimeout: number;
  deepseekMaxRetries: number;
  deepseekMaxTokens: number;
  cbFailureThreshold: number;
  cbRecoveryTimeout: number;
  cbHalfOpenMax: number;
  minGapScoreToAsk: number;
  questionsPerRound: number;
  consecutiveQuestionsMax: number;
  maxSessionTurns: number;
  storageDir: string;
  port: number;
}

const defaults: Config = {
  maxNodes: 200,
  maxEdges: 500,
  // Enterprise aggregate: sized for ~100+ employees × dozens of nodes each,
  // with label de-duplication keeping the real count well below this ceiling.
  maxEnterpriseNodes: 8000,
  maxEnterpriseEdges: 20000,
  embedAutoMerge: 0.92,
  embedAskThreshold: 0.75,
  deepseekApiKey: "",
  deepseekModel: "deepseek-v4-pro",
  deepseekBaseUrl: "https://api.deepseek.com",
  deepseekTimeout: 30_000,
  deepseekMaxRetries: 3,
  deepseekMaxTokens: 4096,
  cbFailureThreshold: 5,
  cbRecoveryTimeout: 60_000,
  cbHalfOpenMax: 3,
  minGapScoreToAsk: 0.3,
  questionsPerRound: 2,
  consecutiveQuestionsMax: 2,
  maxSessionTurns: 50,
  storageDir: "./data/sessions",
  port: 3000,
};

let _config: Config = { ...defaults };

export function getConfig(): Config {
  return _config;
}

export function updateConfig(partial: Partial<Config>): Config {
  _config = { ..._config, ...partial };
  return _config;
}

/** Whether DeepSeek LLM is configured (API key present in config). */
export function isDeepseekConfigured(): boolean {
  return !!getConfig().deepseekApiKey;
}

const CONFIG_KEYS = new Set(Object.keys(defaults));

/**
 * Load settings from config.json at project root.
 * Only known Config keys are applied; unknown keys are ignored.
 * Env var DEEPSEEK_API_KEY is used as fallback when the file omits deepseekApiKey.
 */
export function loadConfigFromFile(configPath?: string): Config {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const resolved = configPath ?? path.join(root, "..", "config.json");

  if (fs.existsSync(resolved)) {
    try {
      const raw = JSON.parse(fs.readFileSync(resolved, "utf-8")) as Record<string, unknown>;
      const partial: Partial<Config> = {};
      for (const [key, value] of Object.entries(raw)) {
        if (CONFIG_KEYS.has(key)) {
          (partial as Record<string, unknown>)[key] = value;
        }
      }
      updateConfig(partial);
      console.log(`Config loaded from ${resolved}`);
    } catch (err) {
      console.warn(`Failed to load config from ${resolved}:`, err);
    }
  }

  // Fallback: env var for CI / container deploy without committing config.json
  if (!getConfig().deepseekApiKey && process.env.DEEPSEEK_API_KEY) {
    updateConfig({ deepseekApiKey: process.env.DEEPSEEK_API_KEY });
  }

  return getConfig();
}
