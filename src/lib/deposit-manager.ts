export type DepositStatus =
  | "PENDING_PAY"
  | "IN_TRANSIT"
  | "REFUND_APPLIED"
  | "REFUNDED"
  | "OVERDUE_RISK"
  | "FORFEITED";

export type PaymentMethod =
  | "BANK_TRANSFER"
  | "E_BOND"
  | "PAPER_BOND"
  | "CASH_CHECK";

export const DEPOSIT_STATUS_META: Record<
  DepositStatus,
  { label: string; color: string; badgeBg: string; desc: string }
> = {
  PENDING_PAY: {
    label: "待缴纳出账",
    color: "text-amber-700",
    badgeBg: "bg-amber-50 text-amber-700 border-amber-200",
    desc: "已录入但尚未完成银行电汇出账或保函出具",
  },
  IN_TRANSIT: {
    label: "在途中 (已缴纳)",
    color: "text-blue-700",
    badgeBg: "bg-blue-50 text-blue-700 border-blue-200",
    desc: "资金已汇出锁定，等待项目截标、开标或合同签订",
  },
  REFUND_APPLIED: {
    label: "已申请退款",
    color: "text-purple-700",
    badgeBg: "bg-purple-50 text-purple-700 border-purple-200",
    desc: "已向采购人或交易中心提交退保申请，财务流转中",
  },
  REFUNDED: {
    label: "已全额退还",
    color: "text-emerald-700",
    badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200",
    desc: "保证金已原路安全退回公司基本账户，闭环销账",
  },
  OVERDUE_RISK: {
    label: "超期滞留风险",
    color: "text-rose-700",
    badgeBg: "bg-rose-50 text-rose-700 border-rose-200",
    desc: "已超出法定退款时限（>5工作日），存在资金无息滞留风险",
  },
  FORFEITED: {
    label: "扣除/没收",
    color: "text-slate-600",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-300",
    desc: "因放弃中标或违规行为被招标方依法扣除没收",
  },
};

export const PAYMENT_METHOD_META: Record<
  PaymentMethod,
  { label: string; shortLabel: string; isBond: boolean }
> = {
  BANK_TRANSFER: {
    label: "现金银行电汇",
    shortLabel: "银行转账",
    isBond: false,
  },
  E_BOND: {
    label: "电子投标保函",
    shortLabel: "电子保函",
    isBond: true,
  },
  PAPER_BOND: {
    label: "银行/担保纸质保函",
    shortLabel: "纸质保函",
    isBond: true,
  },
  CASH_CHECK: {
    label: "银行汇票/支票",
    shortLabel: "支票汇票",
    isBond: false,
  },
};

export interface DepositItemView {
  id: number;
  tenderId: number | null;
  projectName: string;
  projectNo: string | null;
  purchaser: string | null;
  payeeName: string | null;
  amount: number; // 元
  paymentMethod: PaymentMethod;
  methodLabel: string;
  paidAt: string | null;
  deadline: string | null;
  refundDeadline: string | null;
  refundedAt: string | null;
  refundAmount: number | null;
  status: DepositStatus;
  statusLabel: string;
  isOverdue: boolean;
  overdueDays: number;
  bankAccount: string | null;
  notes: string | null;
  createdAt: string;
}

export interface DepositDashboardSummary {
  totalDepositsCount: number;
  inTransitAmount: number; // 在途流动性占用金额 (元)
  overdueRiskAmount: number; // 超期未退高危滞留金额 (元)
  refundedAmount: number; // 已退回资金 (元)
  eBondSavingsOpportunity: number; // 若全量转电子保函可释放的流动资金 (元)
  inTransitCount: number;
  overdueCount: number;
  refundedCount: number;
  pendingPayCount: number;
}

/**
 * 格式化并精算保证金大盘汇总数据
 */
