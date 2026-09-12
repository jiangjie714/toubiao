"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PaymentStatusPoller({ orderNo }: { orderNo: string }) {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <p className="mt-3 text-xs text-slate-500 tnum">
      支付完成后本页会自动刷新；订单号 {orderNo}
    </p>
  );
}
