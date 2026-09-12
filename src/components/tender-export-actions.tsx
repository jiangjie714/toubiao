"use client";

import React, { useState } from "react";
import Link from "next/link";
import { PrinterIcon, DocumentTextIcon, LockClosedIcon } from "@/components/icons";

interface Props {
  tenderId: number;
  canExport: boolean;
}

export default function TenderExportActions({ tenderId, canExport }: Props) {
  const [isExportingWord, setIsExportingWord] = useState(false);

  // A4 打印 / 另存为 PDF
  const handlePrintPdf = () => {
    window.print();
  };

  // 导出 Word 立项评审简报
  const handleExportWord = () => {
    if (!canExport) return;
    setIsExportingWord(true);
    const link = document.createElement("a");
    link.href = `/api/tenders/${tenderId}/export/word`;
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      setIsExportingWord(false);
    }, 2500);
  };

  return (
    <div className="flex items-center gap-2 print:hidden">
      {/* 1. A4 打印 / 另存为 PDF 按钮 */}
      <button
        type="button"
        onClick={handlePrintPdf}
        className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        title="格式化排版并启动 A4 打印或保存为 PDF 归档"
      >
        <PrinterIcon className="h-3.5 w-3.5 text-slate-500" />
        <span>A4 打印 / PDF</span>
      </button>

      {/* 2. 导出立项评审 Word 简报 */}
      {canExport ? (
        <button
          type="button"
          disabled={isExportingWord}
          onClick={handleExportWord}
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary/90 transition-colors disabled:opacity-50"
          title="一键导出包含 AI 速读、机构联系人及正文的 Word 评审简报"
        >
          <DocumentTextIcon className="h-3.5 w-3.5" />
          <span>{isExportingWord ? "正在生成简报..." : "导出 Word 简报"}</span>
        </button>
      ) : (
        <Link
          href="/pricing"
          className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
          title="黄金会员及以上享受导出 Word 标书简报特权"
        >
          <LockClosedIcon className="h-3.5 w-3.5 text-amber-600" />
          <span>导出 Word (会员专享)</span>
        </Link>
      )}
    </div>
  );
}
