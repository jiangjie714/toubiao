"use client";

import { PrinterIcon } from "@/components/icons";

export default function PrintButton({ label = "打印 / 另存为 PDF 合同" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong transition cursor-pointer"
    >
      <PrinterIcon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}
