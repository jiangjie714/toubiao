import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  parseAlipayNotification,
  processPaymentNotification,
  verifyAlipayNotification,
} from "@/lib/payments";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return new NextResponse("fail", { status: 400 });
  }

  const params: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") params[key] = value;
  }

  if (!verifyAlipayNotification(params)) {
    return new NextResponse("fail", { status: 401 });
  }

  const notification = parseAlipayNotification(params);
  if (!notification) {
    return new NextResponse("fail", { status: 400 });
  }

  const result = await processPaymentNotification(notification);
  return new NextResponse(result.accepted ? "success" : "fail", {
    status: result.accepted ? 200 : 409,
  });
}
