"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  DocumentTextIcon,
  LockClosedIcon,
  CheckCircleIcon,
  BoltIcon,
} from "@/components/icons";

export interface AttachmentItem {
  id: number;
  name: string;
  sourceUrl: string;
  contentType?: string | null;
  size?: number | null;
  status: string;
}

interface Props {
  tenderId: number;
  attachments: AttachmentItem[];
  canViewAttachments: boolean;
  planName: string;
}

export default function TenderAttachmentsCard({
  attachments,
  canViewAttachments,
  planName,
}: Props) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  // 格式化文件大小
  const formatSize = (bytes?: number | null) => {
    if (!bytes) return "未知大小";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // 根据扩展名识别徽章样式
  const getFileBadge = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toUpperCase() || "FILE";
    if (ext === "PDF") {
      return { label: "PDF", style: "bg-red-50 text-red-700 border-red-200" };
    }
    if (ext === "DOC" || ext === "DOCX") {
      return { label: "DOC", style: "bg-blue-50 text-blue-700 border-blue-200" };
    }
    if (ext === "XLS" || ext === "XLSX") {
      return { label: "XLS", style: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    }
    if (ext === "ZIP" || ext === "RAR" || ext === "7Z") {
      return { label: "ZIP", style: "bg-purple-50 text-purple-700 border-purple-200" };
    }
    return { label: ext, style: "bg-slate-100 text-slate-700 border-slate-200" };
  };

  const handleDownload = (id: number) => {
    setDownloadingId(id);
    const link = document.createElement("a");
    link.href = `/api/attachments/${id}/download`;
    link.setAttribute("download", "");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      setDownloadingId(null);
    }, 2500);
  };

  if (attachments.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs transition-all">
      {/* 头部标题与特权指示 */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-6 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-white shadow-xs">
            <DocumentTextIcon className="h-4.5 w-4.5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">标书附件与采购清单安全存管中心</h3>
              <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-primary">
                共 {attachments.length} 份文件
              </span>
            </div>
            <p className="text-xs text-slate-500">
              包含官方发布之招标文件、答疑澄清、图纸及工程量采购清单
            </p>
          </div>
        </div>

        {canViewAttachments ? (
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-100 bg-emerald-50/50 px-3 py-1 text-xs font-medium text-emerald-700">
            <CheckCircleIcon className="h-3.5 w-3.5 text-emerald-600" />
            <span>享有安全高速下载特权 ({planName})</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            <LockClosedIcon className="h-3.5 w-3.5 text-amber-600" />
            <span>铂金/企业特权锁定</span>
          </div>
        )}
      </div>

      {/* 文件条目列表 */}
      <div className="divide-y divide-slate-100 p-2 sm:p-4">
        {attachments.map((file) => {
          const badge = getFileBadge(file.name);
          return (
            <div
              key={file.id}
              className="flex flex-col gap-3 rounded-xl p-3 transition-colors duration-150 hover:bg-slate-50/80 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-xs font-extrabold shadow-2xs ${badge.style}`}
                >
                  {badge.label}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </h4>
                    {file.status === "STORED" ? (
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200 shrink-0">
                        已安全存管
                      </span>
                    ) : file.status === "FAILED" ? (
                      <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200 shrink-0">
                        源站异常/转存存管说明
                      </span>
                    ) : (
                      <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-primary border border-blue-200 shrink-0">
                        按需实时转存
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono">{formatSize(file.size)}</span>
                    <span>·</span>
                    <span className={file.status === "STORED" ? "text-emerald-600" : "text-slate-500"}>
                      {file.status === "STORED" ? "本地对象存储已就绪" : "会员触发时即时转存"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 shrink-0">
                {canViewAttachments ? (
                  <button
                    disabled={downloadingId === file.id}
                    onClick={() => handleDownload(file.id)}
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary-strong transition-colors disabled:opacity-50"
                  >
                    <BoltIcon className="h-3.5 w-3.5" />
                    <span>
                      {downloadingId === file.id
                        ? file.status === "STORED"
                          ? "极速传输中..."
                          : "正在拉取转存..."
                        : file.status === "STORED"
                        ? "秒级极速下载"
                        : "按需转存下载"}
                    </span>
                  </button>
                ) : (
                  <Link
                    href="/pricing"
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-2xs hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800 transition-colors"
                  >
                    <LockClosedIcon className="h-3.5 w-3.5 text-amber-600" />
                    <span>升级解锁下载</span>
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 免费版付费墙引导 */}
      {!canViewAttachments && (
        <div className="border-t border-slate-100 bg-gradient-to-b from-transparent to-amber-50/40 p-4">
          <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <LockClosedIcon className="h-4 w-4" />
              </span>
              <div>
                <h5 className="text-xs font-bold text-amber-900">
                  招标文件与采购清单下载受套餐权益保护
                </h5>
                <p className="mt-0.5 text-xs text-amber-800/80">
                  铂金会员支持每日极速下载招标文件原件、工程量清单及答疑答复附件
                </p>
              </div>
            </div>
            <Link
              href="/pricing"
              className="cursor-pointer shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition-all"
            >
              升级铂金/企业会员解锁
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
