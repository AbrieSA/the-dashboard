import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  APP_BASE_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().min(16),
  INTERNAL_DASHBOARD_EMAILS: z.string().default(""),
  INTERNAL_DASHBOARD_PASSWORD: z.string().min(8),
  INGESTION_API_KEY: z.string().min(12),
  GOOGLE_TARGETS_SYNC_KEY: z.string().min(12),
  GOOGLE_TARGETS_CSV_URL: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function getEnv(): AppEnv {
  return envSchema.parse(process.env);
}
