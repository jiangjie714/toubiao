"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ExternalLinkIcon,
  PrinterIcon,
  DatabaseIcon,
  CheckCircleIcon,
  LockClosedIcon,
  SparklesIcon,
} from "@/components/icons";
import { formatJsonTenderContent, isJsonString } from "@/lib/tender-json-formatter";

interface TenderOriginalViewProps {
  contentHtml?: string | null;
  plainContent: string;
  sourceName: string;
  sourceUrl?: string | null;
  publishDate: string;
  canViewFullText: boolean;
  planName: string;
}

export function TenderOriginalView({
  contentHtml,
  plainContent,
  sourceName,
  sourceUrl,
  publishDate,
  canViewFullText,
  planName,
}: TenderOriginalViewProps) {
  const [fontSize, setFontSize] = useState<"sm" | "base" | "lg">("base");
  const [isExpanded, setIsExpanded] = useState(false);
  const [iframeHeight, setIframeHeight] = useState<number>(750);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fontPxMap = {
    sm: 14,
    base: 15.5,
    lg: 17.5,
  };

  // Listen to height messages from the sandboxed iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data && e.data.type === "TB_IFRAME_RESIZE" && typeof e.data.height === "number") {
        if (e.data.height > 200) {
          setIframeHeight(Math.ceil(e.data.height) + 30);
        }
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {
        // fallback
      }
    }
    window.print();
  };

  // 检查 contentHtml 或 plainContent 是否为结构化 JSON 并转为官方公文排版
  const contentHtmlIsJson = contentHtml ? isJsonString(contentHtml) : false;
  const plainIsJson = isJsonString(plainContent);
  const formattedFromJson =
    contentHtmlIsJson || (!contentHtml && plainIsJson)
      ? formatJsonTenderContent(contentHtmlIsJson ? contentHtml! : plainContent)
      : null;

  const hasUsableHtml = Boolean(contentHtml && !contentHtmlIsJson) || Boolean(formattedFromJson);
  const safeHtml = formattedFromJson ? formattedFromJson.htmlText : contentHtml || "";
  const displayHtml = canViewFullText ? safeHtml : safeHtml.slice(0, 1500);
  const displayPlainText = formattedFromJson ? formattedFromJson.plainText : plainContent;

  const srcDoc = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${sourceUrl ? `<base href="${sourceUrl}" target="_blank">` : ""}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
      font-size: ${fontPxMap[fontSize]}px;
      line-height: 1.85;
      -webkit-font-smoothing: antialiased;
      word-break: break-word;
      overflow-wrap: break-word;
    }
    body {
      padding: 24px 28px;
    }
    p, div:not([class*="table"]):not([class*="grid"]) {
      margin: 0.65em 0;
      line-height: 1.85;
    }
    h1, h2, h3, h4, h5, h6 {
      color: #0f172a;
      font-weight: 700;
      margin-top: 1.2em;
      margin-bottom: 0.6em;
      line-height: 1.4;
    }
    h1 { font-size: 1.5em; text-align: center; }
    h2 { font-size: 1.25em; }
    h3 { font-size: 1.1em; }
    table {
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      width: 100% !important;
      max-width: 100% !important;
      margin: 1.2em 0 !important;
      border: 1px solid #94a3b8 !important;
      background-color: #ffffff;
    }
    td, th {
      border: 1px solid #94a3b8 !important;
      padding: 8px 12px !important;
      font-size: 0.92em;
      line-height: 1.55;
      vertical-align: middle;
    }
    th {
      background-color: #f1f5f9 !important;
      font-weight: 600;
      color: #334155;
    }
    tr:hover td {
      background-color: #f8fafc;
    }
    img {
      max-width: 100% !important;
      height: auto !important;
      display: inline-block;
      margin: 10px auto;
      border-radius: 4px;
    }
    a {
      color: #2563eb !important;
      text-decoration: underline !important;
      text-underline-offset: 3px;
    }
    a:hover {
      color: #1d4ed8 !important;
    }
    ul, ol {
      padding-left: 2em;
      margin: 0.8em 0;
    }
    li {
      margin: 0.35em 0;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
  <script>
    function notifyParentHeight() {
      const height = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight
      );
      window.parent.postMessage({ type: "TB_IFRAME_RESIZE", height: height }, "*");
    }
    window.addEventListener("load", notifyParentHeight);
    window.addEventListener("resize", notifyParentHeight);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(notifyParentHeight).observe(document.body);
    }
    setTimeout(notifyParentHeight, 200);
    setTimeout(notifyParentHeight, 1000);
  </script>
