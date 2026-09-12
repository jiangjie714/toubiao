/**
 * 结构化机构联络人抽取与附件发现引擎
 * 用于从正文及详情中高精度提取采购人、代理机构、项目联系人及关键文件
 */

export interface ExtractedContact {
  orgName: string;
  role: "purchaser" | "agency";
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export interface ExtractedAttachment {
  name: string;
  sourceUrl: string;
  contentType?: string;
}

export interface ExtractionOutput {
  contacts: ExtractedContact[];
  attachments: ExtractedAttachment[];
}

/**
 * 清洗电话号码，过滤杂质
 */
export function sanitizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[（）()]/g, "").replace(/[—–]/g, "-").replace(/\s+/g, "").trim();
  // 匹配手机或固定电话带区号，如 028-85471098、18465122119、010-87139662、01087139662
  const phonePattern = /(?:\+?86)?(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8}(?:-\d{1,4})?)/;
  const match = cleaned.match(phonePattern);
  return match ? match[0] : (cleaned.length >= 7 && cleaned.length <= 25 ? cleaned : undefined);
}

/**
 * 清洗电子邮箱
 */
export function sanitizeEmail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const match = raw.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : undefined;
}

/**
 * 清洗地址
 */
export function sanitizeAddress(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cleaned = raw.replace(/^[：:\s]+/, "").trim();
  return cleaned.length >= 4 && cleaned.length <= 80 ? cleaned : undefined;
}

/**
 * 从公告内容中深度解析出采购人和代理机构的详细联络图谱
 */
