ALTER TYPE "Timegrain" ADD VALUE IF NOT EXISTS 'WEEK';

ALTER TABLE "MetricObservation"
ADD COLUMN IF NOT EXISTS "timegrain" "Timegrain" NOT NULL DEFAULT 'MONTH';

CREATE INDEX IF NOT EXISTS "MetricObservation_metricDefinitionId_timegrain_observedAt_idx"
ON "MetricObservation"("metricDefinitionId", "timegrain", "observedAt" DESC);
