"use client";

import React, { useState, useTransition } from "react";
import {
  publishRevisionAction,
  rollbackRevisionAction,
  dryRunTestYamlAction,
} from "@/app/admin/sources/actions";
import {
  type SkillRevisionItem,
  type SourceRevisionDossier,
  type DryRunTestResult,
} from "@/lib/crawler/revisions";
import {
  DatabaseIcon,
  BoltIcon,
  CheckCircleIcon,
} from "@/components/icons";

interface Props {
  dossier: SourceRevisionDossier;
}

interface DiffLine {
  type: "added" | "removed" | "same";
  text: string;
}

function computeDiff(oldText: string, newText: string): DiffLine[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");
  const diffs: DiffLine[] = [];

  // 简易行对比（适合配置对比）
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diffs.push({ type: "same", text: oldLines[i] });
        i++;
        j++;
      } else {
        // 判断新行是否存在于后续旧行
        const lookAheadOld = oldLines.slice(i, i + 5).indexOf(newLines[j]);
        if (lookAheadOld > 0) {
          diffs.push({ type: "removed", text: oldLines[i] });
          i++;
        } else {
          diffs.push({ type: "added", text: newLines[j] });
          j++;
        }
      }
    } else if (i < oldLines.length) {
      diffs.push({ type: "removed", text: oldLines[i] });
      i++;
    } else {
      diffs.push({ type: "added", text: newLines[j] });
      j++;
    }
  }

  return diffs;
}

