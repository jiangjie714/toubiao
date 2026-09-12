import Link from "next/link";

export const metadata = { title: "隐私保护政策" };

export default function PrivacyPage() {
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
          <Link href="/terms" className="hover:text-primary">服务协议</Link>
          <span>·</span>
          <Link href="/register" className="hover:text-primary">返回注册</Link>
          <span>·</span>
          <Link href="/login" className="hover:text-primary">登录</Link>
        </div>
      </div>
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-slate-200 bg-surface p-8 shadow-sm md:p-12">
        <div className="border-b border-slate-100 pb-6">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">标讯通隐私保护政策</h1>
          <p className="mt-2 text-xs text-slate-500">更新时间：2026年9月 · 标讯通团队</p>
        </div>

      <div className="space-y-6 text-sm leading-7 text-slate-700">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">一、引言</h2>
          <p>
            标讯通（以下简称“我们”）深知个人信息对您的重要性，并庄严承诺保护您的个人信息与隐私安全。本政策将向您阐明我们在您使用标讯通网站与服务时，如何收集、使用、保存及保护您的个人信息。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">二、我们收集的信息范围</h2>
          <p>为向您提供各项招投标信息服务，我们仅收集实现功能所必需的信息：</p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li>
              <b>账号注册信息</b>：您在注册时填写的用户名、姓名、电子邮箱地址及加密后的密码散列值（哈希密码）。
            </li>
            <li>
              <b>业务与使用信息</b>：您创建的关键词订阅规则（Watch）、推送接收偏好、检索与筛选条件记录。
            </li>
            <li>
              <b>交易与支付记录</b>：当您开通会员时生成的订单号、套餐类型、支付金额、交易时间及第三方渠道交易流水号（我们不留存您的银行卡密码或支付密码）。
            </li>
            <li>
              <b>安全与风控日志</b>：在您执行批量数据导出或系统登录时，系统自动记录的IP地址、浏览器User-Agent与操作时间戳，用于防范自动化滥用与恶意爬取。
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">三、Cookie 与同类技术的使用</h2>
          <p>
            为确保网站正常运转，我们在您的设备上存储名为 <code className="rounded bg-slate-100 px-1 py-0.5 font-mono text-xs text-primary">tb_session</code> 的必要性安全凭证（HttpOnly Cookie）。该 Cookie 仅用于验证您的身份登录状态，并防御跨站请求伪造，我们不会利用 Cookie 进行跨站商业追踪或投放广告。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">四、信息的共享、转让与公开披露</h2>
          <p>
            我们承诺绝不出售您的个人信息。除以下法定或业务必要情形外，不会向任何第三方提供：
          </p>
          <ul className="list-disc space-y-1 pl-5 text-slate-600">
            <li><b>支付服务商</b>：在您使用微信支付或支付宝时，根据交易指令将订单号与金额传输给支付机构完成扣款。</li>
            <li><b>邮件发送服务</b>：通过安全加密通道向您授权的邮箱地址投递验证邮件或关键词招投标早报。</li>
            <li><b>法律法规要求</b>：根据法律法规、司法机关或行政执法机关的合法强制指令。</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">五、数据安全保障</h2>
          <p>
            我们采用业内标准的加密算法（如 bcrypt 密码哈希、JWT 防篡改验签、TLS 全程传输加密）保护您的数据资产。数据库与备份机制实施严格的访问权限控制与审计隔离。
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-slate-900">六、您的权利与联系我们</h2>
          <p>
            您有权在个人中心查看、修改个人资料，或根据需要停用、删除关键词订阅规则。如对本政策有任何疑问或需要注销账号，请联系平台管理员。
          </p>
        </section>
      </div>

      <div className="border-t border-slate-100 pt-6 text-center text-xs text-slate-500">
        感谢您对标讯通的信任 · <Link href="/terms" className="text-primary hover:underline">查看用户服务协议</Link>
      </div>
    </div>
    </div>
  );
}
