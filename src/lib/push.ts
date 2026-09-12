import { prisma } from "./prisma";
import { getAppUrl, sendMail } from "./mailer";
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
  awardAmountWan?: number | null;
  purchaser?: string | null;
}

/**
 * 推送到企业微信群机器人 (Markdown 格式)
 */
export async function sendWecomWebhook(
  webhookUrl: string,
  options: {
    keyword: string;
    tenders: PushTenderItem[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = getAppUrl();
    const itemsMarkdown = options.tenders
      .slice(0, 5)
      .map((t, idx) => {
        const dateStr =
          typeof t.publishDate === "string"
            ? t.publishDate
            : t.publishDate.toISOString().slice(0, 10);
        return `${idx + 1}. [${t.title}](${appUrl}/tender/${t.id}) (${dateStr})`;
      })
      .join("\n");

    const content = `### 🔔 标讯通商机速递\n> 监控关键词：<font color="info">「${options.keyword}」</font>\n> 发现新商机：**${options.tenders.length}** 条\n\n${itemsMarkdown}\n\n[点击前往标讯通工作台查看全部 >](${appUrl}/tracker)`;

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
 * 推送到钉钉群自定义机器人 (Markdown 格式)
 */
export async function sendDingtalkWebhook(
  webhookUrl: string,
  options: {
    keyword: string;
    tenders: PushTenderItem[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = getAppUrl();
    const itemsMarkdown = options.tenders
      .slice(0, 5)
      .map((t, idx) => {
        const dateStr =
          typeof t.publishDate === "string"
            ? t.publishDate
            : t.publishDate.toISOString().slice(0, 10);
        return `${idx + 1}. [${t.title}](${appUrl}/tender/${t.id}) (${dateStr})`;
      })
      .join("\n\n");

    const text = `### 🔔 标讯通商机速递\n**监控关键词**：${options.keyword}\n\n**命中最新商机**：${options.tenders.length} 条\n\n${itemsMarkdown}\n\n[进入标讯通协同看板](${appUrl}/tracker)`;

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msgtype: "markdown",
        markdown: {
          title: `标讯通商机提醒: ${options.keyword}`,
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
    tenders: PushTenderItem[];
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const appUrl = getAppUrl();
    const contentList = options.tenders.slice(0, 5).map((t, idx) => {
      const dateStr =
        typeof t.publishDate === "string"
          ? t.publishDate
          : t.publishDate.toISOString().slice(0, 10);
      return [
        { tag: "text", text: `${idx + 1}. ` },
        { tag: "a", text: t.title, href: `${appUrl}/tender/${t.id}` },
        { tag: "text", text: ` (${dateStr})\n` },
      ];
    });

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_type: "post",
        content: {
          post: {
            zh_cn: {
              title: `🔔 标讯通商机速递:「${options.keyword}」`,
              content: [
                [{ tag: "text", text: `本次命中最新商机 ${options.tenders.length} 条：\n\n` }],
                ...contentList,
                [
                  {
                    tag: "a",
                    text: "\n👉 点击查看标讯通项目跟踪看板",
                    href: `${appUrl}/tracker`,
                  },
                ],
              ],
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
 * 执行全库日常订阅推送任务（支持 Email、企微、钉钉、飞书）
 */
export async function runDailyPushes(options: { dryRun?: boolean } = {}): Promise<DailyPushResult[]> {
  const watches = await prisma.pushWatch.findMany({
    where: { enabled: true, user: { status: "ACTIVE" } },
    include: { user: { select: { id: true, email: true, name: true, emailVerified: true } } },
    orderBy: { id: "asc" },
  });

  const results: DailyPushResult[] = [];
  for (const watch of watches) {
    const since = watch.lastPushAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
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
      select: { id: true, title: true, type: true, publishDate: true, awardAmount: true, purchaser: true },
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
        data: { lastPushAt: new Date() },
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

      // 1. 邮件推送
      if (channels.includes("email") && watch.user.email && watch.user.emailVerified) {
        const listHtml = matched
          .map(
            (tender) =>
              `<li><a href="${getAppUrl()}/tender/${tender.id}">${tender.title}</a>（${tender.publishDate.toLocaleDateString("zh-CN")}）</li>`,
          )
          .join("");
        await sendMail({
          to: watch.user.email,
          subject: `【标讯通】关键词「${watch.keyword}」命中 ${matched.length} 条新公告`,
          text: matched.map((tender) => `${tender.title}\n${getAppUrl()}/tender/${tender.id}`).join("\n"),
          html: `<p>${watch.user.name}，您好：</p><p>您的关键词「${watch.keyword}」命中以下新公告：</p><ol>${listHtml}</ol>`,
        });
        hasSentAny = true;
      }

      // 2. 机器人 Webhook 推送
      if (watch.webhookUrl && watch.webhookUrl.startsWith("http")) {
        const tenderItems: PushTenderItem[] = matched.map((m) => ({
          id: m.id,
          title: m.title,
          publishDate: m.publishDate,
          type: m.type,
          purchaser: m.purchaser,
        }));

        if (channels.includes("wecom")) {
          await sendWecomWebhook(watch.webhookUrl, { keyword: watch.keyword, tenders: tenderItems });
          hasSentAny = true;
        } else if (channels.includes("dingtalk")) {
          await sendDingtalkWebhook(watch.webhookUrl, { keyword: watch.keyword, tenders: tenderItems });
          hasSentAny = true;
        } else if (channels.includes("feishu")) {
          await sendFeishuWebhook(watch.webhookUrl, { keyword: watch.keyword, tenders: tenderItems });
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
          data: { lastPushAt: new Date() },
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
