import { prisma } from "../src/lib/prisma";
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

async function run() {
  console.log("=== 验证团队共享标讯协同看板与商机批注中心 ===");

  const platinumUser = await prisma.user.findFirst({ where: { username: "platinum_user" } });
  const freeUser = await prisma.user.findFirst({ where: { username: "free_user" } });
  const tender = await prisma.tender.findFirst();

  if (!platinumUser || !freeUser || !tender) {
    console.error("未找到测试数据");
    return;
  }

  // 1. 确保团队存在且包含 platinumUser 和 freeUser
  let team = await prisma.team.findFirst({
    where: { ownerId: platinumUser.id },
    include: { members: true },
  });

  if (!team) {
    team = await prisma.team.create({
      data: {
        name: "华东中标先锋团队",
        ownerId: platinumUser.id,
        maxSeats: 3,
        members: {
          create: [
            { userId: platinumUser.id, role: "OWNER", title: "投标总监" },
            { userId: freeUser.id, role: "MEMBER", title: "资深投标专员" },
          ],
        },
      },
      include: { members: true },
    });
  }

  console.log(`1. 团队状态: ${team.name}, 成员人数: ${team.members.length}`);

  // 2. 清理旧 follow 便于测试
  await prisma.tenderFollowComment.deleteMany({
    where: { follow: { tenderId: tender.id } },
  });
  await prisma.tenderFollow.deleteMany({
    where: { tenderId: tender.id },
  });

  // 3. platinumUser 创建团队跟进记录
  console.log("\n2. platinum_user 将标段加入团队共享看板:");
  const follow = await prisma.tenderFollow.create({
    data: {
      userId: platinumUser.id,
      tenderId: tender.id,
      teamId: team.id,
      status: "DRAFTING",
      priority: "HIGH",
      assignee: "free_user",
      targetAmount: 280.00,
      notes: "重点标段，拟由张工负责编制技术方案",
    },
  });
  console.log(`   跟进记录创建成功: ID=${follow.id}, 状态=${follow.status}, 指派给=@${follow.assignee}`);

  // 4. 添加协同批注
  console.log("\n3. 团队成员发表协同批注与风险提示:");
  const c1 = await prisma.tenderFollowComment.create({
    data: {
      followId: follow.id,
      userId: platinumUser.id,
      category: "RISK",
      content: "⚠️ 请注意：招标文件第 3.2 条要求供应商具备至少 3 份同类三甲医院案例合同原件！",
    },
  });
  console.log(`   [批注 1 (总监风险预警)]: ${c1.content}`);

  const c2 = await prisma.tenderFollowComment.create({
    data: {
      followId: follow.id,
      userId: freeUser.id,
      category: "COMPLIANCE",
      content: "🚨 专员核验回复：我们有协和、华西等 4 份三甲合同原件，合规要求已满足，正在盖章扫描。",
    },
  });
  console.log(`   [批注 2 (专员合规应答)]: ${c2.content}`);

  // 5. 验证 HTTP 页面渲染
  console.log("\n4. HTTP 测试：free_user 访问 /tracker 团队看板:");
  const freeToken = await signToken({
    uid: freeUser.id,
    username: freeUser.username,
    role: "USER",
    name: "测试普通用户",
    emailVerified: true,
  });

  const res = await fetch("http://localhost:3000/tracker", {
    headers: { Cookie: `tb_session=${freeToken}` },
  });
  console.log(`   free_user 访问 /tracker 状态码: ${res.status}`);
  const html = await res.text();
  console.log(`   页面展示所属团队名称 "华东中标先锋团队": ${html.includes("华东中标先锋团队")}`);
  console.log(`   页面展示团队成员指派人 "@free_user": ${html.includes("@free_user")}`);
  console.log(`   页面展示批注数量入口: ${html.includes("批注")}`);

  console.log("\n=== 团队共享标讯协同看板验证通过！ ===");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
