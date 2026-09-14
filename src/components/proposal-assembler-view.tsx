"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import {
  DocumentTextIcon,
  SparklesIcon,
  CheckIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  ShieldCheckIcon,
  ShieldAlertIcon,
  ArrowDownTrayIcon,
  ClipboardIcon,
  TrophyIcon,
} from "@/components/icons";
import {
  createProposalProjectAction,
  getProposalProjectDetailAction,
  updateProposalVolumeAction,
  deleteProposalProjectAction,
  exportProposalMarkdownAction,
  sendProposalToAuditAction,
  type ProposalProjectListItem,
} from "@/app/actions/proposal-assembler";
import {
  VOLUME_METAS,
  type VolumeId,
  type ProposalProjectData,
  type AssembledVolumeItem,
} from "@/lib/proposal-assembler-types";

interface ProposalAssemblerViewProps {
  initialProjects: ProposalProjectListItem[];
  userFollows: Array<{ id: number; tenderId: number; title: string; purchaser: string | null }>;
  userName: string;
}

export default function ProposalAssemblerView({
  initialProjects,
  userFollows,
  userName,
}: ProposalAssemblerViewProps) {
  const [projects, setProjects] = useState<ProposalProjectListItem[]>(initialProjects);
  const [selectedProject, setSelectedProject] = useState<ProposalProjectData | null>(null);
  const [activeVolumeId, setActiveVolumeId] = useState<VolumeId>("VOL_1_COMMERCIAL");
  const [activeVolumeText, setActiveVolumeText] = useState<string>("");
  const [isEditingVolume, setIsEditingVolume] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 新建装配工程弹窗
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createMode, setCreateMode] = useState<"FOLLOW" | "CUSTOM">("FOLLOW");
  const [selectedFollowId, setSelectedFollowId] = useState<number>(userFollows[0]?.id || 0);
  const [customTitle, setCustomTitle] = useState("");
  const [customPurchaser, setCustomPurchaser] = useState("");
  const [customBudgetWan, setCustomBudgetWan] = useState<number>(350);
  const [customDuration, setCustomDuration] = useState("60日历天");
  const [createError, setCreateError] = useState<string | null>(null);

  // 全量预览弹窗
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [fullMarkdown, setFullMarkdown] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  // 质检反馈弹窗
  const [auditResult, setAuditResult] = useState<{
    auditId?: number;
    auditScore?: number;
    riskLevel?: string;
  } | null>(null);

  // 打开工程详情
  const handleOpenProject = (id: number) => {
    startTransition(async () => {
      const res = await getProposalProjectDetailAction(id);
      if (res.success && res.data) {
        setSelectedProject(res.data);
        const firstVol = res.data.volumes[0];
        setActiveVolumeId(firstVol?.volumeId || "VOL_1_COMMERCIAL");
        setActiveVolumeText(firstVol?.contentMarkdown || "");
        setIsEditingVolume(false);
      }
    });
  };

  // 切换分卷
  const handleSelectVolume = (vol: AssembledVolumeItem) => {
    setActiveVolumeId(vol.volumeId);
    setActiveVolumeText(vol.contentMarkdown);
    setIsEditingVolume(false);
  };

  // 保存当前分卷修改
  const handleSaveVolume = () => {
    if (!selectedProject) return;
    startTransition(async () => {
      const res = await updateProposalVolumeAction(
        selectedProject.id,
        activeVolumeId,
        activeVolumeText
      );
      if (res.success) {
        setSelectedProject((prev) =>
          prev
            ? {
                ...prev,
                volumes: prev.volumes.map((v) =>
                  v.volumeId === activeVolumeId
                    ? { ...v, contentMarkdown: activeVolumeText }
                    : v
                ),
              }
            : null
        );
        setIsEditingVolume(false);
      }
    });
  };

  // 新建工程提交
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);

    let inputData;
    if (createMode === "FOLLOW") {
      const follow = userFollows.find((f) => f.id === Number(selectedFollowId));
      if (!follow) {
        setCreateError("请选择一个跟进项目");
        return;
      }
      inputData = {
        tenderId: follow.tenderId,
        followId: follow.id,
      };
    } else {
      if (!customTitle.trim()) {
        setCreateError("请输入标书工程名称");
        return;
      }
      inputData = {
        customTitle: customTitle.trim(),
        customPurchaser: customPurchaser.trim() || undefined,
        customBudgetWan: Number(customBudgetWan) || 350,
        customDuration: customDuration.trim() || "60日历天",
      };
    }

    startTransition(async () => {
      const res = await createProposalProjectAction(inputData);
      if (!res.success || !res.projectId) {
        setCreateError(res.error || "装配工程创建失败");
        return;
      }

      setShowCreateModal(false);
      // 打开新建的工程
      handleOpenProject(res.projectId);
      // 刷新页面状态
      window.location.reload();
    });
  };

  // 删除工程
  const handleDelete = (id: number, title: string) => {
    if (!confirm(`确定要删除标书装配工程「${title}」吗？`)) return;
    startTransition(async () => {
      const res = await deleteProposalProjectAction(id);
      if (res.success) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        if (selectedProject?.id === id) {
          setSelectedProject(null);
        }
      }
    });
  };

  // 导出全量 Markdown
  const handleExportFullMarkdown = (id: number) => {
    startTransition(async () => {
      const res = await exportProposalMarkdownAction(id);
      if (res.success && res.content) {
        setFullMarkdown(res.content);
        setShowFullPreview(true);
      }
    });
  };

  // 下载 Markdown 文件
  const handleDownloadFile = () => {
    if (!fullMarkdown) return;
    const blob = new Blob([fullMarkdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedProject?.title || "投标文件全套响应稿"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 一键送检深度质检
  const handleSendToAudit = (projectId: number) => {
    startTransition(async () => {
      const res = await sendProposalToAuditAction(projectId);
      if (res.success) {
        setAuditResult({
          auditId: res.auditId,
          auditScore: res.auditScore,
          riskLevel: res.riskLevel,
        });
        if (selectedProject) {
          setSelectedProject({ ...selectedProject, status: "AUDITED" });
        }
      } else {
        alert(res.error || "流转质检失败");
      }
    });
  };

  const currentVolume = selectedProject?.volumes.find((v) => v.volumeId === activeVolumeId);

  return (
    <div className="space-y-6">
      {/* 顶部主标题与操作条 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 text-white shadow-xs">
              <DocumentTextIcon className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              投标文件智能生成与模块化装配工场
            </h1>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              M2 旗舰装配版
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-600">
            自动贯通企业资质库、同类业绩案例库与招标文件实质性要求，一键流水线装配六大卷宗全套投标文件，直通深度清标质检。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {selectedProject && (
            <button
              onClick={() => setSelectedProject(null)}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <span>← 返回工程列表</span>
            </button>
          )}
          <button
            onClick={() => setShowCreateModal(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
          >
            <PlusIcon className="h-4 w-4" />
            <span>新建标书装配工程</span>
          </button>
        </div>
      </div>

      {/* 顶部统计卡片 */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">已装配标书工程</span>
            <DocumentTextIcon className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              {projects.length}
            </span>
            <span className="text-xs text-slate-500">套完整卷宗</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            编制席位：{userName}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">标准化装配分卷</span>
            <SparklesIcon className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-purple-600 tnum">
              6
            </span>
            <span className="text-xs text-purple-600 font-medium">大核心分卷</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            商务/资质/业绩/技术/应答/售后
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">已自动置入资产</span>
            <TrophyIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tnum">
              100%
            </span>
            <span className="text-xs text-emerald-600 font-medium">自动匹配</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            动态挂载企业证书库与业绩库
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-surface p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">直通清标质检</span>
            <ShieldCheckIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-emerald-600 tnum">
              一键送检
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            0-100健康分排查金额矛盾与漏项
          </div>
        </div>
      </div>

      {/* 主视图区域：工程列表 OR 正在装配的工作台 */}
      {!selectedProject ? (
        /* 工程列表大盘 */
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              标书装配工程工作台 ({projects.length})
            </h3>
            <span className="text-xs text-slate-500">
              点击工程卡片进入六大卷宗装配工场
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-surface p-12 text-center">
              <DocumentTextIcon className="mx-auto h-10 w-10 text-slate-400" />
              <h4 className="mt-3 text-sm font-semibold text-slate-800">
                暂无投标文件装配工程
              </h4>
              <p className="mt-1 text-xs text-slate-500">
                从已跟进的标讯中选择，或自由输入招标要素，一键秒级装配六大卷宗。
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                <span>立即新建装配工程</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => {
                const isAudited = p.status === "AUDITED";
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs hover:border-indigo-300 transition-all flex flex-col justify-between"
                  >
                    <div>
                      {/* 状态与时间 */}
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                            isAudited
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-indigo-200 bg-indigo-50 text-indigo-700"
                          }`}
                        >
                          {isAudited ? "✅ 已通过清标质检" : "⚡ 装配就绪 (6卷)"}
                        </span>
                        <span className="text-[11px] text-slate-500 tnum">
                          {p.createdAt.split("T")[0]}
                        </span>
                      </div>

                      {/* 工程标题 */}
                      <h4
                        onClick={() => handleOpenProject(p.id)}
                        className="mt-3 text-base font-bold text-slate-900 hover:text-primary cursor-pointer transition-colors line-clamp-2"
                      >
                        {p.title}
                      </h4>

                      {/* 商务指标 */}
                      <div className="mt-4 space-y-1.5 rounded-xl bg-slate-50/80 p-3 text-xs text-slate-600 border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">发包采购单位：</span>
                          <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                            {p.targetPurchaser || "未指定"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">拟投标总报价：</span>
                          <span className="font-bold text-indigo-600 tnum">
                            {p.bidAmountWan ? `¥${p.bidAmountWan} 万元` : "见商务标"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">承诺实施周期：</span>
                          <span className="font-medium text-slate-700">
                            {p.projectDuration || "60日历天"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 底部按钮栏 */}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleOpenProject(p.id)}
                          className="cursor-pointer font-semibold text-primary hover:underline"
                        >
                          进入装配工场 →
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleExportFullMarkdown(p.id)}
                          title="导出全套 Markdown"
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <ArrowDownTrayIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(p.id, p.title)}
                          title="删除工程"
                          className="cursor-pointer rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 装配工场编辑与管理界面 */
        <div className="space-y-4">
          {/* 工作台顶部项目导航条 */}
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4 shadow-2xs flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md border border-indigo-300 bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800">
                  {selectedProject.status === "AUDITED" ? "已送检通过" : "装配就绪"}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedProject.title}
                </h2>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                <span>发包单位：<strong>{selectedProject.targetPurchaser}</strong></span>
                <span>投标报价：<strong className="text-indigo-600 tnum">¥{selectedProject.bidAmountWan} 万元</strong></span>
                <span>工期：{selectedProject.projectDuration}</span>
                {selectedProject.tenderId && (
                  <Link
                    href={`/tender/${selectedProject.tenderId}`}
                    target="_blank"
                    className="text-primary underline hover:text-primary-hover"
                  >
                    查看源招标公告 ↗
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleSendToAudit(selectedProject.id)}
                disabled={isPending}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors shadow-2xs disabled:opacity-50"
              >
                <ShieldAlertIcon className="h-4 w-4 text-rose-600" />
                <span>一键送检·清标质检</span>
              </button>
              <button
                onClick={() => handleExportFullMarkdown(selectedProject.id)}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors shadow-xs"
              >
                <ArrowDownTrayIcon className="h-4 w-4" />
                <span>导出全套标书</span>
              </button>
            </div>
          </div>

          {/* 质检结果提示栏 */}
          {auditResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-2xs flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShieldCheckIcon className="h-6 w-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-900">
                    标书深度清标质检完成！健康评分：{auditResult.auditScore} 分 ({auditResult.riskLevel})
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    六维规则扫描完毕，已自动存入企业质检档案，可前往【标书质检】查看细项整改意见。
                  </p>
                </div>
              </div>
              <Link
                href="/audit"
                className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                <span>前往质检中心查看</span>
              </Link>
            </div>
          )}

          {/* 六卷导航与主体编辑区 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* 左侧：六大卷宗目录树导航 */}
            <div className="lg:col-span-4 space-y-2.5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider px-1">
                六大卷宗装配清单 (点击切换分卷)
              </div>

              {selectedProject.volumes.map((vol, idx) => {
                const meta = VOLUME_METAS[vol.volumeId];
                const isActive = vol.volumeId === activeVolumeId;

                return (
                  <button
                    key={vol.volumeId}
                    onClick={() => handleSelectVolume(vol)}
                    className={`cursor-pointer w-full text-left rounded-2xl border p-3.5 transition-all flex items-start gap-3 ${
                      isActive
                        ? "border-primary bg-primary/5 shadow-2xs ring-1 ring-primary/30"
                        : "border-slate-200 bg-surface hover:border-slate-300"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        isActive
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {meta.shortTitle}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-semibold ${meta.badgeCls}`}
                        >
                          {meta.volumeNumber}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500 line-clamp-1">
                        {vol.metaSummary}
                      </p>
                      {vol.matchedAssetsCount !== undefined && vol.matchedAssetsCount > 0 && (
                        <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                          <CheckIcon className="h-3 w-3" />
                          <span>已智能置入 {vol.matchedAssetsCount} 项企业资产</span>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 右侧：分卷正文预览与在线微调编辑 */}
            <div className="lg:col-span-8 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-surface p-5 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {VOLUME_METAS[activeVolumeId].volumeNumber}
                      </span>
                      <h3 className="text-base font-bold text-slate-900">
                        {VOLUME_METAS[activeVolumeId].title}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {VOLUME_METAS[activeVolumeId].description}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isEditingVolume ? (
                      <>
                        <button
                          onClick={() => {
                            setActiveVolumeText(currentVolume?.contentMarkdown || "");
                            setIsEditingVolume(false);
                          }}
                          className="cursor-pointer rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                        >
                          取消
                        </button>
                        <button
                          onClick={handleSaveVolume}
                          disabled={isPending}
                          className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-primary-hover disabled:opacity-50"
                        >
                          <CheckIcon className="h-3.5 w-3.5" />
                          <span>{isPending ? "保存中..." : "保存分卷内容"}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setIsEditingVolume(true)}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50"
                      >
                        <span>编辑此卷</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 内容渲染 / 编辑框 */}
                <div className="mt-4">
                  {isEditingVolume ? (
                    <div className="space-y-2">
                      <div className="text-[11px] text-slate-500">
                        提示：支持 Markdown 格式直接编辑，保存后将自动更新至全套标书。
                      </div>
                      <textarea
                        value={activeVolumeText}
                        onChange={(e) => setActiveVolumeText(e.target.value)}
                        rows={22}
                        className="w-full rounded-xl border border-slate-200 p-4 font-mono text-xs leading-relaxed focus:border-primary focus:outline-none bg-slate-50/50"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 font-mono text-xs leading-relaxed text-slate-800 whitespace-pre-wrap overflow-x-auto max-h-[600px] overflow-y-auto">
                      {activeVolumeText}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 新建装配工程弹窗 Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <SparklesIcon className="h-5 w-5 text-primary" />
                <h3 className="text-base font-bold text-slate-900">
                  新建投标文件模块化装配工程
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4">
              {createError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
                  {createError}
                </div>
              )}

              {/* 模式切换 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  选择装配输入方式
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setCreateMode("FOLLOW")}
                    className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${
                      createMode === "FOLLOW"
                        ? "border-primary bg-primary/5 text-primary font-bold shadow-2xs"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs">从已跟进标讯导入</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      自动提取招标文件限价与要求
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCreateMode("CUSTOM")}
                    className={`cursor-pointer rounded-xl border p-2.5 text-left transition-all ${
                      createMode === "CUSTOM"
                        ? "border-primary bg-primary/5 text-primary font-bold shadow-2xs"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <div className="text-xs">自定义要素装配</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      手动输入发包单位与工期
                    </div>
                  </button>
                </div>
              </div>

              {createMode === "FOLLOW" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    选择跟进中的标讯项目
                  </label>
                  {userFollows.length === 0 ? (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      您暂未在【跟进看板】中添加项目，请切换为“自定义要素装配”或先去关注公告。
                    </div>
                  ) : (
                    <select
                      value={selectedFollowId}
                      onChange={(e) => setSelectedFollowId(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs focus:border-primary focus:outline-none"
                    >
                      {userFollows.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.title} ({f.purchaser || "单位见正文"})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      投标文件工程名称 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      placeholder="例如：市大数据局数字化平台建设工程投标文件"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      目标发包采购人单位全称
                    </label>
                    <input
                      type="text"
                      value={customPurchaser}
                      onChange={(e) => setCustomPurchaser(e.target.value)}
                      placeholder="例如：某某市人民政府办公室"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        拟投标报价 (万元)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={customBudgetWan}
                        onChange={(e) => setCustomBudgetWan(Number(e.target.value))}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        承诺交付工期
                      </label>
                      <input
                        type="text"
                        value={customDuration}
                        onChange={(e) => setCustomDuration(e.target.value)}
                        placeholder="例如：60日历天"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 space-y-1">
                <div>⚡ 引擎将自动读取您企业档案的法定代表人、地址及开户信息；</div>
                <div>⚡ 自动从资质库挂载有效证书、从案例库优选类似合同业绩页。</div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="cursor-pointer rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-primary-hover transition-colors disabled:opacity-50"
                >
                  <SparklesIcon className="h-4 w-4" />
                  <span>{isPending ? "正在装配六大卷宗..." : "一键开始装配"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 全量标书 Markdown 预览弹窗 */}
      {showFullPreview && fullMarkdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-200 bg-surface p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  全套六卷投标文件公文级预览
                </h3>
                <p className="text-xs text-slate-500">
                  带封面、公文目录与六卷完整正文，支持一键下载 .md 或复制。
                </p>
              </div>
              <button
                onClick={() => setShowFullPreview(false)}
                className="cursor-pointer rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="my-4 flex-1 overflow-y-auto rounded-xl bg-slate-900 p-5 font-mono text-xs leading-relaxed text-slate-100 shadow-inner">
              <pre className="whitespace-pre-wrap">{fullMarkdown}</pre>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="text-xs text-emerald-600 font-medium">
                {copyMsg}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(fullMarkdown);
                    setCopyMsg("已成功复制全套标书 Markdown！");
                    setTimeout(() => setCopyMsg(null), 2500);
                  }}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ClipboardIcon className="h-3.5 w-3.5" />
                  <span>复制全套 Markdown</span>
                </button>
                <button
                  onClick={handleDownloadFile}
                  className="cursor-pointer inline-flex items-center gap-1 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover shadow-xs"
                >
                  <ArrowDownTrayIcon className="h-3.5 w-3.5" />
                  <span>下载 .md 文档文件</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
