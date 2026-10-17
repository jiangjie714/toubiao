import { prisma } from "./prisma";
import { getAppUrl, sendMail } from "./mailer";

export interface ExpiringNoticeResult {
  userId: number;
  userName: string;
  userEmail?: string | null;
  planName: string;
  stage: "T_MINUS_15" | "T_MINUS_3" | "EXPIRED";
  endsAt: Date;
  daysRemaining: number;
  sentChannels: string[];
}

/**
 * 巡检即将到期与已过期会员，分梯队发送召回与续订提醒
 */
export async function processSubscriptionLifecycleAlerts(options: {
  dryRun?: boolean;
} = {}): Promise<ExpiringNoticeResult[]> {
  const now = new Date();
  const appUrl = getAppUrl();
  const results: ExpiringNoticeResult[] = [];

  // 1. 查询所有已生效的付费订阅 (排除 FREE 免费套餐)
  const subscriptions = await prisma.subscription.findMany({
    where: {
      status: "ACTIVE",
      endsAt: { not: null },
      plan: { code: { not: "FREE" } },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          emailVerified: true,
          wechatOpenId: true,
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  for (const sub of subscriptions) {
    if (!sub.endsAt) continue;

    const diffMs = sub.endsAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    let stage: ExpiringNoticeResult["stage"] | null = null;
    let emailSubject = "";
    let emailContentHtml = "";

    // 阶梯 1: T-15 (13 ~ 15 天)
    if (daysRemaining > 3 && daysRemaining <= 15) {
      stage = "T_MINUS_15";
      emailSubject = `【标讯通温馨提醒】您的「${sub.plan.name}」权益将于 ${daysRemaining} 天后到期`;
      emailContentHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e293b;">
          <h3 style="color: #2563eb;">尊敬的 ${sub.user.name || sub.user.username}：</h3>
          <p>感谢您一直以来对标讯通招投标大数据服务的信任与支持！</p>
          <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; font-size: 14px;"><strong>当前套餐：</strong>${sub.plan.name}</p>
            <p style="margin: 6px 0 0; font-size: 14px;"><strong>到期时间：</strong>${sub.endsAt.toLocaleDateString("zh-CN")}</p>
            <p style="margin: 6px 0 0; font-size: 14px; color: #d97706;"><strong>剩余有效天数：</strong>${daysRemaining} 天</p>
          </div>
          <p>为保障您的每日商机雷达推送、项目全景穿透以及附件原文查阅不中断，建议您提前完成续期。现在续约，<strong>新周期将在原有到期日后无缝顺延叠加</strong>，剩余天数绝不浪费！</p>
          <div style="margin-top: 24px;">
            <a href="${appUrl}/pricing?utm_source=lifecycle_t15" style="display: inline-block; background: #2563eb; color: #ffffff; padding: 10px 22px; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 14px;">
              立即无缝续期
            </a>
          </div>
        </div>
      `;
    }
    // 阶梯 2: T-3 (0 ~ 3 天，紧急冲刺)
    else if (daysRemaining >= 0 && daysRemaining <= 3) {
      stage = "T_MINUS_3";
      emailSubject = `【紧急提醒】您的标讯通「${sub.plan.name}」仅剩 ${daysRemaining === 0 ? "不足 24 小时" : `${daysRemaining} 天`}，即将停止推送`;
      emailContentHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; line-height: 1.6; color: #1e293b;">
          <h3 style="color: #e11d48;">🚨 紧急到期提醒</h3>
          <p>尊敬的 ${sub.user.name || sub.user.username}：</p>
          <p>您的标讯通 <strong>${sub.plan.name}</strong> 权益即将于 <strong>${sub.endsAt.toLocaleString("zh-CN")}</strong> 正式到期。</p>
          <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 14px; margin: 16px 0; border-radius: 6px;">
            <p style="margin: 0; color: #9f1239; font-weight: 600;">到期后以下高级权益将即刻暂停：</p>
            <ul style="margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #475569;">
              <li>企微群机器人与微信商机雷达实时直推</li>
              <li>招标文件完整联系方式与几十兆货物清单附件下载</li>
              <li>开标倒计时预警与更正答疑智能对比</li>
            </ul>
          </div>
          <p>点击下方按钮可在 1 分钟内完成极速扫码或对公续费，立即锁定商机：</p>
          <div style="margin-top: 20px;">
            <a href="${appUrl}/pricing?utm_source=lifecycle_t3" style="display: inline-block; background: #e11d48; color: #ffffff; padding: 10px 24px; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 14px;">
              一键极速续费保权
            </a>
          </div>
        </div>
      `;
    }
    // 阶梯 3: 已过期 (diffMs < 0)
    else if (daysRemaining < 0) {
      stage = "EXPIRED";
      if (!options.dryRun) {
        await prisma.subscription.update({
          where: { id: sub.id },
          data: { status: "EXPIRED" },
        });
      }
    }

    if (!stage) continue;

    const sentChannels: string[] = [];

    if (!options.dryRun && emailSubject && emailContentHtml) {
      if (sub.user.email) {
        try {
          await sendMail({
            to: sub.user.email,
            subject: emailSubject,
            text: `尊敬的 ${sub.user.name}：您的标讯通 ${sub.plan.name} 即将到期。请访问 ${appUrl}/pricing 办理续约。`,
            html: emailContentHtml,
          });
          sentChannels.push("email");
        } catch (err) {
          console.error(`[Subscription Lifecycle] 邮件发送失败: ${sub.user.email}`, err);
        }
      }
    } else if (options.dryRun) {
      sentChannels.push("dryRun");
    }

    results.push({
      userId: sub.userId,
      userName: sub.user.name || sub.user.username,
      userEmail: sub.user.email,
      planName: sub.plan.name,
      stage,
      endsAt: sub.endsAt,
      daysRemaining,
      sentChannels,
    });
  }

  return results;
}
