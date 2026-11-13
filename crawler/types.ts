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
  /**
   * jsonPath 指向「同一标段的公告数组」时，按元素字段等值挑选目标公告；
   * 数组顺序不可靠的站点（如湖南 noticeList 混合招标/澄清/更正）用它精确选取。
   */
  pick?: {
    field: string;
    values: string[];
    /** 字段匹配方式：equals 精确等值（默认）/ contains 包含（如公告标题带类型后缀） */
    match?: "equals" | "contains";
    contentField?: string;
    /** 全部未命中时的兜底：first / last / longest（取正文最长的一条）/ none */
    fallback?: "first" | "last" | "longest" | "none";
  };
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
    /**
     * 站方把公告挂错类型时的正文兜底修正：详情正文命中 pattern 即改写条目类型。
     * 例：湖南把「终止公告」的 bulletinType 标成 CHONGXIN_ZHAOBIAO_NOTICE，
     * 列表侧无法识别，只能等正文抓回来再纠正。
     */
    typeRules?: Array<{ pattern: string; type: TenderType }>;
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
