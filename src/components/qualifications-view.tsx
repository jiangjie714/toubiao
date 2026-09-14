"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RadarIcon,
  ShieldCheckIcon,
  BuildingIcon,
  BriefcaseIcon,
  CheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SparklesIcon,
  ArrowRightIcon,
  PlusIcon,
  TrashIcon,
  LockClosedIcon,
  TrophyIcon,
  ScaleIcon,
} from "@/components/icons";
import { tenderTypeLabel, tenderTypeColor } from "@/lib/constants";
import { saveCompanyProfileAction } from "@/app/actions/company-profile";
import {
  addRadarItemToTrackerAction,
  type OpportunityRadarActionResponse,
} from "@/app/actions/opportunity-radar";

const COMMON_CERTS = [
  "ISO9001质量管理体系",
  "ISO27001信息安全体系",
  "ISO20000IT服务管理",
  "ISO14001环境管理体系",
  "高新技术企业",
  "专精特新企业",
  "CMMI3级认证",
  "CMMI5级认证",
  "ITSS运维能力三级",
  "ITSS运维能力二级",
  "AAA级信用企业",
];

const COMMON_QUALS = [
  "电子与智能化工程专业承包一级",
  "电子与智能化工程专业承包二级",
  "建筑机电安装工程专业承包一级",
  "通信工程施工总承包一级",
  "通信工程施工总承包二级",
  "安防工程企业设计施工维护能力一级",
  "涉密信息系统集成乙级",
  "涉密信息系统集成甲级",
];

