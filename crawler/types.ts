export type FieldSpec =
  | string
  | {
      selector?: string;
      attr?: string;
      regex?: string;
      const?: string;
    };

export type ExtractionSpec = {
  selector?: string;
  attr?: string;
  regex: string;
};

export const TENDER_TYPES = ["NOTICE", "RESULT", "CHANGE", "INQUIRY", "INTENTION"] as const;

export type TenderType = (typeof TENDER_TYPES)[number];

export type HtmlDetail = {
  contentSelector?: string;
  /** JSON 详情接口：正文 HTML 在响应里的点分路径 */
  jsonPath?: string;
  removeSelector?: string;
  /** 详情页真实地址模板，支持 {query:参数名}/{YYYY}/{MM}/{DD} 占位；缺省用条目链接本身 */
  urlTemplate?: string;
  /** 详情接口与列表地址不同时（如安徽 POST 异步取正文），单独配置请求 */
  request?: {
    method: "GET" | "POST";
    url?: string;
    headers?: Record<string, string>;
    form?: Record<string, string>;
    body?: string;
  };
  extraction?: Record<string, ExtractionSpec>;
};

export type ListConfig = {
  type: TenderType;
  mode: "html" | "json";
  url?: string;
  firstPageUrl?: string;
  request?: {
    method: "GET" | "POST";
    url: string;
    headers?: Record<string, string>;
    form?: Record<string, string>;
    body?: string;
    json?: Record<string, unknown>;
  };
  startPage?: number;
  maxPages?: number;
  urlReplace?: {
    pattern: string;
    replacement: string;
  };
  parse: {
    itemSelector?: string;
    itemsPath?: string;
    fields: {
      title: FieldSpec;
      url: FieldSpec;
      date?: FieldSpec;
      province?: FieldSpec;
      city?: FieldSpec;
      purchaser?: FieldSpec;
      agency?: FieldSpec;
      hint?: FieldSpec;
    };
    extraFields?: Record<string, FieldSpec>;
    /** 同一列表混合多种公告类型的站点（如湖南工程建设 listByFile），按条目字段值映射类型 */
    typeMap?: {
      field: string;
      map: Record<string, TenderType>;
      default?: TenderType;
    };
  };
  detail?: HtmlDetail | null;
};

export type SkillConfig = {
  source: {
    name: string;
    baseUrl: string;
  };
  settings: {
    requestDelayMs?: number;
    timeoutMs?: number;
    retries?: number;
    maxPages?: number;
    headers?: Record<string, string>;
    userAgent?: string;
    scheduleCron?: string;
    proxyPolicy?: string;
    enabled?: boolean;
  };
  lists: ListConfig[];
};

export type ParsedItem = {
  title: string;
  url: string;
  /** 列表级 type 被 parse.typeMap 覆盖后的实际类型，缺省用 list.type */
  type?: TenderType;
  date: Date | null;
  province: string | null;
  city: string | null;
  purchaser: string | null;
  agency: string | null;
  hint: string | null;
  extraFields: Record<string, string>;
};
