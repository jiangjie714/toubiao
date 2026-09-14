"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SupplierComparisonData } from "@/lib/competitor";
import {
  TrophyIcon,
  BuildingIcon,
  MapPinIcon,
  ArrowsRightLeftIcon,
  LockClosedIcon,
  SparklesIcon,
  ChartBarIcon,
} from "@/components/icons";

interface CompetitorCompareViewProps {
  initialData: SupplierComparisonData;
  initialNames: string[];
  userCompanyName?: string;
}

export default function CompetitorCompareView({
  initialData,
  initialNames,
  userCompanyName,
}: CompetitorCompareViewProps) {
  const router = useRouter();
  const [data] = useState<SupplierComparisonData>(initialData);
  const [names, setNames] = useState<string[]>(initialNames);
  const [newSupplierInput, setNewSupplierInput] = useState("");

  const handleRemoveSupplier = (nameToRemove: string) => {
    if (names.length <= 1) return;
    const filtered = names.filter((n) => n !== nameToRemove);
    setNames(filtered);
    router.push(`/suppliers/compare?names=${encodeURIComponent(filtered.join(","))}`);
  };

  const handleAddSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSupplierInput.trim();
    if (!trimmed || names.includes(trimmed)) return;
    if (names.length >= 3) {
      alert("最多支持同时对比 3 家同业企业");
      return;
    }
    const updated = [...names, trimmed];
    setNames(updated);
    setNewSupplierInput("");
    router.push(`/suppliers/compare?names=${encodeURIComponent(updated.join(","))}`);
  };

  const handleAddUserCompany = () => {
    if (!userCompanyName || names.includes(userCompanyName)) return;
    const updated = [userCompanyName, ...names].slice(0, 3);
    setNames(updated);
    router.push(`/suppliers/compare?names=${encodeURIComponent(updated.join(","))}`);
  };

  // 辅助比较最大值以高亮胜出者
  const maxWinCount = Math.max(...data.suppliers.map((s) => s.winCount));
  const maxTotalAward = Math.max(...data.suppliers.map((s) => s.totalAwardWan));
  const maxAvgAward = Math.max(...data.suppliers.map((s) => s.avgAwardWan));
  const maxProvinces = Math.max(...data.suppliers.map((s) => s.provincesCount));

  // 调色盘：区分对比企业 (最多3家)
  const toneStyles = [
    {
      badge: "bg-blue-50 text-blue-700 border-blue-200",
      bar: "bg-blue-600",
      lightBg: "bg-blue-50/50",
      text: "text-blue-700",
      border: "border-blue-200",
      accent: "#2563eb",
    },
    {
      badge: "bg-purple-50 text-purple-700 border-purple-200",
      bar: "bg-purple-600",
      lightBg: "bg-purple-50/50",
      text: "text-purple-700",
      border: "border-purple-200",
      accent: "#7c3aed",
    },
    {
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      bar: "bg-amber-600",
      lightBg: "bg-amber-50/50",
      text: "text-amber-800",
      border: "border-amber-200",
      accent: "#d97706",
    },
  ];

  return (
    <div className="space-y-8">
      {/* 1. 顶部控制栏与对比企业选择器 */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-xs">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ArrowsRightLeftIcon className="h-4 w-4" />
              </span>
              <h2 className="text-lg font-bold tracking-tight text-slate-900">
                同业竞争对标中枢
              </h2>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  data.insights.overlapDegree === "HIGH"
                    ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/20"
                    : data.insights.overlapDegree === "MEDIUM"
                    ? "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/20"
                    : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"
                }`}
              >
                {data.insights.overlapDegreeLabel}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              通过真实招投标大数据，量化对比企业中标实力、客单价偏好、重叠发包金主与主攻根据地
            </p>
          </div>

          {/* 添加企业表单 */}
          <div className="flex flex-wrap items-center gap-2">
            {userCompanyName && !names.includes(userCompanyName) && (
              <button
                type="button"
                onClick={handleAddUserCompany}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <SparklesIcon className="h-3.5 w-3.5" />
                <span>与我的企业（{userCompanyName}）PK</span>
              </button>
            )}

            {names.length < 3 && (
              <form onSubmit={handleAddSupplier} className="flex items-center gap-2">
                <div className="relative">
                  <input
                    type="text"
                    value={newSupplierInput}
                    onChange={(e) => setNewSupplierInput(e.target.value)}
                    placeholder="输入竞对全称加入对比..."
                    className="h-8 w-48 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!newSupplierInput.trim()}
                  className="cursor-pointer h-8 rounded-lg bg-primary px-3 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  添加
                </button>
              </form>
            )}
          </div>
        </div>

        {/* 当前对比企业标签 */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400">当前对标主体：</span>
          {data.suppliers.map((s, idx) => (
            <div
              key={s.name}
              className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-2xs ${
                toneStyles[idx]?.badge || "bg-slate-100 text-slate-700 border-slate-200"
              }`}
            >
              <Link
                href={`/suppliers/${encodeURIComponent(s.name)}`}
                className="cursor-pointer hover:underline"
                title="查看该企业单体画像"
              >
                {s.name}
              </Link>
              {names.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemoveSupplier(s.name)}
                  className="cursor-pointer text-slate-400 hover:text-rose-600 transition-colors"
                  title="移除此企业"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. 核心战绩量化 PK 罗盘 (Head-to-Head Hero Metrics) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {data.suppliers.map((s, idx) => {
          const tone = toneStyles[idx] || toneStyles[0];
          return (
            <div
              key={s.name}
              className={`relative overflow-hidden rounded-2xl border ${tone.border} bg-surface p-5 shadow-xs transition-shadow hover:shadow-md`}
            >
              {/* 顶部企业标识 */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${tone.bar}`}
                    />
                    <h3 className="text-base font-bold text-slate-900 line-clamp-1" title={s.name}>
                      {s.name}
                    </h3>
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <span>首次拿单: {s.firstDate}</span>
                    <span>·</span>
                    <span>最新: {s.latestDate}</span>
                  </div>
                </div>

                <Link
                  href={`/suppliers/${encodeURIComponent(s.name)}`}
                  className="cursor-pointer text-xs font-medium text-slate-400 hover:text-primary transition-colors"
                >
                  画像 →
                </Link>
              </div>

              {/* 关键数字阵列 */}
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
                <div className="rounded-xl bg-slate-50/70 p-3">
                  <div className="text-xs text-slate-500">累计中标总金额</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-slate-900 tnum">
                      {s.totalAwardWan.toLocaleString("zh-CN")}
                    </span>
                    <span className="text-xs text-slate-500">万元</span>
                  </div>
                  {s.totalAwardWan === maxTotalAward && data.suppliers.length > 1 && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.2 text-[10px] font-semibold text-amber-700">
                      <TrophyIcon className="h-3 w-3 text-amber-600" />
                      领先
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50/70 p-3">
                  <div className="text-xs text-slate-500">中标项目数</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-xl font-extrabold text-slate-900 tnum">
                      {s.winCount}
                    </span>
                    <span className="text-xs text-slate-500">个标段</span>
                  </div>
                  {s.winCount === maxWinCount && data.suppliers.length > 1 && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-700">
                      单量最多
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50/70 p-3">
                  <div className="text-xs text-slate-500">平均中标客单价</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-lg font-bold text-slate-900 tnum">
                      {s.avgAwardWan.toLocaleString("zh-CN")}
                    </span>
                    <span className="text-xs text-slate-500">万元/标</span>
                  </div>
                  {s.avgAwardWan === maxAvgAward && data.suppliers.length > 1 && (
                    <div className="mt-1 text-[10px] font-medium text-slate-400">
                      高客单优势
                    </div>
                  )}
                </div>

                <div className="rounded-xl bg-slate-50/70 p-3">
                  <div className="text-xs text-slate-500">阵地与发包方</div>
                  <div className="mt-1 text-sm font-semibold text-slate-800 tnum">
                    {s.provincesCount} 省市 / {s.purchasersCount} 买方
                  </div>
                  {s.provincesCount === maxProvinces && data.suppliers.length > 1 && (
                    <div className="mt-1 text-[10px] font-medium text-slate-400">
                      地域分布广
                    </div>
                  )}
                </div>
              </div>

              {/* 单笔极值与主力买方 */}
              <div className="mt-3 space-y-1.5 rounded-lg border border-slate-100 bg-white p-2.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span className="text-slate-400">单笔最大中标标段：</span>
                  <span className="font-semibold text-slate-800 tnum">
                    {s.maxAwardWan} 万元
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">主力合作采购人：</span>
                  <span
                    className="max-w-[140px] truncate text-slate-700"
                    title={s.topPurchasers.map((p) => p.name).join("、")}
                  >
                    {s.topPurchasers[0]?.name || "暂无"}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 3. 竞争博弈深度洞察与战术突围建议 */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/50 via-white to-blue-50/40 p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
            <SparklesIcon className="h-4 w-4" />
          </span>
          <h3 className="text-base font-bold text-slate-900">
            红蓝博弈洞察与战术突围建议
          </h3>
          <span className="rounded bg-indigo-100/70 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
            AI 规则引擎推导
          </span>
        </div>

        <p className="mt-2 text-sm leading-relaxed text-slate-700">
          {data.insights.summary}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {data.insights.recommendations.map((rec, idx) => (
            <div
              key={idx}
              className="flex items-start gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary tnum">
                {idx + 1}
              </span>
              <p className="text-xs leading-relaxed text-slate-600">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. 发包买方重合度与红海竞争热度表 (Shared Purchasers Matrix) */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-surface shadow-xs">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-6 py-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <BuildingIcon className="h-4 w-4 text-slate-500" />
              <h3 className="text-base font-bold text-slate-900">
                共有客户发包方深度穿透（正面交锋红海）
              </h3>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              识别双方均曾中标的发包单位，此区域为双方正面抢单与防守的核心战场
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
            共计 {data.sharedPurchasers.length} 家重叠买方
          </span>
        </div>

        {data.sharedPurchasers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            双方暂无重叠中标的发包方单位，体现出较强的客群区隔与错位优势。
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                  <th className="px-6 py-3 font-medium">共有发包单位名称</th>
                  <th className="px-6 py-3 font-medium">累计交锋标段数</th>
                  {data.suppliers.map((s, idx) => (
                    <th key={s.name} className="px-6 py-3 font-medium">
                      <span className={toneStyles[idx]?.text || "text-slate-700"}>
                        {s.name} 战绩
                      </span>
                    </th>
                  ))}
                  <th className="px-6 py-3 font-medium">竞争态势</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.sharedPurchasers.map((item, idx) => {
                  return (
                    <tr
                      key={idx}
                      className="transition-colors duration-150 hover:bg-slate-50/60"
                    >
                      <td className="px-6 py-3.5">
                        {item.isLocked ? (
                          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-400">
                            <LockClosedIcon className="h-3.5 w-3.5 text-amber-500" />
                            <span>{item.purchaser}</span>
                          </div>
                        ) : (
                          <Link
                            href={`/purchasers/${encodeURIComponent(item.purchaser)}`}
                            className="cursor-pointer font-medium text-slate-800 hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <span>{item.purchaser}</span>
                            <span className="text-[10px] text-slate-400">→</span>
                          </Link>
                        )}
                      </td>

                      <td className="px-6 py-3.5 text-xs font-semibold text-slate-700 tnum">
                        {item.totalSharedBids} 标
                      </td>

                      {data.suppliers.map((s) => {
                        const st = item.details[s.name];
                        if (!st) {
                          return (
                            <td key={s.name} className="px-6 py-3.5 text-xs text-slate-400">
                              -
                            </td>
                          );
                        }
                        return (
                          <td key={s.name} className="px-6 py-3.5 text-xs">
                            <div className="font-semibold text-slate-800 tnum">
                              {st.winCount} 次 / {st.totalAwardWan} 万元
                            </div>
                            <div className="text-[11px] text-slate-400">
                              最新: {st.latestDate}
                            </div>
                          </td>
                        );
                      })}

                      <td className="px-6 py-3.5">
                        <span className="inline-flex items-center rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                          正面对决
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* 权限提示：若存在脱敏买方 */}
        {!data.isPremium && data.lockedSharedPurchasersCount > 0 && (
          <div className="border-t border-slate-100 bg-amber-50/40 p-4 text-center">
            <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
              <span className="flex items-center gap-1 text-xs text-amber-800">
                <LockClosedIcon className="h-3.5 w-3.5 text-amber-600" />
                当前为基础体验模式，已隐藏其余 {data.lockedSharedPurchasersCount} 家共有买方详细明细
              </span>
              <Link
                href="/pricing"
                className="cursor-pointer rounded-lg bg-primary px-3 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                升级白金版解锁全量买方穿透 →
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 5. 标段金额档位偏好对比 (Tier Distribution) */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-bold text-slate-900">
            标段金额档位偏好与项目规模结构
          </h3>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          对比各企业在小微标段、中型标段与特大重特大工程上的布局占比，洞悉竞争对手的核心擅长价格带
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {data.suppliers.map((s, idx) => {
            const tone = toneStyles[idx] || toneStyles[0];
            const totalCount = s.winCount || 1;
            const pctUnder100 = Math.round((s.tierDistribution.under100.count / totalCount) * 100);
            const pctBetween = Math.round(
              (s.tierDistribution.between100And500.count / totalCount) * 100
            );
            const pctAbove500 = Math.round((s.tierDistribution.above500.count / totalCount) * 100);

            return (
              <div
                key={s.name}
                className="rounded-xl border border-slate-100 bg-slate-50/50 p-4"
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-bold ${tone.text} line-clamp-1`} title={s.name}>
                    {s.name}
                  </span>
                  <span className="text-xs text-slate-400">共 {s.winCount} 标</span>
                </div>

                <div className="mt-4 space-y-3 text-xs">
                  {/* < 100万 */}
                  <div>
                    <div className="flex justify-between text-slate-600">
                      <span>小型标段 (&lt;100万)</span>
                      <span className="font-semibold text-slate-800 tnum">
                        {s.tierDistribution.under100.count} 标 ({pctUnder100}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-slate-400"
                        style={{ width: `${pctUnder100}%` }}
                      />
                    </div>
                  </div>

                  {/* 100~500万 */}
                  <div>
                    <div className="flex justify-between text-slate-600">
                      <span>中型标段 (100~500万)</span>
                      <span className="font-semibold text-slate-800 tnum">
                        {s.tierDistribution.between100And500.count} 标 ({pctBetween}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className={`h-full rounded-full ${tone.bar}`}
                        style={{ width: `${pctBetween}%` }}
                      />
                    </div>
                  </div>

                  {/* > 500万 */}
                  <div>
                    <div className="flex justify-between text-slate-600">
                      <span>大型重特大标 (&gt;500万)</span>
                      <span className="font-semibold text-slate-800 tnum">
                        {s.tierDistribution.above500.count} 标 ({pctAbove500}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-amber-500"
                        style={{ width: `${pctAbove500}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. 作战省份势力范围分析 (Territory & Provinces) */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-6 shadow-xs">
        <div className="flex items-center gap-2">
          <MapPinIcon className="h-4 w-4 text-slate-500" />
          <h3 className="text-base font-bold text-slate-900">
            作战根据地与省份势力范围
          </h3>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">
          对比各企业在全国各行政区划的主战场分布、共有交锋阵地与独占优势省份
        </p>

        <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* 共有阵地 */}
          <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-800">
                双方共同交锋省份（重合阵地）
              </span>
              <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700 tnum">
                {data.sharedProvinces.length} 个
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {data.sharedProvinces.length > 0 ? (
                data.sharedProvinces.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs border border-blue-100"
                  >
                    {p}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">暂无完全重叠的中标省份</span>
              )}
            </div>
          </div>

          {/* 各自独占阵地 */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
            <span className="text-xs font-bold text-slate-700">各自独占优势根据地</span>
            {data.suppliers.map((s, idx) => {
              const excList = data.exclusiveProvinces[s.name] || [];
              const tone = toneStyles[idx] || toneStyles[0];
              return (
                <div key={s.name} className="text-xs">
                  <div className="flex items-center gap-1.5 font-medium text-slate-600">
                    <span className={`h-2 w-2 rounded-full ${tone.bar}`} />
                    <span className="font-semibold text-slate-800">{s.name} 独占：</span>
                    <span className="text-slate-400 tnum">{excList.length} 省</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1 pl-3.5">
                    {excList.length > 0 ? (
                      excList.map((p) => (
                        <span
                          key={p}
                          className="rounded bg-white px-2 py-0.5 text-[11px] text-slate-600 border border-slate-200/60"
                        >
                          {p}
                        </span>
                      ))
                    ) : (
                      <span className="text-[11px] text-slate-400">无独立独占省份</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
