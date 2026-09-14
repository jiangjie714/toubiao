import Link from "next/link";
import { getRegionList, CHINA_ZONES } from "@/lib/region";
import {
  MapPinIcon,
  SparklesIcon,
  BuildingIcon,
  TrophyIcon,
  ChartBarIcon,
} from "@/components/icons";

export const metadata = {
  title: "全国省市招投标大盘与区域作战地图 - 标讯通",
  description:
    "覆盖全国 31 个省市自治区招投标采购全景大盘、各省发包预算池、核心发包金主与领军标王透视",
};

export default async function RegionsPage({
  searchParams,
}: {
  searchParams: Promise<{ zone?: string; q?: string }>;
}) {
  const { zone: currentZone = "ALL", q = "" } = await searchParams;
  const regions = await getRegionList();

  const totalBudgetWan = regions.reduce((acc, r) => acc + r.totalBudgetWan, 0);
  const totalAwardWan = regions.reduce((acc, r) => acc + r.totalAwardWan, 0);
  const totalTenders = regions.reduce((acc, r) => acc + r.tenderCount, 0);
  const totalPurchasers = regions.reduce((acc, r) => acc + r.purchaserCount, 0);

  // 过滤
  let filtered = regions;
  if (currentZone && currentZone !== "ALL") {
    const zoneMeta = CHINA_ZONES[currentZone];
    if (zoneMeta) {
      filtered = filtered.filter((r) => zoneMeta.provinceCodes.includes(r.code));
    }
  }

  if (q.trim()) {
    const query = q.trim();
    filtered = filtered.filter((r) => r.name.includes(query) || r.zone.includes(query));
  }

  const zoneEntries = Object.entries(CHINA_ZONES);

  return (
    <div className="space-y-8">
      {/* 顶部标题与定位 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider">
            <MapPinIcon className="h-4 w-4" />
            <span>全国招投标区域作战地图 · 31 省市公共资源交易全盘透视</span>
          </div>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
            全国省市招投标情报大盘
          </h1>
          <p className="mt-1.5 text-sm text-slate-500 max-w-3xl">
            汇聚全国 31 个省、自治区、直辖市政府采购与公共资源交易全量数据，穿透各省发包预算池、
            核心发包金主朋友圈、中标标王榜单与下辖地市商机纵深。
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <SparklesIcon className="h-4 w-4 text-amber-500" />
          <span>每日多频同步全国公共资源交易平台</span>
        </div>
      </div>

      {/* 4 大核心宏观指标看板 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">覆盖行政战区</span>
            <MapPinIcon className="h-4 w-4 text-blue-600" />
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-900 font-mono">
            {regions.length}{" "}
            <span className="text-xs font-normal text-slate-500">省市自治区</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            涵盖全国 7 大地理战区
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">全网发包总预算</span>
            <ChartBarIcon className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-emerald-700 font-mono">
            {(totalBudgetWan / 10000).toFixed(2)}{" "}
            <span className="text-xs font-normal text-slate-500">亿元</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            累计成交 ¥{(totalAwardWan / 10000).toFixed(2)} 亿元
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">在库标讯总量</span>
            <TrophyIcon className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-slate-900 font-mono">
            {totalTenders.toLocaleString()}{" "}
            <span className="text-xs font-normal text-slate-500">篇</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            含招标/意向/更正/中标
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-medium">发包金主单位</span>
            <BuildingIcon className="h-4 w-4 text-purple-600" />
          </div>
          <div className="mt-3 text-2xl font-black tracking-tight text-purple-700 font-mono">
            {totalPurchasers.toLocaleString()}{" "}
            <span className="text-xs font-normal text-slate-500">家</span>
          </div>
          <div className="mt-1 text-xs text-slate-400">
            全国各级党政机关/企事业单位
          </div>
        </div>
      </div>

      {/* 战区导航与搜索过滤 */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href="/regions"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                currentZone === "ALL"
                  ? "bg-primary text-white font-semibold shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              全部战区 ({regions.length})
            </Link>
            {zoneEntries.map(([key, item]) => {
              const count = regions.filter((r) => item.provinceCodes.includes(r.code)).length;
              const isActive = currentZone === key;
              return (
                <Link
                  key={key}
                  href={`/regions?zone=${key}`}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    isActive
                      ? "bg-primary text-white font-semibold shadow-xs"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {item.name} ({count})
                </Link>
              );
            })}
          </div>

          <form action="/regions" method="GET" className="flex items-center gap-2">
            {currentZone !== "ALL" && <input type="hidden" name="zone" value={currentZone} />}
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="搜索省市名称..."
              className="rounded-lg border border-slate-200 bg-surface px-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary w-44"
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 transition cursor-pointer"
            >
              筛选
            </button>
          </form>
        </div>
      </div>

      {/* 省市 Bento Grid 卡片流 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((r) => {
          return (
            <div
              key={r.code}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs transition duration-200 hover:border-blue-400 hover:shadow-md"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 group-hover:text-primary transition-colors">
                        {r.name}
                      </h2>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {r.zone}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-400 font-mono">
                      代码: {r.code} · 最近更新: {r.latestDate}
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-600/20 font-mono">
                      活跃度 {r.hotScore}
                    </span>
                  </div>
                </div>

                {/* 预算与标讯看板 */}
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50/70 p-3 text-xs">
                  <div>
                    <div className="text-slate-400">发包预算池</div>
                    <div className="mt-1 text-sm font-bold text-blue-700 font-mono">
                      {r.totalBudgetWan > 0
                        ? `${r.totalBudgetWan.toLocaleString()} 万元`
                        : "待披露"}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">中标成交额</div>
                    <div className="mt-1 text-sm font-bold text-emerald-700 font-mono">
                      {r.totalAwardWan > 0
                        ? `${r.totalAwardWan.toLocaleString()} 万元`
                        : "待更新"}
                    </div>
                  </div>
                  <div className="border-t border-slate-200/60 pt-2">
                    <div className="text-slate-400">标讯总篇数</div>
                    <div className="mt-0.5 font-bold text-slate-800 font-mono">
                      {r.tenderCount} 篇
                    </div>
                  </div>
                  <div className="border-t border-slate-200/60 pt-2">
                    <div className="text-slate-400">发包买方规模</div>
                    <div className="mt-0.5 font-bold text-slate-800 font-mono">
                      {r.purchaserCount} 家
                    </div>
                  </div>
                </div>

                {/* 标讯类型比例条 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>招标公告: {r.noticeCount}</span>
                    <span>中标结果: {r.resultCount}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      className="bg-blue-600 h-full"
                      style={{
                        width: `${
                          r.tenderCount > 0
                            ? (r.noticeCount / r.tenderCount) * 100
                            : 50
                        }%`,
                      }}
                    />
                    <div
                      className="bg-emerald-500 h-full"
                      style={{
                        width: `${
                          r.tenderCount > 0
                            ? (r.resultCount / r.tenderCount) * 100
                            : 50
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 底部操作区 */}
              <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                <Link
                  href={`/list?province=${r.code}`}
                  className="text-xs text-slate-500 hover:text-primary transition"
                >
                  检索本省商机 →
                </Link>
                <Link
                  href={`/regions/${r.code}`}
                  className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-100"
                >
                  <span>360° 区域作战大盘</span>
                  <span className="font-mono">→</span>
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-surface p-12 text-center text-slate-400">
          未检索到符合条件的行政区域
        </div>
      )}
    </div>
  );
}
