import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { AttachmentMeta } from "./extraction";

export interface FidelityOptions {
  contentSelector?: string;
  removeSelector?: string;
  baseUrl: string;
  maxHtmlLen?: number;
  maxContentLen?: number;
}

export interface FidelityResult {
  fidelityHtml: string;
  plainText: string;
  attachments: AttachmentMeta[];
}

const DEFAULT_MAX_HTML_LEN = 500_000;
const DEFAULT_MAX_CONTENT_LEN = 100_000;

const DANGEROUS_TAGS = [
  "script",
  "noscript",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "applet",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "meta",
  "svg",
  "canvas",
];

const ALLOWED_ATTRIBUTES_COMMON = new Set(["style", "class", "id", "title", "dir", "align"]);
const ALLOWED_ATTRIBUTES_A = new Set(["href", "title", "target", "rel", "download", "style", "class", "id"]);
const ALLOWED_ATTRIBUTES_IMG = new Set(["src", "alt", "title", "width", "height", "loading", "style", "class", "id", "align"]);
const ALLOWED_ATTRIBUTES_TABLE = new Set([
  "border",
  "cellpadding",
  "cellspacing",
  "width",
  "height",
  "align",
  "valign",
  "bgcolor",
  "colspan",
  "rowspan",
  "style",
  "class",
  "id",
]);

/**
 * Standard Scoped CSS for Official Bidding Documents
 * Ensures faithful rendering for tables, headers, and spacing even when source external CSS is absent.
 */
export const DOCUMENT_SCAFFOLD_CSS = `
<style data-scaffold="fidelity-document">
.tb-fidelity-root {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
  color: #1e293b;
  line-height: 1.85;
  font-size: 15px;
  word-break: break-word;
  overflow-wrap: break-word;
  -webkit-font-smoothing: antialiased;
}
.tb-fidelity-root * {
  box-sizing: border-box;
}
.tb-fidelity-root p,
.tb-fidelity-root div:not([class*="table"]):not([class*="grid"]) {
  margin-top: 0.6em;
  margin-bottom: 0.6em;
  line-height: 1.85;
}
.tb-fidelity-root h1, .tb-fidelity-root h2, .tb-fidelity-root h3, .tb-fidelity-root h4 {
  font-weight: 700;
  color: #0f172a;
  margin-top: 1.2em;
  margin-bottom: 0.6em;
  line-height: 1.4;
}
.tb-fidelity-root h1 { font-size: 1.5rem; text-align: center; }
.tb-fidelity-root h2 { font-size: 1.25rem; }
.tb-fidelity-root h3 { font-size: 1.1rem; }
.tb-fidelity-root table {
  border-collapse: collapse !important;
  border-spacing: 0 !important;
  width: 100% !important;
  max-width: 100% !important;
  margin: 1.2em 0 !important;
  border: 1px solid #cbd5e1 !important;
  background-color: #ffffff;
}
.tb-fidelity-root td,
.tb-fidelity-root th {
  border: 1px solid #cbd5e1 !important;
  padding: 8px 12px !important;
  font-size: 13.5px;
  line-height: 1.5;
  vertical-align: middle;
}
.tb-fidelity-root th {
  background-color: #f8fafc !important;
  font-weight: 600;
  color: #334155;
}
.tb-fidelity-root tr:hover td {
  background-color: #fcfdfe;
}
.tb-fidelity-root img {
  max-width: 100% !important;
  height: auto !important;
  display: inline-block;
  margin: 10px auto;
  border-radius: 4px;
}
.tb-fidelity-root a {
  color: #2563eb !important;
  text-decoration: underline !important;
  text-underline-offset: 3px;
  transition: color 0.15s ease;
}
.tb-fidelity-root a:hover {
  color: #1d4ed8 !important;
}
.tb-fidelity-root ul, .tb-fidelity-root ol {
  padding-left: 2em;
  margin: 0.8em 0;
}
.tb-fidelity-root li {
  margin: 0.3em 0;
}
</style>
`.trim();

