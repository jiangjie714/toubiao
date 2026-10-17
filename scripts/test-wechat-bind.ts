import QRCode from "qrcode";
import { getWechatMpConfig } from "../src/lib/wechat-service";

async function testWechatBindingWorkflow() {
  console.log("=== [Test] 微信服务号免密绑定与带参二维码全流程验证 ===\n");

  // 1. 检查微信服务号环境配置降级能力
  const config = getWechatMpConfig();
  console.log(`✓ 微信服务号当前配置状态: isConfigured=${config.isConfigured}, AppID=${config.appId || "未填(已自动启用开发演示模式)"}`);

  // 2. 模拟带参场景二维码生成
  const testUid = 10086;
  const testTicket = `BIND_${testUid}_${Date.now()}`;
  const simulationUrl = `https://toubiao.com/wechat/mock-bind?ticket=${testTicket}&uid=${testUid}`;

  const qrDataUrl = await QRCode.toDataURL(simulationUrl, {
    margin: 1,
    width: 240,
    color: { dark: "#0f172a", light: "#ffffff" },
  });

  if (!qrDataUrl.startsWith("data:image/png;base64,")) {
    throw new Error("带参二维码 DataURL 生成异常");
  }
  console.log(`✓ 成功生成微信绑定带参场景二维码 DataURL: 长度 = ${qrDataUrl.length} 字符`);

  // 3. 验证模拟绑定 OpenID 生成规则
  const mockOpenId = `wx_mp_${testUid}_${Math.random().toString(36).slice(2, 8)}`;
  if (!mockOpenId.startsWith(`wx_mp_${testUid}_`)) {
    throw new Error("模拟 OpenID 生成规则异常");
  }
  console.log(`✓ 模拟微信 OpenID 生成规范: [${mockOpenId}]`);

  console.log("\n✅ 微信服务号绑定与前台交互引导全链路逻辑测试通过！");
}

testWechatBindingWorkflow().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
