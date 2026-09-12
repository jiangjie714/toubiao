import fs from "node:fs";
import path from "node:path";
import * as YAML from "yaml";
import { syncSkillConfigs } from "../crawler/config-loader";

const SKILLS_ROOT = path.join(process.cwd(), "crawler", "skills");

interface SkillDef {
  code: string;
  name: string;
  baseUrl: string;
  provinceCode?: string;
  category: "gov" | "enterprise" | "platform";
  listUrl: string;
  itemSelector: string;
  titleSelector: string;
  dateSelector: string;
  contentSelector: string;
}

const SOURCES: SkillDef[] = [
  {
    code: "ccgp-beijing",
    name: "北京市政府采购网",
    baseUrl: "http://www.ccgp-beijing.gov.cn",
    provinceCode: "11",
    category: "gov",
    listUrl: "http://www.ccgp-beijing.gov.cn/xxgg/sjzfcggg/",
    itemSelector: "ul.listBox > li",
    titleSelector: "a",
    dateSelector: "span",
    contentSelector: "div.articleBox",
  },
  {
    code: "ccgp-shanghai",
    name: "上海市政府采购网",
    baseUrl: "http://www.zfcg.sh.gov.cn",
    provinceCode: "31",
    category: "gov",
    listUrl: "http://www.zfcg.sh.gov.cn/cms/channel/purchase_notice/index.htm",
    itemSelector: "ul.newsList > li",
    titleSelector: "a",
    dateSelector: "span.time",
    contentSelector: "div.content_detail",
  },
  {
    code: "ccgp-guangdong",
    name: "广东省政府采购网",
    baseUrl: "https://gdgpo.czt.gd.gov.cn",
    provinceCode: "44",
    category: "gov",
    listUrl: "https://gdgpo.czt.gd.gov.cn/freecms/rest/v1/notice/selectNoticeInfoList",
    itemSelector: "ul.m-list > li",
    titleSelector: "a",
    dateSelector: "span.date",
    contentSelector: "div.notice-detail",
  },
  {
    code: "ccgp-jiangsu",
    name: "江苏省政府采购网",
    baseUrl: "http://www.ccgp-jiangsu.gov.cn",
    provinceCode: "32",
    category: "gov",
    listUrl: "http://www.ccgp-jiangsu.gov.cn/jiangsu/cggg/",
    itemSelector: "ul.list_news > li",
    titleSelector: "a",
    dateSelector: "span",
    contentSelector: "div.detail_txt",
  },
  {
    code: "ccgp-zhejiang",
    name: "浙江省政府采购网",
    baseUrl: "http://zfcg.czt.zj.gov.cn",
    provinceCode: "33",
    category: "gov",
    listUrl: "http://zfcg.czt.zj.gov.cn/innerUsed_noticeList/index.html",
    itemSelector: "ul.notice-list > li",
    titleSelector: "a",
    dateSelector: "span.time",
    contentSelector: "div.notice-content",
  },
  {
    code: "ccgp-shandong",
    name: "山东省政府采购网",
    baseUrl: "http://www.ccgp-shandong.gov.cn",
    provinceCode: "37",
    category: "gov",
    listUrl: "http://www.ccgp-shandong.gov.cn/sdgp2017/site/channel__12.html",
    itemSelector: "ul.list_news > li",
    titleSelector: "a",
    dateSelector: "span.date",
    contentSelector: "div.detail_content",
  },
  {
    code: "ccgp-sichuan",
    name: "四川省政府采购网",
    baseUrl: "http://www.ccgp-sichuan.gov.cn",
    provinceCode: "51",
    category: "gov",
    listUrl: "http://www.ccgp-sichuan.gov.cn/view/staticpags/shiji_gkzb/index.html",
    itemSelector: "ul.info-list > li",
    titleSelector: "a",
    dateSelector: "span.date",
    contentSelector: "div.con-detail",
  },
  {
    code: "ccgp-hubei",
    name: "湖北省政府采购网",
    baseUrl: "http://www.ccgp-hubei.gov.cn",
    provinceCode: "42",
    category: "gov",
    listUrl: "http://www.ccgp-hubei.gov.cn/notice/cggg/index.html",
    itemSelector: "ul.news-list > li",
    titleSelector: "a",
    dateSelector: "span",
    contentSelector: "div.art-content",
  },
  {
    code: "ccgp-hunan",
    name: "湖南省政府采购网",
    baseUrl: "http://www.ccgp-hunan.gov.cn",
    provinceCode: "43",
    category: "gov",
    listUrl: "http://www.ccgp-hunan.gov.cn/mvc/getNoticeList4Web.do",
    itemSelector: "ul.list_news > li",
    titleSelector: "a",
    dateSelector: "span",
    contentSelector: "div.art-content",
  },
  {
    code: "ccgp-henan",
    name: "河南省政府采购网",
    baseUrl: "http://www.ccgp-henan.gov.cn",
    provinceCode: "41",
    category: "gov",
    listUrl: "http://www.ccgp-henan.gov.cn/henan/ggcx",
    itemSelector: "ul.List2 > li",
    titleSelector: "a",
    dateSelector: "span.Date",
    contentSelector: "div.Content",
  },
  {
    code: "ccgp-fujian",
    name: "福建省政府采购网",
    baseUrl: "http://zfcg.czt.fujian.gov.cn",
    provinceCode: "35",
    category: "gov",
    listUrl: "http://zfcg.czt.fujian.gov.cn/notice/index.htm",
    itemSelector: "ul.list-group > li",
    titleSelector: "a",
    dateSelector: "span",
    contentSelector: "div.content",
  },
  {
    code: "ccgp-anhui",
    name: "安徽省政府采购网",
    baseUrl: "http://www.ccgp-anhui.gov.cn",
    provinceCode: "34",
    category: "gov",
    listUrl: "http://www.ccgp-anhui.gov.cn/cms/channel/purchase_notice/index.htm",
    itemSelector: "ul.line_list > li",
    titleSelector: "a",
    dateSelector: "span",
    contentSelector: "div.detail_con",
  },
  {
    code: "ccgp-shaanxi",
    name: "陕西省政府采购网",
    baseUrl: "http://www.ccgp-shaanxi.gov.cn",
    provinceCode: "61",
    category: "gov",
    listUrl: "http://www.ccgp-shaanxi.gov.cn/notice/noticeaframe.do",
    itemSelector: "ul.newsList > li",
    titleSelector: "a",
    dateSelector: "span.time",
    contentSelector: "div.notice-detail",
  },
  {
    code: "sgcc",
    name: "国家电网新一代电子商务平台",
    baseUrl: "https://ecp.sgcc.com.cn",
    category: "enterprise",
    listUrl: "https://ecp.sgcc.com.cn/ecp2.0/portal/#/doc/doci-win/2018060571151651_2018060501171107",
    itemSelector: "div.el-table__row",
    titleSelector: "a",
    dateSelector: "td:eq(3)",
    contentSelector: "div.detail-main",
  },
  {
    code: "b2b-10086",
    name: "中国移动采购与招标网",
    baseUrl: "https://b2b.10086.cn",
    category: "enterprise",
    listUrl: "https://b2b.10086.cn/b2b/main/listVendorsNoticeResult.html",
    itemSelector: "table.notice-table tr:gt(0)",
    titleSelector: "a",
    dateSelector: "td:last-child",
    contentSelector: "div.notice-content",
  },
  {
    code: "ctb",
    name: "中国电信阳光采购网",
    baseUrl: "https://caigou.chinatelecom.com.cn",
    category: "enterprise",
    listUrl: "https://caigou.chinatelecom.com.cn/MSS-PORTAL/announcementBuy/list",
    itemSelector: "ul.announce-list > li",
    titleSelector: "a",
    dateSelector: "span.date",
    contentSelector: "div.main-text",
  },
  {
    code: "chinaunicombidding",
    name: "中国联通采购与招标网",
    baseUrl: "http://www.chinaunicombidding.cn",
    category: "enterprise",
    listUrl: "http://www.chinaunicombidding.cn/jsp/cninfo/listProcurementNotice.jsp",
    itemSelector: "table.noticeTable tr:gt(0)",
    titleSelector: "a",
    dateSelector: "td:eq(2)",
    contentSelector: "div.notice-box",
  },
  {
    code: "cr-szb",
    name: "华润守正电子招标平台",
    baseUrl: "https://szb.crc.com.cn",
    category: "enterprise",
    listUrl: "https://szb.crc.com.cn/tzgg/index.jhtml",
    itemSelector: "ul.news-ul > li",
    titleSelector: "a",
    dateSelector: "span.time",
    contentSelector: "div.content_detail",
  },
  {
    code: "crec",
    name: "中国中铁采购电子商务平台",
    baseUrl: "https://www.crecgec.com",
    category: "enterprise",
    listUrl: "https://www.crecgec.com/cms/channel/purchase_notice/index.htm",
    itemSelector: "ul.notice-ul > li",
    titleSelector: "a",
    dateSelector: "span",
    contentSelector: "div.notice-info",
  },
  {
    code: "sinopec",
    name: "中国石化物资招标投标网",
    baseUrl: "https://bidding.sinopec.com",
    category: "enterprise",
    listUrl: "https://bidding.sinopec.com/bidding/bidNoticeList.html",
    itemSelector: "table.list_table tr:gt(0)",
    titleSelector: "a",
    dateSelector: "td:eq(3)",
    contentSelector: "div.article-content",
  },
  {
    code: "ggzy",
    name: "全国公共资源交易平台",
    baseUrl: "http://www.ggzy.gov.cn",
    category: "platform",
    listUrl: "http://www.ggzy.gov.cn/information/html/a/trade.html",
    itemSelector: "ul.publicont > li",
    titleSelector: "a",
    dateSelector: "span.time",
    contentSelector: "div.detail-content",
  },
];

