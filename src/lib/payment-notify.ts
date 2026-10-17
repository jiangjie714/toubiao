import { getAppUrl, sendMail } from "./mailer";
import { generateAuditToken } from "./payments";

export interface PaymentNotifyPayload {
  orderNo: string;
  userName: string;
  userEmail?: string | null;
  planName: string;
  billingCycle: string;
  amount: number | string;
  channel: string;
  matchingCode?: string | null;
  note?: string | null;
}

const CHANNEL_LABEL: Record<string, string> = {
  wechat: "微信支付(个人码)",
  alipay: "支付宝(个人码)",
  bank: "企业对公转账",
};

/**
 * 当用户在收银台点击“我已支付”或上传打款底单时，
 * 触发向管理员多渠道推送（企微机器人 Webhook + 邮件通知），包含免密一键核销放行链接。
 */
export async function sendAdminPaymentNotification(
  payload: PaymentNotifyPayload,
): Promise<{ success: boolean; wecom?: boolean; mail?: boolean }> {
  const token = generateAuditToken(payload.orderNo, 86400 * 2); // 48 小时有效
  const verifyUrl = `${getAppUrl()}/pay/verify?orderNo=${payload.orderNo}&token=${token}`;
  const channelName = CHANNEL_LABEL[payload.channel] || payload.channel;
  const cycleName = payload.billingCycle === "monthly" ? "月付" : "年付";

  let wecomSuccess = false;
  let mailSuccess = false;

  // 1. 发送企业微信群机器人 Webhook (若配置)
  const wecomWebhookUrl = process.env.WECOM_BOT_WEBHOOK_URL;
  if (wecomWebhookUrl) {
    try {
      const wecomBody = {
        msgtype: "markdown",
        markdown: {
          content: `### 🚨【标讯通·新收款待核销通知】\n` +
            `> **订单编号**：\`${payload.orderNo}\`\n` +
            `> **付款客户**：${payload.userName} (${payload.userEmail || "未留邮箱"})\n` +
            `> **采购套餐**：<font color="info">${payload.planName}</font> (${cycleName})\n` +
            `> **实付金额**：<font color="warning">¥${Number(payload.amount).toFixed(2)}</font>\n` +
            `> **付款渠道**：${channelName}\n` +
            `> **附言识别码**：<font color="comment">【${payload.matchingCode || "未填"}】</font>\n` +
            (payload.note ? `> **凭证说明**：${payload.note}\n` : "") +
            `\n👉 [手机端免登一键审核核销](${verifyUrl})`,
        },
      };

      const resp = await fetch(wecomWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(wecomBody),
      });
      wecomSuccess = resp.ok;
    } catch (err) {
      console.error("[payment-notify] WeCom webhook failed:", err);
    }
  }

  // 2. 发送管理员邮件通知 (若配置)
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      await sendMail({
        to: adminEmail,
        subject: `【标讯通】收到待核销款项通知 - ${payload.orderNo} (¥${Number(payload.amount).toFixed(2)})`,
        text: `收到新付款通知：\n订单号：${payload.orderNo}\n客户：${payload.userName}\n套餐：${payload.planName} (${cycleName})\n金额：¥${Number(payload.amount).toFixed(2)}\n附言码：${payload.matchingCode || "无"}\n渠道：${channelName}\n请点击链接审核核销：${verifyUrl}`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 600px; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <h2 style="color: #0f172a; margin-top: 0;">标讯通·新收款待核销通知</h2>
            <p style="color: #475569; font-size: 14px;">有用户在收银台报告已完成付款，请财务或管理员核对银行/微信到账流水：</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px; color: #64748b;">订单编号</td><td style="padding: 8px; font-weight: bold; font-family: monospace;">${payload.orderNo}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px; color: #64748b;">客户账号</td><td style="padding: 8px;">${payload.userName}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px; color: #64748b;">套餐规格</td><td style="padding: 8px;">${payload.planName} (${cycleName})</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px; color: #64748b;">应付金额</td><td style="padding: 8px; font-size: 16px; font-weight: bold; color: #2563eb;">¥${Number(payload.amount).toFixed(2)}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px; color: #64748b;">支付渠道</td><td style="padding: 8px;">${channelName}</td></tr>
              <tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px; color: #64748b;">附言识别码</td><td style="padding: 8px; font-weight: bold; color: #dc2626; font-size: 15px;">${payload.matchingCode || "无"}</td></tr>
              ${payload.note ? `<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 8px; color: #64748b;">凭证说明</td><td style="padding: 8px;">${payload.note}</td></tr>` : ""}
            </table>
            <div style="margin-top: 24px;">
              <a href="${verifyUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
                手机端直接审核并开通 →
              </a>
            </div>
            <p style="margin-top: 16px; font-size: 11px; color: #94a3b8;">此链接具备专属安全加密签名，48 小时内有效。</p>
          </div>
        `,
      });
      mailSuccess = true;
    } catch (err) {
      console.error("[payment-notify] Email send failed:", err);
    }
  }

  // 即使在没有真实外发配置的本地开发环境，也在控制台输出醒目的审核链接
  console.info(`[payment-notify] 订单待审核：${payload.orderNo} | 金额: ¥${payload.amount} | 附言码: ${payload.matchingCode} | 免密审核URL: ${verifyUrl}`);

  return { success: true, wecom: wecomSuccess, mail: mailSuccess };
}