export default function YamlRevisionEditor({ dossier }: Props) {
  const [yamlContent, setYamlContent] = useState(dossier.currentYaml);
  const [note, setNote] = useState("");
  const [isPending, startTransition] = useTransition();
  const [actionMessage, setActionMessage] = useState<{ text: string; error: boolean } | null>(null);

  // 选中的历史版本对比
  const [comparingRevision, setComparingRevision] = useState<SkillRevisionItem | null>(null);

  // DryRun 状态
  const [isDryRunning, setIsDryRunning] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<DryRunTestResult | null>(null);
  const [showDryRunModal, setShowDryRunModal] = useState(false);

  // 1. 发布新版本
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    setActionMessage(null);
    const formData = new FormData();
    formData.set("sourceId", String(dossier.sourceId));
    formData.set("configYaml", yamlContent);
    formData.set("note", note.trim() || "在线发布配置微调");

    startTransition(async () => {
      const res = await publishRevisionAction(formData);
      if (res.success) {
        setActionMessage({
          text: `🎉 成功发布新版本 v${res.newVersion}！配置已热更新生效。`,
          error: false,
        });
        setNote("");
      } else {
        setActionMessage({ text: res.error || "发布失败", error: true });
      }
    });
  };

  // 2. 回滚版本
  const handleRollback = (targetVersion: number) => {
    if (!confirm(`确定要将当前线上生效版本回滚至 v${targetVersion} 吗？`)) {
      return;
    }
    setActionMessage(null);
    const formData = new FormData();
    formData.set("sourceId", String(dossier.sourceId));
    formData.set("targetVersion", String(targetVersion));

    startTransition(async () => {
      const res = await rollbackRevisionAction(formData);
      if (res.success) {
        setActionMessage({
          text: `🔄 已成功回滚至历史版本 v${targetVersion}！`,
          error: false,
        });
        // 更新编辑器内容为回滚版本
        const targetRev = dossier.revisions.find((r) => r.version === targetVersion);
        if (targetRev) setYamlContent(targetRev.configYaml);
      } else {
        setActionMessage({ text: res.error || "回滚失败", error: true });
      }
    });
  };

  // 3. 在线沙盒 dry-run 探活测试
  const handleDryRun = async () => {
    setIsDryRunning(true);
    setDryRunResult(null);
    setShowDryRunModal(true);
    try {
      const res = await dryRunTestYamlAction(dossier.skillCode, yamlContent);
      setDryRunResult(res);
    } catch (err) {
      setDryRunResult({
        success: false,
        itemCount: 0,
        httpOk: 0,
        avgLatencyMs: 0,
        items: [],
        error: String(err),
      });
    } finally {
      setIsDryRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 提示消息 */}
      {actionMessage && (
        <div
          className={`rounded-xl p-4 text-sm font-medium border ${
            actionMessage.error
              ? "bg-red-50 text-red-700 border-red-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* 左侧：YAML 在线配置与发布控制台 (占 7 列) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-2">
                <DatabaseIcon className="h-4.5 w-4.5 text-primary" />
                <h2 className="text-sm font-bold text-slate-900">
                  YAML 在线规则编辑器
                </h2>
                <span className="rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-primary">
                  v{dossier.currentVersion} (当前编辑)
                </span>
              </div>
              <button
                type="button"
                onClick={handleDryRun}
                disabled={isDryRunning}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
              >
                <BoltIcon className="h-3.5 w-3.5 text-amber-600" />
                <span>{isDryRunning ? "沙盒测试中..." : "沙盒探活测试 (dry-run)"}</span>
              </button>
            </div>

            <form onSubmit={handlePublish} className="mt-4 space-y-4">
              <div>
                <textarea
                  value={yamlContent}
                  onChange={(e) => setYamlContent(e.target.value)}
                  rows={20}
                  spellCheck={false}
                  className="w-full rounded-lg border border-slate-300 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-emerald-400 focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary select-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  变更说明 / 修复备注 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例：站点改版调整详情页选择器、微调预算金额抽取正则"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-400">
                  发布后将自动生成新版本号并热更新调度器缓存，无需重启服务。
                </div>
                <button
                  type="submit"
                  disabled={isPending || !yamlContent.trim()}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-strong disabled:opacity-50"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>{isPending ? "发布中..." : "发布为新版本"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* 右侧：版本历史时间轴与差异对比 (占 5 列) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs">
            <div className="border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">
                版本历史与一键回滚 ({dossier.revisions.length} 个版本)
              </h2>
            </div>

            <div className="mt-4 divide-y divide-slate-100">
              {dossier.revisions.map((rev) => (
                <div key={rev.id} className="py-3.5 space-y-2 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        v{rev.version}
                      </span>
                      {rev.isCurrent && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                          线上生效中
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setComparingRevision(
                            comparingRevision?.id === rev.id ? null : rev
                          );
                        }}
                        className="text-xs font-semibold text-primary hover:underline"
                      >
                        {comparingRevision?.id === rev.id ? "收起对比" : "Diff 对比"}
                      </button>
                      {!rev.isCurrent && (
                        <button
                          type="button"
                          onClick={() => handleRollback(rev.version)}
                          disabled={isPending}
                          className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100"
                        >
                          回滚至此版
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    {rev.note || "无备注说明"}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>发布人：{rev.changedBy}</span>
                    <span>{new Date(rev.createdAt).toLocaleString("zh-CN")}</span>
                  </div>

                  {/* 展开的 Diff 区域 */}
                  {comparingRevision?.id === rev.id && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-900 p-3 text-[11px] font-mono text-slate-300 max-h-60 overflow-y-auto">
                      <div className="mb-2 text-slate-400 border-b border-slate-800 pb-1 flex justify-between">
                        <span>当前编辑代码 vs v{rev.version}</span>
                        <span className="text-emerald-400">+新增 / -删除</span>
                      </div>
                      {computeDiff(rev.configYaml, yamlContent).map((line, idx) => (
                        <div
                          key={idx}
                          className={`whitespace-pre-wrap ${
                            line.type === "added"
                              ? "bg-emerald-950/80 text-emerald-400"
                              : line.type === "removed"
                              ? "bg-rose-950/80 text-rose-400 line-through"
                              : "text-slate-400"
                          }`}
                        >
                          {line.type === "added"
                            ? "+ "
                            : line.type === "removed"
                            ? "- "
                            : "  "}
                          {line.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DryRun 沙盒探活结果弹窗 */}
      {showDryRunModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl animate-in fade-in zoom-in duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <BoltIcon className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">
                  在线沙盒探活测试结果 - {dossier.skillCode}
                </h3>
              </div>
              <button
                onClick={() => setShowDryRunModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto pr-1">
              {isDryRunning ? (
                <div className="py-16 text-center space-y-3">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-r-transparent" />
                  <p className="text-sm font-medium text-slate-600">
                    正在连通目标站点并抓取第 1 页样例数据...
                  </p>
                </div>
              ) : dryRunResult ? (
                <div className="space-y-4">
                  {/* 指标摘要 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-blue-50 p-3 text-center">
                      <div className="text-xs text-blue-600 font-medium">解析标讯数</div>
                      <div className="mt-0.5 text-lg font-bold font-mono text-blue-900">
                        {dryRunResult.itemCount} 条
                      </div>
                    </div>
                    <div className="rounded-lg bg-emerald-50 p-3 text-center">
                      <div className="text-xs text-emerald-600 font-medium">网络响应状态</div>
                      <div className="mt-0.5 text-lg font-bold font-mono text-emerald-900">
                        HTTP {dryRunResult.httpOk > 0 ? "200 OK" : "异常"}
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-50 p-3 text-center">
                      <div className="text-xs text-amber-600 font-medium">平均网络延迟</div>
                      <div className="mt-0.5 text-lg font-bold font-mono text-amber-900">
                        {dryRunResult.avgLatencyMs} ms
                      </div>
                    </div>
                  </div>

                  {dryRunResult.error && (
                    <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 font-mono">
                      错误详情：{dryRunResult.error}
                    </div>
                  )}

                  {/* 样例列表 */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 mb-2">
                      解析样例 (前 {dryRunResult.items.length} 条)
                    </h4>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {dryRunResult.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-xs space-y-1.5"
                        >
                          <div className="font-semibold text-slate-900 flex items-start justify-between gap-2">
                            <span>{item.title}</span>
                            <span className="font-mono text-slate-400 shrink-0 text-[11px]">
                              {item.publishDate || "无日期"}
                            </span>
                          </div>
                          <div className="font-mono text-[11px] text-blue-600 truncate">
                            {item.url}
                          </div>
                          {item.fields && Object.keys(item.fields).length > 0 && (
                            <div className="rounded bg-white p-2 border border-slate-100 text-[11px] font-mono text-slate-600 grid grid-cols-2 gap-1.5">
                              {Object.entries(item.fields).map(([k, v]) => (
                                <div key={k} className="truncate">
                                  <span className="text-slate-400">{k}:</span>{" "}
                                  <span>{String(v)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => setShowDryRunModal(false)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-900"
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
