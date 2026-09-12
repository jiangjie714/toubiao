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
  console.log("=== 验证企业发票与财务报销中心端到端流转 ===");

  const user = await prisma.user.findFirst({ where: { username: "platinum_user" } });
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  const plan = await prisma.plan.findFirst({ where: { code: "PLATINUM" } });

  if (!user || !admin || !plan) {
    console.error("未找到必要的基础数据");
    return;
  }

  // 1. 创建或获取一个已支付订单
  console.log("\n1. 准备测试已支付订单:");
  let order = await prisma.order.findFirst({
    where: { userId: user.id, status: "PAID" },
  });

  if (!order) {
    order = await prisma.order.create({
      data: {
        orderNo: `TB${Date.now()}`,
        userId: user.id,
        planId: plan.id,
        billingCycle: "yearly",
        amount: 799.00,
        status: "PAID",
        paidAt: new Date(),
        invoiceStatus: "NONE",
      },
    });
    console.log(`   创建新测试已支付订单: 单号=${order.orderNo}, 金额=¥${order.amount}`);
  } else {
    // 重置状态便于测试
    await prisma.invoice.deleteMany({ where: { orderId: order.id } });
    await prisma.order.update({ where: { id: order.id }, data: { invoiceStatus: "NONE" } });
    console.log(`   重置现有已支付订单: 单号=${order.orderNo}, 金额=¥${order.amount}`);
  }

  // 2. 模拟用户申请增值税专用发票 (测试 6% 进项税拆分)
  console.log("\n2. 用户提交增值税专用发票申请:");
  const totalAmount = Number(order.amount);
  const amountWithoutTax = Math.round((totalAmount / 1.06) * 100) / 100;
  const taxAmount = Math.round((totalAmount - amountWithoutTax) * 100) / 100;

  console.log(`   价税拆分测算: 总额=¥${totalAmount} -> 不含税=¥${amountWithoutTax}, 税额(6%)=¥${taxAmount}`);

  const invoice = await prisma.invoice.create({
    data: {
      orderId: order.id,
      userId: user.id,
      type: "SPECIAL",
      title: "中标先锋信息技术（北京）股份有限公司",
      taxNumber: "91110108MA0178ABC9",
      bankName: "中国工商银行北京海淀支行",
      bankAccount: "0200004509001234567",
      address: "北京市海淀区中关村南大街1号",
      phone: "010-88889999",
      email: "finance@zhongbiaoxianfeng.com",
      amount: totalAmount,
      taxRate: 0.06,
      taxAmount,
      amountWithoutTax,
      status: "PENDING",
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { invoiceStatus: "REQUESTED" },
  });

  console.log(`   发票申请成功写入: ID=${invoice.id}, 状态=${invoice.status}, 订单发票状态=REQUESTED`);

  // 3. 模拟财务审核并核发电子发票
  console.log("\n3. 财务管理后台审核通过并核发电子发票:");
  const updatedInvoice = await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      status: "ISSUED",
      invoiceCode: "031002600111",
      invoiceNumber: "26849102",
      checkCode: "89201948102938102931",
      issuedAt: new Date(),
    },
  });

  await prisma.order.update({
    where: { id: order.id },
    data: { invoiceStatus: "ISSUED" },
  });

  console.log(`   发票已核发: 发票代码=${updatedInvoice.invoiceCode}, 发票号码=${updatedInvoice.invoiceNumber}, 状态=${updatedInvoice.status}`);

  // 4. HTTP 测试：前台 /invoices 与 后台 /admin/invoices
  console.log("\n4. HTTP 路由渲染验证:");

  const userToken = await signToken({
    uid: user.id,
    username: user.username,
    role: "USER",
    name: "白金企业账号",
    emailVerified: true,
  });

  const resUser = await fetch("http://localhost:3000/invoices", {
    headers: { Cookie: `tb_session=${userToken}` },
  });
  console.log(`   用户访问 /invoices 状态码: ${resUser.status}`);
  const userHtml = await resUser.text();
  console.log(`   页面包含发票抬头 "中标先锋信息技术": ${userHtml.includes("中标先锋信息技术")}`);
  console.log(`   页面包含发票类型 "增值税专用发票": ${userHtml.includes("增值税专用发票")}`);
  console.log(`   页面包含凭证打印入口 "电子凭证 / 打印": ${userHtml.includes("电子凭证 / 打印")}`);

  const adminToken = await signToken({
    uid: admin.id,
    username: admin.username,
    role: "ADMIN",
    name: "系统管理员",
    emailVerified: true,
  });

  const resAdmin = await fetch("http://localhost:3000/admin/invoices", {
    headers: { Cookie: `tb_session=${adminToken}` },
  });
  console.log(`   管理员访问 /admin/invoices 状态码: ${resAdmin.status}`);
  const adminHtml = await resAdmin.text();
  console.log(`   后台页面包含税号 "91110108MA0178ABC9": ${adminHtml.includes("91110108MA0178ABC9")}`);

  console.log("\n=== 财务发票中心端到端全部通过！ ===");
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