</head>
<body>
  ${displayHtml}
</body>
</html>`;

  return (
    <div className={`transition-all duration-200 ${isExpanded ? "relative z-30" : ""}`}>
      {/* 顶部工具控制栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/80 px-6 py-3.5 text-xs text-slate-600 print:hidden">
        {/* 左侧：来源及存证快照标记 */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 border border-emerald-200">
            <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
            官方源网原版快照
          </span>
          <span className="inline-flex items-center gap-1 text-slate-500">
            <DatabaseIcon className="h-3.5 w-3.5" />
            数据源：<strong className="text-slate-700">{sourceName}</strong>
          </span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="hidden sm:inline text-slate-500 tnum">
            发布于 {publishDate}
          </span>
        </div>

        {/* 右侧：字号切换、打印、扩展及官方外链 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 字号缩放 */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setFontSize("sm")}
              className={`cursor-pointer rounded-md px-2 py-1 text-xs transition-colors ${
                fontSize === "sm"
                  ? "bg-slate-100 font-bold text-primary"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="小号字 (14px)"
            >
              A-
            </button>
            <button
              type="button"
              onClick={() => setFontSize("base")}
              className={`cursor-pointer rounded-md px-2 py-1 text-xs transition-colors ${
                fontSize === "base"
                  ? "bg-slate-100 font-bold text-primary"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="标准字 (15.5px)"
            >
              标准
            </button>
            <button
              type="button"
              onClick={() => setFontSize("lg")}
              className={`cursor-pointer rounded-md px-2 py-1 text-xs transition-colors ${
                fontSize === "lg"
                  ? "bg-slate-100 font-bold text-primary"
                  : "text-slate-600 hover:text-slate-900"
              }`}
              title="大号字 (17.5px)"
            >
              A+
            </button>
          </div>

          {/* 宽屏切换 */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            title={isExpanded ? "收起宽屏" : "宽屏沉浸查看"}
          >
            {isExpanded ? "常规宽度" : "宽屏模式"}
          </button>

          {/* 打印 */}
          <button
            type="button"
            onClick={handlePrint}
            className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            title="打印或另存为 PDF"
          >
            <PrinterIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>打印</span>
          </button>

          {/* 源站跳转 */}
          {sourceUrl && (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
              title="在官方源网站查看原文"
            >
              <span>访问官方源网页</span>
              <ExternalLinkIcon className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>

      {/* 原文主体展示区域 */}
      <div className="relative bg-white">
        {hasUsableHtml ? (
          <div className="relative w-full overflow-hidden">
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              title="官方公告原文"
              className="w-full border-none transition-all duration-150"
              style={{ height: `${iframeHeight}px`, minHeight: "500px" }}
              sandbox="allow-same-origin allow-popups"
            />
          </div>
        ) : (
          /* 历史旧数据降级展示 */
          <div className="p-8">
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              <p className="font-semibold">提示：本条历史公告在系统早期采集，未归档原始 HTML 快照。</p>
              <p className="mt-1">
                下方为您展示系统保留的排版纯文本；若需查阅带有官方印章与原始排版的文件，请点击上方
                {sourceUrl && (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-1 font-semibold text-primary underline"
                  >
                    「访问官方源网页」
                  </a>
                )}
                查看。
              </p>
            </div>
            <div className="prose max-w-none whitespace-pre-wrap leading-relaxed text-slate-800">
              {canViewFullText ? displayPlainText : `${displayPlainText.slice(0, 500)}…`}
            </div>
          </div>
        )}

        {/* 未解锁会员遮罩 */}
        {!canViewFullText && (
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center bg-gradient-to-t from-white via-white/95 to-white/60 p-8 pt-24 text-center print:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 shadow-xs mb-3">
              <LockClosedIcon className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              升级会员查看 1:1 官方原版公文与全量附件清单
            </h3>
            <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-600">
              您当前为【{planName}】。升级为黄金或铂金会员，即可畅享全国所有招采公告 1:1
              高保真原文快照、公章扫描件排版、专家打分表及采购需求明细。
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Link
                href="/pricing"
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong transition-colors"
              >
                <SparklesIcon className="h-4 w-4" />
                立即升级会员解锁
              </Link>
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  前往源网查看
                  <ExternalLinkIcon className="h-3.5 w-3.5 text-slate-400" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