/**
 * Resolve a relative URL to an absolute URL safely.
 */
export function resolveAbsoluteUrl(rawUrl: string, baseUrl: string): string | null {
  if (!rawUrl) return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("javascript:") || trimmed.startsWith("vbscript:")) {
    return null;
  }
  if (trimmed.startsWith("data:image/")) {
    return trimmed; // safe inline image data URI
  }
  try {
    const parsed = new URL(trimmed, baseUrl);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    // invalid URL format
  }
  return null;
}

/**
 * Extract attachments from HTML content.
 */
function extractAttachmentsFromCheerio(
  $target: cheerio.Cheerio<AnyNode>,
  baseUrl: string,
  $: cheerio.CheerioAPI,
): AttachmentMeta[] {
  const attachments: AttachmentMeta[] = [];
  const seenUrls = new Set<string>();

  const ATTACHMENT_PATTERN = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|csv|wps|et)(?:\?.*)?$/i;

  $target.find("a[href]").each((_, el) => {
    const rawHref = $(el).attr("href");
    if (!rawHref) return;

    const absUrl = resolveAbsoluteUrl(rawHref, baseUrl);
    if (!absUrl) return;

    const text = $(el).text().replace(/\s+/g, " ").trim();
    const isAttachmentUrl = ATTACHMENT_PATTERN.test(absUrl);
    const isAttachmentText = /附件|招标文件|采购文件|下载|清单|说明书|资格预审/.test(text);

    if ((isAttachmentUrl || isAttachmentText) && !seenUrls.has(absUrl)) {
      seenUrls.add(absUrl);
      const urlFileName = absUrl.split("/").pop()?.split("?")[0] || "";
      const name = text.length > 2 && text.length < 100 ? text : decodeURIComponent(urlFileName) || "附件";

      attachments.push({
        name,
        sourceUrl: absUrl,
      });
    }
  });

  return attachments;
}

/**
 * Extracts high fidelity HTML from page while preserving layout, tables, styles and images.
 */
