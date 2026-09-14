"use client";

import React from "react";
import Link from "next/link";
import { type WeeklyBriefData } from "@/lib/analytics";
import {
  PrinterIcon,
  SparklesIcon,
  ClockIcon,
  BuildingIcon,
  TrophyIcon,
  ChartBarIcon,
} from "@/components/icons";

interface Props {
  brief: WeeklyBriefData;
  userName: string;
}

export default function WeeklyBriefView({ brief, userName }: Props) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* 顶部操作条（打印时隐藏） */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Link
            href="/analytics"
            className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 hover:text-slate-900"
            title="返回情报大盘"
          >
            ←
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900">标讯商机决策周报</h1>
            <p className="text-xs text-slate-500">
              数据周期：{brief.startDate} 至 {brief.endDate} · 生成人：{userName}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            <PrinterIcon className="h-4 w-4" />
            打印 / 另存为 PDF
          </button>
        </div>
      </div>

      {/* 决策简报正文（适配 A4 纸张排版与打印） */}
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:border-none print:p-0 print:shadow-none">
        {/* 周报头部报头 */}
        <div className="border-b-2 border-primary pb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary px-2.5 py-1 text-xs font-black tracking-wider text-white uppercase">
                BXTONG BRIEF
              </span>
              <span className="text-xs font-bold text-slate-500">标讯通企业情报内参</span>
            </div>
            <span className="text-xs font-medium text-slate-400 tnum">
              生成日期：{brief.generatedAt}
            </span>
          </div>

          <div className="mt-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                招投标重点商机与竞争决策周报
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                统计区间：{brief.startDate} ~ {brief.endDate}（近 7 天全网监测数据汇编）
              </p>
            </div>
            <div className="text-right text-xs text-slate-500">
              <div>编制团队：{userName}</div>
              <div className="font-semibold text-emerald-600">保密级别：内部决策参考</div>
            </div>
          </div>
        </div>

        {/* 1. 本周大盘宏观速览 */}
        <div className="mt-6">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-primary pl-2">
            <ChartBarIcon className="h-4 w-4 text-primary" />
            一、本周全网招标与预算走势综述
          </h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">本周新增标讯</div>
              <div className="mt-1 text-xl font-black text-slate-900 tnum">
                {brief.newTendersCount} <span className="text-xs font-normal">篇</span>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">新增预算总盘</div>
              <div className="mt-1 text-xl font-black text-amber-600 tnum">
                {brief.newBudgetWan.toLocaleString()}{" "}
                <span className="text-xs font-normal">万元</span>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">重点商机精选</div>
              <div className="mt-1 text-xl font-black text-blue-600 tnum">
                {brief.topOpportunities.length} <span className="text-xs font-normal">个</span>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 border border-slate-100">
              <div className="text-[11px] text-slate-500 font-medium">即将截标预警</div>
              <div className="mt-1 text-xl font-black text-rose-600 tnum">
                {brief.expiringTenders.length} <span className="text-xs font-normal">标</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. 重点商机精选 (标王雷达) */}
        <div className="mt-8">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-amber-500 pl-2">
            <SparklesIcon className="h-4 w-4 text-amber-500" />
            二、高预算重点标的聚焦（建议销售团队重点跟进）
          </h3>
          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="data-table min-w-full divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="py-2.5 pl-3 pr-2 text-left font-semibold text-slate-700">项目名称</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-slate-700">采购单位</th>
                  <th className="px-2 py-2.5 text-left font-semibold text-slate-700">地区</th>
                  <th className="px-2 py-2.5 text-right font-semibold text-slate-700">预算控制价</th>
                  <th className="py-2.5 pl-2 pr-3 text-right font-semibold text-slate-700">发布日期</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {brief.topOpportunities.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      本周暂无公开大额预算标的
                    </td>
                  </tr>
                ) : (
                  brief.topOpportunities.map((op, i) => (
                    <tr key={op.id} className="hover:bg-slate-50/60">
                      <td className="py-2.5 pl-3 pr-2 font-medium text-slate-900 max-w-[280px] truncate">
                        <Link
                          href={`/tender/${op.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {i + 1}. {op.title}
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-slate-600 truncate max-w-[150px]">
                        {op.purchaser || "未公开"}
                      </td>
                      <td className="px-2 py-2.5 text-slate-500">{op.provinceName || "-"}</td>
                      <td className="px-2 py-2.5 text-right font-bold text-amber-600 tnum">
                        {op.budgetAmountWan.toLocaleString()} 万
                      </td>
                      <td className="py-2.5 pl-2 pr-3 text-right text-slate-400 tnum">
                        {op.publishDate}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 3. 即将截标倒计时预警 */}
        <div className="mt-8">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-rose-500 pl-2">
            <ClockIcon className="h-4 w-4 text-rose-500" />
            三、投标截止时间临近预警（截标倒计时）
          </h3>
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {brief.expiringTenders.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">近期无紧急截止项目</div>
            ) : (
              brief.expiringTenders.map((exp) => (
                <div
                  key={exp.id}
                  className="flex items-center justify-between p-2.5 text-xs hover:bg-slate-50"
                >
                  <div className="min-w-0 pr-4">
                    <Link
                      href={`/tender/${exp.id}`}
                      className="font-medium text-slate-900 hover:text-primary hover:underline truncate block"
                    >
                      {exp.title}
                    </Link>
                    <div className="text-[10px] text-slate-400">
                      采购方: {exp.purchaser || "体制内单位"} · 地区: {exp.provinceName || "全国"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="rounded bg-rose-50 px-2 py-0.5 font-semibold text-rose-700 tnum">
                      截标日: {exp.expireDate}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 4. 竞争对手中标情报汇编 */}
        <div className="mt-8">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-purple-500 pl-2">
            <TrophyIcon className="h-4 w-4 text-purple-500" />
            四、近期友商中标结果与竞争态势透视
          </h3>
          <div className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {brief.recentAwards.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">本周暂无中标公布数据</div>
            ) : (
              brief.recentAwards.map((aw) => (
                <div
                  key={aw.id}
                  className="flex items-center justify-between p-2.5 text-xs hover:bg-slate-50"
                >
                  <div className="min-w-0 pr-4">
                    <span className="font-semibold text-slate-900">{aw.winningSupplier}</span>
                    <div className="text-[11px] text-slate-500 truncate">
                      中标项目: {aw.title}
                    </div>
                  </div>
                  <div className="shrink-0 text-right tnum">
                    <div className="font-bold text-purple-700">
                      {aw.awardAmountWan ? `${aw.awardAmountWan} 万元` : "成交价保密"}
                    </div>
                    <div className="text-[10px] text-slate-400">{aw.publishDate}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 5. 内部跟进看板推进状态 */}
        {brief.trackerSummary && (
          <div className="mt-8">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 border-l-4 border-emerald-500 pl-2">
              <BuildingIcon className="h-4 w-4 text-emerald-500" />
              五、企业敏捷跟进看板执行进展
            </h3>
            <div className="mt-3 grid grid-cols-3 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-center">
              <div>
                <div className="text-[11px] text-slate-500">当前在跟项目</div>
                <div className="mt-1 text-lg font-bold text-slate-900 tnum">
                  {brief.trackerSummary.totalFollows} 个
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">标书正在编制</div>
                <div className="mt-1 text-lg font-bold text-blue-600 tnum">
                  {brief.trackerSummary.draftingCount} 个
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">本期已中标揽标</div>
                <div className="mt-1 text-lg font-bold text-emerald-600 tnum">
                  {brief.trackerSummary.wonCount} 个
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 6. 企业决策会签栏 (A4 纸张打印专用) */}
        <div className="mt-10 border-t border-slate-200 pt-6">
          <div className="grid grid-cols-3 gap-6 text-xs text-slate-600">
            <div className="space-y-6">
              <div>编制部门：市场商务部 / 投标组</div>
              <div>编制人签字：__________________</div>
            </div>
            <div className="space-y-6">
              <div>营销大区：全国营销中心</div>
              <div>业务主管签字：________________</div>
            </div>
            <div className="space-y-6">
              <div>决策层批示：[  ] 重点跟进  [  ] 暂缓放弃</div>
              <div>总监 / 领导签字：_____________</div>
            </div>
          </div>
          <div className="mt-6 text-center text-[10px] text-slate-400">
            本报告由「标讯通 (BXTONG)」自动聚合生成 · 助力企业商机快人一步
          </div>
        </div>
      </div>
    </div>
  );
}