export default function QualificationsView({
  initialData,
  userName,
}: {
  initialData: OpportunityRadarActionResponse["data"];
  userName?: string;
}) {
  const [activeTab, setActiveTab] = useState<"radar" | "profile">("radar");

  // Profile 表单状态
  const [companyName, setCompanyName] = useState(initialData?.profile?.companyName || "");
  const [registeredCapital, setRegisteredCapital] = useState(
    initialData?.profile?.registeredCapital || ""
  );
  const [certifications, setCertifications] = useState<string[]>(
    initialData?.profile?.certifications || []
  );
  const [qualifications, setQualifications] = useState<string[]>(
    initialData?.profile?.qualifications || []
  );
  const [keyCases, setKeyCases] = useState<
    Array<{ title: string; amount: string; year: string }>
  >(initialData?.profile?.keyCases || []);

  const [customCertInput, setCustomCertInput] = useState("");
  const [customQualInput, setCustomQualInput] = useState("");

  // 新增业绩表单项
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newCaseAmount, setNewCaseAmount] = useState("");
  const [newCaseYear, setNewCaseYear] = useState(new Date().getFullYear().toString());

  const [savePending, setSavePending] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  // 跟进状态
  const [trackingMap, setTrackingMap] = useState<Record<number, boolean>>({});
  const [trackingLoading, setTrackingLoading] = useState<number | null>(null);

  // 筛选状态
  const [levelFilter, setLevelFilter] = useState<"ALL" | "HIGH" | "MEDIUM">("ALL");

  const competitiveness = initialData?.competitiveness;
  const items = initialData?.items || [];
  const filteredItems = items.filter((item) => {
    if (levelFilter === "HIGH") return item.matchLevel === "HIGH";
    if (levelFilter === "MEDIUM") return item.matchLevel === "MEDIUM";
    return true;
  });

  const handleToggleCert = (cert: string) => {
    if (certifications.includes(cert)) {
      setCertifications(certifications.filter((c) => c !== cert));
    } else {
      setCertifications([...certifications, cert]);
    }
  };

  const handleAddCustomCert = () => {
    const val = customCertInput.trim();
    if (val && !certifications.includes(val)) {
      setCertifications([...certifications, val]);
      setCustomCertInput("");
    }
  };

  const handleToggleQual = (qual: string) => {
    if (qualifications.includes(qual)) {
      setQualifications(qualifications.filter((q) => q !== qual));
    } else {
      setQualifications([...qualifications, qual]);
    }
  };

  const handleAddCustomQual = () => {
    const val = customQualInput.trim();
    if (val && !qualifications.includes(val)) {
      setQualifications([...qualifications, val]);
      setCustomQualInput("");
    }
  };

  const handleAddKeyCase = () => {
    if (!newCaseTitle.trim()) return;
    setKeyCases([
      ...keyCases,
      {
        title: newCaseTitle.trim(),
        amount: newCaseAmount.trim() ? `${newCaseAmount.trim()}万元` : "金额保密",
        year: newCaseYear.trim() || new Date().getFullYear().toString(),
      },
    ]);
    setNewCaseTitle("");
    setNewCaseAmount("");
  };

  const handleDeleteKeyCase = (idx: number) => {
    setKeyCases(keyCases.filter((_, i) => i !== idx));
  };

  const handleSaveProfile = async () => {
    if (!companyName.trim()) {
      setSaveError("请填写企业全称");
      return;
    }
    setSavePending(true);
    setSaveError("");
    setSaveSuccess(false);

    const res = await saveCompanyProfileAction({
      companyName,
      registeredCapital,
      certifications,
      qualifications,
      keyCases,
    });

    setSavePending(false);
    if (res.success) {
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        window.location.reload();
      }, 1200);
    } else {
      setSaveError(res.error || "保存失败，请稍后重试");
    }
  };

  const handleAddToTracker = async (tenderId: number) => {
    setTrackingLoading(tenderId);
    try {
      const res = await addRadarItemToTrackerAction(tenderId);
      if (res.success) {
        setTrackingMap((prev) => ({ ...prev, [tenderId]: true }));
      }
    } finally {
      setTrackingLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 顶部主视觉 Header */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-6 text-white shadow-sm sm:p-8">
        <div className="absolute right-0 top-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-blue-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-200 backdrop-blur-md">
              <SparklesIcon className="h-3.5 w-3.5 text-blue-300" />
              <span>AI 商业化决策系统 · 智能商机雷达{userName ? ` (${userName})` : ""}</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {companyName ? `${companyName} · 商机雷达` : "企业资质库与全网商机智能匹配雷达"}
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl leading-relaxed">
              基于企业资质认证、专业承包等级、注册资本与标杆业绩，全网自动扫描在招标讯与采购意向，精准测算赢面契合度，助您快人一步捕捉高胜率商机。
            </p>
          </div>

          {/* 资质完备度小部件 */}
          <div className="flex shrink-0 items-center gap-4 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
            <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-blue-400 bg-blue-500/20 font-bold text-white shadow-inner">
              <span className="text-lg tnum">{competitiveness?.healthScore || 10}</span>
              <span className="text-[10px] text-blue-200">分</span>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-300">资质资产完备度</div>
              <div className="mt-0.5 text-sm font-semibold text-white">
                {competitiveness?.level === "完善" && "🌟 资质完备 · 极佳"}
                {competitiveness?.level === "良好" && "⚡️ 基础完备 · 良好"}
                {(!competitiveness || competitiveness.level === "待补全") && "⚠️ 待补充资质"}
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className="mt-1 inline-flex items-center gap-1 text-xs text-blue-300 hover:text-white cursor-pointer"
              >
                <span>完善资质画像</span>
                <ArrowRightIcon className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 双 Tab 切换栏 */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setActiveTab("radar")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "radar"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <RadarIcon className="h-4 w-4" />
          <span>全网商机匹配雷达</span>
          {initialData?.totalAvailable ? (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-primary tnum">
              {initialData.totalAvailable}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-colors cursor-pointer ${
            activeTab === "profile"
              ? "border-primary text-primary"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <ShieldCheckIcon className="h-4 w-4" />
          <span>企业资质与业绩资产库</span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 tnum">
            {certifications.length + qualifications.length + keyCases.length} 项资产
          </span>
        </button>
      </div>

      {/* Tab 1: 全网智能商机匹配雷达 */}
      {activeTab === "radar" && (
        <div className="space-y-6">
          {/* 未录入企业主体提醒 */}
          {!companyName && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 text-amber-800">
              <div className="flex items-start gap-3">
                <AlertCircleIcon className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-semibold text-sm text-amber-900">
                    尚未录入企业主体档案与资质资产
                  </div>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    录入企业名称、注册资本、ISO认证、专业承包资质及代表业绩后，智能商机雷达将自动为您实时匹配全网高契合度标讯。
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("profile")}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700 cursor-pointer"
                  >
                    <span>立刻前往录入资质档案</span>
                    <ArrowRightIcon className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 顶部统计大盘 */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-surface p-4 shadow-xs">
              <div className="text-xs font-medium text-slate-500">近 45 天扫描候选标讯</div>
              <div className="mt-1 text-2xl font-bold text-slate-900 tnum">
                {initialData?.totalScanned || 0}
                <span className="ml-1 text-xs font-normal text-slate-500">条</span>
              </div>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 shadow-xs">
              <div className="text-xs font-medium text-blue-700">高胜率极力推荐 (≥80分)</div>
              <div className="mt-1 text-2xl font-bold text-primary tnum">
                {initialData?.highCount || 0}
                <span className="ml-1 text-xs font-normal text-blue-600">条</span>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-xs">
              <div className="text-xs font-medium text-indigo-700">良好契合商机 (60-79分)</div>
              <div className="mt-1 text-2xl font-bold text-indigo-900 tnum">
                {initialData?.mediumCount || 0}
                <span className="ml-1 text-xs font-normal text-indigo-600">条</span>
              </div>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-xs">
              <div className="text-xs font-medium text-emerald-700">企业资质画像状态</div>
              <div className="mt-1 text-base font-bold text-emerald-800 truncate">
                {companyName || "未登记企业"}
              </div>
            </div>
          </div>

          {/* 筛选工具栏 */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-surface p-3.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">契合度评级:</span>
              <button
                type="button"
                onClick={() => setLevelFilter("ALL")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  levelFilter === "ALL"
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                全部 ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("HIGH")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  levelFilter === "HIGH"
                    ? "bg-primary text-white"
                    : "bg-blue-50 text-primary hover:bg-blue-100"
                }`}
              >
                极力推荐 (≥80分)
              </button>
              <button
                type="button"
                onClick={() => setLevelFilter("MEDIUM")}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                  levelFilter === "MEDIUM"
                    ? "bg-indigo-600 text-white"
                    : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                }`}
              >
                谨慎参与 (60-79分)
              </button>
            </div>

            <div className="text-xs text-slate-500">
              当前展示 <span className="font-semibold text-slate-900 tnum">{filteredItems.length}</span> 条高吻合标讯
            </div>
          </div>

          {/* 商机卡片流 */}
          <div className="space-y-3.5">
            {filteredItems.map((item) => {
              const isHigh = item.matchLevel === "HIGH";
              const isFollowed = item.isFollowed || trackingMap[item.tenderId];

              return (
                <div
                  key={item.tenderId}
                  className="group relative rounded-xl border border-slate-200 bg-surface p-5 transition-all duration-200 hover:border-blue-300 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    {/* 左侧：分数徽章与标讯标题 */}
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* 匹配度指数 */}
                        <div
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            isHigh
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-primary"
                          }`}
                        >
                          <TrophyIcon className="h-3 w-3" />
                          <span className="tnum">{item.matchScore}分</span>
                          <span>{isHigh ? "🌟 极力推荐" : "⚡️ 具备优势"}</span>
                        </div>

                        {/* 公告类型 */}
                        <span
                          className={`rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tenderTypeColor(
                            item.type
                          )}`}
                        >
                          {tenderTypeLabel(item.type)}
                        </span>

                        {/* 地区与时间 */}
                        {item.provinceName && (
                          <span className="text-xs text-slate-500">
                            {item.provinceName} {item.cityName}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">·</span>
                        <span className="text-xs text-slate-500 tnum">{item.publishDate} 发布</span>
                      </div>

                      {/* 标题 */}
                      <h3 className="text-base font-semibold text-slate-900 group-hover:text-primary">
                        <Link href={`/tender/${item.tenderId}`} className="hover:underline">
                          {item.title}
                        </Link>
                      </h3>

                      {/* 采购人与预算金额 */}
                      <div className="flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                        {item.purchaser && (
                          <div className="flex items-center gap-1">
                            <BuildingIcon className="h-3.5 w-3.5 text-slate-400" />
                            <span>采购单位：{item.purchaser}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <BriefcaseIcon className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {item.budgetAmountWan
                              ? `预算金额：¥${item.budgetAmountWan.toLocaleString("zh-CN")}万元`
                              : item.awardAmountWan
                              ? `中标金额：¥${item.awardAmountWan.toLocaleString("zh-CN")}万元`
                              : "金额预算：详见标书"}
                          </span>
                        </div>
                      </div>

                      {/* 优势标签与差距提示 */}
                      <div className="pt-2 border-t border-slate-100 space-y-1.5">
                        {item.strengths.length > 0 && (
                          <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50/60 p-2 rounded-lg">
                            <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                            <div className="space-y-0.5">
                              {item.strengths.slice(0, 2).map((s, idx) => (
                                <div key={idx}>{s}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {item.gaps.length > 0 && (
                          <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50/60 p-2 rounded-lg">
                            <AlertCircleIcon className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                            <div className="space-y-0.5">
                              {item.gaps.slice(0, 1).map((g, idx) => (
                                <div key={idx}>{g}</div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 右侧：快速操作动作 */}
                    <div className="flex shrink-0 flex-row sm:flex-col gap-2 pt-2 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleAddToTracker(item.tenderId)}
                        disabled={isFollowed || trackingLoading === item.tenderId}
                        className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                          isFollowed
                            ? "bg-slate-100 text-slate-500 cursor-default"
                            : "bg-primary text-white hover:bg-primary-strong shadow-xs"
                        }`}
                      >
                        {isFollowed ? (
                          <>
                            <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
                            <span>已在跟进看板</span>
                          </>
                        ) : trackingLoading === item.tenderId ? (
                          "加入中…"
                        ) : (
                          <>
                            <PlusIcon className="h-3.5 w-3.5" />
                            <span>加入跟进看板</span>
                          </>
                        )}
                      </button>

                      <Link
                        href={`/tender/${item.tenderId}`}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <ScaleIcon className="h-3.5 w-3.5 text-slate-500" />
                        <span>查看与合规体检</span>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredItems.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-surface p-12 text-center text-sm text-slate-500">
                暂无符合筛选条件的商机雷达推荐
              </div>
            )}
          </div>

          {/* 商业化升级引导提示条 */}
          {!initialData?.isPlatinumOrAbove && (
            <div className="relative overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-6 text-center shadow-xs">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-primary">
                <LockClosedIcon className="h-5 w-5" />
              </div>
              <h4 className="mt-3 text-base font-bold text-slate-900">
                已为您精算并锁定全网 {initialData?.totalAvailable || 20}+ 条高契合商机
              </h4>
              <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
                当前账号为免费试用版，仅开放前 3 条高匹配商机。升级至【白金版】或【企业定制版】，全量解锁 50+ 条高胜率推荐雷达、资质自动匹配及专属推送。
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <Link
                  href="/pricing"
                  className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-strong"
                >
                  立即升级白金特权
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: 企业资质与业绩资产库 */}
      {activeTab === "profile" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-surface p-6 shadow-xs space-y-6">
            <div>
              <h2 className="text-lg font-bold text-slate-900">企业资质与业绩资产库</h2>
              <p className="mt-1 text-xs text-slate-500">
                维护企业的资质认证、专业承包资格与历史标杆案例，AI 将基于此资产库全网智能匹配高赢面商机。
              </p>
            </div>

            {/* 1. 企业主体信息 */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BuildingIcon className="h-4 w-4 text-primary" />
                <span>企业主体基本档案</span>
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    企业全称 <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="例如：北京华泰信息科技有限公司"
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700">
                    注册资本 (测算履约与投标门槛)
                  </label>
                  <input
                    type="text"
                    value={registeredCapital}
                    onChange={(e) => setRegisteredCapital(e.target.value)}
                    placeholder="例如：5000万元 或 1亿元"
                    className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>
            </div>

            {/* 2. 资质与认证证书货架 */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <ShieldCheckIcon className="h-4 w-4 text-primary" />
                <span>管理体系与能力认证</span>
              </h3>
              <p className="text-xs text-slate-500">
                在招投标评分中，ISO、高企及软件认证常享有 2~5 分商务加分。点击卡片快速勾选：
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {COMMON_CERTS.map((cert) => {
                  const selected = certifications.includes(cert);
                  return (
                    <button
                      key={cert}
                      type="button"
                      onClick={() => handleToggleCert(cert)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? "bg-blue-50 border border-primary text-primary font-semibold"
                          : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {selected ? <CheckIcon className="h-3.5 w-3.5 text-primary" /> : <PlusIcon className="h-3.5 w-3.5 text-slate-400" />}
                      <span>{cert}</span>
                    </button>
                  );
                })}
              </div>

              {/* 自定义添加认证 */}
              <div className="flex items-center gap-2 max-w-md pt-2">
                <input
                  type="text"
                  value={customCertInput}
                  onChange={(e) => setCustomCertInput(e.target.value)}
                  placeholder="其他证书（例如：环境标志产品认证）"
                  className="block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleAddCustomCert}
                  className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  添加证书
                </button>
              </div>
            </div>

            {/* 3. 行业专项工程与承包资质 */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <BriefcaseIcon className="h-4 w-4 text-primary" />
                <span>专项工程与施工总承包资质</span>
              </h3>
              <p className="text-xs text-slate-500">
                涉及工程建设、弱电智能化、安防及系统集成类标段的核心准入门槛：
              </p>

              <div className="flex flex-wrap gap-2 pt-1">
                {COMMON_QUALS.map((qual) => {
                  const selected = qualifications.includes(qual);
                  return (
                    <button
                      key={qual}
                      type="button"
                      onClick={() => handleToggleQual(qual)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? "bg-indigo-50 border border-indigo-600 text-indigo-700 font-semibold"
                          : "bg-slate-50 border border-slate-200 text-slate-700 hover:border-slate-300"
                      }`}
                    >
                      {selected ? <CheckIcon className="h-3.5 w-3.5 text-indigo-600" /> : <PlusIcon className="h-3.5 w-3.5 text-slate-400" />}
                      <span>{qual}</span>
                    </button>
                  );
                })}
              </div>

              {/* 自定义添加专项资质 */}
              <div className="flex items-center gap-2 max-w-md pt-2">
                <input
                  type="text"
                  value={customQualInput}
                  onChange={(e) => setCustomQualInput(e.target.value)}
                  placeholder="其他专项资质（例如：电力工程总承包三级）"
                  className="block w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleAddCustomQual}
                  className="shrink-0 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 cursor-pointer"
                >
                  添加资质
                </button>
              </div>
            </div>

            {/* 4. 标杆历史业绩库 */}
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <TrophyIcon className="h-4 w-4 text-primary" />
                <span>近三年标杆类似业绩库</span>
              </h3>
              <p className="text-xs text-slate-500">
                已录入 <span className="font-semibold text-slate-900 tnum">{keyCases.length}</span> 项代表业绩。充足的类似合同可确保商务评分项拿满分。
              </p>

              {/* 业绩列表 */}
              <div className="space-y-2">
                {keyCases.map((c, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="font-medium text-slate-900">{c.title}</span>
                        <span className="ml-2 font-semibold text-primary tnum">{c.amount}</span>
                        <span className="ml-2 text-slate-400">({c.year}年)</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteKeyCase(idx)}
                      className="text-slate-400 hover:text-red-600 cursor-pointer"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 新增业绩输入栏 */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px_100px_80px] pt-2">
                <input
                  type="text"
                  value={newCaseTitle}
                  onChange={(e) => setNewCaseTitle(e.target.value)}
                  placeholder="项目/合同名称（如：某市政务协同系统工程）"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={newCaseAmount}
                  onChange={(e) => setNewCaseAmount(e.target.value)}
                  placeholder="金额（万元）"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-accent"
                />
                <input
                  type="text"
                  value={newCaseYear}
                  onChange={(e) => setNewCaseYear(e.target.value)}
                  placeholder="年份（2025）"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleAddKeyCase}
                  className="rounded-lg bg-blue-50 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-blue-100 cursor-pointer"
                >
                  添加业绩
                </button>
              </div>
            </div>

            {/* 保存反馈与操作按钮 */}
            {saveError && (
              <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 flex items-center gap-1.5">
                <AlertCircleIcon className="h-4 w-4 shrink-0 text-red-600" />
                <span>{saveError}</span>
              </div>
            )}
            {saveSuccess && (
              <div className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700 flex items-center gap-1.5">
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>企业资质档案保存成功！正在更新商机雷达匹配…</span>
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSaveProfile}
                disabled={savePending}
                className="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-primary-strong disabled:opacity-50 cursor-pointer"
              >
                {savePending ? "正在保存资产库…" : "保存资质档案并重新运行雷达"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
