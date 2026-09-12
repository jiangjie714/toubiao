import { SignJWT } from "jose";
import dotenv from "dotenv";
dotenv.config();

function getSecret() {
  const secret = process.env.AUTH_SECRET || "development-secret-must-be-at-least-32-chars-long";
  return new TextEncoder().encode(secret);
}

async function signToken(payload: Record<string, unknown>) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

async function testAccess() {
  const freeToken = await signToken({
    uid: 8,
    username: "free_user",
    role: "USER",
    name: "测试普通用户",
    emailVerified: true,
  });

  const res = await fetch("http://localhost:3000/tender/1", {
    headers: {
      Cookie: `tb_session=${freeToken}`,
    },
  });
  console.log(`free_user (with inherited team seat) 访问 /tender/1 状态码: ${res.status}`);
  const html = await res.text();
  // Check if blurred overlay or full contact details
  console.log(`是否展示团队席位白金特权: ${html.includes("华东中标先锋团队席位") || html.includes("联系方式")}`);
}

testAccess().catch(console.error);
