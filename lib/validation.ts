import { SourceSystem, TargetType } from "@prisma/client";
import { z } from "zod";
import { dashboardTimegrains } from "@/lib/timegrain";

export const timegrainSchema = z.enum(dashboardTimegrains);

export const ingestionObservationSchema = z.object({
  metricKey: z.string().min(1),
  value: z.number().finite(),
  timestamp: z.iso.datetime(),
  timegrain: timegrainSchema.default("MONTH"),
  segmentKey: z.string().optional(),
  segmentValue: z.string().optional(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const ingestionPayloadSchema = z.object({
  source: z.nativeEnum(SourceSystem),
  externalRunId: z.string().min(1),
  observations: z.array(ingestionObservationSchema).min(1),
});

export const dashboardQuerySchema = z.object({
  timegrain: timegrainSchema.default("MONTH"),
  asOf: z.iso.datetime().optional(),
});

export const targetRowSchema = z.object({
  metricKey: z.string().min(1),
  targetType: z.nativeEnum(TargetType),
  targetValue: z.coerce.number().finite(),
  effectiveFrom: z.iso.date(),
  effectiveTo: z.iso.date().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const pagespeedStrategySchema = z.enum(["mobile", "desktop"]);
export const websiteHealthReportStrategySchema = z.enum(["all", "mobile", "desktop"]);

export const websiteHealthSyncRequestSchema = z.object({
  pageIds: z.array(z.string().min(1)).optional(),
  strategies: z.array(pagespeedStrategySchema).min(1).optional(),
  strategy: pagespeedStrategySchema.optional(),
  notes: z.string().optional(),
});

export const websitePageCreateSchema = z.object({
  label: z.string().trim().min(1),
  url: z.url(),
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/)
    .optional(),
  sortOrder: z.number().int().optional(),
});

export const websitePageUpdateSchema = z
  .object({
    label: z.string().trim().min(1).optional(),
    url: z.url().optional(),
    isActive: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const websiteHealthReportQuerySchema = z.object({
  strategy: websiteHealthReportStrategySchema.default("all"),
  pageId: z.string().min(1).optional(),
});

export type IngestionPayload = z.infer<typeof ingestionPayloadSchema>;
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
export type TargetRow = z.infer<typeof targetRowSchema>;
export type WebsiteHealthSyncRequest = z.infer<typeof websiteHealthSyncRequestSchema>;
export type WebsitePageCreateInput = z.infer<typeof websitePageCreateSchema>;
export type WebsitePageUpdateInput = z.infer<typeof websitePageUpdateSchema>;
export type WebsiteHealthReportQuery = z.infer<typeof websiteHealthReportQuerySchema>;
