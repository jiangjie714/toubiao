"use server";

import { getSession } from "@/lib/auth";
import {
  sendWecomWebhook,
  sendDingtalkWebhook,
  sendFeishuWebhook,
} from "@/lib/push";

export async function testWebhookAction(params: {
  channel: "wecom" | "dingtalk" | "feishu";
  webhookUrl: string;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const { channel, webhookUrl } = params;
    if (!webhookUrl || !webhookUrl.startsWith("http")) {
      return { success: false, error: "请输入有效的 Webhook 完整链接（以 http:// 或 https:// 开头）" };
    }

    const testTenders = [
      {
        id: 1,
        title: "【测试】国家税务总局全国发票查验平台运维服务采购项目",
        type: "NOTICE",
        budgetAmountWan: 385.5,
        purchaser: "国家税务总局",
        publishDate: new Date().toISOString().slice(0, 10),
      },
      {
        id: 2,
        title: "【测试】某省数字化政务协同办公中枢系统建设项目（包1：软件工程）",
        type: "RESULT",
        awardAmountWan: 1260.0,
        purchaser: "某省大数据局",
        publishDate: new Date().toISOString().slice(0, 10),
      },
    ];

    let result: { success: boolean; error?: string };
    if (channel === "wecom") {
      result = await sendWecomWebhook(webhookUrl, {
        keyword: "测试监控",
        tenders: testTenders,
      });
    } else if (channel === "dingtalk") {
      result = await sendDingtalkWebhook(webhookUrl, {
        keyword: "测试监控",
        tenders: testTenders,
      });
    } else if (channel === "feishu") {
      result = await sendFeishuWebhook(webhookUrl, {
        keyword: "测试监控",
        tenders: testTenders,
      });
    } else {
      return { success: false, error: "不支持的机器人类型" };
    }

    if (result.success) {
      return {
        success: true,
        message: "测试标讯卡片已成功发送！请前往您的群聊查看效果。",
      };
    } else {
      return {
        success: false,
        error: result.error || "机器人发送失败，请检查 Webhook 链接是否正确或机器人安全设置",
      };
    }
  } catch (err) {
    console.error("Test webhook failed:", err);
    return { success: false, error: "网络连接失败，无法触达 Webhook 地址" };
  }
}
