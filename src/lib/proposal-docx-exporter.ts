/**
 * 投标文件工业级 Word (.docx) 排版生成与导出引擎
 * 符合国家公文规范 (GB/T 9704-2012) 与政府采购招投标标准排版要求
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  PageBreak,
  convertInchesToTwip,
} from "docx";
import { ProposalProjectData, VOLUME_METAS } from "./proposal-assembler-types";

export interface DocxExportOptions {
  includeCover?: boolean;
  watermarkText?: string;
  bidderName?: string;
  legalRepresentative?: string;
  proposalType?: "正本" | "副本";
}

// 常用公文字体配置
const FONT_FANGSONG = "FangSong"; // 仿宋
const FONT_HEITI = "SimHei"; // 黑体
const FONT_SONGTI = "SimSun"; // 宋体
const FONT_KAITI = "KaiTi"; // 楷体

/**
 * 将多卷装配工程生成规范的 .docx 二进制 Buffer
 */
export async function generateProposalDocxBuffer(
  project: ProposalProjectData,
  options: DocxExportOptions = {}
): Promise<Buffer> {
  const includeCover = options.includeCover !== false;
  const bidderName = options.bidderName || "标讯通智能科技有限公司";
  const legalRep = options.legalRepresentative || "张三（法定代表人）";
  const proposalType = options.proposalType || "正本";

  // 1. 封面段落集合
  const coverChildren: (Paragraph | Table)[] = [];
  if (includeCover) {
    // 密级与版次（右上角）
    coverChildren.push(
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 360 },
        children: [
          new TextRun({
            text: `【 ${proposalType} 】 内部保密 • 严禁外传`,
            font: FONT_HEITI,
            size: 20, // 10pt
            color: "4B5563",
            bold: true,
          }),
        ],
      })
    );

    // 顶部大空白间隔
    coverChildren.push(
      new Paragraph({
        spacing: { before: 1000, after: 400 },
        children: [],
      })
    );

    // 标书大标题
    coverChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({
            text: "投  标  文  件",
            font: FONT_HEITI,
            size: 60, // 30pt 小初号
            bold: true,
            color: "1E3A8A", // 商务公文深蓝
          }),
        ],
      })
    );

    // 项目名称
    coverChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 800 },
        children: [
          new TextRun({
            text: `项目名称：${project.title}`,
            font: FONT_SONGTI,
            size: 32, // 16pt 三号
            bold: true,
            color: "111827",
          }),
        ],
      })
    );

    // 封面信息清单表格（居中对称公文表）
    const coverInfoRows = [
      { label: "招 标 人：", value: project.targetPurchaser || "招标单位采购人" },
      { label: "项目预算：", value: project.bidAmountWan ? `${project.bidAmountWan} 万元` : "见招标文件最高限价" },
      { label: "工期要求：", value: project.projectDuration || "按招标文件规定执行" },
      { label: "投 标 人：", value: `${bidderName}（盖单位章）` },
      { label: "法定代表人：", value: `${legalRep}（签字或盖章）` },
      { label: "日    期：", value: formatChineseDate(new Date()) },
    ];

    const coverTable = new Table({
      width: { size: 85, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: coverInfoRows.map((row) => {
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 30, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.RIGHT,
                  spacing: { before: 120, after: 120 },
                  children: [
                    new TextRun({
                      text: row.label,
                      font: FONT_FANGSONG,
                      size: 28, // 14pt 四号
                      bold: true,
                      color: "374151",
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 70, type: WidthType.PERCENTAGE },
              borders: {
                top: { style: BorderStyle.NONE },
                bottom: { style: BorderStyle.SINGLE, size: 6, color: "9CA3AF" },
                left: { style: BorderStyle.NONE },
                right: { style: BorderStyle.NONE },
              },
              children: [
                new Paragraph({
                  alignment: AlignmentType.LEFT,
                  spacing: { before: 120, after: 120 },
                  children: [
                    new TextRun({
                      text: `  ${row.value}`,
                      font: FONT_FANGSONG,
                      size: 28, // 14pt
                      color: "111827",
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      }),
    });

    coverChildren.push(coverTable);

    // 封面公章与骑缝章醒目标识框
    coverChildren.push(
      new Paragraph({
        spacing: { before: 800, after: 200 },
        children: [],
      })
    );

    coverChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 0 },
        children: [
          new TextRun({
            text: "【 投标专用章 / 法定代表人印鉴加盖处 】",
            font: FONT_KAITI,
            size: 22,
            color: "DC2626", // 警示红
            bold: true,
          }),
        ],
      })
    );

    // 封面结束后强制分页
    coverChildren.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );
  }

  // 2. 正文分卷内容解析与组织
  const bodyChildren: (Paragraph | Table)[] = [];

  // 总目录 / 分卷总览
  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 360 },
      children: [
        new TextRun({
          text: "目    录",
          font: FONT_HEITI,
          size: 36, // 18pt 小二号
          bold: true,
          color: "111827",
        }),
      ],
    })
  );

  const tocRows = (project.volumes || []).map((vol) => {
    const meta = VOLUME_METAS[vol.volumeId];
    return new TableRow({
      children: [
        new TableCell({
          width: { size: 25, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({
                  text: meta?.volumeNumber || "分卷",
                  font: FONT_HEITI,
                  size: 24, // 12pt
                  bold: true,
                  color: "1E3A8A",
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 75, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [
            new Paragraph({
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({
                  text: `${vol.title || meta?.title} ....................................................................`,
                  font: FONT_SONGTI,
                  size: 24,
                  color: "374151",
                }),
              ],
            }),
          ],
        }),
      ],
    });
  });

  bodyChildren.push(
    new Table({
      width: { size: 95, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: tocRows,
    })
  );

  // 目录后分页
  bodyChildren.push(
    new Paragraph({
      children: [new PageBreak()],
    })
  );

  // 遍历并解析各卷 Markdown
  (project.volumes || []).forEach((vol, idx) => {
    const meta = VOLUME_METAS[vol.volumeId];
    const volNum = meta?.volumeNumber || `第${idx + 1}卷`;
    const volTitle = vol.title || meta?.title || "标书分卷";

    // 分卷大卷标（一级标题，大字号、段前段后、居中）
    bodyChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360, after: 200 },
        children: [
          new TextRun({
            text: `${volNum}  ${volTitle}`,
            font: FONT_HEITI,
            size: 32, // 16pt 三号
            bold: true,
            color: "1E3A8A",
          }),
        ],
      })
    );

    // 卷摘要说明
    if (meta?.description) {
      bodyChildren.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 280 },
          children: [
            new TextRun({
              text: `【本卷导读：${meta.description}】`,
              font: FONT_KAITI,
              size: 20, // 10pt
              color: "6B7280",
            }),
          ],
        })
      );
    }

    // 解析分卷正文 Markdown
    const parsedElements = parseMarkdownToDocxElements(vol.contentMarkdown || "");
    bodyChildren.push(...parsedElements);

    // 卷末落款盖章卡片
    bodyChildren.push(createVolumeSignatureBlock(bidderName, legalRep));

    // 非最后一卷，自动插入分页符
    if (idx < (project.volumes || []).length - 1) {
      bodyChildren.push(
        new Paragraph({
          children: [new PageBreak()],
        })
      );
    }
  });

  // 3. 构造全文档
  const doc = new Document({
    sections: [
      ...(includeCover
        ? [
            {
              properties: {
                page: {
                  margin: {
                    top: convertInchesToTwip(1),
                    bottom: convertInchesToTwip(1),
                    left: convertInchesToTwip(1.2),
                    right: convertInchesToTwip(1.2),
                  },
                },
              },
              children: coverChildren,
            },
          ]
        : []),
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.2),
            },
            pageNumbers: {
              start: 1,
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 120 },
                border: {
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                },
                children: [
                  new TextRun({
                    text: `${project.title} • 投标文件（${proposalType}）   `,
                    font: FONT_SONGTI,
                    size: 18, // 9pt
                    color: "64748B",
                  }),
                  new TextRun({
                    text: `[商业秘密]`,
                    font: FONT_HEITI,
                    size: 18,
                    color: "DC2626",
                    bold: true,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120, after: 0 },
                children: [
                  new TextRun({
                    text: "第 ",
                    font: FONT_SONGTI,
                    size: 18,
                    color: "64748B",
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: FONT_SONGTI,
                    size: 18,
                    bold: true,
                    color: "1E293B",
                  }),
                  new TextRun({
                    text: " 页",
                    font: FONT_SONGTI,
                    size: 18,
                    color: "64748B",
                  }),
                ],
              }),
            ],
          }),
        },
        children: bodyChildren,
      },
    ],
  });

  return await Packer.toBuffer(doc);
}

