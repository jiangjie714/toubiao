/**
 * 历史存量数据清洗脚本：
 * 1. 修复存为 JSON 字符串的标讯（广东省、湖南省等），转为规范公文文本与高保真 HTML
 * 2. 修复山东省政府采购网 Base64 GBK 误用 UTF-8 解码导致的 \uFFFD 乱码
 */

import { prisma } from "../src/lib/prisma";
import { formatJsonTenderContent, isJsonString } from "../src/lib/tender-json-formatter";
import { extractFidelityHtml } from "../crawler/fidelity";

async function fixJsonTenders() {
  console.log("=== [1/2] 正在修复存为 JSON 字符串的标讯数据 ===");
  const tenders = await prisma.tender.findMany({
    where: {
      OR: [{ content: { startsWith: "{" } }, { content: { startsWith: "[" } }],
    },
    select: { id: true, sourceName: true, title: true, content: true, contentHtml: true },
  });

  console.log(`检测到 ${tenders.length} 条 JSON 格式公告待修复`);

  let count = 0;
  for (const t of tenders) {
    if (!isJsonString(t.content)) continue;
    const formatted = formatJsonTenderContent(t.content, t.title);
    if (!formatted.isJson) continue;

    await prisma.tender.update({
      where: { id: t.id },
      data: {
        content: formatted.plainText,
        contentHtml: formatted.htmlText,
      },
    });
    count++;
  }

  console.log(`✅ 成功修复 JSON 公告：${count} 条`);
}

async function fixShandongMojibake() {
  console.log("\n=== [2/2] 正在修复山东省政府采购网 Base64 GBK 乱码数据 ===");
  const shandongTenders = await prisma.tender.findMany({
    where: {
      sourceName: "山东省政府采购网",
    },
    select: { id: true, sourceUrl: true, title: true, content: true },
  });

  console.log(`检测到 ${shandongTenders.length} 条山东省政府采购网数据`);

  let fixed = 0;
  let failed = 0;

  for (const t of shandongTenders) {
    if (!t.sourceUrl) continue;
    try {
      const res = await fetch(t.sourceUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) {
        failed++;
        continue;
      }
      const data = await res.json().catch(() => null);
      const b64 = data?.data?.data?.body || data?.data?.body;
      if (!b64 || typeof b64 !== "string") {
        failed++;
        continue;
      }

      const buf = Buffer.from(b64.replace(/\s+/g, ""), "base64");
      // 用 GB18030 正确解码
      const html = new TextDecoder("gb18030", { fatal: false }).decode(buf);

      const fidelity = extractFidelityHtml(html, {
        contentSelector: "#noticeArea, table, .protect, body",
        baseUrl: t.sourceUrl,
      });

      await prisma.tender.update({
        where: { id: t.id },
        data: {
          content: fidelity.plainText,
          contentHtml: fidelity.fidelityHtml,
        },
      });
      fixed++;
      if (fixed % 20 === 0) {
        console.log(`  已完成修复 ${fixed}/${shandongTenders.length}...`);
      }
    } catch {
      failed++;
    }
  }

  console.log(`✅ 山东省乱码修复完成：成功 ${fixed} 条，失败/跳过 ${failed} 条`);
}

async function fixSingleHunan1497() {
  const t = await prisma.tender.findUnique({ where: { id: 1497 } });
  if (t && t.content.includes("绁侀槼")) {
    console.log("正在修复湖南省 ID 1497 乱码记录...");
    try {
      const res = await fetch(t.sourceUrl!, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        },
      });
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const html = new TextDecoder("gb18030", { fatal: false }).decode(buf);
        const fidelity = extractFidelityHtml(html, {
          contentSelector: "#template-center-mark, .tb-fidelity-root, body",
          baseUrl: t.sourceUrl!,
        });
        if (!fidelity.plainText.includes("\uFFFD")) {
          await prisma.tender.update({
            where: { id: 1497 },
            data: {
              content: fidelity.plainText,
              contentHtml: fidelity.fidelityHtml,
            },
          });
          console.log("✅ ID 1497 修复成功");
        }
      }
    } catch {
      // ignore
    }
  }
}

async function main() {
  await fixJsonTenders();
  await fixShandongMojibake();
  await fixSingleHunan1497();
  console.log("\n🎉 全部数据清洗修复完毕！");
}

main()
  .catch((e) => console.error("修复失败：", e))
  .finally(() => prisma.$disconnect());
