"use client";

import React, { useEffect, useState } from "react";
import { ScaleIcon, CheckIcon } from "@/components/icons";
import {
  getCompareTrayItems,
  toggleTenderCompare,
  type CompareTrayItem,
} from "./tender-compare-tray";

interface Props {
  tender: CompareTrayItem;
  variant?: "list" | "detail";
}

export default function TenderCompareButton({ tender, variant = "list" }: Props) {
  const [isInCompare, setIsInCompare] = useState(false);

  useEffect(() => {
    const checkStatus = () => {
      const current = getCompareTrayItems();
      setIsInCompare(current.some((c) => c.id === tender.id));
    };

    checkStatus();
    window.addEventListener("tb-compare-change", checkStatus);
    window.addEventListener("storage", checkStatus);
    return () => {
      window.removeEventListener("tb-compare-change", checkStatus);
      window.removeEventListener("storage", checkStatus);
    };
  }, [tender.id]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const added = toggleTenderCompare(tender);
    setIsInCompare(added);
  };

  if (variant === "detail") {
    return (
      <button
        type="button"
        onClick={handleToggle}
        className={`cursor-pointer inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors print:hidden ${
          isInCompare
            ? "bg-blue-100 text-primary hover:bg-blue-200"
            : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
        }`}
        title={isInCompare ? "已加入对比托盘，点击移除" : "加入多标横向决策对比罗盘"}
      >
        {isInCompare ? (
          <>
            <CheckIcon className="h-3.5 w-3.5 text-primary" />
            <span>已在对比罗盘</span>
          </>
        ) : (
          <>
            <ScaleIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>加入对比</span>
          </>
        )}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`cursor-pointer inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors shrink-0 ${
        isInCompare
          ? "bg-blue-100 text-primary border border-blue-200 font-bold"
          : "text-slate-500 bg-slate-100 hover:bg-slate-200 hover:text-slate-700"
      }`}
      title={isInCompare ? "已加入标讯对比，点击取消" : "加入多标横向对比"}
    >
      <ScaleIcon className="h-3 w-3" />
      <span>{isInCompare ? "已对比" : "+ 对比"}</span>
    </button>
  );
}
