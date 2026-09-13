"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { trackRegionAction, untrackRegionAction } from "@/app/actions/region";
import { RadarIcon, CheckIcon } from "@/components/icons";

interface Props {
  provinceCode: string;
  provinceName: string;
  initialIsWatched: boolean;
  isLoggedIn: boolean;
  canTrack: boolean;
}

export default function RegionTrackButton({
  provinceCode,
  provinceName,
  initialIsWatched,
  isLoggedIn,
  canTrack,
}: Props) {
  const router = useRouter();
  const [isWatched, setIsWatched] = useState(initialIsWatched);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (!isLoggedIn) {
      router.push(`/login?next=/regions/${provinceCode}`);
      return;
    }

    if (!canTrack) {
      alert("当前套餐订阅配额已用尽或不支持区域监控，请升级白金版或企业版套餐");
      router.push("/pricing");
      return;
    }

    startTransition(async () => {
      if (isWatched) {
        const res = await untrackRegionAction(provinceCode);
        if (res.success) {
          setIsWatched(false);
        } else {
          alert(res.error || "取消订阅失败");
        }
      } else {
        const res = await trackRegionAction(provinceCode);
        if (res.success) {
          setIsWatched(true);
        } else {
          alert(res.error || "订阅失败");
        }
      }
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold shadow-xs transition duration-150 cursor-pointer ${
        isWatched
          ? "border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "bg-primary text-white hover:bg-primary-strong"
      } ${isPending ? "opacity-60 cursor-wait" : ""}`}
      title={
        isWatched
          ? "已开启该战区商机监控，点击取消"
          : `订阅${provinceName}招投标商机，最新项目自动推送企微/钉钉/飞书群`
      }
    >
      {isWatched ? (
        <>
          <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
          <span>已关注此战区</span>
        </>
      ) : (
        <>
          <RadarIcon className="h-3.5 w-3.5" />
          <span>关注{provinceName}战区</span>
        </>
      )}
    </button>
  );
}
