import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface CrawlerStorage {
  saveSnapshot(key: string, content: string): Promise<string>;
  saveAttachment(key: string, content: Buffer, contentType?: string): Promise<string>;
  getAttachment(storageKey: string): Promise<Buffer | null>;
  hasAttachment(storageKey: string): Promise<boolean>;
  getSnapshot(storageKey: string): Promise<string | null>;
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

  async getSnapshot(storageKey: string): Promise<string | null> {
    try {
      const fullPath = path.join(this.baseDir, storageKey);
      return await fs.readFile(fullPath, "utf-8");
    } catch {
      return null;
    }
  }

  async saveAttachment(key: string, content: Buffer, contentType?: string): Promise<string> {
    let extension = "";
    if (contentType?.includes("pdf")) extension = ".pdf";
    else if (contentType?.includes("vnd.openxmlformats") || contentType?.includes("docx")) extension = ".docx";
    else if (contentType?.includes("msword") || contentType?.includes("doc")) extension = ".doc";
    else if (contentType?.includes("spreadsheet") || contentType?.includes("xlsx")) extension = ".xlsx";
    else if (contentType?.includes("excel") || contentType?.includes("xls")) extension = ".xls";
    else if (contentType?.includes("zip")) extension = ".zip";
    else if (contentType?.includes("rar")) extension = ".rar";

    const storageKey = `attachments/${crypto.createHash("sha256").update(key).digest("hex")}${extension}`;
    const dir = await this.ensureDir("attachments");
    await fs.writeFile(path.join(dir, path.basename(storageKey)), content);
    return storageKey;
  }

  async getAttachment(storageKey: string): Promise<Buffer | null> {
    try {
      const fullPath = path.join(this.baseDir, storageKey);
      return await fs.readFile(fullPath);
    } catch {
      return null;
    }
  }

  async hasAttachment(storageKey: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.baseDir, storageKey);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}

export const defaultStorage = new LocalCrawlerStorage();
