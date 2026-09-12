import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "tb_session";
const SESSION_TTL = "7d";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("AUTH_SECRET 未配置或过短，请在 .env 中设置");
  }
  return new TextEncoder().encode(secret);
}

export type SessionUser = {
  uid: number;
  username: string;
  name: string;
  role: string;
  emailVerified: boolean;
};

export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(getSecret());
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
}

export async function destroySession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** 读取会话并校验用户在数据库中仍为启用状态 */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const user = await prisma.user.findUnique({
      where: { id: payload.uid as number },
    });
    if (!user || user.status !== "ACTIVE") return null;
    return {
      uid: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      emailVerified: user.emailVerified,
    };
  } catch {
    return null;
  }
}

export async function verifyPassword(
  username: string,
  password: string,
): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.status !== "ACTIVE") return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });
  return {
    uid: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    emailVerified: user.emailVerified,
  };
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}
