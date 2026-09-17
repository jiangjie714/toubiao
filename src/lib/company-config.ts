/**
 * 标讯通收款机构与官方企业基本信息配置
 * 支持通过环境变量覆盖，若未配置则读取默认企业主体
 */

export interface CompanyPaymentConfig {
  companyName: string;
  bankName: string;
  bankAccount: string;
  bankBranchCode: string; // 大额支付联行行号
  taxNumber?: string;
  contactEmail?: string;
  contactPhone?: string;
  wechatQrCodeUrl?: string;
  alipayQrCodeUrl?: string;
}

export function getCompanyPaymentConfig(): CompanyPaymentConfig {
  return {
    companyName:
      process.env.COMPANY_NAME || "北京云尖字节信息科技有限公司",
    bankName:
      process.env.COMPANY_BANK_NAME || "中国工商银行股份有限公司紫竹院支行",
    bankAccount:
      process.env.COMPANY_BANK_ACCOUNT || "0200007609200202973",
    bankBranchCode:
      process.env.COMPANY_BANK_BRANCH_CODE || "102100000763",
    taxNumber:
      process.env.COMPANY_TAX_NUMBER || "91110108MA017XYZ88",
    contactEmail:
      process.env.COMPANY_CONTACT_EMAIL || "service@toubiao.com",
    contactPhone:
      process.env.COMPANY_CONTACT_PHONE || "400-880-9966",
    wechatQrCodeUrl:
      process.env.WECHAT_RECEIVE_QR_URL || "/images/payment/wechat-pay-default.png",
    alipayQrCodeUrl:
      process.env.ALIPAY_RECEIVE_QR_URL || "/images/payment/alipay-default.png",
  };
}
