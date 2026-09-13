"use client";

import { useState } from "react";
import { trackPurchaserAction, untrackPurchaserAction } from "@/app/actions/purchaser";
import { RadarIcon, CheckIcon } from "@/components/icons";

export default function PurchaserTrackButton({
  purchaserName,
  initialIsWatched = false,
}: {
  purchaserName: string;
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
        const res = await untrackPurchaserAction(purchaserName);
        if (res.success) {
          setIsWatched(false);
          setMsg("已取消监控");
        } else {
          setMsg(res.error || "操作失败");
        }
      } else {
        const res = await trackPurchaserAction(purchaserName);
        if (res.success) {
          setIsWatched(true);
          setMsg("已加入买方监控雷达");
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
      {msg && <span className="text-xs text-blue-700 font-medium">{msg}</span>}
      <button
        onClick={handleToggle}
        disabled={pending}
        className={`cursor-pointer inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold shadow-xs transition-all ${
          isWatched
            ? "border border-blue-200 bg-blue-50 text-primary hover:bg-blue-100"
            : "border border-primary bg-primary text-white hover:bg-primary-strong"
        }`}
      >
        {isWatched ? (
          <>
            <CheckIcon className="h-3.5 w-3.5 text-primary" />
            <span>已加入买方雷达</span>
          </>
        ) : (
          <>
            <RadarIcon className="h-3.5 w-3.5 text-white" />
            <span>一键监控该买方</span>
          </>
        )}
      </button>
    </div>
  );
}
