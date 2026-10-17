import { prisma } from "./prisma";

export interface AttachmentHit {
  attachmentId: number;
  attachmentName: string;
  fileType: string;
  tenderId: number;
  tenderTitle: string;
  pageNumber: number;
  snippet: string;
  parsedAt: Date | null;
}

/**
 * 在附件全文中深层检索关键词，精准定位命中的页码与上下文片段
 */
export async function searchAttachmentContent(
  keyword: string,
  options: { take?: number } = {},
): Promise<AttachmentHit[]> {
  const q = keyword.trim();
  if (!q) return [];

  const take = options.take || 15;

  // 查询包含该关键词且已解析出正文的附件
  const attachments = await prisma.attachment.findMany({
    where: {
      status: "parsed",
      extractedText: { contains: q, mode: "insensitive" },
    },
    take,
    select: {
      id: true,
      name: true,
      fileType: true,
      extractedText: true,
      parsedAt: true,
      tender: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  const hits: AttachmentHit[] = [];

  for (const att of attachments) {
    if (!att.extractedText) continue;

    // 1. 拆分页面并查找命中具体哪一页
    const pageBlocks = att.extractedText.split(/=== \[第 (\d+) 页\] ===/);
    let matchedPage = 1;
    let matchedSnippet = "";

    // 格式为: ["", "1", "第一页内容", "2", "第二页内容"...]
    for (let i = 1; i < pageBlocks.length; i += 2) {
      const pageNum = parseInt(pageBlocks[i], 10);
      const content = pageBlocks[i + 1] || "";
      const lowerContent = content.toLowerCase();
      const lowerQ = q.toLowerCase();

      const matchIdx = lowerContent.indexOf(lowerQ);
      if (matchIdx !== -1) {
        matchedPage = pageNum;
        const start = Math.max(0, matchIdx - 35);
        const end = Math.min(content.length, matchIdx + q.length + 35);
        const before = (start > 0 ? "..." : "") + content.slice(start, matchIdx).trim();
        const matched = content.slice(matchIdx, matchIdx + q.length);
        const after = content.slice(matchIdx + q.length, end).trim() + (end < content.length ? "..." : "");
        matchedSnippet = `${before}【${matched}】${after}`;
        break;
      }
    }

    if (!matchedSnippet) {
      // 兜底全文模糊摘录
      const lower = att.extractedText.toLowerCase();
      const idx = lower.indexOf(q.toLowerCase());
      if (idx !== -1) {
        matchedSnippet = att.extractedText.slice(Math.max(0, idx - 30), idx + q.length + 30);
      } else {
        matchedSnippet = att.extractedText.slice(0, 80);
      }
    }

    hits.push({
      attachmentId: att.id,
      attachmentName: att.name,
      fileType: att.fileType || "PDF",
      tenderId: att.tender.id,
      tenderTitle: att.tender.title,
      pageNumber: matchedPage,
      snippet: matchedSnippet.replace(/\s+/g, " "),
      parsedAt: att.parsedAt,
    });
  }

  return hits;
}
