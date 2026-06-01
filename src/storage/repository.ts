/**
 * Session persistence — JSON file-based storage.
 */

import fs from "node:fs";
import path from "node:path";
import type { SessionData } from "../model/schema.js";
import { getConfig } from "../config.js";

export class SessionRepository {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? getConfig().storageDir;
  }

  private ensureDir(): void {
    if (!fs.existsSync(this.dir)) {
      fs.mkdirSync(this.dir, { recursive: true });
    }
  }

  private filePath(sessionId: string): string {
    return path.join(this.dir, `${sessionId}.json`);
  }

  async save(session: SessionData): Promise<void> {
    this.ensureDir();
    const content = JSON.stringify(session, null, 2);
    await fs.promises.writeFile(this.filePath(session.id), content, "utf-8");
  }

  async load(sessionId: string): Promise<SessionData | null> {
    try {
      const content = await fs.promises.readFile(this.filePath(sessionId), "utf-8");
      return JSON.parse(content) as SessionData;
    } catch {
      return null;
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(this.dir);
      return files.filter(f => f.endsWith(".json")).map(f => f.replace(".json", ""));
    } catch {
      return [];
    }
  }

  async delete(sessionId: string): Promise<void> {
    try {
      await fs.promises.unlink(this.filePath(sessionId));
    } catch {
      // ignore if not exists
    }
  }
}
