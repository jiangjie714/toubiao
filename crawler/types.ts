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

export type HtmlDetail = {
  contentSelector: string;
  removeSelector?: string;
  extraction?: Record<string, ExtractionSpec>;
};

export type ListConfig = {
  type: "NOTICE" | "RESULT" | "CHANGE" | "INQUIRY" | "INTENTION";
  mode: "html" | "json";
  url?: string;
  firstPageUrl?: string;
  request?: {
    method: "GET" | "POST";
    url: string;
    headers?: Record<string, string>;
    form?: Record<string, string>;
  };
  startPage?: number;
  maxPages?: number;
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
  };
  lists: ListConfig[];
};

export type ParsedItem = {
  title: string;
  url: string;
  date: Date | null;
  province: string | null;
  city: string | null;
  purchaser: string | null;
  agency: string | null;
  hint: string | null;
  extraFields: Record<string, string>;
};
