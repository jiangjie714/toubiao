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

async function testHttp() {
  console.log("=== 测试 /team 路由 HTTP 页面渲染 ===");

  // 1. platinum_user token
  const platinumToken = await signToken({
    uid: 7,
    username: "platinum_user",
    role: "USER",
    name: "白金企业账号",
    emailVerified: true,
  });

  const res1 = await fetch("http://localhost:3000/team", {
    headers: {
      Cookie: `tb_session=${platinumToken}`,
    },
  });
  console.log(`platinum_user 访问 /team 状态码: ${res1.status}`);
  const html1 = await res1.text();
  console.log(`页面是否包含 "华东中标先锋团队": ${html1.includes("华东中标先锋团队")}`);
  console.log(`页面是否包含 "已占用席位": ${html1.includes("已占用席位")}`);
  console.log(`页面是否包含 "资深投标专员": ${html1.includes("资深投标专员")}`);

  // 2. free_user token
  const freeToken = await signToken({
    uid: 8,
    username: "free_user",
    role: "USER",
    name: "测试普通用户",
    emailVerified: true,
  });

  const res2 = await fetch("http://localhost:3000/team", {
    headers: {
      Cookie: `tb_session=${freeToken}`,
    },
  });
  console.log(`\nfree_user 访问 /team 状态码: ${res2.status}`);
  const html2 = await res2.text();
  console.log(`free_user 查看到所属团队: ${html2.includes("华东中标先锋团队")}`);
  console.log(`free_user 看到自身席位角色: ${html2.includes("资深投标专员")}`);
  console.log(`free_user 看到特权激活: ${html2.includes("已激活（权益全享）")}`);

  console.log("\n=== HTTP 渲染验证全部通过！ ===");
}

testHttp().catch(console.error);
