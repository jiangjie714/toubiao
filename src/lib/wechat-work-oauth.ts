export interface WecomOAuthConfig {
  corpId: string;
  agentId: string;
  corpSecret: string;
  redirectUri: string;
}

export interface WecomUserInfo {
  userId?: string;
  openId?: string;
  name?: string;
  mobile?: string;
  department?: number[];
  avatar?: string;
}

export function getWecomOAuthConfig(): WecomOAuthConfig {
  return {
    corpId: process.env.WECOM_CORP_ID || "ww_demo_corp_id",
    agentId: process.env.WECOM_AGENT_ID || "1000002",
    corpSecret: process.env.WECOM_CORP_SECRET || "demo_secret",
    redirectUri: process.env.WECOM_REDIRECT_URI || "http://localhost:3000/api/auth/wecom/callback",
  };
}

/**
 * 构建企业微信 OAuth2 网页静默授权 / 扫码登录跳转链接
 * 参考企业微信开放平台标准：https://developer.work.weixin.qq.com/document/path/91022
 */
export function buildWecomAuthorizeUrl(state = "login_state", directRedirect = false): string {
  const config = getWecomOAuthConfig();
  const encodedRedirect = encodeURIComponent(config.redirectUri);

  if (directRedirect) {
    // 企微内嵌应用/移动端浏览器免密静默登录
    return `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${config.corpId}&redirect_uri=${encodedRedirect}&response_type=code&scope=snsapi_base&state=${encodeURIComponent(state)}#wechat_redirect`;
  }

  // PC 端企业微信扫码登录
  return `https://open.work.weixin.qq.com/wwopen/sso/qrConnect?appid=${config.corpId}&agentid=${config.agentId}&redirect_uri=${encodedRedirect}&state=${encodeURIComponent(state)}`;
}

/**
 * 通过 code 换取企业微信成员身份
 */
export async function exchangeWecomCodeForUser(code: string): Promise<{
  success: boolean;
  user?: WecomUserInfo;
  error?: string;
}> {
  // 开发演示与沙盒兜底
  if (code.startsWith("mock_") || !process.env.WECOM_CORP_SECRET) {
    return {
      success: true,
      user: {
        userId: "wecom_sales_001",
        name: "企业微信投标经理",
        mobile: "13800001234",
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
      },
    };
  }

  try {
    const config = getWecomOAuthConfig();
    // 1. 获取 access_token
    const tokenRes = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${config.corpId}&corpsecret=${config.corpSecret}`
    );
    const tokenData = await tokenRes.json();
    if (tokenData.errcode !== 0) {
      return { success: false, error: `获取企微Token失败: ${tokenData.errmsg}` };
    }

    const accessToken = tokenData.access_token;

    // 2. 通过 code 换取 UserId
    const userRes = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${accessToken}&code=${code}`
    );
    const userData = await userRes.json();
    if (userData.errcode !== 0) {
      return { success: false, error: `获取成员UserId失败: ${userData.errmsg}` };
    }

    const userId = userData.userid || userData.openid;

    // 3. 读取成员详细画像
    const detailRes = await fetch(
      `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${accessToken}&userid=${userId}`
    );
    const detailData = await detailRes.json();

    return {
      success: true,
      user: {
        userId,
        name: detailData.name || "企微销售代表",
        mobile: detailData.mobile,
        avatar: detailData.avatar,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "请求企业微信接口超时",
    };
  }
}
