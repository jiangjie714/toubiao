"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  generateWechatBindQrAction,
  simulateBindWechatAction,
  unbindWechatAction,
  type WechatBindStatus,
} from "@/app/actions/wechat-bind";
import { CheckIcon } from "@/components/icons";

interface WechatBindModalProps {
  initialStatus: WechatBindStatus;
  onStatusChange?: (status: WechatBindStatus) => void;
}

export default function WechatBindModal({
  initialStatus,
  onStatusChange,
}: WechatBindModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localStatus, setLocalStatus] = useState<WechatBindStatus | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [isSimulation, setIsSimulation] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const status = localStatus ?? initialStatus;

  const handleOpen = () => {
    setIsOpen(true);
    setFeedback(null);
    startTransition(async () => {
      const res = await generateWechatBindQrAction();
      if (res.success && res.qrCodeDataUrl) {
        setQrCodeDataUrl(res.qrCodeDataUrl);
        setIsSimulation(res.isSimulation);
      } else {
        setFeedback(res.error || "获取微信绑定二维码失败");
      }
    });
  };

  const handleSimulateBind = () => {
    startTransition(async () => {
      const res = await simulateBindWechatAction();
      if (res.success) {
        const newStatus: WechatBindStatus = {
          ...status,
          isBound: true,
          maskedOpenId: "wx_mp_****demo",
        };
        setLocalStatus(newStatus);
        onStatusChange?.(newStatus);
        setFeedback("🎉 微信服务号已成功绑定！");
        setTimeout(() => {
          setIsOpen(false);
        }, 1500);
      } else {
        setFeedback(res.error || "模拟绑定失败");
      }
    });
  };

  const handleUnbind = () => {
    if (!confirm("确定要解绑微信服务号吗？解绑后将无法通过微信接收商机卡片。")) return;
    startTransition(async () => {
      const res = await unbindWechatAction();
      if (res.success) {
        const newStatus: WechatBindStatus = {
          ...status,
          isBound: false,
          maskedOpenId: null,
          wechatOpenId: null,
        };
        setLocalStatus(newStatus);
        onStatusChange?.(newStatus);
        setFeedback("已解除微信绑定");
      } else {
        setFeedback(res.error || "解绑失败");
      }
    });
  };

  return (
    <div>
      {status.isBound ? (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckIcon className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="font-semibold text-emerald-900">微信服务号已绑定</span>
              <span className="ml-1.5 font-mono text-[11px] text-emerald-600">
                ({status.maskedOpenId})
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleUnbind}
            disabled={isPending}
            className="text-[11px] text-slate-400 hover:text-red-600 transition underline"
          >
            解绑
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-800">
          <div className="flex items-center gap-1.5">
            <span>⚠️</span>
            <span>当前账号尚未绑定微信服务号</span>
          </div>
          <button
            type="button"
            onClick={handleOpen}
            className="rounded bg-primary px-2.5 py-1 text-[11px] font-medium text-white hover:bg-primary/90 transition shadow-2xs"
          >
            扫码绑定微信 →
          </button>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4 text-center">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span>💬</span> 绑定微信服务号接收商机
              </h3>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="mx-auto w-48 h-48 rounded-xl border border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden p-2 relative">
                {isPending && !qrCodeDataUrl ? (
                  <span className="text-xs text-slate-400">正在生成授权码...</span>
                ) : qrCodeDataUrl ? (
                  <Image
                    src={qrCodeDataUrl}
                    alt="微信绑定二维码"
                    width={180}
                    height={180}
                    unoptimized
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <span className="text-xs text-red-500">{feedback || "加载失败"}</span>
                )}
              </div>

              <p className="text-xs text-slate-600 leading-relaxed px-2">
                使用手机微信扫描上方二维码关注服务号，关注后系统将自动完成绑定与商机直推通道授权。
              </p>

              {isSimulation && (
                <div className="rounded-lg bg-blue-50/70 border border-blue-100 p-2.5 text-[11px] text-blue-700 text-left space-y-1">
                  <div className="font-semibold text-blue-900 flex items-center gap-1">
                    <span>💡</span> 本地开发演示模式
                  </div>
                  <p className="text-slate-600">
                    当前环境未配置生产级微信服务号凭据，您可直接点击下方模拟放行，验证模板消息推送全流程。
                  </p>
                  <div className="pt-1.5 text-center">
                    <button
                      type="button"
                      onClick={handleSimulateBind}
                      disabled={isPending}
                      className="w-full rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-2xs transition"
                    >
                      {isPending ? "正在模拟绑定..." : "⚡️ 一键模拟扫码成功"}
                    </button>
                  </div>
                </div>
              )}

              {feedback && (
                <div className="text-xs text-primary font-medium">{feedback}</div>
              )}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-full rounded-lg border border-slate-200 py-1.5 text-xs text-slate-600 hover:bg-slate-50 transition"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
