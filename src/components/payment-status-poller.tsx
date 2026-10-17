"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { pollOrderStatusAction } from "@/app/actions/payments";
import { CheckCircleIcon } from "@/components/icons";

export default function PaymentStatusPoller({
  orderNo,
  initialStatus = "PENDING",
  onStatusChange,
}: {
  orderNo: string;
  initialStatus?: string;
  onStatusChange?: (status: string) => void;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isSuccess, setIsSuccess] = useState(initialStatus === "PAID");

  const isPaid = isSuccess || status === "PAID" || initialStatus === "PAID";

  useEffect(() => {
    if (isPaid) return;

    let isMounted = true;
    const timer = setInterval(async () => {
      try {
        const res = await pollOrderStatusAction(orderNo);
        if (!isMounted) return;
        setStatus(res.status);
        onStatusChange?.(res.status);
        if (res.status === "PAID") {
          setIsSuccess(true);
          clearInterval(timer);
          router.refresh();
        }
      } catch (err) {
        console.error("Poll order status error:", err);
      }
    }, 3000);

    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, [orderNo, isPaid, router, onStatusChange]);

  if (isSuccess || status === "PAID") {
    return (
      <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200 animate-pulse">
        <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
        <span>款项已确认，正在为您呈现开通结果...</span>
      </div>
    );
  }

  return (
    <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500 tnum">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
      </span>
      <span>
        {status === "WAIT_VERIFY"
          ? "已收到您的付款通知，财务正在核对流水（预计1-5分钟）..."
          : "扫码完成转账后，页面将自动同步入账状态"}
      </span>
    </div>
  );
}
