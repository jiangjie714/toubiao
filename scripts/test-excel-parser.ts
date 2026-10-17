import ExcelJS from "exceljs";
import { parseAttachmentBuffer } from "../src/lib/attachment-parser";

async function testExcelParser() {
  console.log("=== [Test] 真实 Excel 附件清单二进制解析与表格提取验证 ===\n");

  // 1. 在内存中创建一个标准工程量/设备采购清单工作簿
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("采购设备明细表");

  sheet.addRow(["序号", "设备品名", "规格型号", "数量", "计量单位", "单价限价(元)", "合价(元)"]);
  sheet.addRow([1, "高精度工业三坐标测量机", "Bridge-6000 Pro", 2, "台", "480,000.00", "960,000.00"]);
  sheet.addRow([2, "高频激光干涉仪", "Optic-X3", 1, "套", "320,000.00", "320,000.00"]);
  sheet.addRow([3, "金属光谱分析仪", "Spec-800", 3, "批", "150,000.00", "450,000.00"]);

  const buffer = await workbook.xlsx.writeBuffer();
  console.log(`✓ 内存生成模拟招标文件 Excel 附件: 大小 = ${buffer.byteLength} 字节`);

  // 2. 调用 parseAttachmentBuffer 进行全流程测试
  const parsed = await parseAttachmentBuffer(Buffer.from(buffer), "高精加工中心设备采购清单.xlsx");

  console.log(`✓ 附件类型: ${parsed.fileType}`);
  console.log(`✓ 页数(Sheets): ${parsed.pageCount}`);
  console.log(`✓ 提取条目总数: ${parsed.itemCount}`);
  console.log(`✓ 提取表格数: ${parsed.tables?.length ?? 0}`);
  console.log(`✓ 提炼核心标的摘要: "${parsed.snippet}"`);

  if (!parsed.snippet.includes("高精度工业三坐标测量机")) {
    throw new Error(`未能成功提取代表性采购品名: ${parsed.snippet}`);
  }

  if (parsed.itemCount !== 3) {
    throw new Error(`提取条目数错误: 期望 3，实际 ${parsed.itemCount}`);
  }

  if (!parsed.tables || parsed.tables[0].headers.length !== 7) {
    throw new Error("表格表头解析字段数不匹配");
  }

  console.log("\n✅ 真实 Excel 附件解析提纯测试通过！");
}

testExcelParser().catch((err) => {
  console.error("❌ 测试失败:", err);
  process.exit(1);
});
