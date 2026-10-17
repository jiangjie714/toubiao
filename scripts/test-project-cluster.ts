import {
  normalizeProjectNo,
  canonicalizeProjectTitle,
  calculateBigramSimilarity,
  extractOriginProjectRef,
  inferProjectStage,
} from "../crawler/enrichment/project-cluster";

function testProjectCluster() {
  console.log("=== [Test] 招投标跨源深度级联启发式聚类引擎单元验证 ===\n");

  // 1. 测试项目编号多格式标准化清洗
  console.log("▶ [Test 1] 项目编号标准化比对...");
  const raw1 = "[2026] 09-ZBD_01";
  const raw2 = "【2026】09-ZBD-01";
  const norm1 = normalizeProjectNo(raw1);
  const norm2 = normalizeProjectNo(raw2);
  if (norm1 !== "202609ZBD01" || norm1 !== norm2) {
    throw new Error(`编号标准化异常: norm1=${norm1}, norm2=${norm2}`);
  }
  console.log(`✓ 成功将异构格式 [${raw1}] 与 [${raw2}] 统一标准化为: [${norm1}]`);

  // 2. 测试标题特征清洗与阶段词剔除
  console.log("\n▶ [Test 2] 标题去噪与阶段词剥离规范化...");
  const tIntention = "关于某机关单位办公综合楼智能化改造项目的采购意向公开";
  const tNotice = "某机关单位办公综合楼智能化改造项目（公开招标）招标公告";
  const tChange = "某机关单位办公综合楼智能化改造项目（第一次更正）变更公告";
  const tResult = "某机关单位办公综合楼智能化改造项目中标结果公告";

  const cIntention = canonicalizeProjectTitle(tIntention);
  const cNotice = canonicalizeProjectTitle(tNotice);
  const cChange = canonicalizeProjectTitle(tChange);
  const cResult = canonicalizeProjectTitle(tResult);

  console.log(`  意向特征: "${cIntention}"`);
  console.log(`  招标特征: "${cNotice}"`);
  console.log(`  变更特征: "${cChange}"`);
  console.log(`  中标特征: "${cResult}"`);

  const simNoticeResult = calculateBigramSimilarity(cNotice, cResult);
  const simNoticeIntention = calculateBigramSimilarity(cNotice, cIntention);

  if (simNoticeResult < 0.85 || simNoticeIntention < 0.85) {
    throw new Error(`标题特征相似度偏低: sim(招标,中标)=${simNoticeResult}, sim(招标,意向)=${simNoticeIntention}`);
  }
  console.log(`✓ 全生命周期标题核心业务标的重合度: ${Math.round(simNoticeResult * 100)}% (远超 80% 阈值)`);

  // 3. 测试更正公告正文逆向溯源引用提取
  console.log("\n▶ [Test 3] 更正/答疑公告正文逆向溯源引用提取...");
  const sampleChangeText = `
    【更正声明】
    针对各投标人对本项目提出的疑问，现发布答疑澄清纪要：
    一、原项目编号：ZBD-2026-HQ-0928
    二、原招标公告名称：《某市公安局指挥大厅视频融合平台建设工程公开招标》
    三、现对投标文件递交截止时间做顺延调整。
  `;

  const originRef = extractOriginProjectRef(sampleChangeText);
  if (originRef.originProjectNo !== "ZBD-2026-HQ-0928") {
    throw new Error(`未能成功提取原项目编号，得到: ${originRef.originProjectNo}`);
  }
  console.log(`✓ 成功从变更公文正文中反向溯源提取原公告编号: [${originRef.originProjectNo}]`);

  // 4. 测试生命周期状态机推进
  console.log("\n▶ [Test 4] 项目全生命周期阶段状态机演进推导...");
  let stage = inferProjectStage("BIDDING", "NOTICE");
  if (stage !== "BIDDING") throw new Error("初始状态应为 BIDDING");

  stage = inferProjectStage(stage, "CHANGE");
  if (stage !== "CLARIFYING") throw new Error("答疑更正后应推进为 CLARIFYING");

  stage = inferProjectStage(stage, "RESULT");
  if (stage !== "AWARDED") throw new Error("中标公示后应推进为 AWARDED");

  // 中标后即使再有补充更正，仍保持 AWARDED 终态
  stage = inferProjectStage(stage, "CHANGE");
  if (stage !== "AWARDED") throw new Error("终态后状态不应回退");

  console.log("✓ 生命周期阶段演进: BIDDING ➔ CLARIFYING ➔ AWARDED (终态保持) 全部推导正确！");

  console.log("\n=======================================================");
  console.log("✅ 招投标跨源深度级联启发式聚类引擎单元验证全部通过！");
  console.log("=======================================================");
}

testProjectCluster();
