export type WebhookChannel = "WECOM" | "DINGTALK" | "FEISHU" | "GENERIC";

export type WebhookEventType =
  | "DEADLINE"
  | "COMPETITOR"
  | "DEPOSIT"
  | "AUDIT"
  | "TENDER"
  | "TEST";

export interface WebhookEventMeta {
  type: WebhookEventType;
  label: string;
  shortLabel: string;
  description: string;
  badgeCls: string;
}

export const WEBHOOK_EVENT_METAS: Record<WebhookEventType, WebhookEventMeta> = {
  DEADLINE: {
    type: "DEADLINE",
    label: "截标倒计时紧急预警",
    shortLabel: "截标预警",
    description: "距投标截止或开标不足 24h/48h 时触发红标紧急提醒，防范逾期废标。",
    badgeCls: "bg-rose-100 text-rose-800 border-rose-300",
  },
  COMPETITOR: {
    type: "COMPETITOR",
    label: "竞对动态与后院起火警报",
    shortLabel: "竞对渗透",
    description: "关注对手中标我方深耕客户、区域大标或低价杀入时秒级告警。",
    badgeCls: "bg-amber-100 text-amber-800 border-amber-300",
  },
  DEPOSIT: {
    type: "DEPOSIT",
    label: "投标保证金超期催讨提醒",
    shortLabel: "保证金逾期",
    description: "开标超期（法定期限）未退还保证金时触发法务维权催讨提示。",
    badgeCls: "bg-purple-100 text-purple-800 border-purple-300",
  },
  AUDIT: {
    type: "AUDIT",
    label: "标书质检一票否决高危警报",
    shortLabel: "清标废标",
    description: "送检文本命中模板残留、错写业主、金额矛盾或负偏离等致命项时即时通知。",
    badgeCls: "bg-red-100 text-red-800 border-red-300",
  },
  TENDER: {
    type: "TENDER",
    label: "重点高匹配新商机速递",
    shortLabel: "商机速递",
    description: "符合企业关注赛道、资质与千万级以上优质招标公告实时分发。",
    badgeCls: "bg-blue-100 text-blue-800 border-blue-300",
  },
  TEST: {
    type: "TEST",
    label: "连通性测试消息",
    shortLabel: "连通测试",
    description: "验证机器人 Webhook 配置与加签密钥连通性。",
    badgeCls: "bg-slate-100 text-slate-800 border-slate-300",
  },
};

export interface WebhookChannelMeta {
  channel: WebhookChannel;
  label: string;
  iconName: string;
  placeholder: string;
  hasSecret: boolean;
  secretHelp?: string;
}

export const WEBHOOK_CHANNEL_METAS: Record<WebhookChannel, WebhookChannelMeta> = {
  WECOM: {
    channel: "WECOM",
    label: "企业微信群机器人",
    iconName: "wecom",
    placeholder: "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=...",
    hasSecret: false,
  },
  DINGTALK: {
    channel: "DINGTALK",
    label: "钉钉自定义机器人",
    iconName: "dingtalk",
    placeholder: "https://oapi.dingtalk.com/robot/send?access_token=...",
    hasSecret: true,
    secretHelp: "选填。若在钉钉机器人安全设置中勾选了「加签」，请填入 SEC 开头的密钥。",
  },
  FEISHU: {
    channel: "FEISHU",
    label: "飞书群自定义机器人",
    iconName: "feishu",
    placeholder: "https://open.feishu.cn/open-apis/bot/v2/hook/...",
    hasSecret: true,
    secretHelp: "选填。若在飞书机器人安全设置中勾选了「签名校验」，请填入签名密钥。",
  },
  GENERIC: {
    channel: "GENERIC",
    label: "通用 Webhook (HTTP POST JSON)",
    iconName: "generic",
    placeholder: "https://api.your-company.com/webhooks/bidding",
    hasSecret: true,
    secretHelp: "选填。若配置，系统将在请求头中带上 X-Hub-Signature-256。",
  },
};

export interface WebhookEventPayload {
  eventType: WebhookEventType;
  title: string;
  summary: string;
  details: { label: string; value: string }[];
  actionUrl?: string;
  urgent?: boolean;
}
