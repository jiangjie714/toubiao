const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type FetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  form?: Record<string, string>;
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
};

/** 根据响应头/HTML meta 判断 charset 并解码（兼容 GBK 老站点） */
function decodeBody(buf: ArrayBuffer, contentType: string | null): string {
  const m = contentType?.match(/charset=([\w-]+)/i);
  let charset = m?.[1]?.toLowerCase() ?? "";
  if (!charset) {
    const head = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 2048));
    charset = head.match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? "utf-8";
  }
  try {
    return new TextDecoder(charset === "gb2312" ? "gbk" : charset).decode(buf);
  } catch {
    return new TextDecoder("utf-8").decode(buf);
  }
}

export class FetchError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** 带超时与重试的页面抓取，自动处理编码 */
export async function fetchText(url: string, opts: FetchOptions = {}): Promise<string> {
  const { method = "GET", headers = {}, form, timeoutMs = 20000, retries = 2 } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": opts.userAgent ?? DEFAULT_UA,
          "Accept-Language": "zh-CN,zh;q=0.9",
          ...(form
            ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" }
            : {}),
          ...headers,
        },
        body: form ? new URLSearchParams(form).toString() : undefined,
      });
      if (!res.ok) {
        throw new FetchError(`HTTP ${res.status}`, res.status);
      }
      const buf = await res.arrayBuffer();
      return decodeBody(buf, res.headers.get("content-type"));
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
