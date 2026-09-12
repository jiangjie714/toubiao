/**
 * 将招投标公告正文按中文公告的惯用结构（一、二、三…小节）解析为分类区块，
 * 便于详情页分类展示。解析不出结构时退回单一正文区块。
 */

import * as cheerio from "cheerio";

export type SectionKind = "project" | "requirement" | "time" | "contact" | "misc";

export type TenderTableCell = {
  text: string;
  header: boolean;
  colSpan?: number;
  rowSpan?: number;
};

export type TenderTable = {
  type: "table";
  rows: TenderTableCell[][];
};

export type TenderLink = {
  type: "link";
  href: string;
  label: string;
};

export type TenderParagraph = {
  type: "paragraph";
  text: string;
};

export type TenderContentBlock = TenderParagraph | TenderTable | TenderLink;

export type TenderSection = {
  kind: SectionKind;
  title: string;
  text: string;
  blocks: TenderContentBlock[];
};

const RULES: { kind: SectionKind; title: string; pattern: RegExp }[] = [
  {
    kind: "project",
    title: "项目信息",
    pattern:
      /项目编号|项目概况|项目基本情况|项目名称|采购需求|招标范围|采购内容|预算金额|最高限价|标的信息|招标条件|项目背景/,
  },
  {
    kind: "requirement",
    title: "资格与要求",
    pattern:
      /资格要求|资格条件|供应商资格|投标人资格|资质要求|资格审查|特定资格|响应供应商|资格审查方式/,
  },
  {
    kind: "time",
    title: "时间安排",
    pattern:
      /截止时间|截止日期|递交.{0,6}时间|开启时间|开标时间|评标时间|公告期限|公示期|获取招标文件|获取采购文件|获取.{0,4}文件|报名时间|响应文件递交|磋商时间/,
  },
  {
    kind: "contact",
    title: "联系方式",
    pattern:
      /联系方式|联系人|联系电话|电\s*话|传\s*真|电子邮箱|通讯地址|联系地址|质疑渠道|异议渠道/,
  },
];

const NUM_HEADING = /^([一二三四五六七八九十百]+|\d{1,2})[、.．]\s*\S/;
const PAREN_HEADING = /^[（(][一二三四五六七八九十百]+[)）]/;
const BARE_KEYWORD = /^(项目概况|项目基本情况|资格要求|资格条件|联系方式|时间安排|公告说明|采购需求|注意事项|其他补充事宜)[：:]?$/;

function isHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 2 || t.length > 30) return false;
  return NUM_HEADING.test(t) || PAREN_HEADING.test(t) || BARE_KEYWORD.test(t);
}

/**
 * 抓取的正文常把整篇公告挤在少量长行里（以空格分隔）。
 * 两刀补插换行恢复小节结构：序号标题之前、序号短标题之后。
 * 误切只会产生普通换行（行首无序号不构成标题），无实际危害。
 */
function normalize(content: string): string {
  return content
    .replace(/[ \t]+(?=[一二三四五六七八九十]{1,3}、)/g, "\n")
    .replace(/[ \t]+(?=[（(][一二三四五六七八九十]{1,3}[)）])/g, "\n")
    .replace(/([一二三四五六七八九十]{1,3}、[^\s：:]{2,15}[：:]?)[ \t]{2,}/g, "$1\n")
    .replace(/([（(][一二三四五六七八九十]{1,3}[)）][^\s：:]{2,15}[：:]?)[ \t]{2,}/g, "$1\n");
}