/**
 * 卷末落款与加盖公章占位模块
 */
function createVolumeSignatureBlock(bidderName: string, legalRep: string): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 55, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.NONE },
              bottom: { style: BorderStyle.NONE },
              left: { style: BorderStyle.NONE },
              right: { style: BorderStyle.NONE },
            },
            children: [
              new Paragraph({
                spacing: { before: 240, after: 80 },
                children: [
                  new TextRun({
                    text: `投标人名称：${bidderName}`,
                    font: FONT_SONGTI,
                    size: 24, // 12pt
                    bold: true,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: `法定代表人或授权委托人：${legalRep}`,
                    font: FONT_SONGTI,
                    size: 24,
                  }),
                ],
              }),
              new Paragraph({
                spacing: { before: 80, after: 120 },
                children: [
                  new TextRun({
                    text: `签署日期：${formatChineseDate(new Date())}`,
                    font: FONT_SONGTI,
                    size: 24,
                    color: "4B5563",
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.DASHED, size: 8, color: "DC2626" },
              bottom: { style: BorderStyle.DASHED, size: 8, color: "DC2626" },
              left: { style: BorderStyle.DASHED, size: 8, color: "DC2626" },
              right: { style: BorderStyle.DASHED, size: 8, color: "DC2626" },
            },
            shading: { fill: "FEF2F2" }, // 浅红印章底色
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 180, after: 80 },
                children: [
                  new TextRun({
                    text: "【此处加盖单位合法公章】",
                    font: FONT_KAITI,
                    size: 22,
                    bold: true,
                    color: "B91C1C",
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 0, after: 180 },
                children: [
                  new TextRun({
                    text: "（骑缝章请沿文件边缘均匀加盖）",
                    font: FONT_KAITI,
                    size: 18,
                    color: "EF4444",
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/**
 * 将 Markdown 文本逐块解析为标准的 Word 段落或实体表格
 */
function parseMarkdownToDocxElements(md: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const lines = md.split("\n");
  let i = 0;

  while (i < lines.length) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 跳过纯空行
    if (!line) {
      i++;
      continue;
    }

    // 1. 检查是否为 Markdown 表格起始行 (以 | 开头且下一行为 |---| 分隔符)
    if (line.startsWith("|") && i + 1 < lines.length && lines[i + 1].trim().startsWith("|") && lines[i + 1].includes("---")) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const table = parseMarkdownTable(tableLines);
      if (table) {
        elements.push(table);
      }
      continue;
    }

    // 2. 标题级别解析 (H1, H2, H3, H4)
    if (line.startsWith("# ")) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 140 },
          children: [
            new TextRun({
              text: line.replace(/^#\s+/, ""),
              font: FONT_HEITI,
              size: 28, // 14pt 四号
              bold: true,
              color: "1E3A8A",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 100 },
          children: [
            new TextRun({
              text: line.replace(/^##\s+/, ""),
              font: FONT_HEITI,
              size: 26, // 13pt
              bold: true,
              color: "1F2937",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 160, after: 80 },
          children: [
            new TextRun({
              text: line.replace(/^###\s+/, ""),
              font: FONT_HEITI,
              size: 24, // 12pt
              bold: true,
              color: "374151",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    if (line.startsWith("#### ")) {
      elements.push(
        new Paragraph({
          spacing: { before: 120, after: 60 },
          children: [
            new TextRun({
              text: line.replace(/^####\s+/, ""),
              font: FONT_SONGTI,
              size: 24, // 12pt
              bold: true,
              color: "4B5563",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // 3. 引用块 / 强调提示块
    if (line.startsWith("> ")) {
      elements.push(
        new Paragraph({
          spacing: { before: 100, after: 100 },
          border: {
            left: { style: BorderStyle.SINGLE, size: 12, color: "3B82F6" },
          },
          indent: { left: 240 },
          children: [
            new TextRun({
              text: line.replace(/^>\s*/, ""),
              font: FONT_KAITI,
              size: 22,
              color: "374151",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // 4. 列表项 (- 或 * 或 1. 2.)
    if (/^[-*]\s+/.test(line)) {
      const listContent = line.replace(/^[-*]\s+/, "");
      elements.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 480 },
          children: [
            new TextRun({
              text: "•  ",
              font: FONT_HEITI,
              size: 22,
              bold: true,
              color: "2563EB",
            }),
            ...parseInlineFormatting(listContent),
          ],
        })
      );
      i++;
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const match = line.match(/^(\d+\.)\s+(.*)$/);
      const prefix = match ? match[1] : "1.";
      const text = match ? match[2] : line;
      elements.push(
        new Paragraph({
          spacing: { before: 60, after: 60 },
          indent: { left: 480 },
          children: [
            new TextRun({
              text: `${prefix}  `,
              font: FONT_HEITI,
              size: 24,
              bold: true,
            }),
            ...parseInlineFormatting(text),
          ],
        })
      );
      i++;
      continue;
    }

    // 5. 识别签章/公章红框提示
    if (line.includes("盖单位公章") || line.includes("【公章】") || line.includes("法定代表人签字")) {
      elements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 180, after: 180 },
          border: {
            top: { style: BorderStyle.DASHED, size: 6, color: "EF4444" },
            bottom: { style: BorderStyle.DASHED, size: 6, color: "EF4444" },
            left: { style: BorderStyle.DASHED, size: 6, color: "EF4444" },
            right: { style: BorderStyle.DASHED, size: 6, color: "EF4444" },
          },
          children: [
            new TextRun({
              text: `  ${line}  `,
              font: FONT_KAITI,
              size: 24,
              bold: true,
              color: "DC2626",
            }),
          ],
        })
      );
      i++;
      continue;
    }

    // 6. 普通段落（带首行缩进与内联格式）
    elements.push(
      new Paragraph({
        spacing: { before: 60, after: 80 },
        indent: { firstLine: 480 }, // 首行缩进 2 汉字字符
        children: parseInlineFormatting(line),
      })
    );

    i++;
  }

  return elements;
}

/**
 * 解析行内粗体与关键标签（如 **粗体**）
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*.*?\*\*)/g);

  for (const part of parts) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**")) {
      const clean = part.slice(2, -2);
      runs.push(
        new TextRun({
          text: clean,
          font: FONT_SONGTI,
          size: 24, // 12pt 小四
          bold: true,
          color: "0F172A",
        })
      );
    } else {
      runs.push(
        new TextRun({
          text: part,
          font: FONT_FANGSONG,
          size: 24, // 12pt 小四
          color: "1F2937",
        })
      );
    }
  }

  return runs;
}

/**
 * 解析 Markdown 表格为 Word 实体表格 (Table)
 */
function parseMarkdownTable(lines: string[]): Table | null {
  if (lines.length < 2) return null;

  // 过滤出真正包含内容的数据行（跳过 |---| 分隔线行）
  const dataLines: string[][] = [];
  let colCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    // 判断是否是分隔行
    if (raw.replace(/[|\s-:]/g, "").length === 0) {
      continue;
    }

    const cells = raw
      .split("|")
      .map((c) => c.trim())
      .slice(1, -1); // 去除首尾空元素

    if (cells.length === 0) continue;
    if (colCount === 0) colCount = cells.length;

    dataLines.push(cells);
  }

  if (dataLines.length === 0 || colCount === 0) return null;

  const headerData = dataLines[0];
  const bodyData = dataLines.slice(1);

  const colWidthPct = Math.floor(100 / colCount);

  const tableRows: TableRow[] = [];

  // 1. 表头行
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: headerData.map((cellText) => {
        return new TableCell({
          width: { size: colWidthPct, type: WidthType.PERCENTAGE },
          shading: { fill: "E2E8F0" }, // 浅灰蓝表头底色
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100, after: 100 },
              children: [
                new TextRun({
                  text: cellText,
                  font: FONT_HEITI,
                  size: 22, // 11pt
                  bold: true,
                  color: "0F172A",
                }),
              ],
            }),
          ],
        });
      }),
    })
  );

  // 2. 数据行
  bodyData.forEach((rowCells, rIdx) => {
    // 补齐列数
    while (rowCells.length < colCount) {
      rowCells.push("");
    }

    const bgFill = rIdx % 2 === 1 ? "F8FAFC" : "FFFFFF"; // 斑马纹交替底色

    tableRows.push(
      new TableRow({
        children: rowCells.map((cellText) => {
          // 根据内容判断居中或居左（短文字/数字居中，长句居左）
          const isShort = cellText.length <= 8;
          return new TableCell({
            width: { size: colWidthPct, type: WidthType.PERCENTAGE },
            shading: { fill: bgFill },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            },
            children: [
              new Paragraph({
                alignment: isShort ? AlignmentType.CENTER : AlignmentType.LEFT,
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: cellText,
                    font: FONT_SONGTI,
                    size: 20, // 10pt
                    color: "1E293B",
                  }),
                ],
              }),
            ],
          });
        }),
      })
    );
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    alignment: AlignmentType.CENTER,
    rows: tableRows,
  });
}

/**
 * 格式化为公文标准中文日期（例如：2026年09月16日）
 */
function formatChineseDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}年${month}月${day}日`;
}
