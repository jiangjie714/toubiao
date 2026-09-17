import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import PrintButton from "@/components/print-button";
import { getCompanyPaymentConfig } from "@/lib/company-config";

export const metadata = {
  title: "电子服务采购合同 - 标讯通",
  description: "标讯通企业信息数据服务采购电子合同与法律公章凭据",
};

function amountToChinese(n: number): string {
  const fraction = ["角", "分"];
  const digit = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const unit = [
    ["元", "万", "亿"],
    ["", "拾", "佰", "仟"],
  ];
  const head = n < 0 ? "负" : "";
  n = Math.abs(n);

  let s = "";
  for (let i = 0; i < fraction.length; i++) {
    s += (
      digit[Math.floor(n * 10 * Math.pow(10, i)) % 10] + fraction[i]
    ).replace(/零./, "");
  }
  s = s || "整";
  n = Math.floor(n);

  for (let i = 0; i < unit[0].length && n > 0; i++) {
    let p = "";
    for (let j = 0; j < unit[1].length && n > 0; j++) {
      p = digit[n % 10] + unit[1][j] + p;
      n = Math.floor(n / 10);
    }
    s = p.replace(/(零.)*零$/, "").replace(/^$/, "零") + unit[0][i] + s;
  }
  return (
    head +
    s
      .replace(/(零.)*零元/, "元")
      .replace(/(零.)+/g, "零")
      .replace(/^整$/, "零元整")
  );
}

