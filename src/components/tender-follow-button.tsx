"use client";

import { useEffect, useState, useTransition } from "react";
import { BookmarkIcon } from "@/components/icons";
import {
  getTenderFollowStatusAction,
  saveTenderFollowAction,
  deleteFollowAction,
  type FollowStatus,
} from "@/app/actions/tender-follow";

interface TenderFollowButtonProps {
  tenderId: number;
}

const STATUS_LABELS: Record<FollowStatus, { label: string; color: string }> = {
  EVALUATING: { label: "线索评估", color: "bg-blue-100 text-blue-800 border-blue-200" },
  DECIDED: { label: "决定投标", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  DRAFTING: { label: "标书编制", color: "bg-amber-100 text-amber-800 border-amber-200" },
  SUBMITTED: { label: "已递交待开标", color: "bg-purple-100 text-purple-800 border-purple-200" },
  WON: { label: "中标喜报", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  LOST: { label: "未中标/失标", color: "bg-slate-100 text-slate-700 border-slate-200" },
};

export function TenderFollowButton({ tenderId }: TenderFollowButtonProps) {
  const [following, setFollowing] = useState(false);
  const [status, setStatus] = useState<FollowStatus>("EVALUATING");
  const [followId, setFollowId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);

  const [assignee, setAssignee] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [notes, setNotes] = useState("");

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const res = await getTenderFollowStatusAction(tenderId);
      if (res.following && res.record) {
        setFollowing(true);
        setStatus(res.record.status);
        setFollowId(res.record.id);
        setAssignee(res.record.assignee || "");
        setTargetAmount(res.record.targetAmount ? String(res.record.targetAmount) : "");
        setNotes(res.record.notes || "");
      }
    });
  }, [tenderId]);

  const handleSave = () => {
    startTransition(async () => {
      const res = await saveTenderFollowAction({
        tenderId,
        status,
        assignee: assignee.trim(),
        targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
        notes: notes.trim(),
      });
      if (res.success) {
        setFollowing(true);
        setShowModal(false);
      }
    });
  };

  const handleUnfollow = () => {
    if (!followId) return;
    startTransition(async () => {
      const res = await deleteFollowAction(followId);
      if (res.success) {
        setFollowing(false);
        setFollowId(null);
        setShowModal(false);
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={isPending}
        className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all ${
          following
            ? `${STATUS_LABELS[status].color}`
            : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:text-primary"
        }`}
      >
        <BookmarkIcon className={`h-3.5 w-3.5 ${following ? "fill-current" : ""}`} />
        <span>{following ? `看板跟进中 · ${STATUS_LABELS[status].label}` : "加入投标跟进看板"}</span>
      </button>

      {/* 设置跟进弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
              <h4 className="font-bold text-slate-900">
                {following ? "更新投标跟进信息" : "加入投标项目跟进看板"}
              </h4>
              <button
                onClick={() => setShowModal(false)}
                className="cursor-pointer text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="mt-3.5 space-y-3">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  当前投标进度状态
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as FollowStatus)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-primary focus:outline-hidden"
                >
                  <option value="EVALUATING">🔍 线索评估中</option>
                  <option value="DECIDED">📝 决定投标（立项）</option>
                  <option value="DRAFTING">🛠️ 标书编制中</option>
                  <option value="SUBMITTED">📤 已递交/待开标</option>
                  <option value="WON">🏆 中标喜报</option>
                  <option value="LOST">❌ 未中标/失标</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  内部负责人 / 项目指派
                </label>
                <input
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  placeholder="例如：张工 / 商务拓展二组"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  预估投标报价 (万元)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  placeholder="例如：420"
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-hidden"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  团队跟进备注
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="记录关键沟通信息、分包配合或答疑备忘..."
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-primary focus:outline-hidden"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4">
              {following ? (
                <button
                  type="button"
                  onClick={handleUnfollow}
                  disabled={isPending}
                  className="cursor-pointer text-rose-600 hover:underline"
                >
                  移出看板
                </button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="cursor-pointer rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-100"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isPending}
                  className="cursor-pointer rounded-lg bg-primary px-3 py-1.5 font-semibold text-white hover:bg-primary-strong transition-colors"
                >
                  {isPending ? "保存中..." : "确认保存"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
