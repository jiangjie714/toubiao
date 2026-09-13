"use client";

import { useState } from "react";
import { trackProjectAction, untrackProjectAction } from "@/app/actions/project";
import { RadarIcon, CheckIcon } from "@/components/icons";

export default function ProjectTrackButton({
  projectId,
  initialIsWatched = false,
}: {
  projectId: number;
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
        const res = await untrackProjectAction(projectId);
        if (res.success) {
          setIsWatched(false);
          setMsg("已取消跟踪");
        } else {
          setMsg(res.error || "操作失败");
        }
      } else {
        const res = await trackProjectAction(projectId);
        if (res.success) {
          setIsWatched(true);
          setMsg("已加入项目全生命周期雷达");
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
            <span>已跟踪该项目</span>
          </>
        ) : (
          <>
            <RadarIcon className="h-3.5 w-3.5 text-white" />
            <span>跟踪项目全周期动态</span>
          </>
        )}
      </button>
    </div>
  );
}
