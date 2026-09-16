import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "tb_session";

// 登录/静态资源/法务条款与搜索引擎公开路由放行，其余全部要求有效会话
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/verify-email",
  "/terms",
  "/privacy",
  "/robots.txt",
  "/sitemap.xml",
  "/tender",
  "/api/payment",
  "/api/v1",
  "/_next",
  "/favicon",
  "/public",
  "/.well-known",
];

async function getSecret(): Promise<Uint8Array> {
  return new TextEncoder().encode(process.env.AUTH_SECRET!);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let role: string | null = null;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, await getSecret());
      role = (payload.role as string) ?? null;
    } catch {
      role = null;
    }
  }

  if (!token || !role) {
    const loginUrl = new URL("/login", req.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && role !== "ADMIN") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  if (pathname.startsWith("/api/crawl") && role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/auth).*)"],
};
