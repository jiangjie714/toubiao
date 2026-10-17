"use client";

import React, { useState } from "react";
import {
  DocumentTextIcon,
  XMarkIcon,
  CheckIcon,
  ClipboardIcon,
  SearchIcon,
} from "@/components/icons";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  attachmentName: string;
  fileType: string;
  extractedText?: string | null;
  snippet?: string | null;
  pageCount?: number | null;
}

export default function AttachmentPreviewModal({
  isOpen,
  onClose,
  attachmentName,
  fileType,
  extractedText,
  snippet,
  pageCount,
}: Props) {
  const [searchKeyword, setSearchKeyword] = useState("");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const content = extractedText || snippet || "该附件暂未完成深度文本提取，请点击直接下载查看原件。";

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 简单的划词高亮
  const renderHighlightedContent = () => {
    if (!searchKeyword.trim()) {
      return <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed">{content}</pre>;
    }

    const regex = new RegExp(`(${searchKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = content.split(regex);

    return (
      <div className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed">
        {parts.map((part, i) =>
          regex.test(part) ? (
            <mark key={i} className="bg-amber-200 text-amber-900 rounded px-1 font-bold">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative flex h-[85vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* 头部标题与控制栏 */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-primary">
              <DocumentTextIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
                  {fileType}
                </span>
                <h3 className="truncate text-sm font-bold text-slate-900">
                  {attachmentName}
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">
                免下载在线划词查阅 · {pageCount ? `共 ${pageCount} 页` : "已提取纯文本"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              type="button"
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
              title="复制提取的全文文本"
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-700 font-semibold">已复制</span>
                </>
              ) : (
                <>
                  <ClipboardIcon className="h-3.5 w-3.5 text-slate-500" />
                  <span>一键复制全文</span>
                </>
              )}
            </button>
            <button
              onClick={onClose}
              type="button"
              className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              title="关闭弹窗"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 搜索与工具栏 */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white px-6 py-2.5">
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              placeholder="在附件文本中搜索规格、型号或参数..."
              className="w-full pl-8 pr-3 py-1 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-primary transition"
            />
          </div>
          <span className="text-[11px] text-slate-400">
            支持针对数十兆招标文件进行毫秒级参数定位
          </span>
        </div>

        {/* 主体正文区 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            {renderHighlightedContent()}
          </div>
        </div>

        {/* 底部信息提示 */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-3 flex items-center justify-between text-xs text-slate-500">
          <span>提示：提取内容包含货物参数表、评分条款及资质门槛，可直接复制至应答文件。</span>
          <button
            onClick={onClose}
            type="button"
            className="cursor-pointer rounded-lg bg-slate-200 px-4 py-1.5 font-medium text-slate-700 hover:bg-slate-300 transition"
          >
            完成查阅
          </button>
        </div>
      </div>
    </div>
  );
}