export function extractContactsAndAttachments(
  content: string,
  fallbackPurchaser?: string | null,
  fallbackAgency?: string | null,
  sourceUrl?: string | null,
): ExtractionOutput {
  const contacts: ExtractedContact[] = [];
  const attachments: ExtractedAttachment[] = [];

  // 辅助解析单个机构块
  const parseBlock = (
    blockText: string,
    role: "purchaser" | "agency",
    defaultOrgName?: string | null,
  ): ExtractedContact | null => {
    // 提炼名称
    const nameMatch = blockText.match(/(?:名\s*称|单位名称|采购人|代理机构)[：:\s]+([^\s\r\n\t，,。；;]+)/);
    const orgName = (nameMatch ? nameMatch[1].trim() : defaultOrgName)?.trim();
    if (!orgName || orgName.length < 3) return null;

    // 提炼联系人
    const contactMatch = blockText.match(/(?:联系人|联\s*系\s*人|项目联系人)[：:\s]+([^\s\r\n\t，,。；;0-9]{2,15})/);
    const contactName = contactMatch ? contactMatch[1].trim() : undefined;

    // 提炼电话：支持多种写法与后缀
    const phoneMatch = blockText.match(
      /(?:联系方式|联系电话|电\s*话|手\s*机)[：:\s]+([^\r\n，,。；;]+)/,
    );
    const phone = sanitizePhone(phoneMatch ? phoneMatch[1] : undefined);

    // 提炼邮箱
    const email = sanitizeEmail(blockText);

    // 提炼地址
    const addressMatch = blockText.match(/(?:地\s*址|通讯地址|联系地址)[：:\s]+([^\r\n\t]+)/);
    const address = sanitizeAddress(addressMatch ? addressMatch[1] : undefined);

    return {
      orgName,
      role,
      contactName,
      phone,
      email,
      address,
    };
  };

  // 1. 优先定位联系方式核心专区（全国公共采购网、政采网通用结尾段）
  const contactSectionIdx = content.search(/(?:请按以下方式联系|对本次招标提出询问|联系方式[：:\s]*$|采购人及联系方式)/);
  const searchScope = contactSectionIdx !== -1 ? content.slice(contactSectionIdx) : content;

  // 提取采购人信息块
  const purchaserBlockMatch = searchScope.match(
    /(?:1\s*[.、]|采购人信息|招标人信息)[^]*?(?=(?:2\s*[.、]|采购代理机构信息|代理机构信息|3\s*[.、]|项目联系方式|$))/i,
  );

  // 提取代理机构信息块
  const agencyBlockMatch = searchScope.match(
    /(?:2\s*[.、]|采购代理机构信息|代理机构信息|招标代理机构信息)[^]*?(?=(?:3\s*[.、]|项目联系方式|4\s*[.、]|$))/i,
  );

  // 提取项目联系方式块
  const projectContactBlockMatch = searchScope.match(
    /(?:3\s*[.、]|项目联系方式|项目负责人)[^]*?(?=(?:4\s*[.、]|$))/i,
  );

  // 解析采购人
  if (purchaserBlockMatch) {
    const pContact = parseBlock(purchaserBlockMatch[0], "purchaser", fallbackPurchaser);
    if (pContact) contacts.push(pContact);
  } else if (fallbackPurchaser && fallbackPurchaser.trim().length >= 3) {
    const phoneMatch = searchScope.match(/(?:联系电话|联系方式|电\s*话)[：:\s]+([^\r\n，,。；;]+)/);
    contacts.push({
      orgName: fallbackPurchaser.trim(),
      role: "purchaser",
      phone: sanitizePhone(phoneMatch ? phoneMatch[1] : undefined),
      email: sanitizeEmail(searchScope),
    });
  }

  // 解析代理机构
  if (agencyBlockMatch) {
    const aContact = parseBlock(agencyBlockMatch[0], "agency", fallbackAgency);
    if (aContact) contacts.push(aContact);
  } else if (fallbackAgency && fallbackAgency.trim().length >= 3) {
    contacts.push({
      orgName: fallbackAgency.trim(),
      role: "agency",
    });
  }

  // 若联系人缺少电话，从项目联系人块交叉补齐
  if (projectContactBlockMatch) {
    const projectPhoneMatch = projectContactBlockMatch[0].match(
      /(?:联系电话|电\s*话|手\s*机|联系方式)[：:\s]+([^\r\n，,。；;]+)/,
    );
    const projectContactMatch = projectContactBlockMatch[0].match(
      /(?:项目联系人|联\s*系\s*人)[：:\s]+([^\s\r\n\t，,。；;0-9]{2,15})/,
    );
    const pPhone = sanitizePhone(projectPhoneMatch ? projectPhoneMatch[1] : undefined);
    const pName = projectContactMatch ? projectContactMatch[1].trim() : undefined;

    // 优先补到代理机构，若无代理机构补到采购人
    const target = contacts.find((c) => c.role === "agency") || contacts[0];
    if (target) {
      if (!target.phone && pPhone) target.phone = pPhone;
      if (!target.contactName && pName) target.contactName = pName;
    }
  }

  // 2. 挖掘附件与采购清单
  const attachmentRegex = /([^\s\r\n\t，,。；;]+?\.(?:pdf|docx?|xlsx?|zip|rar|7z))/gi;
  let match: RegExpExecArray | null;
  const seenNames = new Set<string>();

  while ((match = attachmentRegex.exec(content)) !== null) {
    const fullFileName = match[1].replace(/^[0-9.、\s]+/, "").trim();
    if (fullFileName.length >= 5 && !seenNames.has(fullFileName.toLowerCase())) {
      seenNames.add(fullFileName.toLowerCase());

      const ext = fullFileName.split(".").pop()?.toLowerCase();
      let contentType = "application/octet-stream";
      if (ext === "pdf") contentType = "application/pdf";
      else if (ext === "doc" || ext === "docx") contentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (ext === "xls" || ext === "xlsx") contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      else if (ext === "zip" || ext === "rar") contentType = "application/zip";

      attachments.push({
        name: fullFileName,
        sourceUrl: sourceUrl || `https://ccgp.gov.cn/attachments/${encodeURIComponent(fullFileName)}`,
        contentType,
      });
    }
  }

  return { contacts, attachments };
}
