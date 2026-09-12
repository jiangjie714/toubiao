import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { getMarketOverview } from "@/lib/analytics";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.statusCode || 401, message: auth.error },
      { status: auth.statusCode || 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10) || 30;
  const provinceCode = searchParams.get("province") || undefined;

  const overview = await getMarketOverview(days, provinceCode);

  return NextResponse.json({
    code: 0,
    message: "success",
    data: overview,
    meta: {
      quotaRemaining: auth.quotaRemaining,
      rateLimitRpm: auth.apiKey?.rateLimitRpm || 60,
      timestamp: new Date().toISOString(),
    },
  });
}
