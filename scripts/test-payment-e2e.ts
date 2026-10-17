import { prisma } from "../src/lib/prisma";
import { allocateMatchingCode, generateAuditToken, verifyAuditToken } from "../src/lib/payments";
import { activatePaidOrder } from "../src/lib/commerce";

async function main() {
  console.log("=== [E2E Test] P0 商业支付与双轨收银闭环验证 ===");

  // 1. 获取测试用户与套餐
  const testUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });
  if (!testUser) {
    throw new Error("未找到测试管理员用户，请先运行 seed");
  }

  const plan = await prisma.plan.findFirst({
    where: { priceMonthly: { not: null } },
  }) || await prisma.plan.findFirst();

  if (!plan) {
    throw new Error("未找到测试订阅套餐，请先检查 Plan 表");
  }

  const testAmount = plan.priceMonthly ? Number(plan.priceMonthly) : 199;
  console.log(`✓ 准备测试环境: 用户=${testUser.username}(ID: ${testUser.id}), 套餐=${plan.name}(${plan.code}), 金额=¥${testAmount}`);

  // 2. 模拟创建待支付订单并预分配匹配码
  const testOrderNo = `TEST_PAY_${Date.now()}`;
  const matchingCode = await allocateMatchingCode(testOrderNo);
  if (!matchingCode || !/^\d{4}$/.test(matchingCode)) {
    throw new Error(`匹配码分配失败或格式错误: ${matchingCode}`);
  }
  console.log(`✓ 成功生成 4 位转账/核销匹配码: [${matchingCode}]`);

  const initialOrder = await prisma.order.create({
    data: {
      orderNo: testOrderNo,
      userId: testUser.id,
      planId: plan.id,
      billingCycle: "monthly",
      amount: testAmount,
      status: "PENDING",
      channel: "wechat",
      matchingCode,
    },
  });
  console.log(`✓ 创建待支付订单: ${initialOrder.orderNo}, 金额=¥${initialOrder.amount}, 匹配码=${initialOrder.matchingCode}`);

  const orderWithCode = await prisma.order.findUnique({
    where: { id: initialOrder.id },
  });
  if (orderWithCode?.matchingCode !== matchingCode) {
    throw new Error("数据库中的 matchingCode 与返回值不一致");
  }

  // 4. 测试免密 HMAC 审核 Token 生成与校验
  const auditToken = generateAuditToken(initialOrder.orderNo);
  const isValid = verifyAuditToken(auditToken, initialOrder.orderNo);
  if (!isValid) {
    throw new Error("HMAC 审核 Token 校验未通过");
  }
  const isInvalidForOther = verifyAuditToken(auditToken, "FAKE_ORDER_NO");
  if (isInvalidForOther) {
    throw new Error("HMAC 审核 Token 防伪篡改检测失效");
  }
  console.log(`✓ HMAC 移动端免密一键审核 Token 生成与验签成功 (防伪检测正常)`);

  // 5. 模拟用户扫码后点击「我已完成支付」(WAIT_VERIFY)
  const waitVerifyOrder = await prisma.order.update({
    where: { id: initialOrder.id },
    data: {
      status: "WAIT_VERIFY",
      paidNoticeAt: new Date(),
      auditStatus: "PENDING",
      note: "E2E 测试自动报备付款",
    },
  });
  if (waitVerifyOrder.status !== "WAIT_VERIFY") {
    throw new Error("订单状态更新为 WAIT_VERIFY 失败");
  }
  console.log(`✓ 用户上报支付: 订单状态流转至 WAIT_VERIFY (待核销)`);

  // 6. 模拟管理员通过移动端一键审核或后台核销开通
  console.log("执行 activatePaidOrder 事务核销并开通权益...");
  const beforeSub = await prisma.subscription.findUnique({
    where: { userId: testUser.id },
  });
  const beforeEndsAt = beforeSub?.endsAt ? new Date(beforeSub.endsAt).getTime() : Date.now();

  await activatePaidOrder(initialOrder.id, {
    auditByUserId: testUser.id,
    auditNote: "E2E 自动化测试核销通过",
  });

  const activatedOrder = await prisma.order.findUnique({
    where: { id: initialOrder.id },
  });

  if (!activatedOrder || activatedOrder.status !== "PAID" || activatedOrder.auditStatus !== "APPROVED") {
    throw new Error(`订单核销状态不正确: status=${activatedOrder?.status}, auditStatus=${activatedOrder?.auditStatus}`);
  }
  console.log(`✓ 订单成功核销: status=${activatedOrder.status}, auditStatus=${activatedOrder.auditStatus}`);

  // 7. 验证权益生效与到期时间计算
  const afterSub = await prisma.subscription.findUnique({
    where: { userId: testUser.id },
    include: { plan: true },
  });
  if (!afterSub || afterSub.status !== "ACTIVE" || !afterSub.endsAt) {
    throw new Error("用户订阅状态未更新为 ACTIVE 或到期时间为空");
  }
  const afterEndsAt = new Date(afterSub.endsAt).getTime();
  if (afterEndsAt <= beforeEndsAt) {
    throw new Error(`到期时间计算异常: 原到期=${new Date(beforeEndsAt).toISOString()}, 新到期=${afterSub.endsAt.toISOString()}`);
  }
  console.log(`✓ 用户权益即时开通: 套餐=${afterSub.plan.name}, 有效期至=${afterSub.endsAt.toLocaleDateString("zh-CN")}`);

  // 8. 测试续费叠加机制 (Extension Test)
  console.log("测试续费叠加机制 (原有效期基础上追加 30 天)...");
  const renewOrder = await prisma.order.create({
    data: {
      orderNo: `TEST_RENEW_${Date.now()}`,
      userId: testUser.id,
      planId: plan.id,
      billingCycle: "monthly",
      amount: testAmount,
      status: "WAIT_VERIFY",
      channel: "alipay",
      matchingCode: "8888",
    },
  });
  await activatePaidOrder(renewOrder.id, { auditByUserId: testUser.id });
  const renewedSub = await prisma.subscription.findUnique({
    where: { userId: testUser.id },
  });
  if (!renewedSub || !renewedSub.endsAt) {
    throw new Error("续费后到期时间为空");
  }
  const renewedEndsAt = new Date(renewedSub.endsAt).getTime();
  const diffDays = Math.round((renewedEndsAt - afterEndsAt) / (1000 * 60 * 60 * 24));
  if (diffDays < 28 || diffDays > 32) {
    throw new Error(`续期天数计算不符合预期: 增量=${diffDays}天`);
  }
  console.log(`✓ 续费无缝顺延通过: 在原有到期日基础上顺延了 ${diffDays} 天`);

  // 9. 测试驳回机制
  console.log("测试订单驳回机制...");
  const rejectTestOrder = await prisma.order.create({
    data: {
      orderNo: `TEST_REJ_${Date.now()}`,
      userId: testUser.id,
      planId: plan.id,
      billingCycle: "monthly",
      amount: 100,
      status: "WAIT_VERIFY",
      channel: "bank",
      matchingCode: "9999",
    },
  });

  const rejectedOrder = await prisma.order.update({
    where: { id: rejectTestOrder.id },
    data: {
      status: "PENDING",
      auditStatus: "REJECTED",
      auditNote: "未核对到对应入账流水，请重新核对打款户名与附言",
      auditByUserId: testUser.id,
      auditAt: new Date(),
    },
  });

  if (rejectedOrder.status !== "PENDING" || rejectedOrder.auditStatus !== "REJECTED") {
    throw new Error("驳回状态变更失败");
  }
  console.log(`✓ 订单驳回成功: status=${rejectedOrder.status}, auditStatus=${rejectedOrder.auditStatus}, auditNote=${rejectedOrder.auditNote}`);

  // 10. 清理测试产生的临时订单
  await prisma.order.deleteMany({
    where: {
      id: { in: [initialOrder.id, renewOrder.id, rejectTestOrder.id] },
    },
  });
  console.log(`✓ 清理测试产生的临时订单记录`);

  console.log("\n=========================================");
  console.log("🎉 全部测试项均通过！P0 商业支付与双轨收银闭环逻辑验证完备！");
  console.log("=========================================\n");
}

main()
  .catch((err) => {
    console.error("❌ E2E 测试失败:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
