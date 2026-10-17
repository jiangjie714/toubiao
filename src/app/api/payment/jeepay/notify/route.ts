import type { NextRequest } from "next/server";
import { getJeepayConfig, verifyJeepaySign } from "@/lib/jeepay";
import {
  parseJeepayNotification,
  processPaymentNotification,
} from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest | Request) {
  let params: Record<string, unknown> = {};

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      params = (await request.json()) as Record<string, unknown>;
    } catch {
      return new Response("INVALID_PAYLOAD", { status: 400 });
    }
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const formData = await request.formData();
      formData.forEach((val, key) => {
        params[key] = typeof val === "string" ? val : String(val);
      });
    } catch {
      return new Response("INVALID_PAYLOAD", { status: 400 });
    }
  } else {
    try {
      const text = await request.text();
      if (text.trim().startsWith("{")) {
        params = JSON.parse(text) as Record<string, unknown>;
      } else {
        const sp = new URLSearchParams(text);
        sp.forEach((val, key) => {
          params[key] = val;
        });
      }
    } catch {
      return new Response("INVALID_PAYLOAD", { status: 400 });
    }
  }

  const apiKey = getJeepayConfig()?.apiKey;
  if (!apiKey || !verifyJeepaySign(params, apiKey)) {
    return new Response("FAIL", { status: 400 });
  }

  const notification = parseJeepayNotification(params);
  if (!notification) {
    return new Response("INVALID_PAYLOAD", { status: 400 });
  }

  await processPaymentNotification(notification);

  return new Response("success", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