export default async function ContractPage({
  params,
}: {
  params: Promise<{ orderNo: string }>;
}) {
  const { orderNo } = await params;
  const user = await getSession();
  if (!user) redirect(`/login?next=/contract/${orderNo}`);

  const order = await prisma.order.findFirst({
    where: { orderNo, userId: user.uid },
    include: {
      plan: true,
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
        },
      },
    },
  });

  if (!order) notFound();

  const numAmount = Number(order.amount);
  const chineseAmount = amountToChinese(numAmount);
  const createDateStr = order.createdAt.toISOString().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl py-6 print:py-0">
      {/* 顶部操作控制条（打印时隐藏） */}
      <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-surface p-4 shadow-xs print:hidden">
        <div className="flex items-center gap-2">
          <Link
            href={`/pay/${order.orderNo}`}
            className="text-xs text-slate-500 hover:text-primary transition"
          >
            ← 返回订单收银台
          </Link>
          <span className="text-slate-300">|</span>
          <span className="text-xs font-semibold text-slate-700">
            合同编号: HT-{order.orderNo}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <PrintButton />
        </div>
      </div>

      {/* 正式法律合同主体 */}
      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white p-8 sm:p-12 shadow-sm print:border-none print:p-0 print:shadow-none font-serif text-slate-900 leading-relaxed">
        {/* 头部标题 */}
        <div className="text-center border-b-2 border-slate-900 pb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-wider">
            标讯通企业数据服务采购合同
          </h1>
          <div className="mt-3 flex justify-between text-xs text-slate-600 font-sans">
            <span>合同编号：HT-{order.orderNo}</span>
            <span>签约日期：{createDateStr}</span>
            <span>签署地点：中国·北京</span>
          </div>
        </div>

        {/* 签约双方信息 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-sans border-b border-slate-200 pb-6">
          <div className="space-y-1.5">
            <div className="font-bold text-sm text-slate-900">
              甲方（采购客户）：{order.user.name || order.user.username}
            </div>
            <div>企业账号：{order.user.username}</div>
            <div>电子邮箱：{order.user.email || "未留存"}</div>
            <div>服务代表：{order.user.name}</div>
          </div>

          <div className="space-y-1.5">
            <div className="font-bold text-sm text-slate-900">
              乙方（服务机构）：{getCompanyPaymentConfig().companyName}
            </div>
            <div>统一社会信用代码：{getCompanyPaymentConfig().taxNumber}</div>
            <div>开户银行：{getCompanyPaymentConfig().bankName}</div>
            <div>对公银行账号：{getCompanyPaymentConfig().bankAccount}</div>
            <div>联行行号：{getCompanyPaymentConfig().bankBranchCode}</div>
          </div>
        </div>

        {/* 鉴于与正文条款 */}
        <div className="mt-6 space-y-6 text-xs sm:text-sm">
          <div>
            <p className="indent-8 text-justify">
              鉴于甲方在生产经营与招投标业务中对全国公共资源交易与政府采购大数据的查询、分析及商机监控需求，
              乙方作为“标讯通”数据智能服务平台的合法运营方，拥有完备的招投标数据聚合服务与商业化系统。双方依据《中华人民共和国民法典》及相关法律法规，
              经友好协商一致，特签订本采购服务合同，以资信守。
            </p>
          </div>

          {/* 第一条：服务标的与套餐规格 */}
          <div className="space-y-2">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              第一条 服务标的与产品规格
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-slate-300 text-xs font-sans">
                <thead>
                  <tr className="bg-slate-100 text-left text-slate-700">
                    <th className="border border-slate-300 p-2.5">服务项目</th>
                    <th className="border border-slate-300 p-2.5">规格周期</th>
                    <th className="border border-slate-300 p-2.5">授权功能明细</th>
                    <th className="border border-slate-300 p-2.5 text-right">费用总计</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 p-2.5 font-bold">
                      标讯通 {order.plan.name} 数据服务
                    </td>
                    <td className="border border-slate-300 p-2.5">
                      {order.billingCycle === "monthly" ? "1 个月" : "1 年 (12个月)"}
                    </td>
                    <td className="border border-slate-300 p-2.5 text-slate-600">
                      全库无限制搜索、正文全文穿透、采购人联系方式穿透、
                      企业微信/钉钉商机推送、Excel商机批量导出、项目全生命周期穿透
                    </td>
                    <td className="border border-slate-300 p-2.5 text-right font-bold font-mono">
                      ¥{numAmount.toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 第二条：合同价款与支付结算 */}
          <div className="space-y-2">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              第二条 合同价款与结算方式
            </h2>
            <ul className="list-decimal pl-6 space-y-1 text-justify">
              <li>
                合同总金额：人民币（大写）{" "}
                <span className="font-bold underline decoration-slate-400 underline-offset-4">
                  {chineseAmount}
                </span>{" "}
                （小写：¥{numAmount.toFixed(2)} 元）。
              </li>
              <li>
                结算方式：甲方通过银行对公转账电汇方式，全额汇入本合同首部乙方指定的官方对公银行账户。
              </li>
              <li>
                转账附言：甲方汇款时须注明订单识别号【
                <span className="font-mono font-bold">{order.orderNo}</span>
                】，乙方财务人员在确认款项到账后 1 个工作日内核销并正式开通对应会员权限。
              </li>
              <li>
                发票索取：乙方确认收到款项后，依据甲方在标讯通发票中心提交的开票信息，开具等额增值税普通发票或增值税专用发票。
              </li>
            </ul>
          </div>

          {/* 第三条：甲乙双方权责 */}
          <div className="space-y-2">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              第三条 双方权利与义务
            </h2>
            <ul className="list-decimal pl-6 space-y-1 text-justify">
              <li>
                乙方向甲方提供安全、连续、稳定的数据检索与商机监测网络服务，系统年度可用率承诺不低于 99.5%。
              </li>
              <li>
                甲方应妥善保管平台账号与密码，不得利用平台数据从事非法破解、恶意爬取或转售第三方牟利等危害网络安全的行为。
              </li>
              <li>
                甲方理解并认可，标讯通汇聚的信息均来源于依法合规公开的政采及公共资源交易渠道，标讯通对官方原始公示内容的准确性秉持客观中立原则。
              </li>
            </ul>
          </div>

          {/* 第四条：保密与争议解决 */}
          <div className="space-y-2">
            <h2 className="font-bold text-slate-900 text-sm sm:text-base">
              第四条 保密与法律适用
            </h2>
            <p className="indent-8 text-justify">
              任何一方对因签署或履行本合同而获得的对方商业秘密与交易信息负有严格保密责任。
              本合同的订立、效力、解释及争议解决均适用中华人民共和国法律。
              因履行本合同发生的争议，双方应友好协商解决；协商不成的，均应向乙方住所地有管辖权的人民法院提起诉讼。
            </p>
          </div>
        </div>

        {/* 签字盖章区 */}
        <div className="mt-12 pt-8 border-t-2 border-slate-900 grid grid-cols-2 gap-8 text-xs font-sans relative">
          {/* 甲方签章 */}
          <div className="space-y-8">
            <div>
              <span className="font-bold">甲方（盖章）：</span>
              <span className="text-slate-700">
                {order.user.name || order.user.username}
              </span>
            </div>
            <div>法定代表人或授权代表（签字）：</div>
            <div>签署日期：______年____月____日</div>
          </div>

          {/* 乙方签章与电子印章 */}
          <div className="space-y-8 relative">
            <div>
              <span className="font-bold">乙方（盖章）：</span>
              <span className="text-slate-700">
                {getCompanyPaymentConfig().companyName}
              </span>
            </div>
            <div>法定代表人或授权代表（签字）： 授权签署</div>
            <div>签署日期：{createDateStr}</div>

            {/* 仿真电子合同专用印章 */}
            <div className="absolute right-6 -top-4 pointer-events-none opacity-85 select-none">
              <div className="h-32 w-32 rounded-full border-2 border-red-600 flex flex-col items-center justify-center p-2 text-center text-red-600 font-serif rotate-[-12deg]">
                <div className="text-[9px] tracking-tight font-sans font-bold">
                  ★ {getCompanyPaymentConfig().companyName} ★
                </div>
                <div className="my-1 text-base">★</div>
                <div className="text-xs font-bold tracking-widest border-t border-b border-red-600 py-0.5 w-full">
                  合同专用章
                </div>
                <div className="text-[9px] font-mono mt-0.5">
                  {getCompanyPaymentConfig().taxNumber?.slice(0, 16)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
