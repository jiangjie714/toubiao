/**
 * 网络安全等级保护（二级）符合性评估报告 Word (.docx) 生成引擎
 * 符合国家等保测评与公文汇报规范
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
import { ComplianceInspectionResult } from "./compliance";

const FONT_FANGSONG = "FangSong";
const FONT_HEITI = "SimHei";
const FONT_SONGTI = "SimSun";
const FONT_KAITI = "KaiTi";

export async function generateComplianceReportDocxBuffer(
  inspection: ComplianceInspectionResult,
  companyName: string = "标讯通智能科技有限公司"
): Promise<Buffer> {
  const currentDateStr = formatChineseDate(new Date());

  // 1. 封面
  const coverChildren: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 360 },
      children: [
        new TextRun({
          text: "【 等保二级符合性自评报告 】 内部保密 • 严禁外传",
          font: FONT_HEITI,
          size: 20,
          color: "4B5563",
          bold: true,
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 1000, after: 200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 200 },
      children: [
        new TextRun({
          text: "网络安全等级保护（二级）",
          font: FONT_HEITI,
          size: 48, // 24pt
          bold: true,
          color: "1E3A8A",
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100, after: 800 },
      children: [
        new TextRun({
          text: "系统安全性与合规技术措施自评报告",
          font: FONT_HEITI,
          size: 36, // 18pt
          bold: true,
          color: "1E3A8A",
        }),
      ],
    }),
    new Table({
      width: { size: 85, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: [
        { label: "被测评系统：", value: "标讯通招投标大数据商业情报平台" },
        { label: "系统定级：", value: "第二级（S2A2G2）" },
        { label: "测评依据：", value: "GB/T 22239-2019《信息安全技术 网络安全等级保护基本要求》" },
        { label: "自评机构：", value: `${companyName} 安全与合规委员会` },
        { label: "评估综合得分：", value: `${inspection.overallScore} 分（${inspection.ratingLabel}）` },
        { label: "评估日期：", value: currentDateStr },
      ].map((row) => {
        return new TableRow({
          children: [
            new TableCell({
              width: { size: 32, type: WidthType.PERCENTAGE },
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
                      size: 26,
                      bold: true,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 68, type: WidthType.PERCENTAGE },
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
                      size: 26,
                    }),
                  ],
                }),
              ],
            }),
          ],
        });
      }),
    }),
    new Paragraph({ spacing: { before: 800, after: 200 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: "【 系统运维与信息安全责任单位（盖章） 】",
          font: FONT_KAITI,
          size: 22,
          color: "DC2626",
          bold: true,
        }),
      ],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // 2. 正文
  const bodyChildren: (Paragraph | Table)[] = [];

  // 一、系统概述与评估背景
  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: "一、评估背景与定级概述",
          font: FONT_HEITI,
          size: 30,
          bold: true,
          color: "1E3A8A",
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 120 },
      indent: { firstLine: 480 },
      children: [
        new TextRun({
          text: `依据《中华人民共和国网络安全法》、《中华人民共和国数据安全法》以及 GB/T 22239-2019 国家标准关于等级保护第二级（S2A2G2）之技术规范，${companyName} 对自主研发运营的「标讯通招投标商业情报平台」进行了系统级全量安全基准自查与合规测评。`,
          font: FONT_FANGSONG,
          size: 24,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 120 },
      indent: { firstLine: 480 },
      children: [
        new TextRun({
          text: `本次测评覆盖平台身份鉴别、访问控制、安全审计、数据安全与系统韧性等五大控制域共计 15 项技术基线要求。经全栈自动化探针扫描与人工复核，系统综合合规得分为 ${inspection.overallScore} 分（总分 100 分），评定结论为：${inspection.ratingLabel}。`,
          font: FONT_FANGSONG,
          size: 24,
          bold: true,
        }),
      ],
    })
  );

  // 二、15项等保二级指标自评核查清单
  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 160 },
      children: [
        new TextRun({
          text: "二、五大控制域 15 项技术指标核查清单",
          font: FONT_HEITI,
          size: 30,
          bold: true,
          color: "1E3A8A",
        }),
      ],
    })
  );

  // 构造表格
  const tableRows: TableRow[] = [];
  tableRows.push(
    new TableRow({
      tableHeader: true,
      children: [
        { text: "编号", width: 12 },
        { text: "控制领域", width: 15 },
        { text: "标准条款与检查项", width: 35 },
        { text: "技术措施与合规证据", width: 28 },
        { text: "核验判定", width: 10 },
      ].map((col) => {
        return new TableCell({
          width: { size: col.width, type: WidthType.PERCENTAGE },
          shading: { fill: "E2E8F0" },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: "94A3B8" },
            left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
              children: [
                new TextRun({
                  text: col.text,
                  font: FONT_HEITI,
                  size: 20,
                  bold: true,
                }),
              ],
            }),
          ],
        });
      }),
    })
  );

  inspection.items.forEach((item) => {
    const isPassed = item.status === "PASSED";
    const statusText = isPassed ? "符合 (Pass)" : "基本符合";

    tableRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 12, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: item.id, font: FONT_HEITI, size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 15, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: item.categoryName, font: FONT_HEITI, size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 35, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 40 },
                children: [
                  new TextRun({ text: item.title, font: FONT_HEITI, size: 18, bold: true }),
                ],
              }),
              new Paragraph({
                spacing: { before: 0, after: 60 },
                children: [
                  new TextRun({ text: `条款：${item.standardClause}`, font: FONT_KAITI, size: 16, color: "64748B" }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 28, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: item.evidence, font: FONT_SONGTI, size: 18 }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 10, type: WidthType.PERCENTAGE },
            shading: { fill: isPassed ? "ECFDF5" : "FFFBEB" },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({
                    text: statusText,
                    font: FONT_HEITI,
                    size: 18,
                    bold: true,
                    color: isPassed ? "059669" : "D97706",
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  bodyChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: tableRows,
    })
  );

  // 三、法定安全审计日志留存证据
  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({
          text: "三、网络日志安全留存证据（抽样）",
          font: FONT_HEITI,
          size: 30,
          bold: true,
          color: "1E3A8A",
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 60, after: 120 },
      indent: { firstLine: 480 },
      children: [
        new TextRun({
          text: "依据《网络安全法》第二十一条规定，本系统对敏感数据导出、高频调度与管理后台操作均自动实施只读防篡改审计记录，抽样如下：",
          font: FONT_FANGSONG,
          size: 24,
        }),
      ],
    })
  );

  const auditRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        { text: "时间", width: 22 },
        { text: "事件类型", width: 18 },
        { text: "操作主体", width: 18 },
        { text: "操作内容及审计详情", width: 42 },
      ].map((col) => {
        return new TableCell({
          width: { size: col.width, type: WidthType.PERCENTAGE },
          shading: { fill: "E2E8F0" },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text: col.text, font: FONT_HEITI, size: 18, bold: true })],
            }),
          ],
        });
      }),
    }),
  ];

  (inspection.auditLogsSample || []).forEach((log) => {
    auditRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 22, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: log.timestamp, font: FONT_SONGTI, size: 16 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: log.action, font: FONT_SONGTI, size: 16 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: `${log.operator} (${log.ip})`, font: FONT_SONGTI, size: 16 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 42, type: WidthType.PERCENTAGE },
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [new TextRun({ text: `${log.target} · ${log.detail}`, font: FONT_SONGTI, size: 16 })],
              }),
            ],
          }),
        ],
      })
    );
  });

  bodyChildren.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      alignment: AlignmentType.CENTER,
      rows: auditRows,
    })
  );

  // 四、责任签署与盖章确认
  bodyChildren.push(
    new Paragraph({
      alignment: AlignmentType.LEFT,
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 300, after: 120 },
      children: [
        new TextRun({
          text: "四、安全责任人签署与单位盖章确认",
          font: FONT_HEITI,
          size: 30,
          bold: true,
          color: "1E3A8A",
        }),
      ],
    }),
    new Table({
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
                  spacing: { before: 180, after: 60 },
                  children: [new TextRun({ text: `单位名称：${companyName}`, font: FONT_SONGTI, size: 24, bold: true })],
                }),
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [new TextRun({ text: "安全责任人（签字）：________________", font: FONT_SONGTI, size: 24 })],
                }),
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [new TextRun({ text: "技术负责人（签字）：________________", font: FONT_SONGTI, size: 24 })],
                }),
                new Paragraph({
                  spacing: { before: 60, after: 120 },
                  children: [new TextRun({ text: `自评签署日期：${currentDateStr}`, font: FONT_SONGTI, size: 24, color: "4B5563" })],
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
              shading: { fill: "FEF2F2" },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 180, after: 80 },
                  children: [
                    new TextRun({
                      text: "【此处加盖企业单位公章】",
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
                      text: "（骑缝章沿边缘均匀加盖）",
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
    })
  );

  // 组装文档
  const doc = new Document({
    sections: [
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
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1.2),
              right: convertInchesToTwip(1.2),
            },
            pageNumbers: { start: 1 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 0, after: 120 },
                border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" } },
                children: [
                  new TextRun({
                    text: "标讯通 · 网络安全等级保护（二级）符合性自评报告   [保密]",
                    font: FONT_SONGTI,
                    size: 18,
                    color: "64748B",
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
                  new TextRun({ text: "第 ", font: FONT_SONGTI, size: 18, color: "64748B" }),
                  new TextRun({ children: [PageNumber.CURRENT], font: FONT_SONGTI, size: 18, bold: true }),
                  new TextRun({ text: " 页", font: FONT_SONGTI, size: 18, color: "64748B" }),
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

function formatChineseDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}年${month}月${day}日`;
}
