import { prisma } from "../src/lib/prisma";
import {
  detectAttachmentFileType,
  formatAttachmentWithPages,
  extractGoodsSnippet,
  parseAttachmentRawText,
} from "../src/lib/attachment-parser";
import { searchAttachmentContent } from "../src/lib/attachment-search";
import {
  calculateSeatUpgradeQuote,
  transferUserBiddingAssets,
} from "../src/lib/team-seat-service";

async function main() {
  console.log("==================================================================");
  console.log("  P2 企业协同与深度数据壁垒 E2E 自动化综合验证测试");
  console.log("==================================================================\n");

  const cleanupIds = {
    tenderIds: [] as number[],
    attachmentIds: [] as number[],
    userIds: [] as number[],
    teamIds: [] as number[],
  };

  try {
    // -------------------------------------------------------------------------
    // 1. 附件格式探测与多页切片分段提取测试
    // -------------------------------------------------------------------------
    console.log("[TEST 1/4] 测试附件类型智能探测与分页标记切片...");
    const extPdf = detectAttachmentFileType("采购招标文件-2026最终版.pdf");
    const extDoc = detectAttachmentFileType("投标文件格式模版.DOCX");
    const extXls = detectAttachmentFileType("工程量与物料清单.xlsx");
    const extZip = detectAttachmentFileType("图纸附件压缩包.zip");

    if (extPdf !== "PDF" || extDoc !== "DOCX" || extXls !== "XLSX" || extZip !== "ZIP") {
      throw new Error(`附件扩展名检测异常: PDF=${extPdf}, DOCX=${extDoc}, XLSX=${extXls}, ZIP=${extZip}`);
    }

    const multiPages = [
      "第一部分 招标邀请书\n本招标项目采购高精度工业检测设备，请合格供应商按期投递。",
      "第二部分 技术规格与参数\n主要采购设备：高精度三坐标测量仪 2套，测量精度达0.5微米，要求原厂维保三年。",
      "第三部分 评分办法与标准\n技术分40分，商务分60分，评标委员会将依法评审。",
    ];
    const paginatedText = formatAttachmentWithPages(multiPages);
    if (!paginatedText.includes("=== [第 1 页] ===") || !paginatedText.includes("=== [第 2 页] ===")) {
      throw new Error("分页文本标记生成失败");
    }

    const goodsSnippet = extractGoodsSnippet("清单包含：高精度三坐标测量仪 2套；激光干涉仪 1台；光谱分析仪 3批。");
    if (!goodsSnippet || !goodsSnippet.includes("高精度三坐标测量仪")) {
      throw new Error(`采购商品摘要提炼失败: ${goodsSnippet}`);
    }

    const rawParsed = parseAttachmentRawText(multiPages.join("\n\n"), "测试文件.pdf");
    if (rawParsed.fileType !== "PDF" || rawParsed.pageCount < 1) {
      throw new Error(`parseAttachmentRawText 结果状态异常: ${JSON.stringify(rawParsed)}`);
    }
    console.log("  ✓ 附件类型探测、多页分段切片与商品摘要解析全部通过！\n");

    // -------------------------------------------------------------------------
    // 2. 附件深层全文检索与「命中附件某某.pdf 第 X 页」精确位移验证
    // -------------------------------------------------------------------------
    console.log("[TEST 2/4] 测试附件深层全文检索与精确页码(第 X 页)定位...");
    const testTender = await prisma.tender.create({
      data: {
        title: "E2E测试-国家级实验室精密计量仪器采购项目",
        sourceUrl: `https://test-p2-moat.ccgp.gov.cn/notice-${Date.now()}`,
        publishDate: new Date(),
        type: "PURCHASE",
        provinceCode: "11",
        budgetAmount: 480,
        content: "本项目为精密仪器设备采购项目，用于测试。",
      },
    });
    cleanupIds.tenderIds.push(testTender.id);

    const testAttachment = await prisma.attachment.create({
      data: {
        tenderId: testTender.id,
        name: "国家级实验室精密计量仪器招标文件及设备清单.pdf",
        sourceUrl: `https://test-p2-moat.ccgp.gov.cn/file-${Date.now()}.pdf`,
        fileType: "PDF",
        status: "parsed",
        extractedText: paginatedText,
        snippet: "高精度三坐标测量仪 2套；激光干涉仪 1台",
        pageCount: 3,
        size: 1024 * 1024 * 2.5,
        parsedAt: new Date(),
      },
    });
    cleanupIds.attachmentIds.push(testAttachment.id);

    // 搜索关键词："三坐标测量仪"
    const searchHits = await searchAttachmentContent("三坐标测量仪");
    const targetHit = searchHits.find((h) => h.attachmentId === testAttachment.id);

    if (!targetHit) {
      throw new Error("附件深层检索未能匹配到目标附件");
    }

    console.log(`  命中结果展示:
    - 标讯标题: ${targetHit.tenderTitle}
    - 附件名称: ${targetHit.attachmentName}
    - 精确页码: 第 ${targetHit.pageNumber} 页
    - 高亮上下文: ${targetHit.snippet}`);

    if (targetHit.pageNumber !== 2) {
      throw new Error(`精确页码定位错误: 预期第 2 页，实际为第 ${targetHit.pageNumber} 页`);
    }
    if (!targetHit.snippet.includes("【高精度三坐标测量仪】") && !targetHit.snippet.includes("三坐标测量仪")) {
      throw new Error(`命中片段未包含高亮关键字: ${targetHit.snippet}`);
    }
    console.log("  ✓ 附件深层全文检索与第 2 页精准定位验证成功！\n");

    // -------------------------------------------------------------------------
    // 3. 企业席位加购弹性折算费用计算 (Pro-rata)
    // -------------------------------------------------------------------------
    console.log("[TEST 3/4] 测试企业席位加购 Pro-rata 弹性折算报价...");
    // 创建测试企业主账号及年费订阅
    const enterprisePlan = await prisma.plan.findFirst({
      where: { code: "ENTERPRISE_STANDARD" },
    });
    if (!enterprisePlan) {
      throw new Error("未找到 enterprise 订阅套餐");
    }

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 180); // 剩余 180 天租期

    const testOwner = await prisma.user.create({
      data: {
        username: `e2e_corp_owner_${Date.now()}`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
        role: "SUBSCRIBER",
        name: "测试企业法定代表人",
      },
    });
    cleanupIds.userIds.push(testOwner.id);

    await prisma.subscription.create({
      data: {
        userId: testOwner.id,
        planId: enterprisePlan.id,
        status: "ACTIVE",
        billingCycle: "yearly",
        startsAt: new Date(),
        endsAt: futureDate,
      },
    });

    const testTeam = await prisma.team.create({
      data: {
        name: "E2E高新精密仪器科技股份有限公司",
        ownerId: testOwner.id,
        maxSeats: 10,
      },
    });
    cleanupIds.teamIds.push(testTeam.id);

    const quote = await calculateSeatUpgradeQuote(testTeam.id, 5); // 加购 5 个席位
    console.log(`  席位升级报价结果:
    - 加购席位数: ${quote.extraSeats} 个席位
    - 剩余服务期: ${quote.remainingDays} 天
    - 计费周期: ${quote.billingCycle}
    - 折算应收总额: ¥${quote.totalAmount}`);

    if (quote.extraSeats !== 5) throw new Error("加购席位数异常");
    if (quote.remainingDays < 179 || quote.remainingDays > 181) {
      throw new Error(`剩余天数异常: ${quote.remainingDays}`);
    }
    // 5 * (990 / 365) * 180 ≈ 2441.1
    const expected = Math.round(5 * (990 / 365) * quote.remainingDays * 100) / 100;
    if (Math.abs(quote.totalAmount - expected) > 1) {
      throw new Error(`弹性折算费用计算不符: 实际 ¥${quote.totalAmount}, 预期 ¥${expected}`);
    }
    console.log("  ✓ 企业多席位弹性 Pro-rata 计费折算验证成功！\n");

    // -------------------------------------------------------------------------
    // 4. 离职员工标讯资产原子一键交接/继承 (Transfer)
    // -------------------------------------------------------------------------
    console.log("[TEST 4/4] 测试离职员工标讯资产一键交接继承 (跟进/草稿/雷达)...");
    const employeeOffboarding = await prisma.user.create({
      data: {
        username: `e2e_emp_leave_${Date.now()}`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
        role: "USER",
        name: "李四（离职员工）",
      },
    });
    const employeeSuccessor = await prisma.user.create({
      data: {
        username: `e2e_emp_takeover_${Date.now()}`,
        passwordHash: "$2a$10$abcdefghijklmnopqrstuv",
        role: "USER",
        name: "王五（接手同事）",
      },
    });
    cleanupIds.userIds.push(employeeOffboarding.id, employeeSuccessor.id);

    // 加入团队
    await prisma.teamMember.createMany({
      data: [
        { teamId: testTeam.id, userId: employeeOffboarding.id, role: "MEMBER" },
        { teamId: testTeam.id, userId: employeeSuccessor.id, role: "MEMBER" },
      ],
    });

    // 创建另外 2 个测试标讯用于跟进测试
    const extraTender1 = await prisma.tender.create({
      data: {
        title: "E2E测试-离职交接标讯A",
        sourceUrl: `https://test-p2-moat.ccgp.gov.cn/notice-a-${Date.now()}`,
        publishDate: new Date(),
        type: "PURCHASE",
        provinceCode: "11",
        content: "离职交接标讯A内容，用于测试资产迁移与跟进承接。",
      },
    });
    const extraTender2 = await prisma.tender.create({
      data: {
        title: "E2E测试-离职交接标讯B（接手人已跟进，需去重）",
        sourceUrl: `https://test-p2-moat.ccgp.gov.cn/notice-b-${Date.now()}`,
        publishDate: new Date(),
        type: "PURCHASE",
        provinceCode: "11",
        content: "离职交接标讯B内容，接手人已跟进，测试去重冲突逻辑。",
      },
    });
    cleanupIds.tenderIds.push(extraTender1.id, extraTender2.id);

    // 离职员工拥有标讯A跟进、标讯B跟进、标书草稿1份、商机雷达1条
    await prisma.tenderFollow.createMany({
      data: [
        { tenderId: extraTender1.id, userId: employeeOffboarding.id, status: "PREPARING" },
        { tenderId: extraTender2.id, userId: employeeOffboarding.id, status: "BIDDING" },
      ],
    });

    // 接手同事原本就已经跟进了标讯B
    await prisma.tenderFollow.create({
      data: {
        tenderId: extraTender2.id,
        userId: employeeSuccessor.id,
        status: "PREPARING",
      },
    });

    // 标书编制项目草稿
    await prisma.proposalProject.create({
      data: {
        tenderId: extraTender1.id,
        userId: employeeOffboarding.id,
        title: "离职前编写的重大仪器投标技术方案",
        status: "DRAFT",
        assembledVolumes: [],
      },
    });

    // 商机监控雷达
    await prisma.pushWatch.create({
      data: {
        userId: employeeOffboarding.id,
        name: "离职员工创建的计量仪器雷达",
        keyword: "计量 测量仪",
        channels: ["email", "wechat_mp"],
      },
    });

    // 执行一键交接
    const transferResult = await transferUserBiddingAssets({
      fromUserId: employeeOffboarding.id,
      toUserId: employeeSuccessor.id,
      teamId: testTeam.id,
      operatorUserId: testOwner.id,
    });

    console.log(`  离职资产交接执行结果:
    - 交接人员: ${transferResult.fromUserName} -> ${transferResult.toUserName}
    - 迁移标讯跟进条数: ${transferResult.transferredFollows} (标讯B已自动去重避免冲突)
    - 迁移标书方案草稿: ${transferResult.transferredProposals}
    - 迁移商机监控雷达: ${transferResult.transferredWatches}`);

    if (transferResult.transferredFollows !== 1) {
      throw new Error(`标讯迁移数量不符合去重预期: ${transferResult.transferredFollows}`);
    }
    if (transferResult.transferredProposals !== 1) {
      throw new Error(`标书草稿迁移数量异常: ${transferResult.transferredProposals}`);
    }
    if (transferResult.transferredWatches !== 1) {
      throw new Error(`商机雷达迁移数量异常: ${transferResult.transferredWatches}`);
    }

    // 验证离职员工在团队中已清退
    const teamMemberCheck = await prisma.teamMember.findFirst({
      where: { teamId: testTeam.id, userId: employeeOffboarding.id },
    });
    if (teamMemberCheck) {
      throw new Error("离职员工未能从企业团队名单中清除");
    }

    // 验证标书草稿归属已更新为接手同事
    const proposalCheck = await prisma.proposalProject.findFirst({
      where: { tenderId: extraTender1.id },
    });
    if (proposalCheck?.userId !== employeeSuccessor.id) {
      throw new Error(`标书草稿所有权未正确转移给接手人: ${proposalCheck?.userId}`);
    }

    console.log("  ✓ 离职员工跟进标讯、标书草稿与商机雷达原子交接迁移验证成功！\n");

    console.log("==================================================================");
    console.log("  🎉 P2 深度数据壁垒与企业协同全套功能 100% 验证通过！");
    console.log("==================================================================");
  } finally {
    // 清理测试数据
    console.log("\n正在清理测试脏数据...");
    if (cleanupIds.attachmentIds.length > 0) {
      await prisma.attachment.deleteMany({
        where: { id: { in: cleanupIds.attachmentIds } },
      });
    }
    if (cleanupIds.tenderIds.length > 0) {
      await prisma.tenderFollow.deleteMany({
        where: { tenderId: { in: cleanupIds.tenderIds } },
      });
      await prisma.proposalProject.deleteMany({
        where: { tenderId: { in: cleanupIds.tenderIds } },
      });
      await prisma.tender.deleteMany({
        where: { id: { in: cleanupIds.tenderIds } },
      });
    }
    if (cleanupIds.teamIds.length > 0) {
      await prisma.teamMember.deleteMany({
        where: { teamId: { in: cleanupIds.teamIds } },
      });
      await prisma.team.deleteMany({
        where: { id: { in: cleanupIds.teamIds } },
      });
    }
    if (cleanupIds.userIds.length > 0) {
      await prisma.pushWatch.deleteMany({
        where: { userId: { in: cleanupIds.userIds } },
      });
      await prisma.subscription.deleteMany({
        where: { userId: { in: cleanupIds.userIds } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: cleanupIds.userIds } },
      });
    }
    console.log("测试脏数据清理完毕。");
  }
}

main()
  .catch((e) => {
    console.error("❌ 测试失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
