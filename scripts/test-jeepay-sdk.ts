import assert from "node:assert";
import crypto from "node:crypto";
import {
  generateJeepaySign,
  verifyJeepaySign,
  buildJeepayParams,
  getJeepayConfig,
  isJeepayConfigured,
  type JeepayConfig,
} from "../src/lib/jeepay";

console.log("=== Testing Jeepay SDK & Signature Logic ===");

// 1. 测试签名生成算法 (ASCII 排序、过滤空值/null/undefined/'sign'、&key= 拼接、大写 MD5)
const mockParams = {
  mchNo: "M1623984572",
  appId: "60cc09bce4b0f1c0b83761c9",
  mchOrderNo: "TB202610010001",
  amount: 29900,
  currency: "cny",
  emptyField: "",
  nullField: null,
  undefinedField: undefined,
  sign: "EXISTING_OLD_SIGN_SHOULD_BE_IGNORED",
};
const mockApiKey = "TEST_API_KEY_123456";

// 手动推算期望的拼接串
// 排序后的有效字段：amount, appId, currency, mchNo, mchOrderNo
const expectedQueryString =
  "amount=29900&appId=60cc09bce4b0f1c0b83761c9&currency=cny&mchNo=M1623984572&mchOrderNo=TB202610010001&key=TEST_API_KEY_123456";
const expectedSign = crypto
  .createHash("md5")
  .update(expectedQueryString, "utf8")
  .digest("hex")
  .toUpperCase();

const generatedSign = generateJeepaySign(mockParams, mockApiKey);
assert.strictEqual(
  generatedSign,
  expectedSign,
  "generateJeepaySign 生成的 MD5 签名与标准 Jeepay 规范不符"
);
assert.strictEqual(generatedSign.length, 32, "签名长度必须为 32 位");
assert.strictEqual(
  generatedSign,
  generatedSign.toUpperCase(),
  "签名必须全部为大写字母"
);
console.log("✓ generateJeepaySign: ASCII 字典序排序、过滤空值与签名生成正确");

// 2. 测试验签算法 (verifyJeepaySign)
const validPayload = { ...mockParams, sign: generatedSign };
const verifySuccess = verifyJeepaySign(validPayload, mockApiKey);
assert.strictEqual(verifySuccess, true, "合法签名验签应通过");

// 篡改金额
const tamperedPayload = { ...mockParams, amount: 19900, sign: generatedSign };
const verifyTampered = verifyJeepaySign(tamperedPayload, mockApiKey);
assert.strictEqual(verifyTampered, false, "篡改数据后验签必须失败");

// 签名为空或非法格式
assert.strictEqual(
  verifyJeepaySign({ ...mockParams, sign: "" }, mockApiKey),
  false,
  "空签名必须验签失败"
);
assert.strictEqual(
  verifyJeepaySign({ ...mockParams, sign: "SHORT" }, mockApiKey),
  false,
  "非 32 位签名必须验签失败且不抛异常"
);
assert.strictEqual(
  verifyJeepaySign({ ...mockParams, sign: undefined }, mockApiKey),
  false,
  "undefined 签名必须验签失败"
);
console.log("✓ verifyJeepaySign: 常时比对与防篡改验证全部通过");

// 3. 测试 buildJeepayParams 请求参数组装
const mockConfig: JeepayConfig = {
  payUrl: "http://127.0.0.1:9217/",
  mchNo: "M1623984572",
  appId: "60cc09bce4b0f1c0b83761c9",
  apiKey: mockApiKey,
  notifyUrl: "http://127.0.0.1:3000/api/payment/jeepay/notify",
};

const bizParams = {
  mchOrderNo: "ORD_TEST_001",
  wayCode: "WX_NATIVE",
  amount: 100,
  subject: "会员月卡",
};

const builtParams = buildJeepayParams(bizParams, mockConfig);
assert.strictEqual(builtParams.mchNo, mockConfig.mchNo);
assert.strictEqual(builtParams.appId, mockConfig.appId);
assert.strictEqual(builtParams.version, "1.0");
assert.strictEqual(builtParams.signType, "MD5");
assert.strictEqual(typeof builtParams.reqTime, "number");
assert.strictEqual(builtParams.mchOrderNo, "ORD_TEST_001");
assert.strictEqual(typeof builtParams.sign, "string");
assert.strictEqual((builtParams.sign as string).length, 32);

// 校验 buildJeepayParams 生成的包自带签名能否直接通过验签
const verifyBuilt = verifyJeepaySign(builtParams, mockApiKey);
assert.strictEqual(verifyBuilt, true, "buildJeepayParams 生成的报文必须能直接自验签通过");
console.log("✓ buildJeepayParams: 统一下单与查单公共参数构造及自动加签通过");

// 4. 测试配置读取 getJeepayConfig / isJeepayConfigured
const originalEnv = { ...process.env };
try {
  delete process.env.JEEPAY_PAY_URL;
  delete process.env.JEEPAY_MCH_NO;
  delete process.env.JEEPAY_APP_ID;
  delete process.env.JEEPAY_API_KEY;

  assert.strictEqual(isJeepayConfigured(), false, "环境变量缺失时 isJeepayConfigured 应返回 false");
  assert.strictEqual(getJeepayConfig(), null, "环境变量缺失时 getJeepayConfig 应返回 null");

  process.env.JEEPAY_PAY_URL = "http://localhost:9217///";
  process.env.JEEPAY_MCH_NO = "M_TEST";
  process.env.JEEPAY_APP_ID = "APP_TEST";
  process.env.JEEPAY_API_KEY = "KEY_TEST";

  assert.strictEqual(isJeepayConfigured(), true, "环境变量完整时 isJeepayConfigured 应返回 true");
  const parsedCfg = getJeepayConfig();
  assert.strictEqual(parsedCfg?.payUrl, "http://localhost:9217", "URL 末尾斜杠应被自动规范化去除");
  assert.strictEqual(parsedCfg?.mchNo, "M_TEST");
  console.log("✓ getJeepayConfig / isJeepayConfigured: 环境变量解析与配置校验通过");
} finally {
  process.env = originalEnv;
}

console.log("🎉 [PASS] Task 1 Jeepay 核心 SDK 与 MD5 签名/验签测试全部通过！");
