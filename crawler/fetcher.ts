const DEFAULT_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type FetchOptions = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  form?: Record<string, string>;
  body?: string;
  json?: unknown;
  timeoutMs?: number;
  retries?: number;
  userAgent?: string;
};

/** 根据响应头/HTML meta 判断 charset 并解码（双向检测自动回退，杜绝 GBK/UTF-8 错配乱码） */
function decodeBody(buf: ArrayBuffer, contentType: string | null): string {
  const m = contentType?.match(/charset=([\w-]+)/i);
  let charset = m?.[1]?.toLowerCase() ?? "";
  if (!charset) {
    const head = new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 2048));
    charset = head.match(/charset=["']?([\w-]+)/i)?.[1]?.toLowerCase() ?? "utf-8";
  }

  const normalizeCharset = (cs: string) => {
    if (cs === "gb2312" || cs === "gbk" || cs === "gb18030") return "gb18030";
    return cs || "utf-8";
  };

  const primaryEncoding = normalizeCharset(charset);
  const secondaryEncoding = primaryEncoding === "gb18030" ? "utf-8" : "gb18030";

  let primaryText = "";
  try {
    primaryText = new TextDecoder(primaryEncoding, { fatal: false }).decode(buf);
  } catch {
    primaryText = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  }

  // 若初步解码含有替代字符 \uFFFD，尝试备用编码对比乱码率
  if (primaryText.includes("\uFFFD")) {
    try {
      const secondaryText = new TextDecoder(secondaryEncoding, { fatal: false }).decode(buf);
      const primaryErrors = (primaryText.match(/\uFFFD/g) || []).length;
      const secondaryErrors = (secondaryText.match(/\uFFFD/g) || []).length;
      if (secondaryErrors < primaryErrors) {
        return secondaryText;
      }
    } catch {
      // 保持 primaryText
    }
  }

  return primaryText;
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
  const { method = "GET", headers = {}, form, body, json, timeoutMs = 20000, retries = 2 } = opts;
  let lastErr: unknown;

  let requestBody: string | undefined = undefined;
  const requestHeaders = { ...headers };

  if (json !== undefined) {
    requestBody = typeof json === "string" ? json : JSON.stringify(json);
    if (!requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json; charset=UTF-8";
    }
  } else if (form) {
    requestBody = new URLSearchParams(form).toString();
    if (!requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/x-www-form-urlencoded; charset=UTF-8";
    }
  } else if (body !== undefined) {
    requestBody = body;
  }

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
          ...requestHeaders,
        },
        body: requestBody,
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
