"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  ScaleIcon,
  XMarkIcon,
  TrashIcon,
  ArrowRightIcon,
} from "@/components/icons";
import { tenderTypeLabel, tenderTypeColor } from "@/lib/constants";

export interface CompareTrayItem {
  id: number;
  title: string;
  type: string;
  budgetAmount: number | null;
}

const STORAGE_KEY = "tb_compare_tenders";
const MAX_ITEMS = 4;

let listeners: Array<() => void> = [];

// useSyncExternalStore 要求 getSnapshot/getServerSnapshot 在通知之间返回稳定引用，
// 否则触发 React "should be cached" 无限循环保护导致整页水合崩溃
const EMPTY_ITEMS: CompareTrayItem[] = [];
let snapshot: CompareTrayItem[] = EMPTY_ITEMS;
let snapshotDirty = true;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

export function getCompareTrayItems(): CompareTrayItem[] {
  if (typeof window === "undefined") return EMPTY_ITEMS;
  if (snapshotDirty) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      snapshot = raw ? (JSON.parse(raw) as CompareTrayItem[]) : EMPTY_ITEMS;
    } catch {
      snapshot = EMPTY_ITEMS;
    }
    snapshotDirty = false;
  }
  return snapshot;
}

export function saveCompareTrayItems(items: CompareTrayItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
    snapshotDirty = true;
    window.dispatchEvent(new CustomEvent("tb-compare-change"));
    emitChange();
  } catch (e) {
    console.error("Failed to save compare items", e);
  }
}

export function subscribeCompareTray(callback: () => void) {
  listeners.push(callback);
  const handleCustom = () => {
    snapshotDirty = true;
    callback();
  };
  const handleStorage = () => {
    snapshotDirty = true;
    callback();
  };
  window.addEventListener("tb-compare-change", handleCustom);
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners = listeners.filter((l) => l !== callback);
    window.removeEventListener("tb-compare-change", handleCustom);
    window.removeEventListener("storage", handleStorage);
  };
}

export function toggleTenderCompare(item: CompareTrayItem): boolean {
  const current = getCompareTrayItems();
  const exists = current.some((c) => c.id === item.id);
  if (exists) {
    saveCompareTrayItems(current.filter((c) => c.id !== item.id));
    return false;
  } else {
    if (current.length >= MAX_ITEMS) {
      alert(`最多同时对比 ${MAX_ITEMS} 个标段，请先移除已有对比项。`);
      return false;
    }
    saveCompareTrayItems([...current, item]);
    return true;
  }
}

export default function TenderCompareTray() {
  const items = useSyncExternalStore(
    subscribeCompareTray,
    getCompareTrayItems,
    () => EMPTY_ITEMS
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  if (items.length === 0) return null;

  const handleRemove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = items.filter((i) => i.id !== id);
    saveCompareTrayItems(next);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    saveCompareTrayItems([]);
  };

  const handleStartCompare = () => {
    const ids = items.map((i) => i.id).join(",");
    router.push(`/tenders/compare?ids=${ids}`);
  };

  return (
    <aside
      aria-label="标讯商机对比托盘"
      className="fixed right-6 bottom-6 z-40 print:hidden transition-all duration-300"
    >
      {/* 展开的浮动托盘卡片 */}
      {isExpanded ? (
        <div className="w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-primary">
                <ScaleIcon className="h-4 w-4" />
              </div>
              <span className="font-bold text-xs text-slate-900">
                标讯对比托盘 ({items.length}/{MAX_ITEMS})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleClear}
                title="清空对比栏"
                className="cursor-pointer text-slate-400 hover:text-rose-600 p-1 transition-colors"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsExpanded(false)}
                title="收起"
                className="cursor-pointer text-slate-400 hover:text-slate-600 p-1"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* 标段卡片列表 */}
          <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
            {items.map((it) => (
              <div
                key={it.id}
                className="group relative flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 text-xs hover:border-blue-200 hover:bg-blue-50/40 transition-all"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`rounded px-1.5 py-0.2 text-[10px] font-medium ring-1 ring-inset ${tenderTypeColor(
                        it.type
                      )}`}
                    >
                      {tenderTypeLabel(it.type)}
                    </span>
                    {it.budgetAmount ? (
                      <span className="font-bold text-primary tnum text-[11px]">
                        {it.budgetAmount} 万元
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">未标明预算</span>
                    )}
                  </div>
                  <p className="font-medium text-slate-900 truncate leading-tight" title={it.title}>
                    {it.title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleRemove(it.id, e)}
                  title="移除此项"
                  className="cursor-pointer text-slate-400 hover:text-rose-600 p-1 transition-colors shrink-0"
                >
                  <XMarkIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          {/* 底部启动对比按钮 */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-500">
              {items.length < 2 ? "至少选择 2 项对比" : "横向评审已就绪"}
            </span>
            <button
              type="button"
              disabled={items.length < 2}
              onClick={handleStartCompare}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>开始横向比对</span>
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* 收起时的浮动胶囊气泡 */
        <button
          type="button"
          onClick={() => setIsExpanded(true)}
          className="cursor-pointer flex items-center gap-2.5 rounded-full bg-slate-900/90 text-white px-4 py-2.5 shadow-xl hover:bg-slate-900 transition-all hover:scale-105 border border-slate-700 backdrop-blur-md"
        >
          <ScaleIcon className="h-4 w-4 text-blue-400" />
          <span className="font-bold text-xs">
            标讯对比罗盘
          </span>
          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-extrabold tnum">
            {items.length}
          </span>
        </button>
      )}
    </aside>
  );
}
