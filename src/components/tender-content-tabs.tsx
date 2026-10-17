"use client";

import { useState, useEffect } from "react";
import { SparklesIcon, DocumentTextIcon } from "@/components/icons";

interface TenderContentTabsProps {
  summaryContent: React.ReactNode;
  originalContent: React.ReactNode;
  defaultTab?: "summary" | "original";
  hasOriginalHtml?: boolean;
}

export function TenderContentTabs({
  summaryContent,
  originalContent,
  defaultTab = "summary",
  hasOriginalHtml = true,
}: TenderContentTabsProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "original">(() => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#original") return "original";
      if (hash === "#summary") return "summary";
    }
    return defaultTab;
  });

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === "#original") {
        setActiveTab("original");
      } else if (hash === "#summary") {
        setActiveTab("summary");
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  const handleTabChange = (tab: "summary" | "original") => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      history.replaceState(null, "", `#${tab}`);
    }
  };

  return (
    <div className="space-y-0">
      {/* 选项卡导航切换条 */}
      <div className="border-b border-slate-200 bg-slate-50/60 px-6 pt-3.5 print:hidden">
        <div className="flex items-center justify-between gap-4">
          <nav className="-mb-px flex space-x-2" aria-label="Tabs">
            <button
              type="button"
              onClick={() => handleTabChange("summary")}
              className={`cursor-pointer group inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                activeTab === "summary"
                  ? "border-primary text-primary bg-white/80 rounded-t-xl shadow-2xs"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  activeTab === "summary"
                    ? "bg-primary/10 text-primary"
                    : "bg-slate-200/60 text-slate-500 group-hover:bg-slate-200"
                }`}
              >
                <SparklesIcon className="h-3.5 w-3.5" />
              </span>
              <span>一页纸速览</span>
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  activeTab === "summary"
                    ? "bg-primary/10 text-primary font-bold"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                智能结构化
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleTabChange("original")}
              className={`cursor-pointer group inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-all duration-150 ${
                activeTab === "original"
                  ? "border-primary text-primary bg-white/80 rounded-t-xl shadow-2xs"
                  : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
              }`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                  activeTab === "original"
                    ? "bg-primary/10 text-primary"
                    : "bg-slate-200/60 text-slate-500 group-hover:bg-slate-200"
                }`}
              >
                <DocumentTextIcon className="h-3.5 w-3.5" />
              </span>
              <span>原文展示</span>
              <span
                className={`ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  activeTab === "original"
                    ? "bg-emerald-100 text-emerald-800 font-bold"
                    : "bg-slate-200/70 text-slate-600"
                }`}
              >
                {hasOriginalHtml ? "1:1 高保真" : "原样内容"}
              </span>
            </button>
          </nav>

          <div className="hidden sm:flex items-center text-xs text-slate-500 pb-2">
            <span>
              当前视图：
              <strong className="text-slate-800">
                {activeTab === "summary" ? "AI 标书速读 + 分类要素" : "官方源网页排版快照"}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* 选项卡内容区 */}
      <div className="divide-y divide-slate-100">
        <div className={activeTab === "summary" ? "block" : "hidden"}>
          {summaryContent}
        </div>
        <div className={activeTab === "original" ? "block" : "hidden"}>
          {originalContent}
        </div>
      </div>
    </div>
  );
}
