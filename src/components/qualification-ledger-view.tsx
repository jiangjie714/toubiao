"use client";

import React, { useState, useTransition } from "react";
import {
  ShieldCheckIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  SparklesIcon,
  ClipboardIcon,
  SearchIcon,
} from "@/components/icons";
import {
  saveQualificationAction,
  deleteQualificationAction,
} from "@/app/actions/qualification";
import {
  QUALIFICATION_CATEGORIES,
  STATUS_META,
  generateQualificationSummaryTable,
  type QualificationCategory,
  type QualificationStatus,
  type CompanyQualificationItem,
  type QualificationSummary,
} from "@/lib/qualification-manager";

interface Props {
  initialQualifications: CompanyQualificationItem[];
  initialSummary?: QualificationSummary;
  companyName: string;
}

// 常用资质快速模板
const QUICK_TEMPLATES = [
  { name: "ISO9001 质量管理体系认证", category: "MANAGEMENT" as QualificationCategory, level: "合格" },
  { name: "ISO27001 信息安全管理体系认证", category: "MANAGEMENT" as QualificationCategory, level: "合格" },
  { name: "ISO20000 信息技术服务管理体系认证", category: "MANAGEMENT" as QualificationCategory, level: "合格" },
  { name: "ISO14001 环境管理体系认证", category: "MANAGEMENT" as QualificationCategory, level: "合格" },
  { name: "ISO45001 职业健康安全管理体系", category: "MANAGEMENT" as QualificationCategory, level: "合格" },
  { name: "CMMI 软件能力成熟度模型认证", category: "CAPABILITY" as QualificationCategory, level: "3级" },
  { name: "ITSS 信息技术服务标准运行维护能力", category: "CAPABILITY" as QualificationCategory, level: "三级" },
  { name: "国家高新技术企业证书", category: "HONOR" as QualificationCategory, level: "国家级" },
  { name: "专精特新“小巨人”企业证书", category: "HONOR" as QualificationCategory, level: "国家级" },
  { name: "企业信用等级 AAA 级证书", category: "CREDIT" as QualificationCategory, level: "AAA" },
  { name: "电子与智能化工程专业承包资质", category: "CAPABILITY" as QualificationCategory, level: "壹级" },
  { name: "安全生产许可证", category: "SPECIAL" as QualificationCategory, level: "合格" },
];

