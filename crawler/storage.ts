import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface CrawlerStorage {
  saveSnapshot(key: string, content: string): Promise<string>;
  saveAttachment(key: string, content: Buffer, contentType?: string): Promise<string>;
}

export class LocalCrawlerStorage implements CrawlerStorage {
  constructor(private readonly baseDir = path.join(process.cwd(), ".data", "storage")) {}

  private async ensureDir(relativeDir: string): Promise<string> {
    const dir = path.join(this.baseDir, relativeDir);
    await fs.mkdir(dir, { recursive: true });
    return dir;
  }

  async saveSnapshot(key: string, content: string): Promise<string> {
    const storageKey = `snapshots/${crypto.createHash("sha256").update(key).digest("hex")}.html`;
    const dir = await this.ensureDir("snapshots");
    await fs.writeFile(path.join(dir, path.basename(storageKey)), content, "utf-8");
    return storageKey;
  }

  async saveAttachment(key: string, content: Buffer, contentType?: string): Promise<string> {
    const extension = contentType?.includes("pdf")
      ? ".pdf"
      : contentType?.includes("word")
        ? ".docx"
        : "";
    const storageKey = `attachments/${crypto.createHash("sha256").update(key).digest("hex")}${extension}`;
    const dir = await this.ensureDir("attachments");
    await fs.writeFile(path.join(dir, path.basename(storageKey)), content);
    return storageKey;
  }
}

export const defaultStorage = new LocalCrawlerStorage();
