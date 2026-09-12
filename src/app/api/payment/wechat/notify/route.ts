import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  decryptWechatResource,
  parseWechatNotification,
  processPaymentNotification,
  verifyWechatNotification,
} from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const headers = {
    "wechatpay-signature": request.headers.get("wechatpay-signature"),
    "wechatpay-timestamp": request.headers.get("wechatpay-timestamp"),
    "wechatpay-nonce": request.headers.get("wechatpay-nonce"),
    "wechatpay-serial": request.headers.get("wechatpay-serial"),
  };

  if (!verifyWechatNotification(headers, rawBody)) {
    return NextResponse.json({ code: "FAIL", message: "invalid signature" }, { status: 401 });
  }

  const resource = decryptWechatResource(rawBody);
  if (!resource) {
    return NextResponse.json({ code: "FAIL", message: "invalid resource" }, { status: 400 });
  }

  const notification = parseWechatNotification(rawBody, resource);
  if (!notification) {
    return NextResponse.json({ code: "FAIL", message: "invalid notification" }, { status: 400 });
  }

  const result = await processPaymentNotification(notification);
  if (!result.accepted) {
    return NextResponse.json(
      { code: "FAIL", message: result.reason ?? "processing failed" },
      { status: 409 },
    );
  }
  return NextResponse.json({ code: "SUCCESS", duplicate: result.duplicate });
}
