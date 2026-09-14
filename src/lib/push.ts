import { prisma } from "./prisma";
import { getAppUrl, sendMail } from "./mailer";
import {
  calculateDeadlineCountdown,
  detectProjectLifecycleUpdates,
} from "./lifecycle-alert";
import type { Prisma } from "@prisma/client";

export type DailyPushResult = {
  watchId: number;
  watchName: string;
  matched: number;
  sent: boolean;
  error?: string;
};

export interface PushTenderItem {
  id: number;
  title: string;
  publishDate: Date | string;
  type?: string;
  budgetAmountWan?: number | null;
  awardAmountWan?: number | null;
  purchaser?: string | null;
}

/**
 * 公告类型人类可读标签
 */
export function formatTenderTypeLabel(type?: string): string {
  switch (type) {
    case "NOTICE":
      return "招标公告";
    case "RESULT":
      return "中标公告";
    case "CHANGE":
      return "变更答疑";
    case "INQUIRY":
      return "询价竞谈";
    case "INTENTION":
      return "采购意向";
    default:
      return "标讯动态";
  }
}

/**
 * 格式化预算与金额信息
 */
export function formatTenderAmountStr(item: PushTenderItem): string {
  if (item.budgetAmountWan && item.budgetAmountWan > 0) {
    return `预算: ¥${item.budgetAmountWan.toLocaleString("zh-CN")}万`;
  }
  if (item.awardAmountWan && item.awardAmountWan > 0) {
    return `中标: ¥${item.awardAmountWan.toLocaleString("zh-CN")}万`;
  }
  return "预算/金额: 详见正文";
}

/**
 * 推送到企业微信群机器人 (Markdown 格式富文本卡片)
 */
