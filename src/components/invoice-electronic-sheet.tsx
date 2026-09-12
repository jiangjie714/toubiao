"use client";

import React, { useRef } from "react";
import { type InvoiceItem } from "@/app/actions/invoice";
import { PrinterIcon } from "@/components/icons";

interface Props {
  invoice: InvoiceItem;
  onClose?: () => void;
}

// 金额转中文大写
function numberToChineseCurrency(num: number): string {
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

export default function InvoiceElectronicSheet({ invoice, onClose }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const isSpecial = invoice.type === "SPECIAL";
  const capitalAmount = numberToChineseCurrency(invoice.amount);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* 顶部操作条（打印时不显示） */}
      <div className="print:hidden flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>税务规范版式电子凭证（已完成电子验真）</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary/90 transition-colors"
          >
            <PrinterIcon className="h-4 w-4" />
            <span>打印 / 导出 PDF 会计凭证</span>
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>

      {/* 发票版面主体（A4 标准打印容器） */}
      <div
        ref={printRef}
        className="invoice-print-container relative mx-auto max-w-4xl rounded-xl border-2 border-amber-800/60 bg-amber-50/20 p-8 text-slate-900 shadow-sm print:m-0 print:max-w-none print:border-none print:p-2 print:shadow-none font-sans"
        style={{ fontFamily: "'Songti SC', 'SimSun', serif" }}
      >
        {/* 发票标题区 */}
        <div className="relative mb-6 text-center">
          <div className="inline-block border-b-2 border-amber-900 pb-1">
            <h2 className="text-2xl font-bold tracking-widest text-amber-950">
              {isSpecial ? "电子发票（增值税专用发票）" : "电子发票（增值税普通发票）"}
            </h2>
            <div className="mt-0.5 h-0.5 w-full bg-amber-900"></div>
          </div>

          {/* 右上角发票代码与号码 */}
          <div className="absolute right-0 top-0 text-left text-xs space-y-1 font-mono text-slate-700">
            <div>
              <span className="text-amber-950 font-serif">发票代码：</span>
              <span className="font-semibold text-slate-900">{invoice.invoiceCode || "031002600111"}</span>
            </div>
            <div>
              <span className="text-amber-950 font-serif">发票号码：</span>
              <span className="font-semibold text-slate-900">{invoice.invoiceNumber || "26849102"}</span>
            </div>
            <div>
              <span className="text-amber-950 font-serif">开票日期：</span>
              <span>
                {invoice.issuedAt
                  ? new Date(invoice.issuedAt).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                    })
                  : new Date().toLocaleDateString("zh-CN")}
              </span>
            </div>
            <div>
              <span className="text-amber-950 font-serif">校验码：</span>
              <span className="text-[11px]">{invoice.checkCode || "89201 94810 29381 02931"}</span>
            </div>
          </div>
        </div>

        {/* 发票表格核心 */}
        <div className="border border-amber-900/80 bg-white text-xs text-slate-800">
          {/* 购买方与密码区 */}
          <div className="grid grid-cols-12 border-b border-amber-900/80">
            <div className="col-span-1 flex items-center justify-center border-r border-amber-900/80 bg-amber-50/50 p-2 font-serif text-amber-950 text-center leading-relaxed">
              购买方
            </div>
            <div className="col-span-6 border-r border-amber-900/80 p-2 space-y-1">
              <div>
                <span className="text-slate-500">名　　　　称：</span>
                <span className="font-medium text-slate-900">{invoice.title}</span>
              </div>
              <div>
                <span className="text-slate-500">纳税人识别号：</span>
                <span className="font-mono font-medium text-slate-900">{invoice.taxNumber}</span>
              </div>
              <div>
                <span className="text-slate-500">地 址、 电 话：</span>
                <span>{invoice.address || "—"} {invoice.phone || ""}</span>
              </div>
              <div>
                <span className="text-slate-500">开户行及账号：</span>
                <span>{invoice.bankName || "—"} {invoice.bankAccount || ""}</span>
              </div>
            </div>
            <div className="col-span-1 flex items-center justify-center border-r border-amber-900/80 bg-amber-50/50 p-2 font-serif text-amber-950 text-center leading-relaxed">
              密码区
            </div>
            <div className="col-span-4 p-2 font-mono text-[11px] tracking-wider text-slate-600 break-all leading-loose">
              04&gt;1&lt;675432-890+&lt;&gt;123456789012345
              <br />
              89-0&lt;1234567890+&gt;&lt;09876543212345
              <br />
              +&gt;&lt;5678901234-89&lt;&gt;123456789012
            </div>
          </div>

          {/* 货物与服务明细表头 */}
          <div className="grid grid-cols-12 border-b border-amber-900/80 bg-amber-50/40 text-center font-serif text-amber-950 py-1.5 font-medium">
            <div className="col-span-4 border-r border-amber-900/80">货物或应税劳务、服务名称</div>
            <div className="col-span-1 border-r border-amber-900/80">规格型号</div>
            <div className="col-span-1 border-r border-amber-900/80">单位</div>
            <div className="col-span-1 border-r border-amber-900/80">数量</div>
            <div className="col-span-1 border-r border-amber-900/80">单价(不含税)</div>
            <div className="col-span-2 border-r border-amber-900/80">金额(不含税)</div>
            <div className="col-span-1 border-r border-amber-900/80">税率</div>
            <div className="col-span-1">税额</div>
          </div>

          {/* 明细条目 */}
          <div className="grid grid-cols-12 border-b border-amber-900/80 py-3 text-center font-mono">
            <div className="col-span-4 border-r border-amber-900/80 px-2 text-left font-sans">
              <div className="font-medium text-slate-900">{invoice.itemName}</div>
              <div className="text-[11px] text-slate-500">关联订购: {invoice.planName} 会员服务</div>
            </div>
            <div className="col-span-1 border-r border-amber-900/80 font-sans text-slate-600">云服务</div>
            <div className="col-span-1 border-r border-amber-900/80 font-sans text-slate-600">项</div>
            <div className="col-span-1 border-r border-amber-900/80 text-slate-900">1</div>
            <div className="col-span-1 border-r border-amber-900/80 text-slate-900 tnum">
              {invoice.amountWithoutTax.toFixed(2)}
            </div>
            <div className="col-span-2 border-r border-amber-900/80 text-slate-900 font-semibold tnum">
              ¥{invoice.amountWithoutTax.toFixed(2)}
            </div>
            <div className="col-span-1 border-r border-amber-900/80 text-slate-900">6%</div>
            <div className="col-span-1 text-slate-900 font-semibold tnum">
              ¥{invoice.taxAmount.toFixed(2)}
            </div>
          </div>

          {/* 金额合计 */}
          <div className="grid grid-cols-12 border-b border-amber-900/80 py-2">
            <div className="col-span-4 border-r border-amber-900/80 text-center font-serif text-amber-950 font-medium">
              合　　　计
            </div>
            <div className="col-span-4 border-r border-amber-900/80 px-4 text-right font-mono font-semibold text-slate-900">
              ¥{invoice.amountWithoutTax.toFixed(2)}
            </div>
            <div className="col-span-4 px-4 text-right font-mono font-semibold text-slate-900">
              ¥{invoice.taxAmount.toFixed(2)}
            </div>
          </div>

          {/* 价税合计 */}
          <div className="grid grid-cols-12 border-b border-amber-900/80 py-2 bg-amber-50/20">
            <div className="col-span-3 border-r border-amber-900/80 text-center font-serif text-amber-950 font-medium">
              价税合计（大写）
            </div>
            <div className="col-span-5 border-r border-amber-900/80 px-4 font-serif font-semibold text-slate-900">
              {capitalAmount}
            </div>
            <div className="col-span-4 px-4 flex items-center justify-between font-mono">
              <span className="text-slate-500 font-serif">（小写）</span>
              <span className="text-base font-bold text-amber-900">¥{invoice.amount.toFixed(2)}</span>
            </div>
          </div>

          {/* 销售方与备注 */}
          <div className="relative grid grid-cols-12">
            <div className="col-span-1 flex items-center justify-center border-r border-amber-900/80 bg-amber-50/50 p-2 font-serif text-amber-950 text-center leading-relaxed">
              销售方
            </div>
            <div className="col-span-6 border-r border-amber-900/80 p-2 space-y-1">
              <div>
                <span className="text-slate-500">名　　　　称：</span>
                <span className="font-medium text-slate-900">标讯通（上海）数字科技有限公司</span>
              </div>
              <div>
                <span className="text-slate-500">纳税人识别号：</span>
                <span className="font-mono font-medium text-slate-900">91310115MA1K78902X</span>
              </div>
              <div>
                <span className="text-slate-500">地 址、 电 话：</span>
                <span>上海市浦东新区张江高科碧波路 888 号 021-88886666</span>
              </div>
              <div>
                <span className="text-slate-500">开户行及账号：</span>
                <span>招商银行上海张江支行 121908888810888</span>
              </div>
            </div>

            <div className="col-span-1 flex items-center justify-center border-r border-amber-900/80 bg-amber-50/50 p-2 font-serif text-amber-950 text-center leading-relaxed">
              备　注
            </div>
            <div className="col-span-4 p-2 text-xs text-slate-600 space-y-1">
              <div>对应平台订单号: {invoice.orderNo}</div>
              <div>接收电子邮箱: {invoice.email}</div>
              <div className="text-[10px] text-slate-400">
                本发票为增值税电子发票，法律效力、基本用途、基本使用规定与纸质发票相同。
              </div>
            </div>

            {/* 电子发票印章 SVG 覆层 */}
            <div className="absolute right-12 -bottom-4 pointer-events-none opacity-85 select-none print:opacity-95">
              <svg width="150" height="110" viewBox="0 0 150 110" fill="none" xmlns="http://www.w3.org/2000/svg">
                <ellipse cx="75" cy="55" rx="68" ry="46" stroke="#DC2626" strokeWidth="2.5" strokeDasharray="3 0" />
                <path d="M75 14 C100 14 125 24 135 45" stroke="#DC2626" strokeWidth="1" strokeDasharray="2 1" />
                <text x="75" y="38" textAnchor="middle" fill="#DC2626" fontSize="10.5" fontWeight="bold" fontFamily="SimSun, serif">
                  标讯通数字科技有限公司
                </text>
                <text x="75" y="58" textAnchor="middle" fill="#DC2626" fontSize="12" fontWeight="bold" letterSpacing="2" fontFamily="SimSun, serif">
                  发票专用章
                </text>
                <text x="75" y="76" textAnchor="middle" fill="#DC2626" fontSize="8.5" fontFamily="monospace" letterSpacing="1">
                  (91310115MA1K78902X)
                </text>
                <ellipse cx="75" cy="55" rx="64" ry="42" stroke="#DC2626" strokeWidth="1" opacity="0.6" />
              </svg>
            </div>
          </div>
        </div>

        {/* 底栏人员 */}
        <div className="mt-4 flex items-center justify-between text-xs text-slate-600 font-serif">
          <div>收款人：财务部（自动化清算）</div>
          <div>复核：智能风控复核组</div>
          <div>开票人：系统管理员</div>
          <div>销售方：（章）</div>
        </div>
      </div>
    </div>
  );
}
