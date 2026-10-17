import { prisma } from "./prisma";
import { activatePaidOrder } from "./commerce";
import { sendAdminPaymentNotification } from "./payment-notify";

export interface ParsedBankStatement {
  rawText: string;
  bankName: string;
  payerName?: string;
  amount: number;
  matchingCode?: string;
  transactionRef?: string;
  transactedAt?: Date;
  confidence: number;
}

export interface ReconcileResult {
  statement: ParsedBankStatement;
  status: "MATCHED" | "AMOUNT_MISMATCH" | "NOT_FOUND" | "ALREADY_PAID" | "ERROR";
  orderNo?: string;
  orderId?: number;
  planName?: string;
  userName?: string;
  message: string;
}

/**
 * 智能解析各大银行动账邮件/网银流水通知文本
 * 支持：工商银行、招商银行、建设银行、农业银行、支付宝企业转账等主流模板
 */
export function parseBankStatementText(text: string): ParsedBankStatement {
  const clean = text.replace(/[\r\n]+/g, " ").trim();
  let bankName = "未知银行/渠道";
  let payerName: string | undefined;
  let matchingCode: string | undefined;
  let transactionRef: string | undefined;
  let amount = 0;
  let confidence = 0.5;

  // 1. 识别银行渠道
  if (/工商银行|ICBC|工行/i.test(clean)) bankName = "中国工商银行";
  else if (/招商银行|CMB|招行/i.test(clean)) bankName = "招商银行";
  else if (/建设银行|CCB|建行/i.test(clean)) bankName = "中国建设银行";
  else if (/农业银行|ABC|农行/i.test(clean)) bankName = "中国农业银行";
  else if (/中国银行|BOC/i.test(clean)) bankName = "中国银行";
  else if (/交通银行|BCM|交行/i.test(clean)) bankName = "交通银行";
  else if (/支付宝/i.test(clean)) bankName = "支付宝企业转账";
  else if (/微信/i.test(clean)) bankName = "微信支付商业转账";

  // 2. 提取金额（格式：6800.00 / 6,800.00 / 人民币 6800 / ¥6800）
  const amountPatterns = [
    /(?:人民币|金额|入账|收入|汇款|交易金额|现汇|贷记)[：:\s]*(?:¥|￥|RMB)?\s*([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:元)?/i,
    /(?:¥|￥)\s*([0-9,]+(?:\.[0-9]{1,2})?)/,
    /([0-9,]+(?:\.[0-9]{2}))\s*元/,
  ];

  for (const pat of amountPatterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      const parsed = parseFloat(match[1].replace(/,/g, ""));
      if (!isNaN(parsed) && parsed > 0) {
        amount = parsed;
        confidence += 0.2;
        break;
      }
    }
  }

  // 3. 提取 4 位附言匹配码（重点提取紧随 附言/备注/识别码 后的 4 位连续数字，或直接独立的 4 位数字）
  const codeExplicitPatterns = [
    /(?:附言|摘要|备注|识别码|匹配码|转账附言|留言)[：:\s]*.*?([1-9][0-9]{3})\b/i,
    /(?:附言|摘要|备注)[：:\s]*.*?([0-9]{4})\b/i,
  ];

  for (const pat of codeExplicitPatterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      matchingCode = match[1];
      confidence += 0.3;
      break;
    }
  }

  // 若未从明确附言前缀提取到，扫描正文中的 4 位数字候选
  if (!matchingCode) {
    const fallbackMatches = clean.match(/\b([1-9][0-9]{3})\b/g);
    if (fallbackMatches && fallbackMatches.length > 0) {
      // 过滤掉明显的年份如 2024, 2025, 2026, 2027
      const validCodes = fallbackMatches.filter(
        (code) => !["2024", "2025", "2026", "2027", "2028"].includes(code)
      );
      if (validCodes.length > 0) {
        matchingCode = validCodes[0];
        confidence += 0.1;
      }
    }
  }

  // 4. 提取付款方户名
  const payerPatterns = [
    /(?:付款人|对方户名|汇款人|付款单位|转出账户名|付款方|缴款人|贷方户名|借方户名)[：:\s]*([^\s,，;；|。]{2,30})/i,
    /(?:来自|收到)\s*([^\s,，;；|。]{2,30})\s*(?:的转账|的汇款)/i,
  ];
  for (const pat of payerPatterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      payerName = match[1].trim();
      break;
    }
  }

  // 5. 提取交易流水号/凭证号/订单号
  const refPatterns = [
    /(?:流水号|交易流水|业务编号|凭证号|交易号|日志号|交易订单号)[：:\s]*([a-zA-Z0-9_-]{8,36})/i,
  ];
  for (const pat of refPatterns) {
    const match = clean.match(pat);
    if (match && match[1]) {
      transactionRef = match[1].trim();
      break;
    }
  }

  return {
    rawText: text,
    bankName,
    payerName,
    amount,
    matchingCode,
    transactionRef,
    transactedAt: new Date(),
    confidence: Math.min(1.0, confidence),
  };
}

