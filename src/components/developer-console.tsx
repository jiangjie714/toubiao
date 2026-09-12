"use client";

import React, { useState, useTransition } from "react";
import {
  type ApiKeyListResult,
  createApiKeyAction,
  revokeApiKeyAction,
} from "@/app/actions/api-key";
import {
  DatabaseIcon,
  BoltIcon,
  SparklesIcon,
  ClipboardIcon,
  TrashIcon,
  PlusIcon,
  LockClosedIcon,
} from "@/components/icons";

interface Props {
  initialData: ApiKeyListResult;
  userName: string;
}

export default function DeveloperConsole({ initialData, userName }: Props) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  // 弹窗状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [createError, setCreateError] = useState("");

  // 交互式控制台状态
  const [selectedEndpoint, setSelectedEndpoint] = useState<
    "/api/v1/tenders" | "/api/v1/tenders/:id" | "/api/v1/analytics/overview"
  >("/api/v1/tenders");
  const [testKeyword, setTestKeyword] = useState("医疗");
  const [testProvince, setTestProvince] = useState("");
  const [testTenderId, setTestTenderId] = useState("1");
  const [testingApiKey, setTestingApiKey] = useState("");

  // 调试结果
  const [isTesting, setIsTesting] = useState(false);
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<number | null>(null);
  const [testTimeMs, setTestTimeMs] = useState<number | null>(null);
  const [activeLangTab, setActiveLangTab] = useState<"curl" | "python" | "node" | "go">("curl");

  const keys = data.keys || [];
  const stats = data.stats || { totalKeys: 0, activeKeys: 0, totalUsed: 0, totalQuota: 0 };
  const quotaPercent =
    stats.totalQuota > 0 ? Math.min(100, Math.round((stats.totalUsed / stats.totalQuota) * 100)) : 0;

  // 创建 API Key
  const handleCreateKey = () => {
    if (!newKeyName.trim()) {
      setCreateError("请输入密钥用途备注");
      return;
    }
    setCreateError("");
    startTransition(async () => {
      const res = await createApiKeyAction(newKeyName.trim());
      if (!res.success || !res.rawKey || !res.key) {
        setCreateError(res.error || "创建失败");
        return;
      }
      setCreatedRawKey(res.rawKey);
      setTestingApiKey(res.rawKey);
      setData((prev) => ({
        ...prev,
        keys: [res.key!, ...(prev.keys || [])],
        stats: {
          ...prev.stats!,
          totalKeys: (prev.stats?.totalKeys || 0) + 1,
          activeKeys: (prev.stats?.activeKeys || 0) + 1,
          totalQuota: (prev.stats?.totalQuota || 0) + res.key!.monthlyQuota,
        },
      }));
    });
  };

  // 吊销 API Key
  const handleRevokeKey = (keyId: number) => {
    if (!confirm("确定要吊销此 API Key 吗？吊销后依赖此密钥的集成程序将立即无法访问。")) return;
    startTransition(async () => {
      const res = await revokeApiKeyAction(keyId);
      if (res.success) {
        setData((prev) => ({
          ...prev,
          keys: (prev.keys || []).map((k) => (k.id === keyId ? { ...k, status: "REVOKED" } : k)),
          stats: {
            ...prev.stats!,
            activeKeys: Math.max(0, (prev.stats?.activeKeys || 1) - 1),
          },
        }));
      }
    });
  };

  // 复制文本
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  // 执行在线 API 调试测试
  const handleRunTest = async () => {
    setIsTesting(true);
    setTestResponse(null);
    setTestStatus(null);
    setTestTimeMs(null);

    const startTime = performance.now();
    try {
      let url = "";
      if (selectedEndpoint === "/api/v1/tenders") {
        const params = new URLSearchParams();
        if (testKeyword) params.set("q", testKeyword);
        if (testProvince) params.set("province", testProvince);
        params.set("pageSize", "3");
        url = `/api/v1/tenders?${params.toString()}`;
      } else if (selectedEndpoint === "/api/v1/tenders/:id") {
        url = `/api/v1/tenders/${testTenderId || "1"}`;
      } else {
        url = `/api/v1/analytics/overview?days=30`;
      }

      const headers: Record<string, string> = {};
      if (testingApiKey.trim()) {
        headers["Authorization"] = `Bearer ${testingApiKey.trim()}`;
      }

      const res = await fetch(url, { headers });
      const duration = Math.round(performance.now() - startTime);
      setTestStatus(res.status);
      setTestTimeMs(duration);

      const json = await res.json();
      setTestResponse(JSON.stringify(json, null, 2));
    } catch (err: unknown) {
      const duration = Math.round(performance.now() - startTime);
      setTestStatus(500);
      setTestTimeMs(duration);
      setTestResponse(JSON.stringify({ error: "网络请求异常", details: String(err) }, null, 2));
    } finally {
      setIsTesting(false);
    }
  };

  // 代码示例生成
  const getSnippet = () => {
    const key = testingApiKey || "bx_live_your_api_key_here";
    const origin = typeof window !== "undefined" ? window.location.origin : "https://bxtong.com";
    if (activeLangTab === "curl") {
      return `curl -X GET "${origin}/api/v1/tenders?q=${encodeURIComponent(
        testKeyword
      )}&pageSize=5" \\
  -H "Authorization: Bearer ${key}"`;
    }
    if (activeLangTab === "python") {
      return `import requests

url = "${origin}/api/v1/tenders"
headers = {
    "Authorization": "Bearer ${key}"
}
params = {
    "q": "${testKeyword}",
    "pageSize": 5
}

response = requests.get(url, headers=headers, params=params)
data = response.json()
print("Total found:", data["data"]["total"])
for item in data["data"]["items"]:
    print(item["title"], item["publishDate"])`;
    }
    if (activeLangTab === "node") {
      return `// Node.js 18+ 原生 fetch 示例
const url = new URL("${origin}/api/v1/tenders");
url.searchParams.set("q", "${testKeyword}");
url.searchParams.set("pageSize", "5");

const res = await fetch(url.toString(), {
  headers: {
    "Authorization": "Bearer ${key}",
  },
});

const json = await res.json();
console.log("返回标讯列表:", json.data.items);`;
    }
    return `package main

import (
    "fmt"
    "io"
    "net/http"
)

func main() {
    url := "${origin}/api/v1/tenders?q=${encodeURIComponent(testKeyword)}&pageSize=5"
    req, _ := http.NewRequest("GET", url, nil)
    req.Header.Set("Authorization", "Bearer ${key}")

    client := &http.Client{}
    resp, err := client.Do(req)
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()

    body, _ := io.ReadAll(resp.Body)
    fmt.Println(string(body))
}`;
  };

  return (
    <div className="space-y-8">
      {/* 顶部标题与控制台介绍 */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              开发者中心与开放 API 控制台
            </h1>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-primary ring-1 ring-blue-200">
              RESTful v1
            </span>
          </div>
          <p className="text-xs text-slate-500">
            企业级高可用标讯数据接口、API Key 凭证管理与在线调试沙盒 · 当前授权企业/开发者：{userName}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCreatedRawKey(null);
              setNewKeyName("");
              setCreateError("");
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            新建 API Key
          </button>
        </div>
      </div>

      {/* 4 大核心指标 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">当月已调用量</span>
            <BoltIcon className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 tnum">
              {stats.totalUsed.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">次</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">实时统计本周期合法调用</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">月度授权额度</span>
            <DatabaseIcon className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-amber-600 tnum">
              {stats.totalQuota.toLocaleString()}
            </span>
            <span className="text-xs text-slate-500">次/月</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">额度使用率 {quotaPercent}%</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">有效 API 密钥</span>
            <LockClosedIcon className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-slate-900 tnum">
              {stats.activeKeys}
            </span>
            <span className="text-xs text-slate-500">/ 5 个</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">SHA-256 安全哈希防护</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">服务 SLA 可用率</span>
            <SparklesIcon className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-black text-emerald-600 tnum">99.9%</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">平均响应时间约 45ms</div>
        </div>
      </div>

      {/* API Key 密钥管理列表 */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">API 访问凭证 (API Keys)</h2>
            <p className="text-xs text-slate-500">
              支持在 HTTP 请求头中携带 <code className="rounded bg-slate-100 px-1 py-0.5 text-primary">Authorization: Bearer &lt;KEY&gt;</code> 进行接口认证
            </p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="py-2.5 pl-4 pr-2 text-left font-semibold text-slate-700">密钥名称</th>
                <th className="px-2 py-2.5 text-left font-semibold text-slate-700">安全脱敏前缀</th>
                <th className="px-2 py-2.5 text-left font-semibold text-slate-700">月用量 / 配额</th>
                <th className="px-2 py-2.5 text-left font-semibold text-slate-700">状态</th>
                <th className="px-2 py-2.5 text-left font-semibold text-slate-700">最近调用时间</th>
                <th className="py-2.5 pl-2 pr-4 text-right font-semibold text-slate-700">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {keys.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    暂无 API Key，请点击右上角「新建 API Key」
                  </td>
                </tr>
              ) : (
                keys.map((k) => (
                  <tr key={k.id} className="hover:bg-slate-50/70">
                    <td className="py-3 pl-4 pr-2 font-medium text-slate-900">{k.name}</td>
                    <td className="px-2 py-3 font-mono text-slate-600">{k.keyPrefix}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2 tnum">
                        <span className="font-semibold text-slate-900">{k.usedCalls}</span>
                        <span className="text-slate-400">/ {k.monthlyQuota}</span>
                      </div>
                      <div className="mt-1 h-1 w-24 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${Math.min(100, (k.usedCalls / k.monthlyQuota) * 100)}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          k.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200"
                        }`}
                      >
                        {k.status === "ACTIVE" ? "有效" : "已吊销"}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-400 tnum">
                      {k.lastUsedAt || "从未使用"}
                    </td>
                    <td className="py-3 pl-2 pr-4 text-right">
                      {k.status === "ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => handleRevokeKey(k.id)}
                          disabled={isPending}
                          className="inline-flex items-center gap-1 text-slate-400 hover:text-rose-600 transition"
                          title="吊销此密钥"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          吊销
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 交互式 API 在线调试沙盒 */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <BoltIcon className="h-5 w-5 text-amber-500" />
            <h2 className="text-base font-bold text-slate-900">交互式 API 在线调试沙盒</h2>
          </div>
          <p className="text-xs text-slate-500">
            无需离开浏览器，即时发送请求并实时测试 OpenAPI 响应报文与数据格式
          </p>
        </div>

        {/* 调试参数表单 */}
        <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 lg:grid-cols-4">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700">目标接口 (Endpoint)</label>
            <select
              value={selectedEndpoint}
              onChange={(e) =>
                setSelectedEndpoint(
                  e.target.value as
                    | "/api/v1/tenders"
                    | "/api/v1/tenders/:id"
                    | "/api/v1/analytics/overview"
                )
              }
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 shadow-xs focus:border-primary focus:outline-none"
            >
              <option value="/api/v1/tenders">GET /api/v1/tenders (标讯列表检索)</option>
              <option value="/api/v1/tenders/:id">GET /api/v1/tenders/:id (标讯单篇详情)</option>
              <option value="/api/v1/analytics/overview">GET /api/v1/analytics/overview (大盘概览)</option>
            </select>
          </div>

          <div className="space-y-1 lg:col-span-2">
            <label className="text-xs font-semibold text-slate-700">
              测试用 API Key
              {testingApiKey && (
                <span className="ml-1 text-[10px] text-emerald-600 font-normal">
                  (已自动填入当前 Key)
                </span>
              )}
            </label>
            <input
              type="text"
              placeholder="请输入 bx_live_... 密钥"
              value={testingApiKey}
              onChange={(e) => setTestingApiKey(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-800 shadow-xs focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleRunTest}
              disabled={isTesting}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary py-2 text-xs font-bold text-white shadow-sm transition hover:bg-primary/90 disabled:opacity-50"
            >
              <BoltIcon className="h-3.5 w-3.5" />
              {isTesting ? "请求发送中..." : "🚀 发送测试请求"}
            </button>
          </div>

          {/* 针对不同接口的动态参数 */}
          {selectedEndpoint === "/api/v1/tenders" && (
            <>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">关键词 q</label>
                <input
                  type="text"
                  value={testKeyword}
                  onChange={(e) => setTestKeyword(e.target.value)}
                  placeholder="如：医疗、信息化"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-600">省份代码 province</label>
                <input
                  type="text"
                  value={testProvince}
                  onChange={(e) => setTestProvince(e.target.value)}
                  placeholder="如 11 (北京), 33 (浙江)"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none"
                />
              </div>
            </>
          )}

          {selectedEndpoint === "/api/v1/tenders/:id" && (
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-600">标讯 ID</label>
              <input
                type="text"
                value={testTenderId}
                onChange={(e) => setTestTenderId(e.target.value)}
                placeholder="标讯 ID（数字）"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-primary focus:outline-none"
              />
            </div>
          )}
        </div>

        {/* 测试结果报文输出区域 */}
        {testStatus !== null && (
          <div className="space-y-2 rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={`font-bold ${
                    testStatus >= 200 && testStatus < 300
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  HTTP {testStatus}
                </span>
                <span className="text-slate-400 tnum">耗时: {testTimeMs} ms</span>
              </div>
              <button
                type="button"
                onClick={() => testResponse && copyToClipboard(testResponse)}
                className="text-slate-400 hover:text-white"
              >
                复制响应报文
              </button>
            </div>
            <pre className="max-h-72 overflow-y-auto font-mono text-[11px] leading-relaxed text-emerald-300">
              {testResponse}
            </pre>
          </div>
        )}
      </div>

      {/* 多语言 SDK 集成代码快速复制 */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">多语言 SDK 代码示例</h2>
            <p className="text-xs text-slate-500">一行代码直接集成至企业内部 ERP / CRM 业务系统</p>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1 text-xs font-semibold">
            {(["curl", "python", "node", "go"] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => setActiveLangTab(lang)}
                className={`rounded-md px-3 py-1 uppercase transition ${
                  activeLangTab === lang
                    ? "bg-white text-primary shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {lang}
              </button>
            ))}
          </div>
        </div>

        <div className="relative rounded-xl border border-slate-800 bg-slate-900 p-4">
          <button
            type="button"
            onClick={() => copyToClipboard(getSnippet())}
            className="absolute top-3 right-3 rounded-md bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            {copiedKey ? "已复制！" : "复制代码"}
          </button>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-blue-300">
            {getSnippet()}
          </pre>
        </div>
      </div>

      {/* 创建新 Key 弹窗 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">
                {createdRawKey ? "🎉 API Key 生成成功" : "创建新 API Key"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {createdRawKey ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <div className="font-bold">⚠️ 请立即复制并安全保存此密钥！</div>
                  <div>出于数据安全考虑，该密钥明文仅展示一次，关闭后将无法再次找回。</div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">明文 API Key</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={createdRawKey}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs font-semibold text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(createdRawKey)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90"
                    >
                      <ClipboardIcon className="h-3.5 w-3.5" />
                      {copiedKey ? "已复制" : "复制"}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    已保存，完成
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">密钥名称 / 用途</label>
                  <input
                    type="text"
                    placeholder="如：企业OA审批流集成、生产环境"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:border-primary focus:outline-none"
                  />
                  {createError && <p className="text-xs text-rose-600">{createError}</p>}
                </div>

                <p className="text-xs text-slate-500 leading-relaxed">
                  系统将为你分配独立的安全密钥并启用 SHA-256 哈希加密。每次合法调用将按照套餐进行计量并受频控保护。
                </p>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateKey}
                    disabled={isPending}
                    className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isPending ? "生成中..." : "立即创建"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
