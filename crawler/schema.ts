import { z } from "zod";

export const EXTRA_FIELD_TARGETS = [
  "projectNo",
  "budgetAmount",
  "awardAmount",
  "openTime",
  "industryCode",
  "winningSupplier",
  "contactPhone",
  "contactEmail",
  "contactAddress",
] as const;

export type ExtraFieldTarget = (typeof EXTRA_FIELD_TARGETS)[number];

const fieldSpecSchema = z.union([
  z.string().min(1).max(200),
  z
    .object({
      selector: z.string().min(1).max(200).optional(),
      attr: z.string().min(1).max(30).optional(),
      regex: z.string().min(1).max(200).optional(),
      const: z.string().min(1).max(200).optional(),
    })
    .strict()
    .refine((value) => Boolean(value.selector || value.const), {
      message: "selector 和 const 至少配置一个",
    }),
]);

const extractionSpecSchema = z
  .object({
    selector: z.string().min(1).max(200).optional(),
    attr: z.string().min(1).max(30).optional(),
    regex: z.string().min(1).max(200),
  })
  .strict()
  .refine((value) => new RegExp(value.regex, "u").source.length <= 200, {
    message: "正则过长或无法编译",
  })
  .refine((value) => /\([^)]/.test(value.regex), {
    message: "extraction 正则必须至少包含一个捕获组",
  });

const fieldSetSchema = z
  .object({
    title: fieldSpecSchema,
    url: fieldSpecSchema,
    date: fieldSpecSchema.optional(),
    province: fieldSpecSchema.optional(),
    city: fieldSpecSchema.optional(),
    purchaser: fieldSpecSchema.optional(),
    agency: fieldSpecSchema.optional(),
    hint: fieldSpecSchema.optional(),
  })
  .strict();

const listConfigSchema = z
  .object({
    type: z.enum(["NOTICE", "RESULT", "CHANGE", "INQUIRY", "INTENTION"]),
    mode: z.enum(["html", "json"]),
    url: z.string().min(1).optional(),
    firstPageUrl: z.string().min(1).optional(),
    request: z
      .object({
        method: z.enum(["GET", "POST"]),
        url: z.string().min(1),
        headers: z.record(z.string(), z.string()).optional(),
        form: z.record(z.string(), z.string()).optional(),
      })
      .strict()
      .optional(),
    startPage: z.number().int().min(1).optional(),
    maxPages: z.number().int().min(1).max(100).optional(),
    parse: z
      .object({
        itemSelector: z.string().min(1).max(200).optional(),
        itemsPath: z.string().min(1).max(200).optional(),
        fields: fieldSetSchema,
        extraFields: z.partialRecord(z.enum(EXTRA_FIELD_TARGETS), fieldSpecSchema).optional(),
      })
      .strict(),
    detail: z
      .object({
        contentSelector: z.string().min(1).max(200),
        removeSelector: z.string().min(1).max(500).optional(),
        extraction: z.partialRecord(z.enum(EXTRA_FIELD_TARGETS), extractionSpecSchema).optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export const SkillConfigSchema = z
  .object({
    source: z
      .object({
        name: z.string().min(1).max(100),
        baseUrl: z.string().url(),
      })
      .strict(),
    settings: z
      .object({
        requestDelayMs: z.number().int().min(100).max(60_000).optional(),
        timeoutMs: z.number().int().min(1_000).max(120_000).optional(),
        retries: z.number().int().min(0).max(10).optional(),
        maxPages: z.number().int().min(1).max(100).optional(),
        headers: z.record(z.string(), z.string()).optional(),
        userAgent: z.string().min(1).max(500).optional(),
        scheduleCron: z
          .string()
          .regex(/^[\d*/,-\s]+$/, "cron 表达式仅支持标准数字、*、/、,、- 和空格")
          .optional(),
        proxyPolicy: z.enum(["off", "pool"]).optional(),
      })
      .strict(),
    lists: z.array(listConfigSchema).min(1).max(50),
  })
  .strict()
  .superRefine((config, ctx) => {
    for (const [index, list] of config.lists.entries()) {
      if (list.mode === "html" && !list.parse.itemSelector) {
        ctx.addIssue({
          code: "custom",
          path: ["lists", index, "parse", "itemSelector"],
          message: "html 模式必须配置 itemSelector",
        });
      }
      if (list.mode === "json" && !list.request) {
        ctx.addIssue({
          code: "custom",
          path: ["lists", index, "request"],
          message: "json 模式必须配置 request",
        });
      }
      if (list.mode === "html" && !list.firstPageUrl && !list.url) {
        ctx.addIssue({
          code: "custom",
          path: ["lists", index],
          message: "html 模式必须配置 firstPageUrl 或 url",
        });
      }
    }
  });

export type ValidatedSkillConfig = z.infer<typeof SkillConfigSchema>;