/**
 * 将解析出的单笔银行流水与待核销订单撮合比对并自动核销
 */
export async function matchAndReconcileStatement(
  statement: ParsedBankStatement
): Promise<ReconcileResult> {
  if (!statement.matchingCode) {
    return {
      statement,
      status: "NOT_FOUND",
      message: "未在流水文本中识别到 4 位附言匹配码",
    };
  }

  // 查找对应匹配码的未完成订单
  const candidateOrders = await prisma.order.findMany({
    where: {
      matchingCode: statement.matchingCode,
    },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
  });

  if (candidateOrders.length === 0) {
    return {
      statement,
      status: "NOT_FOUND",
      message: `未找到附言码为 [${statement.matchingCode}] 的订单`,
    };
  }

  // 优先匹配处于待支付或待核销状态的订单
  const pendingOrder = candidateOrders.find(
    (o) => o.status === "PENDING" || o.status === "WAIT_VERIFY"
  );

  if (!pendingOrder) {
    const paidOrder = candidateOrders.find((o) => o.status === "PAID");
    if (paidOrder) {
      return {
        statement,
        status: "ALREADY_PAID",
        orderNo: paidOrder.orderNo,
        orderId: paidOrder.id,
        planName: paidOrder.plan.name,
        userName: paidOrder.user.name || paidOrder.user.username,
        message: `订单 ${paidOrder.orderNo} 此前已被核销开通，无需重复操作`,
      };
    }

    return {
      statement,
      status: "ERROR",
      message: `找到匹配码但订单状态不可核销（${candidateOrders[0].status}）`,
    };
  }

  // 严格校验金额
  const expectedAmount = Number(pendingOrder.amount);
  const actualAmount = statement.amount;

  if (Math.abs(expectedAmount - actualAmount) > 0.01) {
    return {
      statement,
      status: "AMOUNT_MISMATCH",
      orderNo: pendingOrder.orderNo,
      orderId: pendingOrder.id,
      planName: pendingOrder.plan.name,
      userName: pendingOrder.user.name || pendingOrder.user.username,
      message: `金额不一致：订单应收 ¥${expectedAmount.toFixed(2)}，银行实际入账 ¥${actualAmount.toFixed(2)}`,
    };
  }

  // 金额与附言完全一致，执行原子核销并激活
  try {
    const auditNote = `【网银动账智能自动核销】渠道: ${statement.bankName} | 户名: ${statement.payerName || "未识别"} | 流水参考: ${statement.transactionRef || "自动提取"} | 匹配码: ${statement.matchingCode}`;

    const activated = await activatePaidOrder(pendingOrder.id, {
      transactionNo: statement.transactionRef || `BANK_AUTO_${Date.now()}`,
      auditNote,
    });

    if (!activated) {
      return {
        statement,
        status: "ERROR",
        orderNo: pendingOrder.orderNo,
        orderId: pendingOrder.id,
        message: "调用 activatePaidOrder 激活权益时失败",
      };
    }

    // 企微即时通报
    await sendAdminPaymentNotification({
      orderNo: pendingOrder.orderNo,
      userName: pendingOrder.user.name || pendingOrder.user.username,
      userEmail: pendingOrder.user.username.includes("@") ? pendingOrder.user.username : undefined,
      planName: pendingOrder.plan.name,
      billingCycle: pendingOrder.billingCycle,
      amount: String(actualAmount),
      channel: pendingOrder.channel,
      matchingCode: statement.matchingCode,
      note: `⚡ 自动核销成功！${auditNote}`,
    });

    return {
      statement,
      status: "MATCHED",
      orderNo: pendingOrder.orderNo,
      orderId: pendingOrder.id,
      planName: pendingOrder.plan.name,
      userName: pendingOrder.user.name || pendingOrder.user.username,
      message: `成功核销并激活！用户 ${pendingOrder.user.name} (${pendingOrder.user.username}) 的「${pendingOrder.plan.name}」已秒级到账。`,
    };
  } catch (err) {
    return {
      statement,
      status: "ERROR",
      orderNo: pendingOrder.orderNo,
      orderId: pendingOrder.id,
      message: `核销事务异常: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * 批量处理由财务人员从网银/企业邮箱导出的多段流水纯文本
 */
export async function batchReconcileBankStatements(
  rawStatementsText: string
): Promise<ReconcileResult[]> {
  // 按空行、分号或行首序号切分为多条流水记录
  const rawBlocks = rawStatementsText
    .split(/(?:\n\s*\n|\r\n\s*\r\n|(?<=[。；;\n])(?=\d+[\.、\s]))/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  const results: ReconcileResult[] = [];
  for (const block of rawBlocks) {
    const parsed = parseBankStatementText(block);
    if (parsed.amount > 0 && parsed.matchingCode) {
      const res = await matchAndReconcileStatement(parsed);
      results.push(res);
    } else {
      results.push({
        statement: parsed,
        status: "NOT_FOUND",
        message: "未能从该段文本中同时识别出有效金额与 4 位附言码",
      });
    }
  }

  return results;
}