export function calculateDepositDashboardSummary(
  items: Array<{
    amount: number | { toString(): string };
    status: string;
    paymentMethod: string;
    refundDeadline?: Date | string | null;
    refundAmount?: number | { toString(): string } | null;
  }>
): DepositDashboardSummary {
  let inTransitAmount = 0;
  let overdueRiskAmount = 0;
  let refundedAmount = 0;
  let eBondSavingsOpportunity = 0;
  let inTransitCount = 0;
  let overdueCount = 0;
  let refundedCount = 0;
  let pendingPayCount = 0;

  const now = new Date();

  for (const item of items) {
    const amt = Number(item.amount);
    const refAmt = item.refundAmount ? Number(item.refundAmount) : amt;
    const status = item.status as DepositStatus;
    const isOverdue =
      (status === "IN_TRANSIT" || status === "REFUND_APPLIED" || status === "OVERDUE_RISK") &&
      Boolean(item.refundDeadline && new Date(item.refundDeadline) < now);

    if (status === "PENDING_PAY") {
      pendingPayCount++;
    } else if (status === "REFUNDED") {
      refundedAmount += refAmt;
      refundedCount++;
    } else if (status === "FORFEITED") {
      // 没收不计入在途
    } else {
      // 包含 IN_TRANSIT, REFUND_APPLIED, OVERDUE_RISK
      inTransitAmount += amt;
      inTransitCount++;

      // 如果是用现金转账而非保函，则可释放该流动资金
      if (item.paymentMethod === "BANK_TRANSFER" || item.paymentMethod === "CASH_CHECK") {
        eBondSavingsOpportunity += amt;
      }

      if (isOverdue || status === "OVERDUE_RISK") {
        overdueRiskAmount += amt;
        overdueCount++;
      }
    }
  }

  return {
    totalDepositsCount: items.length,
    inTransitAmount: Math.round(inTransitAmount * 100) / 100,
    overdueRiskAmount: Math.round(overdueRiskAmount * 100) / 100,
    refundedAmount: Math.round(refundedAmount * 100) / 100,
    eBondSavingsOpportunity: Math.round(eBondSavingsOpportunity * 100) / 100,
    inTransitCount,
    overdueCount,
    refundedCount,
    pendingPayCount,
  };
}

/**
 * 自动生成《投标保证金退还催办催款公函》（格式化法律文书文本）
 */
export function generateRefundDemandLetter(
  deposit: DepositItemView,
  companyName: string = "我司"
): string {
  const dateStr = new Date().toLocaleDateString("zh-CN");
  const overdueStr = deposit.overdueDays > 0 ? `已超期 ${deposit.overdueDays} 天` : "已届法定退款期";

  return `
【 关 于 投 标 保 证 金 退 还 事 宜 的 催 办 函 】

致：${deposit.payeeName || deposit.purchaser || "贵单位/采购代理机构/公共资源交易中心"}

我司（${companyName}）于此前参与贵方组织的【${deposit.projectName}】（项目编号：${deposit.projectNo || "详见招标文件"}）的招投标工作，并已于 ${deposit.paidAt || "投标截止前"} 依规足额缴纳投标保证金共计人民币：¥${deposit.amount.toLocaleString()} 元（大写：${numberToChineseUpper(deposit.amount)}）。

现该项目招投标工作已完结/已公布中标结果并签订合同，依据国家现行法律法规：
1. 《中华人民共和国招标投标法实施条例》第五十七条明确规定：“招标人最迟应当在书面合同签订后5日内向中标人和未中标的中标候选人退还投标保证金及银行同期存款利息。”
2. 《政府采购货物和服务招标投标管理办法》（财政部令第87号）第三十八条明确规定：“采购人或者采购代理机构应当自中标通知书发出之日起5个工作日内退还未中标供应商的投标保证金，自政府采购合同签订之日起5个工作日内退还中标供应商的投标保证金。”

截至今日，上述投标保证金${overdueStr}尚未退还至我司账户。为保障企业合法资金权益与合规财务结算，特函请贵单位接函后于 3 个工作日内办理退款手续。

我司指定退款收款银行账户信息如下：
- 开户名称：${companyName}
- 开户银行：${deposit.bankAccount ? deposit.bankAccount.split(" ")[0] || "企业基本存款开户银行" : "（请核对我司开户许可证原件）"}
- 银行账号：${deposit.bankAccount ? deposit.bankAccount.split(" ")[1] || "请核对转账原路" : "（与原转账汇出基本账户一致）"}

特此函告，感谢贵方的大力支持与配合！

催办申请单位：${companyName}（盖章）
发函日期：${dateStr}
`.trim();
}

/**
 * 数字金额转中文大写
 */
function numberToChineseUpper(num: number): string {
  const fraction = ["角", "分"];
  const digit = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const unit = [
    ["元", "万", "亿"],
    ["", "拾", "佰", "仟"],
  ];

  const head = num < 0 ? "欠" : "";
  num = Math.abs(num);

  let s = "";
  for (let i = 0; i < fraction.length; i++) {
    s += (digit[Math.floor(num * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(/零./, "");
  }
  s = s || "整";
  num = Math.floor(num);

  for (let i = 0; i < unit[0].length && num > 0; i++) {
    let p = "";
    for (let j = 0; j < unit[1].length && num > 0; j++) {
      p = digit[num % 10] + unit[1][j] + p;
      num = Math.floor(num / 10);
    }
    s = p.replace(/(零.)*零$/, "").replace(/^$/, "零") + unit[0][i] + s;
  }
  return head + s.replace(/(零.)*零元/, "元").replace(/(零.)+/g, "零").replace(/^整$/, "零元整");
}
