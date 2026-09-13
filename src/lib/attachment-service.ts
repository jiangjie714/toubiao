import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import { defaultStorage } from "@/../crawler/storage";

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const MAX_ATTACHMENT_SIZE_BYTES = 80 * 1024 * 1024; // 最大 80MB

export interface AttachmentFetchResult {
  buffer: Buffer;
  fileName: string;
  contentType: string;
  size: number;
  checksum: string;
  fromCache: boolean;
}

/**
 * SSRF 安全校验：确保 URL 为公网合法 HTTP/HTTPS 地址，阻断私有网段与本地环回
 */
export function validateAttachmentUrl(rawUrl: string): { valid: boolean; reason?: string } {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { valid: false, reason: "仅允许 HTTP 或 HTTPS 协议链接" };
    }

    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname === "[::1]"
    ) {
      return { valid: false, reason: "禁止访问本地环回地址 (SSRF Protection)" };
    }

    // 常见私有 IPv4 段
    const parts = hostname.split(".").map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p) && p >= 0 && p <= 255)) {
      if (parts[0] === 10) return { valid: false, reason: "禁止访问私有内网地址 (10.0.0.0/8)" };
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) {
        return { valid: false, reason: "禁止访问私有内网地址 (172.16.0.0/12)" };
      }
      if (parts[0] === 192 && parts[1] === 168) {
        return { valid: false, reason: "禁止访问私有内网地址 (192.168.0.0/16)" };
      }
      if (parts[0] === 169 && parts[1] === 254) {
        return { valid: false, reason: "禁止访问链路本地地址 (169.254.0.0/16)" };
      }
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: "非法 URL 格式" };
  }
}

/**
 * 依据文件名称推断 MIME 类型
 */
function inferContentType(fileName: string, headerType?: string | null): string {
  if (headerType && headerType !== "application/octet-stream" && headerType !== "text/html") {
    return headerType.split(";")[0].trim();
  }
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "zip":
      return "application/zip";
    case "rar":
      return "application/x-rar-compressed";
    case "7z":
      return "application/x-7z-compressed";
    case "txt":
      return "text/plain; charset=utf-8";
    default:
      return headerType || "application/octet-stream";
  }
}

export class AttachmentError extends Error {
  readonly code: "UPGRADE_REQUIRED" | "NOT_FOUND" | "SECURITY_BLOCKED" | "FETCH_FAILED";

  constructor(
    message: string,
    code: "UPGRADE_REQUIRED" | "NOT_FOUND" | "SECURITY_BLOCKED" | "FETCH_FAILED"
  ) {
    super(message);
    this.name = "AttachmentError";
    this.code = code;
  }
}

/**
 * 获取或按需抓取标书附件，打通「本地存储缓存 ➔ SSRF防御 ➔ 按需抓取 ➔ 落地归档 ➔ 流式输出」
 */
export async function getOrFetchAttachment(
  attachmentId: number,
  userId: number,
): Promise<AttachmentFetchResult> {
  // 1. 验证会员特权
  const entitlement = await getEntitlement(userId);
  if (!entitlement.features.attachments) {
    throw new AttachmentError("当前会员套餐无权下载标书附件，请升级为铂金会员或企业版", "UPGRADE_REQUIRED");
  }

  // 2. 查询附件记录
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      tender: {
        select: {
          id: true,
          title: true,
          sourceName: true,
          sourceUrl: true,
        },
      },
    },
  });

  if (!attachment) {
    throw new AttachmentError("未找到对应的附件记录", "NOT_FOUND");
  }

  // 3. 检查本地对象存储缓存（若已转存且文件完整，直接返回缓存）
  if (attachment.storageKey) {
    const cachedBuffer = await defaultStorage.getAttachment(attachment.storageKey);
    if (cachedBuffer && cachedBuffer.length > 0) {
      const checksum = crypto.createHash("sha256").update(cachedBuffer).digest("hex");
      return {
        buffer: cachedBuffer,
        fileName: attachment.name,
        contentType: attachment.contentType || inferContentType(attachment.name),
        size: cachedBuffer.length,
        checksum,
        fromCache: true,
      };
    }
  }

  // 4. 安全校验：SSRF 防御
  const validation = validateAttachmentUrl(attachment.sourceUrl);
  if (!validation.valid) {
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        status: "failed",
      },
    });
    throw new AttachmentError(`附件链接安全检测未通过: ${validation.reason}`, "SECURITY_BLOCKED");
  }

  // 5. 按需从源站安全抓取
  try {
    const headers: Record<string, string> = {
      "User-Agent": CHROME_UA,
      Accept: "*/*",
    };
    if (attachment.tender.sourceUrl) {
      headers["Referer"] = attachment.tender.sourceUrl;
    }

    const response = await fetch(attachment.sourceUrl, {
      headers,
      signal: AbortSignal.timeout(20000), // 20 秒超时
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(`源站返回 HTTP ${response.status} (${response.statusText})`);
    }

    // 检查响应头中的大小
    const contentLengthStr = response.headers.get("content-length");
    if (contentLengthStr) {
      const declaredSize = parseInt(contentLengthStr, 10);
      if (declaredSize > MAX_ATTACHMENT_SIZE_BYTES) {
        throw new Error(
          `附件文件超过平台安全上限 (${(declaredSize / 1024 / 1024).toFixed(1)}MB > 80MB)`
        );
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length === 0) {
      throw new Error("源站返回空内容 (0 字节)");
    }
    if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
      throw new Error(
        `附件文件超过平台安全上限 (${(buffer.length / 1024 / 1024).toFixed(1)}MB > 80MB)`
      );
    }

    const headerContentType = response.headers.get("content-type");
    const finalContentType = inferContentType(attachment.name, headerContentType);
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");

    // 6. 落地存入本地对象存储卷
    const storageKey = await defaultStorage.saveAttachment(
      attachment.sourceUrl,
      buffer,
      finalContentType
    );

    // 7. 更新数据库状态
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        status: "stored",
        storageKey,
        size: buffer.length,
        contentType: finalContentType,
      },
    });

    return {
      buffer,
      fileName: attachment.name,
      contentType: finalContentType,
      size: buffer.length,
      checksum,
      fromCache: false,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : "从源站拉取附件失败";

    // 记录失败状态
    await prisma.attachment.update({
      where: { id: attachment.id },
      data: {
        status: "failed",
      },
    });

    // 为企业用户生成官方存管回退说明文件，保证下载体验不断崖
    const fallbackText = `【标讯通·招投标附件安全存管通知】\n----------------------------------------\n项目公告：${attachment.tender.title}\n文件名称：${attachment.name}\n源站渠道：${attachment.tender.sourceName}\n官方源站：${attachment.tender.sourceUrl || "暂无"}\n附件原址：${attachment.sourceUrl}\n转存时间：${new Date().toLocaleString("zh-CN")}\n----------------------------------------\n状态说明：该附件在源站已被清理、防盗链限制或临时不可达。\n系统错误：${errMsg}\n建议处理：请点击上方官方源站地址直接前往发布单位门户查阅，或联系标讯通专属客服为您人工协调文件。`;
    const fallbackBuffer = Buffer.from(fallbackText, "utf-8");
    const fallbackChecksum = crypto.createHash("sha256").update(fallbackBuffer).digest("hex");

    return {
      buffer: fallbackBuffer,
      fileName: `${attachment.name}.存管说明.txt`,
      contentType: "text/plain; charset=utf-8",
      size: fallbackBuffer.length,
      checksum: fallbackChecksum,
      fromCache: false,
    };
  }
}