export function extractFidelityHtml(html: string, options: FidelityOptions): FidelityResult {
  const $ = cheerio.load(html);
  const maxHtmlLen = options.maxHtmlLen ?? DEFAULT_MAX_HTML_LEN;
  const maxContentLen = options.maxContentLen ?? DEFAULT_MAX_CONTENT_LEN;

  // 1. Target container selection
  let target = options.contentSelector ? $(options.contentSelector).first() : null;

  if (!target || target.length === 0) {
    const fallbackSelectors = [
      "article",
      ".article-content",
      ".content",
      "#content",
      ".detail-content",
      ".vF_detail_content",
      "#noticeContent",
      ".notice-content",
      ".main-content",
      "body",
    ];
    for (const selector of fallbackSelectors) {
      const el = $(selector).first();
      if (el && el.length > 0 && el.text().trim().length > 30) {
        target = el;
        break;
      }
    }
  }

  if (!target || target.length === 0) {
    const fallbackPlain = $("body").text().replace(/\s{3,}/g, "\n").trim().slice(0, maxContentLen);
    return {
      fidelityHtml: `<div class="tb-fidelity-root"><p>${fallbackPlain.replace(/\n+/g, "</p><p>")}</p></div>`,
      plainText: fallbackPlain,
      attachments: [],
    };
  }

  const container = target.clone();

  // 2. Remove dangerous and noise tags
  container.find(DANGEROUS_TAGS.join(",")).remove();

  // Also remove user-configured noise selectors if provided, but DO NOT delete style if user specified "script, style" blindly
  if (options.removeSelector) {
    const selectors = options.removeSelector
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !["style", "table", "td", "tr", "th", "p", "div", "span"].includes(s.toLowerCase()));

    if (selectors.length > 0) {
      try {
        container.find(selectors.join(",")).remove();
      } catch {
        // ignore invalid custom selector
      }
    }
  }

  // 3. Process all elements with visual attribute whitelist and URL normalization
  container.find("*").each((_, node) => {
    const el = $(node);
    const tagName = node.tagName ? node.tagName.toLowerCase() : "";
    const attrs = el.attr() ?? {};

    // Select allowed attribute set
    let allowedAttrs = ALLOWED_ATTRIBUTES_COMMON;
    if (tagName === "a") {
      allowedAttrs = ALLOWED_ATTRIBUTES_A;
    } else if (tagName === "img") {
      allowedAttrs = ALLOWED_ATTRIBUTES_IMG;
    } else if (["table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "col", "colgroup"].includes(tagName)) {
      allowedAttrs = ALLOWED_ATTRIBUTES_TABLE;
    }

    // Strip unallowed or dangerous attributes
    for (const attrName of Object.keys(attrs)) {
      const lowerAttr = attrName.toLowerCase();
      // Block all inline event handlers (onload, onclick, etc.) and unallowed attributes
      if (lowerAttr.startsWith("on") || !allowedAttrs.has(lowerAttr)) {
        el.removeAttr(attrName);
      }
    }

    // Rewrite URLs
    if (tagName === "img") {
      const rawSrc = el.attr("src");
      if (rawSrc) {
        const absSrc = resolveAbsoluteUrl(rawSrc, options.baseUrl);
        if (absSrc) {
          el.attr("src", absSrc);
          el.attr("loading", "lazy");
        } else {
          el.remove(); // remove broken or unsafe image
        }
      } else {
        el.remove();
      }
    } else if (tagName === "a") {
      const rawHref = el.attr("href");
      if (rawHref) {
        const absHref = resolveAbsoluteUrl(rawHref, options.baseUrl);
        if (absHref) {
          el.attr("href", absHref);
          el.attr("target", "_blank");
          el.attr("rel", "noopener noreferrer");
        } else {
          el.removeAttr("href");
        }
      }
    }

    // Sanitize inline style attribute to prevent expression() or javascript: in CSS
    const rawStyle = el.attr("style");
    if (rawStyle) {
      if (/expression|javascript:|behavior|vbscript:/i.test(rawStyle)) {
        el.removeAttr("style");
      }
    }
  });

  // 4. Extract attachments before table conversion
  const attachments = extractAttachmentsFromCheerio(container, options.baseUrl, $);

  // 5. Generate high-fidelity HTML wrapped with scaffold CSS
  const rawBodyHtml = (container.html() ?? "").trim();
  const fidelityHtml = `${DOCUMENT_SCAFFOLD_CSS}\n<div class="tb-fidelity-root">\n${rawBodyHtml}\n</div>`.slice(0, maxHtmlLen);

  // 6. Generate rich plain text while preserving table cells
  const plainTextContainer = container.clone();

  // Convert tables to clean formatted text blocks rather than deleting them
  plainTextContainer.find("table").each((_, tbl) => {
    const $tbl = $(tbl);
    const rowTexts: string[] = [];

    $tbl.find("tr").each((__, row) => {
      const cells: string[] = [];
      $(row)
        .find("th, td")
        .each((___, cell) => {
          const cellText = $(cell).text().replace(/\s+/g, " ").trim();
          if (cellText) cells.push(cellText);
        });
      if (cells.length > 0) {
        rowTexts.push(cells.join(" | "));
      }
    });

    if (rowTexts.length > 0) {
      $tbl.replaceWith(`\n[表格开始]\n${rowTexts.join("\n")}\n[表格结束]\n`);
    } else {
      $tbl.remove();
    }
  });

  plainTextContainer.find("a").each((_, a) => {
    $(a).replaceWith($(a).text());
  });
  plainTextContainer.find("br").replaceWith("\n");
  plainTextContainer.find("p, div, li, h1, h2, h3, h4, h5, h6, section, article").append("\n");

  const plainText = plainTextContainer
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxContentLen);

  return {
    fidelityHtml,
    plainText,
    attachments,
  };
}