export default function QualificationLedgerView({
  initialQualifications,
  initialSummary,
  companyName,
}: Props) {
  const [qualifications, setQualifications] = useState<CompanyQualificationItem[]>(initialQualifications);
  const [summary, setSummary] = useState<QualificationSummary>(
    initialSummary || {
      totalCount: initialQualifications.length,
      validCount: initialQualifications.filter((q) => q.status === "VALID").length,
      expiring90Count: initialQualifications.filter((q) => q.status === "EXPIRING_90").length,
      expiring30Count: initialQualifications.filter((q) => q.status === "EXPIRING_30").length,
      expiredCount: initialQualifications.filter((q) => q.status === "EXPIRED").length,
      annualInspectDueCount: initialQualifications.filter((q) => q.isAnnualInspectDue).length,
      fileUploadedCount: initialQualifications.filter((q) => q.certFileUrl).length,
      fileUploadedRate: 0,
    }
  );

  // 筛选与搜索
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // 抽屉弹窗表单状态
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<QualificationCategory>("MANAGEMENT");
  const [formCertNo, setFormCertNo] = useState("");
  const [formAuthority, setFormAuthority] = useState("");
  const [formIssueDate, setFormIssueDate] = useState("");
  const [formExpiryDate, setFormExpiryDate] = useState("");
  const [formAnnualInspectDate, setFormAnnualInspectDate] = useState("");
  const [formLevel, setFormLevel] = useState("");
  const [formCoverageScope, setFormCoverageScope] = useState("");
  const [formCertFileUrl, setFormCertFileUrl] = useState("");
  const [formNotes, setFormNotes] = useState("");

  const [formError, setFormError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [copiedMd, setCopiedMd] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  // 过滤后的列表
  const filteredList = qualifications.filter((q) => {
    if (selectedCategory !== "ALL" && q.category !== selectedCategory) return false;
    if (selectedStatus !== "ALL" && q.status !== selectedStatus) return false;
    if (searchQuery.trim()) {
      const qry = searchQuery.toLowerCase();
      const matchName = q.name.toLowerCase().includes(qry);
      const matchCertNo = (q.certNo || "").toLowerCase().includes(qry);
      const matchAuth = (q.issuingAuthority || "").toLowerCase().includes(qry);
      const matchScope = (q.coverageScope || "").toLowerCase().includes(qry);
      return matchName || matchCertNo || matchAuth || matchScope;
    }
    return true;
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormName("");
    setFormCategory("MANAGEMENT");
    setFormCertNo("");
    setFormAuthority("");
    setFormIssueDate("");
    setFormExpiryDate("");
    setFormAnnualInspectDate("");
    setFormLevel("");
    setFormCoverageScope("");
    setFormCertFileUrl("");
    setFormNotes("");
    setFormError("");
    setIsDrawerOpen(true);
  };

  const handleOpenEdit = (item: CompanyQualificationItem) => {
    setEditingId(item.id);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormCertNo(item.certNo || "");
    setFormAuthority(item.issuingAuthority || "");
    setFormIssueDate(item.issueDate || "");
    setFormExpiryDate(item.expiryDate);
    setFormAnnualInspectDate(item.annualInspectDate || "");
    setFormLevel(item.level || "");
    setFormCoverageScope(item.coverageScope || "");
    setFormCertFileUrl(item.certFileUrl || "");
    setFormNotes(item.notes || "");
    setFormError("");
    setIsDrawerOpen(true);
  };

  const handleApplyTemplate = (tpl: typeof QUICK_TEMPLATES[0]) => {
    setFormName(tpl.name);
    setFormCategory(tpl.category);
    setFormLevel(tpl.level);
  };

  const handleSave = () => {
    if (!formName.trim()) {
      setFormError("请填写资质/证书全称");
      return;
    }
    if (!formExpiryDate) {
      setFormError("请选择有效期截止日期");
      return;
    }

    setFormError("");
    startTransition(async () => {
      const res = await saveQualificationAction({
        id: editingId ?? undefined,
        name: formName.trim(),
        category: formCategory,
        certNo: formCertNo.trim() || undefined,
        issuingAuthority: formAuthority.trim() || undefined,
        issueDate: formIssueDate || undefined,
        expiryDate: formExpiryDate,
        annualInspectDate: formAnnualInspectDate || undefined,
        level: formLevel.trim() || undefined,
        coverageScope: formCoverageScope.trim() || undefined,
        certFileUrl: formCertFileUrl.trim() || undefined,
        notes: formNotes.trim() || undefined,
      });

      if (res.success) {
        setIsDrawerOpen(false);
        // 重新刷新页面数据
        window.location.reload();
      } else {
        setFormError(res.error || "保存资质证书失败");
      }
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`确定要移除资质证书「${name}」吗？`)) return;

    startTransition(async () => {
      const res = await deleteQualificationAction(id);
      if (res.success) {
        const next = qualifications.filter((q) => q.id !== id);
        setQualifications(next);
        setSummary((prev) => ({
          ...prev,
          totalCount: next.length,
          validCount: next.filter((q) => q.status === "VALID").length,
          expiring30Count: next.filter((q) => q.status === "EXPIRING_30").length,
          expiredCount: next.filter((q) => q.status === "EXPIRED").length,
        }));
      } else {
        alert(res.error || "删除失败");
      }
    });
  };

  const handleCopySummary = (format: "markdown" | "html") => {
    if (qualifications.length === 0) return;
    const text = generateQualificationSummaryTable(qualifications, format);
    navigator.clipboard.writeText(text).then(() => {
      if (format === "markdown") {
        setCopiedMd(true);
        setTimeout(() => setCopiedMd(false), 2000);
      } else {
        setCopiedHtml(true);
        setTimeout(() => setCopiedHtml(false), 2000);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* 4 大资产指标看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 指标卡 1: 在库有效资质 */}
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">正常有效资质</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              {summary.validCount}
            </span>
            <span className="text-xs text-slate-500">/ 在库共 {summary.totalCount} 项</span>
          </div>
          <div className="mt-2 text-2xs text-slate-500 flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>证书合法有效，投标商务标可全额赋分</span>
          </div>
        </div>

        {/* 指标卡 2: 30天高危临期 */}
        <div
          className={`rounded-2xl border p-5 shadow-2xs ${
            summary.expiring30Count > 0
              ? "border-amber-300 bg-amber-50/40"
              : "border-slate-200 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">30天内高危临期</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <AlertCircleIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight tnum ${
                summary.expiring30Count > 0 ? "text-amber-700" : "text-slate-900"
              }`}
            >
              {summary.expiring30Count}
            </span>
            <span className="text-xs text-slate-500">本</span>
          </div>
          <div className="mt-2 text-2xs text-amber-600 flex items-center gap-1">
            {summary.expiring30Count > 0 ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
                <span className="font-semibold">临期紧急！开标跨期恐导致废标</span>
              </>
            ) : (
              <span>暂无 30 天内紧急临期证书</span>
            )}
          </div>
        </div>

        {/* 指标卡 3: 已过期失效 (红牌) */}
        <div
          className={`rounded-2xl border p-5 shadow-2xs ${
            summary.expiredCount > 0
              ? "border-rose-300 bg-rose-50/50"
              : "border-slate-200 bg-surface"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">已逾期失效证书</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
              <ShieldCheckIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold tracking-tight tnum ${
                summary.expiredCount > 0 ? "text-rose-700" : "text-slate-900"
              }`}
            >
              {summary.expiredCount}
            </span>
            <span className="text-xs text-slate-500">本</span>
          </div>
          <div className="mt-2 text-2xs text-rose-600 flex items-center gap-1">
            {summary.expiredCount > 0 ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                <span className="font-bold">严禁选送！核验不符必按一票否决处理</span>
              </>
            ) : (
              <span>企业无逾期失效证书，合规良好</span>
            )}
          </div>
        </div>

        {/* 指标卡 4: 电子凭证完备率 */}
        <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">扫描件归档完备率</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <SparklesIcon className="h-4 w-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              {summary.fileUploadedRate}%
            </span>
            <span className="text-xs text-slate-500">
              ({summary.fileUploadedCount} / {summary.totalCount})
            </span>
          </div>
          <div className="mt-2 text-2xs text-slate-500">
            原件扫描件就绪，编标时可秒级调取附入标册
          </div>
        </div>
      </div>

      {/* 操作工具栏 */}
      <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索资质名称、证书编号、颁发机构、认证业务范围..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 transition"
            />
          </div>

          {/* 顶部动作按钮 */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopySummary("markdown")}
              disabled={qualifications.length === 0}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-2xs disabled:opacity-50"
              title="生成并在剪贴板复制 Markdown 格式《企业资质与资信证明材料汇总一览表》"
            >
              {copiedMd ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <ClipboardIcon className="h-3.5 w-3.5 text-slate-500" />
              )}
              <span>{copiedMd ? "已复制 Markdown 表格" : "复制 MD 汇总表"}</span>
            </button>

            <button
              type="button"
              onClick={() => handleCopySummary("html")}
              disabled={qualifications.length === 0}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 hover:bg-purple-100 hover:border-purple-300 transition shadow-2xs disabled:opacity-50"
              title="生成并复制 HTML 格式标准国标表格，可直接粘贴进 Word 或 WPS 投标文件商务卷"
            >
              {copiedHtml ? (
                <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <ClipboardIcon className="h-3.5 w-3.5 text-purple-600" />
              )}
              <span>{copiedHtml ? "已复制 Word 附表" : "复制 Word 表格"}</span>
            </button>

            <button
              type="button"
              onClick={handleOpenAdd}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 transition shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>录入新资质</span>
            </button>
          </div>
        </div>

        {/* 筛选标签条 */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* 类别筛选 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 text-2xs mr-1">类别:</span>
            <button
              type="button"
              onClick={() => setSelectedCategory("ALL")}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-2xs font-semibold transition ${
                selectedCategory === "ALL"
                  ? "bg-purple-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              全部类别
            </button>
            {(Object.keys(QUALIFICATION_CATEGORIES) as QualificationCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`cursor-pointer rounded-lg px-2.5 py-1 text-2xs font-semibold transition ${
                  selectedCategory === cat
                    ? "bg-purple-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {QUALIFICATION_CATEGORIES[cat].label}
              </button>
            ))}
          </div>

          {/* 状态筛选 */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 text-2xs mr-1">到期状态:</span>
            <button
              type="button"
              onClick={() => setSelectedStatus("ALL")}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-2xs font-semibold transition ${
                selectedStatus === "ALL"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              全部状态
            </button>
            {(["VALID", "EXPIRING_90", "EXPIRING_30", "EXPIRED"] as QualificationStatus[]).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSelectedStatus(st)}
                  className={`cursor-pointer rounded-lg px-2.5 py-1 text-2xs font-semibold transition ${
                    selectedStatus === st
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {STATUS_META[st].label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

      {/* 资质卡片列表 */}
      {filteredList.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-12 text-center">
          <ShieldCheckIcon className="mx-auto h-12 w-12 text-slate-300" />
          <h3 className="mt-3 text-sm font-bold text-slate-900">暂无符合条件的资质证书</h3>
          <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            建议将企业持有的 ISO 三体系、CMMI、高新技术企业、专精特新、AAA 信用等级等证书全面归档，系统将为您全天候排查临期废标风险并实现一键对标。
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={handleOpenAdd}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-bold text-white hover:bg-purple-700 transition shadow-sm"
            >
              <PlusIcon className="h-4 w-4" />
              <span>立即录入第一本证书</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map((item) => {
            const isExpired = item.status === "EXPIRED";
            const isExpiring30 = item.status === "EXPIRING_30";
            const isExpiring90 = item.status === "EXPIRING_90";

            return (
              <div
                key={item.id}
                className={`relative flex flex-col justify-between rounded-2xl border p-5 transition hover:shadow-md bg-surface ${
                  isExpired
                    ? "border-rose-300 bg-rose-50/20"
                    : isExpiring30
                    ? "border-amber-300 bg-amber-50/20"
                    : "border-slate-200 hover:border-purple-200"
                }`}
              >
                <div>
                  {/* 顶部标签 */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex rounded-md border px-2 py-0.5 text-2xs font-semibold ${
                        QUALIFICATION_CATEGORIES[item.category]?.bg || "bg-slate-50"
                      } ${QUALIFICATION_CATEGORIES[item.category]?.color || "text-slate-700"}`}
                    >
                      {item.categoryLabel}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-bold ${
                        STATUS_META[item.status].badgeColor
                      }`}
                    >
                      {isExpired ? (
                        <AlertCircleIcon className="h-3 w-3" />
                      ) : isExpiring30 ? (
                        <AlertCircleIcon className="h-3 w-3" />
                      ) : (
                        <CheckCircleIcon className="h-3 w-3" />
                      )}
                      {item.statusLabel}
                    </span>
                  </div>

                  {/* 证书名称 */}
                  <h3 className="mt-3 text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                    {item.name}
                  </h3>

                  {/* 核心属性列表 */}
                  <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                    {item.certNo && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-2xs">证书编号:</span>
                        <span className="font-mono text-slate-800 text-2xs">{item.certNo}</span>
                      </div>
                    )}
                    {item.level && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-2xs">等级/级别:</span>
                        <span className="font-semibold text-slate-800 text-2xs">{item.level}</span>
                      </div>
                    )}
                    {item.issuingAuthority && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-2xs">发证机构:</span>
                        <span className="text-slate-800 text-2xs truncate max-w-[170px]" title={item.issuingAuthority}>
                          {item.issuingAuthority}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="text-slate-400 text-2xs">有效期至:</span>
                      <span
                        className={`font-mono text-xs font-bold ${
                          isExpired
                            ? "text-rose-600"
                            : isExpiring30
                            ? "text-amber-600"
                            : "text-slate-800"
                        }`}
                      >
                        {item.expiryDate}
                      </span>
                    </div>

                    {/* 倒计时提示 */}
                    <div className="text-right text-2xs">
                      {isExpired ? (
                        <span className="font-bold text-rose-600">已过期 {Math.abs(item.daysRemaining)} 天 (废标红牌)</span>
                      ) : (
                        <span className={isExpiring30 ? "font-bold text-amber-600" : isExpiring90 ? "text-blue-600" : "text-emerald-600"}>
                          剩余 {item.daysRemaining} 天
                        </span>
                      )}
                    </div>

                    {/* 年审临期预警 */}
                    {item.isAnnualInspectDue && (
                      <div className="rounded-md bg-amber-50 p-1.5 text-2xs text-amber-700 border border-amber-200">
                        ⚠️ 监督审核临期：年审截止日 {item.annualInspectDate} (剩 {item.annualInspectDaysRemaining} 天)
                      </div>
                    )}

                    {/* 认证业务范围 */}
                    {item.coverageScope && (
                      <p className="text-2xs text-slate-500 line-clamp-2 mt-1 bg-slate-50 p-1.5 rounded-md border border-slate-100">
                        {item.coverageScope}
                      </p>
                    )}
                  </div>
                </div>

                {/* 底部操作区 */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-2xs">
                  <span className="text-slate-400">
                    {item.certFileUrl ? (
                      <span className="inline-flex items-center gap-1 text-purple-600 font-semibold">
                        <CheckIcon className="h-3 w-3" />
                        已归档扫描件
                      </span>
                    ) : (
                      <span className="text-slate-400">原件待补录</span>
                    )}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(item)}
                      className="cursor-pointer text-slate-600 hover:text-purple-600 font-medium transition"
                    >
                      编辑
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id, item.name)}
                      className="cursor-pointer text-slate-400 hover:text-rose-600 transition"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 新增/编辑资质抽屉 Modal */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative flex flex-col w-full max-w-2xl max-h-[90vh] bg-surface rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-purple-50/80 via-white to-transparent">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-sm">
                  <ShieldCheckIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingId ? "编辑企业资质证书" : "录入新资质与认证资产"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {companyName} · 资质有效期与资格审查合规归档
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {/* 抽屉内容区 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* 常用模板快捷填入 (仅新增时展示) */}
              {!editingId && (
                <div>
                  <label className="block text-2xs font-semibold text-slate-500 mb-1.5">
                    快捷常用模板 (点击一键填入证书全称与类别):
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_TEMPLATES.map((tpl, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleApplyTemplate(tpl)}
                        className="cursor-pointer rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-2xs text-slate-700 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 transition"
                      >
                        + {tpl.name.split(" ")[0]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 错误提示 */}
              {formError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircleIcon className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* 表单字段 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-800 mb-1">
                    资质/证书全称 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="如: ISO9001:2015 质量管理体系认证证书"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">资质类别</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value as QualificationCategory)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none"
                  >
                    {(Object.keys(QUALIFICATION_CATEGORIES) as QualificationCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {QUALIFICATION_CATEGORIES[cat].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">等级/级别</label>
                  <input
                    type="text"
                    value={formLevel}
                    onChange={(e) => setFormLevel(e.target.value)}
                    placeholder="如: 壹级 / 甲级 / CMMI3 / AAA"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">证书编号</label>
                  <input
                    type="text"
                    value={formCertNo}
                    onChange={(e) => setFormCertNo(e.target.value)}
                    placeholder="如: 00123Q34567R0M"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">发证机构/颁发机关</label>
                  <input
                    type="text"
                    value={formAuthority}
                    onChange={(e) => setFormAuthority(e.target.value)}
                    placeholder="如: 中国质量认证中心 (CQC)"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">初次发证/颁发日期</label>
                  <input
                    type="date"
                    value={formIssueDate}
                    onChange={(e) => setFormIssueDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    有效期截止日期 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formExpiryDate}
                    onChange={(e) => setFormExpiryDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 font-bold focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    下次年审/监督审核日 (选填)
                  </label>
                  <input
                    type="date"
                    value={formAnnualInspectDate}
                    onChange={(e) => setFormAnnualInspectDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    扫描件存储路径/URL (选填)
                  </label>
                  <input
                    type="text"
                    value={formCertFileUrl}
                    onChange={(e) => setFormCertFileUrl(e.target.value)}
                    placeholder="https://... 或 oss://..."
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">
                    认证覆盖业务/技术范围 (对标评标范围)
                  </label>
                  <textarea
                    rows={2}
                    value={formCoverageScope}
                    onChange={(e) => setFormCoverageScope(e.target.value)}
                    placeholder="如: 计算机应用软件开发、系统集成工程及相关运维技术服务"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block font-semibold text-slate-700 mb-1">备注说明</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="如: 仅限本部投标使用、含涉密专项条款等"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-slate-900 focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 抽屉底部操作 */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200 text-xs">
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                取消
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 font-bold text-white hover:bg-purple-700 transition shadow-sm disabled:opacity-50"
              >
                {isPending ? "正在保存..." : editingId ? "保存修改" : "确认录入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
