import ExcelJS from "exceljs";

export interface ParsedAttachmentResult {
  fileType: "PDF" | "DOCX" | "XLSX" | "ZIP" | "OTHER";
  pageCount: number;
  itemCount: number;
  extractedText: string;
  snippet: string;
  tables?: Array<{
    title: string;
    headers: string[];
    rows: string[][];
  }>;
}

export function detectAttachmentFileType(
  filename: string,
): "PDF" | "DOCX" | "XLSX" | "ZIP" | "OTHER" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".docx") || lower.endsWith(".doc")) return "DOCX";
  if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv"))
    return "XLSX";
  if (lower.endsWith(".zip") || lower.endsWith(".rar") || lower.endsWith(".7z"))
    return "ZIP";
  return "OTHER";
}

/**
 * 结构化切分附件页面，生成带页码定位的检索索引串
 */
export function formatAttachmentWithPages(pages: string[]): string {
  return pages
    .map((content, idx) => `=== [第 ${idx + 1} 页] ===\n${content.trim()}`)
    .join("\n\n");
}

/**
 * 从文本或结构化数据中提炼关键货物/规格摘录
 */
export function extractGoodsSnippet(text: string): string {
  const match = text.match(
    /(?:主要货物|采购需求|标的清单|规格型号|设备名称|标的名称)[：:\s]*([^\n]{10,120})/i,
  );
  if (match) {
    return match[1].trim();
  }
  // 取前 80 字作为摘要
  const clean = text.replace(/===.*?===/g, "").replace(/\s+/g, " ").trim();
  return clean.slice(0, 100) + (clean.length > 100 ? "..." : "");
}

/**
 * 针对 Excel 清单附件 (.xlsx / .csv) 的真实二进制结构化提纯解析器
 */
export async function parseExcelAttachmentBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParsedAttachmentResult> {
  const workbook = new ExcelJS.Workbook();
  // CSV 还是 XLSX
  if (filename.toLowerCase().endsWith(".csv")) {
    const { Readable } = await import("node:stream");
    const stream = Readable.from(buffer);
    await workbook.csv.read(stream);
  } else {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  }

  const pages: string[] = [];
  const tables: Array<{ title: string; headers: string[]; rows: string[][] }> = [];
  let totalItems = 0;
  const sampleItems: string[] = [];

  workbook.eachSheet((worksheet, sheetId) => {
    const sheetName = worksheet.name || `Sheet${sheetId}`;
    const rowsData: string[][] = [];

    worksheet.eachRow({ includeEmpty: false }, (row) => {
      const rowValues = Array.isArray(row.values) ? row.values : [];
      // 去除 exceljs 头部索引 0
      const cleanCells = rowValues
        .slice(1)
        .map((cell: unknown) => {
          if (cell === null || cell === undefined) return "";
          if (typeof cell === "object" && cell !== null) {
            const obj = cell as Record<string, unknown>;
            if (obj.text) return String(obj.text).trim();
            if (obj.result) return String(obj.result).trim();
          }
          return String(cell).trim();
        })
        .filter((c) => c !== "");

      if (cleanCells.length > 0) {
        rowsData.push(cleanCells);
      }
    });

    if (rowsData.length > 0) {
      const headers = rowsData[0];
      const dataRows = rowsData.slice(1);
      totalItems += dataRows.length;

      // 提取前几个典型品名
      for (const dr of dataRows.slice(0, 5)) {
        if (dr[0] && dr[0].length > 1 && !/^\d+$/.test(dr[0])) {
          sampleItems.push(dr[0]);
        } else if (dr[1] && dr[1].length > 1) {
          sampleItems.push(dr[1]);
        }
      }

      tables.push({
        title: sheetName,
        headers,
        rows: dataRows.slice(0, 100), // 截取前 100 行供快速在线预览
      });

      // 转换为该页纯文本供分词检索
      const sheetText = [
        `【工作表: ${sheetName} (共 ${dataRows.length} 行物料条目)】`,
        `表头字段: ${headers.join(" | ")}`,
        ...dataRows.slice(0, 150).map((r, idx) => `[条目 ${idx + 1}] ${r.join(" , ")}`),
      ].join("\n");

      pages.push(sheetText);
    }
  });

  if (pages.length === 0) {
    pages.push(`【Excel 附件 ${filename}】暂无有效数据行。`);
  }

  const paginatedText = formatAttachmentWithPages(pages);
  const snippet =
    sampleItems.length > 0
      ? `包含采购物料清单：${sampleItems.slice(0, 4).join("、")}等共 ${totalItems} 项标的`
      : extractGoodsSnippet(paginatedText);

  return {
    fileType: "XLSX",
    pageCount: pages.length,
    itemCount: Math.max(1, totalItems),
    extractedText: paginatedText,
    snippet,
    tables,
  };
}

/**
 * 附件文本解析与结构化提纯引擎 (纯文本兜底)
 */
export function parseAttachmentRawText(
  rawText: string,
  filename: string,
): ParsedAttachmentResult {
  const fileType = detectAttachmentFileType(filename);

  // 1. 按段落或模拟每 800 字分为一页
  const rawClean = rawText.trim();
  const chunkSize = 800;
  const pages: string[] = [];

  if (rawClean.includes("=== [第") && rawClean.includes("页] ===")) {
    // 已经包含页码标记
    const pageSplits = rawClean.split(/=== \[第 \d+ 页\] ===\n?/);
    for (const p of pageSplits) {
      if (p.trim()) pages.push(p.trim());
    }
  } else {
    for (let i = 0; i < rawClean.length; i += chunkSize) {
      pages.push(rawClean.slice(i, i + chunkSize));
    }
  }

  if (pages.length === 0) {
    pages.push(rawClean || "附件无有效纯文本内容");
  }

  const paginatedText = formatAttachmentWithPages(pages);
  const snippet = extractGoodsSnippet(rawClean);

  // 2. 统计清单条目数（根据序号或表格行数估算）
  const itemMatches = rawClean.match(/(?:^|\n)\s*(?:\d+[\.、\)]|[一二三四五六七八九十]+、)/g);
  const itemCount = itemMatches ? itemMatches.length : 1;

  return {
    fileType,
    pageCount: pages.length,
    itemCount,
    extractedText: paginatedText,
    snippet,
  };
}

/**
 * 综合入口：根据 Buffer 与文件扩展名自动分流到原生解析器或文本引擎
 */
export async function parseAttachmentBuffer(
  buffer: Buffer,
  filename: string
): Promise<ParsedAttachmentResult> {
  const type = detectAttachmentFileType(filename);
  if (type === "XLSX") {
    try {
      return await parseExcelAttachmentBuffer(buffer, filename);
    } catch (err) {
      console.error(`[AttachmentParser] Excel 原生解析失败，降级纯文本处理: ${err}`);
    }
  }

  // 兜底为 UTF-8 文本解析
  const rawText = buffer.toString("utf-8");
  return parseAttachmentRawText(rawText, filename);
}

