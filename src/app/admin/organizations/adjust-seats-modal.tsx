"use client";

import { useState, useTransition, useId } from "react";
import { adjustTeamSeatsAction, adminUpdateTeamNameAction, OrganizationRecord } from "./actions";
import { XMarkIcon, UsersIcon, CheckCircleIcon } from "@/components/icons";

export default function AdjustSeatsModal({
  isOpen,
  org,
  onClose,
  onSaved,
}: {
  isOpen: boolean;
  org: OrganizationRecord | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [maxSeats, setMaxSeats] = useState<number>(org?.maxSeats ?? 3);
  const [name, setName] = useState<string>(org?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nameInputId = useId();
  const seatsInputId = useId();

  if (!isOpen || !org) return null;

  const currentUsed = org.usedSeats;

  const handleQuickAdd = (add: number) => {
    setMaxSeats((prev) => Math.min(100, Math.max(currentUsed, prev + add)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      // 1. 如果修改了名称，先更新名称
      if (name.trim() !== org.name) {
        const nameRes = await adminUpdateTeamNameAction(org.id, name.trim());
        if (!nameRes.success) {
          setError(nameRes.error || "修改组织名称失败");
          return;
        }
      }

      // 2. 如果修改了席位配额，更新席位
      if (maxSeats !== org.maxSeats) {
        const seatsRes = await adjustTeamSeatsAction(org.id, maxSeats);
        if (!seatsRes.success) {
          setError(seatsRes.error || "调整席位上限失败");
          return;
        }
      }

      onSaved();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-primary">
              <UsersIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">企业席位配额与组织调控</h3>
              <p className="text-[11px] text-slate-400">线下公对公加购席位后，由此分配生效</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4 text-xs">
          {error && (
            <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600 border border-red-200">
              {error}
            </div>
          )}

          <div>
            <label htmlFor={nameInputId} className="block font-semibold text-slate-700">企业组织全称</label>
            <input
              id={nameInputId}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-primary focus:outline-hidden"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor={seatsInputId} className="block font-semibold text-slate-700">
                团队最大席位上限 (当前在职: {currentUsed} 人)
              </label>
              <span className="text-[11px] text-slate-400">不得低于当前已占席位</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input
                id={seatsInputId}
                type="number"
                min={currentUsed}
                max={200}
                required
                value={maxSeats}
                onChange={(e) => setMaxSeats(Number(e.target.value))}
                className="w-28 rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-900 text-sm focus:border-primary focus:outline-hidden tnum"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickAdd(1)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  +1 席
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(3)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  +3 席
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAdd(5)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  +5 席
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-[11px] text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>所属企业实名：</span>
              <span className="font-semibold text-slate-700">{org.owner.companyName || "未完善企业档案"}</span>
            </div>
            <div className="flex justify-between">
              <span>当前商业套餐：</span>
              <span className="font-semibold text-amber-700">{org.owner.planName}</span>
            </div>
            <div className="flex justify-between">
              <span>企业负责人：</span>
              <span className="font-semibold text-slate-700">
                {org.owner.name} (@{org.owner.username})
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-slate-300 bg-surface px-4 py-2 text-slate-700 hover:bg-slate-100 transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover transition-colors disabled:opacity-50"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {isPending ? "保存中..." : "确认调配席位"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
