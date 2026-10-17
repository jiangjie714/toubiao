import { parseBankStatementText } from "../src/lib/bank-transfer-listener";

function testParser() {
  console.log("=== [Test] 银行动账邮件与流水解析器测试 ===\n");

  const samples = [
    {
      name: "工商银行企业网银动账通知",
      text: `【工商银行】您尾号0973的账户于2026年09月28日 14:25 汇款入账 人民币 6,800.00元，对方户名：北京博创智联科技有限公司，交易流水号：ICBC202609280918234，附言/摘要：8921 购买标讯通企业标准版。`,
      expectedBank: "中国工商银行",
      expectedAmount: 6800,
      expectedCode: "8921",
      expectedPayer: "北京博创智联科技有限公司",
    },
    {
      name: "招商银行企业App到账提醒",
      text: `招商银行通知：您账户入账人民币16,800.00元，付款人：中建八局第一建设有限公司，流水号：CMB88291039812，转账附言：[7342]年费采购款。`,
      expectedBank: "招商银行",
      expectedAmount: 16800,
      expectedCode: "7342",
      expectedPayer: "中建八局第一建设有限公司",
    },
    {
      name: "支付宝企业转账入账消息",
      text: `【支付宝】您已成功收款 ￥99.00 元。来自付款方：张建国。交易订单号：202609282200143890123。备注：3581 黄金会员月卡。`,
      expectedBank: "支付宝企业转账",
      expectedAmount: 99,
      expectedCode: "3581",
      expectedPayer: "张建国",
    },
    {
      name: "建设银行回单明细格式",
      text: `中国建设银行对公回单：记账金额：6800.00元；贷方户名：杭州数智网络服务部；业务编号：CCB9918274619；用途/附言：4219。`,
      expectedBank: "中国建设银行",
      expectedAmount: 6800,
      expectedCode: "4219",
      expectedPayer: "杭州数智网络服务部",
    },
  ];

  let passed = 0;
  for (const s of samples) {
    console.log(`▶ 测试案例: ${s.name}`);
    const parsed = parseBankStatementText(s.text);

    const bankMatch = parsed.bankName === s.expectedBank;
    const amountMatch = Math.abs(parsed.amount - s.expectedAmount) < 0.01;
    const codeMatch = parsed.matchingCode === s.expectedCode;
    const payerMatch = !s.expectedPayer || parsed.payerName === s.expectedPayer;

    if (bankMatch && amountMatch && codeMatch && payerMatch) {
      console.log(`  ✓ 全部命中: 银行=[${parsed.bankName}], 金额=¥${parsed.amount}, 匹配码=[${parsed.matchingCode}], 付款人=[${parsed.payerName || "无"}]`);
      passed++;
    } else {
      console.error(`  ❌ 识别不匹配:`, {
        expected: s,
        actual: parsed,
      });
    }
  }

  console.log(`\n测试完成: ${passed}/${samples.length} 全部通过！`);
}

testParser();
