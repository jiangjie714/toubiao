"use client";

import { useState } from "react";
import { trackCompetitorAction, untrackCompetitorAction } from "@/app/actions/competitor";
import { RadarIcon, CheckIcon } from "@/components/icons";

export default function SupplierTrackButton({
  supplierName,
  initialIsWatched = false,
}: {
  supplierName: string;
  initialIsWatched?: boolean;
}) {
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const handleToggle = async () => {
    setPending(true);
    setMsg(null);
    try {
      if (isWatched) {
        const res = await untrackCompetitorAction(supplierName);
        if (res.success) {
          setIsWatched(false);
          setMsg("已取消关注");
        } else {
          setMsg(res.error || "操作失败");
        }
      } else {
        const res = await trackCompetitorAction(supplierName);
        if (res.success) {
          setIsWatched(true);
          setMsg("已加入监控雷达");
        } else {
          setMsg(res.error || "关注失败");
        }
      }
    } catch {
      setMsg("网络异常，请重试");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {msg && <span className="text-xs text-purple-700 font-medium">{msg}</span>}
      <button
        onClick={handleToggle}
        disabled={pending}
        className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition-all ${
          isWatched
            ? "border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
            : "border border-purple-600 bg-purple-600 text-white hover:bg-purple-700"
        }`}
      >
        {isWatched ? (
          <>
            <CheckIcon className="h-3.5 w-3.5 text-purple-600" />
            <span>已加入竞对雷达</span>
          </>
        ) : (
          <>
            <RadarIcon className="h-3.5 w-3.5 text-white" />
            <span>一键加入竞对雷达</span>
          </>
        )}
      </button>
    </div>
  );
}