export async function sendWecomWebhook(
  webhookUrl: string,
  options: {
    keyword: string;
    frequency?: "daily" | "weekly";
    tenders: PushTenderItem[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = getAppUrl();
    const isWeekly = options.frequency === "weekly";
    const headerTitle = isWeekly ? "📊 标讯通 · 决策周报" : "🔔 标讯通 · 商机速递";
    const subTitle = isWeekly ? "本周高匹配商机精选" : "今日高匹配新商机";

    const itemsMarkdown = options.tenders
      .slice(0, 8)
      .map((t, idx) => {
        const dateStr =
          typeof t.publishDate === "string"
            ? t.publishDate
            : t.publishDate.toISOString().slice(0, 10);
        const typeLabel = formatTenderTypeLabel(t.type);
        const amountStr = formatTenderAmountStr(t);
        const purchaserStr = t.purchaser ? t.purchaser : "采购单位见正文";
        return `${idx + 1}. **[${typeLabel}]** [${t.title}](${appUrl}/tender/${t.id})\n> 🏢 <font color="comment">${purchaserStr}</font>\n> 💰 <font color="warning">${amountStr}</font> · 📅 ${dateStr}`;
      })
      .join("\n\n");

    const content = `### ${headerTitle}\n> 🎯 监控规则：<font color="info">「${options.keyword}」</font>\n> ⚡️ ${subTitle}：**${options.tenders.length}** 条\n\n${itemsMarkdown}\n\n---\n[👉 前往标讯通协同看板](${appUrl}/tracker) · [⚙️ 订阅偏好设置](${appUrl}/watches)`;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "markdown",
        markdown: { content },
      }),
    });

    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (data.errcode === 0) {
      return { success: true };
    }
    return { success: false, error: data.errmsg || `企微返回错误代码: ${data.errcode}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 推送到钉钉群自定义机器人 (Markdown 格式富文本卡片)
 */
export async function sendDingtalkWebhook(
  webhookUrl: string,
  options: {
    keyword: string;
    frequency?: "daily" | "weekly";
    tenders: PushTenderItem[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = getAppUrl();
    const isWeekly = options.frequency === "weekly";
    const headerTitle = isWeekly ? "📊 标讯通 · 决策周报" : "🔔 标讯通 · 商机速递";
    const title = `${headerTitle}: ${options.keyword}`;

    const itemsMarkdown = options.tenders
      .slice(0, 8)
      .map((t, idx) => {
        const dateStr =
          typeof t.publishDate === "string"
            ? t.publishDate
            : t.publishDate.toISOString().slice(0, 10);
        const typeLabel = formatTenderTypeLabel(t.type);
        const amountStr = formatTenderAmountStr(t);
        const purchaserStr = t.purchaser ? t.purchaser : "采购单位见正文";
        return `#### ${idx + 1}. 【${typeLabel}】[${t.title}](${appUrl}/tender/${t.id})\n- 🏢 采购单位：${purchaserStr}\n- 💰 金额预算：${amountStr}\n- 📅 发布日期：${dateStr}`;
      })
      .join("\n\n");

    const text = `### ${headerTitle}\n**监控规则**：${options.keyword}\n**命中商机**：共 ${options.tenders.length} 条\n\n${itemsMarkdown}\n\n---\n[👉 前往标讯通协同看板](${appUrl}/tracker)  |  [⚙️ 订阅偏好管理](${appUrl}/watches)`;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "markdown",
        markdown: {
          title,
          text,
        },
      }),
    });

    const data = (await res.json()) as { errcode?: number; errmsg?: string };
    if (data.errcode === 0) {
      return { success: true };
    }
    return { success: false, error: data.errmsg || `钉钉返回错误代码: ${data.errcode}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 推送到飞书群自定义机器人 (富文本 Post 格式)
 */
export async function sendFeishuWebhook(
  webhookUrl: string,
  options: {
    keyword: string;
    frequency?: "daily" | "weekly";
    tenders: PushTenderItem[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = getAppUrl();
    const isWeekly = options.frequency === "weekly";
    const headerTitle = isWeekly ? "📊 标讯通 · 决策周报" : "🔔 标讯通 · 商机速递";

    const contentBlocks: Array<Array<{ tag: string; text?: string; href?: string }>> = [
      [
        {
          tag: "text",
          text: `🎯 监控规则:「${options.keyword}」 | ⚡️ 命中商机: ${options.tenders.length} 条\n\n`,
        },
      ],
    ];

    options.tenders.slice(0, 8).forEach((t, idx) => {
      const dateStr =
        typeof t.publishDate === "string"
          ? t.publishDate
          : t.publishDate.toISOString().slice(0, 10);
      const typeLabel = formatTenderTypeLabel(t.type);
      const amountStr = formatTenderAmountStr(t);
      const purchaserStr = t.purchaser ? t.purchaser : "采购单位见正文";

      contentBlocks.push([
        { tag: "text", text: `${idx + 1}. 【${typeLabel}】 ` },
        { tag: "a", text: t.title, href: `${appUrl}/tender/${t.id}` },
      ]);
      contentBlocks.push([
        {
          tag: "text",
          text: `   🏢 采购单位：${purchaserStr}  |  💰 ${amountStr}  |  📅 ${dateStr}\n`,
        },
      ]);
    });

    contentBlocks.push([
      {
        tag: "a",
        text: "👉 点击进入标讯通项目跟踪看板",
        href: `${appUrl}/tracker`,
      },
      {
        tag: "text",
        text: "  ·  ",
      },
      {
        tag: "a",
        text: "⚙️ 调整订阅规则",
        href: `${appUrl}/watches`,
      },
    ]);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "post",
        content: {
          post: {
            zh_cn: {
              title: `${headerTitle}:「${options.keyword}」`,
              content: contentBlocks,
            },
          },
        },
      }),
    });

    const data = (await res.json()) as { code?: number; msg?: string; StatusCode?: number };
    if (data.code === 0 || data.StatusCode === 0) {
      return { success: true };
    }
    return { success: false, error: data.msg || `飞书返回错误代码: ${data.code}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * 执行全库日常订阅推送任务（支持 Email、企微、钉钉、飞书，支持日报/周报偏好调度）
 */
export async function runDailyPushes(options: {
  dryRun?: boolean;
  now?: Date;
  forceAll?: boolean;
} = {}): Promise<DailyPushResult[]> {
  const now = options.now || new Date();
  const isMonday = now.getDay() === 1;

  const watches = await prisma.pushWatch.findMany({
    where: { enabled: true, user: { status: "ACTIVE" } },
    include: { user: { select: { id: true, email: true, name: true, emailVerified: true } } },
    orderBy: { id: "asc" },
  });

  const results: DailyPushResult[] = [];
  for (const watch of watches) {
    // 频次控制：若为周报 (weekly)，仅在周一或距离上次推送超过 6 天时执行，除非指定 forceAll
    const isWeekly = watch.frequency === "weekly";
    if (isWeekly && !options.forceAll) {
      if (!isMonday) {
        if (watch.lastPushAt && now.getTime() - watch.lastPushAt.getTime() < 6 * 24 * 60 * 60 * 1000) {
          continue;
        }
      }
    }

    const defaultLookback = isWeekly ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const since = watch.lastPushAt ?? new Date(now.getTime() - defaultLookback);

    const where: Prisma.TenderWhereInput = {
      publishDate: { gte: since },
      OR: [
        { title: { contains: watch.keyword } },
        { content: { contains: watch.keyword } },
      ],
    };
    if (watch.type) where.type = watch.type;
    if (watch.provinceCode) where.provinceCode = watch.provinceCode;
    if (watch.cityCode) where.cityCode = watch.cityCode;

    const candidates = await prisma.tender.findMany({
      where,
      orderBy: { publishDate: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        type: true,
        publishDate: true,
        budgetAmount: true,
        awardAmount: true,
        purchaser: true,
      },
    });

    const existing = await prisma.pushRecord.findMany({
      where: { userId: watch.userId, tenderId: { in: candidates.map((tender) => tender.id) } },
      select: { tenderId: true },
    });
    const existingIds = new Set(existing.map((record) => record.tenderId));
    const matched = candidates.filter((tender) => !existingIds.has(tender.id));

    if (matched.length === 0) {
      await prisma.pushWatch.update({
        where: { id: watch.id },
        data: { lastPushAt: now },
      });
      results.push({ watchId: watch.id, watchName: watch.name, matched: 0, sent: false });
      continue;
    }

    if (options.dryRun) {
      results.push({ watchId: watch.id, watchName: watch.name, matched: matched.length, sent: false });
      continue;
    }

    try {
      const channels = Array.isArray(watch.channels) ? (watch.channels as string[]) : ["email"];
      let hasSentAny = false;

      const tenderItems: PushTenderItem[] = matched.map((m) => ({
        id: m.id,
        title: m.title,
        publishDate: m.publishDate,
        type: m.type,
        budgetAmountWan: m.budgetAmount ? Math.round((Number(m.budgetAmount) / 10000) * 100) / 100 : null,
        awardAmountWan: m.awardAmount ? Math.round((Number(m.awardAmount) / 10000) * 100) / 100 : null,
        purchaser: m.purchaser,
      }));

      // 1. 邮件推送
      if (channels.includes("email") && watch.user.email && watch.user.emailVerified) {
        const listHtml = tenderItems
          .map((tender) => {
            const typeLabel = formatTenderTypeLabel(tender.type);
            const amountStr = formatTenderAmountStr(tender);
            const dateStr =
              typeof tender.publishDate === "string"
                ? tender.publishDate
                : tender.publishDate.toLocaleDateString("zh-CN");
            return `<li><strong>[${typeLabel}]</strong> <a href="${getAppUrl()}/tender/${tender.id}">${tender.title}</a>（${amountStr} - ${tender.purchaser || "采购人见正文"}，${dateStr}）</li>`;
          })
          .join("");

        const emailSubject = isWeekly
          ? `【标讯通周报】关键词「${watch.keyword}」本周精选 ${matched.length} 条高价值标讯`
          : `【标讯通日报】关键词「${watch.keyword}」今日命中 ${matched.length} 条新公告`;

        await sendMail({
          to: watch.user.email,
          subject: emailSubject,
          text: tenderItems.map((t) => `${t.title} (${formatTenderAmountStr(t)})\n${getAppUrl()}/tender/${t.id}`).join("\n"),
          html: `<p>${watch.user.name}，您好：</p><p>您的商机监控「${watch.name}」（关键词：${watch.keyword}）命中以下新标讯：</p><ol>${listHtml}</ol><p><a href="${getAppUrl()}/tracker">前往标讯通项目跟踪看板 &gt;</a></p>`,
        });
        hasSentAny = true;
      }

      // 2. 机器人 Webhook 推送
      if (watch.webhookUrl && watch.webhookUrl.startsWith("http")) {
        const pushOpts = {
          keyword: watch.keyword,
          frequency: (watch.frequency === "weekly" ? "weekly" : "daily") as "daily" | "weekly",
          tenders: tenderItems,
        };

        if (channels.includes("wecom")) {
          await sendWecomWebhook(watch.webhookUrl, pushOpts);
          hasSentAny = true;
        } else if (channels.includes("dingtalk")) {
          await sendDingtalkWebhook(watch.webhookUrl, pushOpts);
          hasSentAny = true;
        } else if (channels.includes("feishu")) {
          await sendFeishuWebhook(watch.webhookUrl, pushOpts);
          hasSentAny = true;
        }
      }

      await prisma.$transaction([
        prisma.pushRecord.createMany({
          data: matched.map((tender) => ({
            userId: watch.userId,
            tenderId: tender.id,
            watchId: watch.id,
            channel: channels[0] || "email",
          })),
          skipDuplicates: true,
        }),
        prisma.pushWatch.update({
          where: { id: watch.id },
          data: { lastPushAt: now },
        }),
      ]);
      results.push({ watchId: watch.id, watchName: watch.name, matched: matched.length, sent: hasSentAny });
    } catch (error) {
      results.push({
        watchId: watch.id,
        watchName: watch.name,
        matched: matched.length,
        sent: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  return results;
}

export type LifecycleAlertPushResult = {
  followId: number;
  userId: number;
  userName: string;
  tenderId: number;
  tenderTitle: string;
  criticalDeadline?: { hoursLeft: number; targetDateStr: string };
  lifecycleUpdate?: { title: string; updateType: string; publishDate?: string };
  sent: boolean;
  error?: string;
};

/**
 * 全生命周期与截标倒计时协同批量扫描预警与即时推送
 */
export async function runLifecycleAlerts(options: {
  dryRun?: boolean;
  now?: Date;
} = {}): Promise<LifecycleAlertPushResult[]> {
  const now = options.now || new Date();
  const results: LifecycleAlertPushResult[] = [];

  const activeFollows = await prisma.tenderFollow.findMany({
    where: {
      status: { in: ["EVALUATING", "DECIDED", "DRAFTING", "SUBMITTED"] },
    },
    include: {
      tender: {
        select: {
          id: true,
          title: true,
          type: true,
          publishDate: true,
          expireDate: true,
          project: {
            include: {
              notices: {
                select: {
                  id: true,
                  title: true,
                  type: true,
                  publishDate: true,
                  sourceUrl: true,
                },
              },
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          emailVerified: true,
        },
      },
    },
  });

  if (activeFollows.length === 0) {
    return results;
  }

  for (const follow of activeFollows) {
    const countdown = calculateDeadlineCountdown(
      follow.tender.expireDate,
      follow.remindDate,
      now
    );
    const lifecycleAlert = detectProjectLifecycleUpdates(
      {
        id: follow.tender.id,
        type: follow.tender.type,
        publishDate: follow.tender.publishDate,
      },
      follow.tender.project?.notices
    );

    const isCriticalDeadline = countdown
      ? countdown.urgency === "CRITICAL" && !countdown.isDeadlinePassed
      : false;
    const hasLifecycleAlert = lifecycleAlert.hasUpdate;

    if (!isCriticalDeadline && !hasLifecycleAlert) {
      continue;
    }

    const itemResult: LifecycleAlertPushResult = {
      followId: follow.id,
      userId: follow.user.id,
      userName: follow.user.name,
      tenderId: follow.tender.id,
      tenderTitle: follow.tender.title,
      sent: false,
    };

    if (isCriticalDeadline && countdown) {
      itemResult.criticalDeadline = {
        hoursLeft: countdown.diffHours,
        targetDateStr: countdown.targetDate.toISOString().slice(0, 10),
      };
    }

    if (lifecycleAlert.hasUpdate) {
      itemResult.lifecycleUpdate = {
        title: lifecycleAlert.latestNoticeTitle || "",
        updateType: lifecycleAlert.updateType || "OTHER",
        publishDate: lifecycleAlert.latestNoticeDate,
      };
    }

    if (options.dryRun) {
      results.push(itemResult);
      continue;
    }

    // 执行真实预警推送
    try {
      const appUrl = getAppUrl();
      const alertLines: string[] = [];
      if (itemResult.criticalDeadline) {
        alertLines.push(
          `🚨 截标冲刺紧急提醒：剩余 ${itemResult.criticalDeadline.hoursLeft} 小时截止（${itemResult.criticalDeadline.targetDateStr}）！请立刻核对电子签章与封标投递。`
        );
      }
      if (itemResult.lifecycleUpdate) {
        const typeStr =
          itemResult.lifecycleUpdate.updateType === "CHANGE"
            ? "更正/澄清答疑"
            : "项目后续进展";
        alertLines.push(
          `📢 捕获关联项目${typeStr}公告：《${itemResult.lifecycleUpdate.title}》，请及时检查并调整应答文件。`
        );
      }

      // 1. 邮件预警
      if (follow.user.email && follow.user.emailVerified) {
        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b;">
            <h3 style="color: #e11d48; margin-bottom: 8px;">🔔【标讯通】投标商机预警提醒</h3>
            <p>尊敬的 <strong>${follow.user.name}</strong>：</p>
            <p>您在投标跟进看板中推进的标段出现重要节点或动态：</p>
            <div style="background: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px; margin: 12px 0;">
              <strong style="color: #0f172a;">${follow.tender.title}</strong>
              <div style="margin-top: 6px; font-size: 13px; color: #475569;">
                ${alertLines.map((l) => `<div style="margin: 4px 0;">${l}</div>`).join("")}
              </div>
            </div>
            <p>
              <a href="${appUrl}/tender/${follow.tender.id}" style="display: inline-block; background: #2563eb; color: #fff; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-size: 13px;">进入标段协同工作台</a>
            </p>
          </div>
        `;

        await sendMail({
          to: follow.user.email,
          subject: `【标讯通预警】${itemResult.criticalDeadline ? `🚨 48h 截标冲刺: ` : `📢 发现澄清更正: `}${follow.tender.title.slice(0, 20)}...`,
          text: `${alertLines.join("\n")}\n标段详情: ${appUrl}/tender/${follow.tender.id}`,
          html,
        });
        itemResult.sent = true;
      }

      results.push(itemResult);
    } catch (err) {
      itemResult.error = err instanceof Error ? err.message : String(err);
      results.push(itemResult);
    }
  }

  return results;
}