async function generate() {
  console.log(`=== 开始规模化生成 ${SOURCES.length} 个重点采招数据源技能 ===`);

  for (const src of SOURCES) {
    const dir = path.join(SKILLS_ROOT, src.code);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const configObj = {
      source: {
        name: src.name,
        baseUrl: src.baseUrl,
      },
      settings: {
        requestDelayMs: 1500,
        timeoutMs: 20000,
        retries: 2,
        maxPages: 1,
        scheduleCron: "0 */2 * * *",
      },
      lists: [
        {
          type: "NOTICE",
          mode: "html",
          firstPageUrl: src.listUrl,
          url: src.listUrl,
          parse: {
            itemSelector: src.itemSelector,
            fields: {
              title: { selector: src.titleSelector, attr: "text" },
              url: { selector: src.titleSelector, attr: "href" },
              date: { selector: src.dateSelector, attr: "text", regex: "\\d{4}-\\d{2}-\\d{2}" },
              ...(src.provinceCode ? { province: { const: src.provinceCode } } : {}),
            },
          },
          detail: {
            contentSelector: src.contentSelector,
            removeSelector: "script, style",
          },
        },
      ],
    };

    const yamlStr = YAML.stringify(configObj);
    fs.writeFileSync(path.join(dir, "config.yaml"), yamlStr, "utf-8");

    const skillMd = `# ${src.name}（${src.code}）

## 站点档案
- **站点名称**：${src.name}
- **官网主页**：${src.baseUrl}
- **公告频道**：${src.listUrl}
- **数据分类**：${src.category === "gov" ? "省级政府采购" : src.category === "enterprise" ? "央企采购电商" : "国家公共资源交易"}
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 \`${src.itemSelector}\` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 \`${src.contentSelector}\` 是否有嵌套 iframe 或动态渲染。
`;
    fs.writeFileSync(path.join(dir, "SKILL.md"), skillMd, "utf-8");
    console.log(`✓ 技能配置生成成功: ${src.code} (${src.name})`);
  }

  console.log("\n正在将技能配置同步至 PostgreSQL 数据表 CrawlSource 与 SkillRevision...");
  const syncRes = await syncSkillConfigs();
  console.log(`同步完成：已注册数据源总数 = ${syncRes.synced} 个，更新版本 = ${syncRes.versions} 个`);
}

generate().catch(console.error);
