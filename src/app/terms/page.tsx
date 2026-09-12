import Link from "next/link";

export const metadata = { title: "用户服务协议" };

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-canvas px-4 py-8">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white shadow-sm">
            标
          </span>
          <span className="text-base font-bold text-primary-strong">标讯通</span>
        </Link>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <Link href="/privacy" className="hover:text-primary">隐私政策</Link>
          <span>·</span>
          <Link href="/register" className="hover:text-primary">返回注册</Link>
          <span>·</span>
          <Link href="/login" className="hover:text-primary">登录</Link>
        </div>
      </div>
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-slate-200 bg-surface p-8 shadow-sm md:p-12">
        <div className="border-b border-slate-100 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">标讯通用户服务协议</h1>
          <p className="mt-2 text-xs text-slate-500">更新时间：2026年9月 · 标讯通团队</p>
        </div>

      <div className="space-y-6 text-sm leading-7 text-slate-700">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">一、前言与协议确认</h2>
          <p>
            欢迎使用标讯通（以下简称“本平台”）。在注册、登录或使用本平台各项功能前，请您务必审慎阅读、充分理解本《用户服务协议》（以下简称“本协议”）及《隐私保护政策》各项条款。如您对本协议的任何条款有异议，请立即停止访问或使用本平台。当您勾选确认、点击“立即注册”或实际使用本服务时，即表示您已充分阅读并完全接受本协议的所有内容。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">二、平台服务说明</h2>
          <p>
            标讯通致力于为企业及个人提供全国招投标与政府采购公开公告的信息聚合、多维筛选检索、标书订阅预警与数据导出等服务。
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li>本平台公告信息均采集自国家公共资源交易平台、政府采购网等官方合法公开渠道。</li>
            <li>平台展示内容包括但不限于招标公告、中标公示、变更更正及竞谈询价信息，仅供商业参考与初步研判。</li>
            <li>用户应以招标人或政府采购主管机关发布的官方原始公告和招标文件为最终准绳，官方原文链接均在详情页内明确提供。</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">三、账号注册与安全</h2>
          <p>
            用户在注册账号时应提供真实、准确、合法的个人或企业信息。用户须妥善保管其账号及登录凭证，对使用该账号实施的所有行为承担法律责任。
          </p>
          <p>
            严禁将本平台账号转让、出借、出租或以恶意拼单方式供第三方使用。若发现异常高频抓取、撞库或盗用账号行为，平台有权根据风控机制立即采取冻结、封禁或限制导出等措施。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">四、增值会员服务与支付</h2>
          <p>
            本平台提供免费版及多级付费会员服务（黄金版、白金版、企业定制版等）。各套餐的服务配额、功能特权、计费周期与价格标准均在<Link href="/pricing" className="font-semibold text-primary underline">【会员套餐页】</Link>公开明示。
          </p>
          <p>
            用户开通付费套餐可通过微信支付、支付宝或对公银行转账结算。除因本平台故障导致长达72小时以上完全无法使用且无法补救的特殊情形外，虚拟数字服务开通生效后一般不予退费。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">五、用户行为规范与知识产权</h2>
          <p>
            用户在使用本平台时，必须遵守国家宪法、网络安全法、反不正当竞争法等法律法规。用户不得利用恶意爬虫、漏洞攻击工具对本平台发起拒绝服务攻击或大规模脱机转存。
          </p>
          <p>
            本平台的软件架构、UI界面设计、分类标签体系、AI速读算法及软件著作权均归标讯通所有。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">六、免责声明</h2>
          <p>
            因不可抗力、目标政采网站服务器临时故障/改版反爬、网络链路拥堵等非本平台可控原因导致的数据延迟或暂时失真，本平台不承担间接损失赔偿责任。
          </p>
          <p>
            本平台详情页提供「数据报错 / 纠错反馈」入口，用户若发现任何内容出入或失效链接，可随时在线反馈，平台承诺在收到后积极审核与修正。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">七、其他</h2>
          <p>
            标讯通有权根据业务发展与国家法律法规适时修改本协议，修改后的条款一旦公布即生效。本协议之订立、生效、解释及争议解决均适用中华人民共和国大陆地区法律。
          </p>
        </section>
      </div>

      <div className="border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
        如有疑问，请通过官方支持渠道联系我们 · 标讯通
      </div>
    </div>
    </div>
  );
}
