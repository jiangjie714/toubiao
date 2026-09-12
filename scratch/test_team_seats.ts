import { prisma } from "../src/lib/prisma";
import { getEntitlement, consumeSearchQuota, consumeAiQuota } from "../src/lib/quota";

async function run() {
  console.log("=== 验证企业团队多席位与权益继承中心 ===");

  const platinumUser = await prisma.user.findFirst({ where: { username: "platinum_user" } });
  const freeUser = await prisma.user.findFirst({ where: { username: "free_user" } });

  if (!platinumUser || !freeUser) {
    console.error("未找到测试用户");
    return;
  }

  console.log(`1. 测试前权益检查:`);
  const initialFreeEnt = await getEntitlement(freeUser.id);
  console.log(`   free_user 初始套餐: ${initialFreeEnt.planCode} (${initialFreeEnt.planName})`);
  console.log(`   free_user 初始全功能: fullText=${initialFreeEnt.features.fullText}, contacts=${initialFreeEnt.features.contacts}, aiQuota=${initialFreeEnt.features.aiQuota}`);

  // 清理现有团队与席位，保证可重复测试
  await prisma.teamMember.deleteMany({
    where: { OR: [{ userId: freeUser.id }, { userId: platinumUser.id }] },
  });
  await prisma.team.deleteMany({
    where: { ownerId: platinumUser.id },
  });

  // 2. 为 platinumUser 创建团队
  console.log(`\n2. 为 platinum_user 创建企业团队与席位:`);
  const team = await prisma.team.create({
    data: {
      name: "华东中标先锋团队",
      ownerId: platinumUser.id,
      maxSeats: 3,
      members: {
        create: {
          userId: platinumUser.id,
          role: "OWNER",
          title: "投标总监",
        },
      },
    },
  });
  console.log(`   团队创建成功: ${team.name}, 总席位: ${team.maxSeats}`);

  // 3. 将 freeUser 添加为席位成员
  console.log(`\n3. 将 free_user 加入团队席位:`);
  const member = await prisma.teamMember.create({
    data: {
      teamId: team.id,
      userId: freeUser.id,
      role: "MEMBER",
      title: "资深投标专员",
    },
  });
  console.log(`   席位分配成功: 成员ID=${member.id}, 角色=${member.role}, 职务=${member.title}`);

  // 4. 再次获取 freeUser 的权益
  console.log(`\n4. 检验 free_user 的团队权益继承:`);
  const upgradedEnt = await getEntitlement(freeUser.id);
  console.log(`   free_user 继承后套餐: ${upgradedEnt.planCode} (${upgradedEnt.planName})`);
  console.log(`   free_user 继承后特权: fullText=${upgradedEnt.features.fullText}, contacts=${upgradedEnt.features.contacts}, aiQuota=${upgradedEnt.features.aiQuota}`);

  if (upgradedEnt.planCode === "PLATINUM" && upgradedEnt.features.fullText && upgradedEnt.features.contacts) {
    console.log("   >>> [PASS] 团队席位权益继承成功！子账号无需重复付费即可享受全站白金特权！");
  } else {
    console.error("   >>> [FAIL] 权益继承未生效！");
  }

  // 5. 检验 Quota 消费
  console.log(`\n5. 检验 free_user 搜索与 AI 额度消费:`);
  const searchRes = await consumeSearchQuota(freeUser.id);
  console.log(`   consumeSearchQuota: allowed=${searchRes.allowed}, quota=${searchRes.quota}, remaining=${searchRes.remaining}`);
  const aiRes = await consumeAiQuota(freeUser.id);
  console.log(`   consumeAiQuota: allowed=${aiRes.allowed}, quota=${aiRes.quota}, remaining=${aiRes.remaining}`);

  console.log("\n=== 团队席位核心逻辑检验完成 ===");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