function parseTextSections(content: string): TenderSection[] {
  const chunks: { heading: string | null; text: string }[] = [];

  for (const line of normalize(content).split(/\r?\n/)) {
    if (isHeading(line)) {
      chunks.push({ heading: line.trim(), text: "" });
    } else if (line.trim()) {
      if (chunks.length === 0) chunks.push({ heading: null, text: "" });
      const last = chunks[chunks.length - 1];
      last.text += (last.text ? "\n" : "") + line.trim();
    }
  }

  const classified: TenderSection[] = chunks.map((c) => {
    // 先按小节标题归类，标题无匹配时再看正文开头
    const probe = (c.heading ?? "") + " " + c.text.slice(0, 60);
    const rule = RULES.find((r) => r.pattern.test(c.heading ?? "") || (c.heading === null && r.pattern.test(probe)));
    return {
      kind: rule?.kind ?? ("misc" as const),
      title: rule?.title ?? "公告说明",
      text: [c.heading, c.text].filter(Boolean).join("\n"),
      blocks: [{ type: "paragraph", text: [c.heading, c.text].filter(Boolean).join("\n") }],
    };
  });

  // 合并相邻同类区块
  const merged: TenderSection[] = [];
  for (const s of classified) {
    const last = merged[merged.length - 1];
    if (last && last.kind === s.kind) {
      last.text += "\n" + s.text;
      last.blocks.push({ type: "paragraph", text: s.text });
    } else merged.push({ ...s });
  }

  if (merged.length < 2) {
    const text = content.trim();
    return [{
      kind: "misc",
      title: "公告正文",
      text,
      blocks: [{ type: "paragraph", text }],
    }];
  }
  return merged;
}

function isHtmlContent(content: string): boolean {
  return /<\/?(?:a|p|div|table|tbody|thead|tr|td|th|ul|ol|li|span)\b/i.test(content);
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/[ \t]{2,}/g, " ").trim();
}

function parseTables($: cheerio.CheerioAPI): TenderTable[] {
  const tables: TenderTable[] = [];

  $("table")
    .filter((_, table) => $(table).parents("table").length === 0)
    .each((_, table) => {
      const rows: TenderTableCell[][] = [];

    $(table)
      .find("tr")
      .each((_, row) => {
        const cells: TenderTableCell[] = [];

        $(row)
          .children("td,th")
          .each((__, cell) => {
            const $cell = $(cell);
            const colSpan = Number.parseInt($cell.attr("colspan") ?? "", 10);
            const rowSpan = Number.parseInt($cell.attr("rowspan") ?? "", 10);

            cells.push({
              text: normalizeText($cell.text()),
              header: cell.tagName?.toLowerCase() === "th",
              ...(Number.isInteger(colSpan) && colSpan > 1 ? { colSpan } : {}),
              ...(Number.isInteger(rowSpan) && rowSpan > 1 ? { rowSpan } : {}),
            });
          });

          if (cells.length > 0) rows.push(cells);
        });

      if (rows.length > 0) tables.push({ type: "table", rows });
    });

  return tables;
}

function parseLinks($: cheerio.CheerioAPI, baseUrl?: string): TenderLink[] {
  const links: TenderLink[] = [];
  const seen = new Set<string>();

  $("a[href]").each((_, anchor) => {
    const $anchor = $(anchor);
    const rawHref = ($anchor.attr("href") ?? "").trim();
    if (!rawHref || rawHref.startsWith("#")) return;

    let href: URL;
    try {
      href = new URL(rawHref, baseUrl);
    } catch {
      return;
    }
    if (href.protocol !== "http:" && href.protocol !== "https:") return;

    const normalizedHref = href.toString();
    if (seen.has(normalizedHref)) return;
    seen.add(normalizedHref);

    links.push({
      type: "link",
      href: normalizedHref,
      label: normalizeText($anchor.text()) || normalizedHref,
    });
  });

  return links;
}

export function parseTenderSections(content: string, baseUrl?: string): TenderSection[] {
  if (!isHtmlContent(content)) return parseTextSections(content);

  const $ = cheerio.load(`<div>${content}</div>`);
  $("script,style,noscript,iframe,object,embed,form,input,button,select,textarea").remove();

  const tables = parseTables($);
  const links = parseLinks($, baseUrl);
  $("table").remove();
  $("a").each((_, anchor) => {
    $(anchor).replaceWith($(anchor).text());
  });
  $("br").replaceWith("\n");
  $("p,div,li,h1,h2,h3,h4,h5,h6,section,article,blockquote").append("\n");
  const text = normalizeText($("body").text());
  const sections = parseTextSections(text);

  if (tables.length > 0) {
    sections.push({
      kind: "misc",
      title: "报表信息",
      text: tables
        .map((table) => table.rows.map((row) => row.map((cell) => cell.text).join("\t")).join("\n"))
        .join("\n\n"),
      blocks: tables,
    });
  }

  if (links.length > 0) {
    sections.push({
      kind: "misc",
      title: "附件与相关链接",
      text: links.map((link) => `${link.label}: ${link.href}`).join("\n"),
      blocks: links,
    });
  }

  return sections;
}
