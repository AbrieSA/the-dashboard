-- CreateEnum
CREATE TYPE "SourceSystem" AS ENUM ('SALESFORCE', 'GA4', 'WEBSITE_PERFORMANCE', 'GOOGLE_SHEETS', 'MANUAL');

-- CreateEnum
CREATE TYPE "SourceRunStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'DUPLICATE');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('CURRENT', 'STANDARD', 'DESIRED');

-- CreateEnum
CREATE TYPE "Timegrain" AS ENUM ('MONTH', 'YEAR');

-- CreateTable
CREATE TABLE "DashboardGroup" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceSystem" "SourceSystem" NOT NULL,
    "unit" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "segment" TEXT,
    "directionality" TEXT NOT NULL DEFAULT 'HIGHER_IS_BETTER',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dashboardGroupId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricObservation" (
    "id" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "observedValue" DECIMAL(18,6) NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "sourceSystem" "SourceSystem" NOT NULL,
    "segmentKey" TEXT,
    "segmentValue" TEXT,
    "notes" TEXT,
    "metadataJson" JSONB,
    "sourceRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetricTarget" (
    "id" TEXT NOT NULL,
    "metricDefinitionId" TEXT NOT NULL,
    "targetType" "TargetType" NOT NULL,
    "targetValue" DECIMAL(18,6) NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "sourceSystem" "SourceSystem" NOT NULL DEFAULT 'GOOGLE_SHEETS',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetricTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRun" (
    "id" TEXT NOT NULL,
    "sourceSystem" "SourceSystem" NOT NULL,
    "externalRunId" TEXT NOT NULL,
    "status" "SourceRunStatus" NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "observationCount" INTEGER NOT NULL DEFAULT 0,
    "payloadJson" JSONB,
    "errorMessage" TEXT,

    CONSTRAINT "SourceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DashboardGroup_key_key" ON "DashboardGroup"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MetricDefinition_key_key" ON "MetricDefinition"("key");

-- CreateIndex
CREATE INDEX "MetricObservation_metricDefinitionId_observedAt_idx" ON "MetricObservation"("metricDefinitionId", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "MetricObservation_sourceSystem_observedAt_idx" ON "MetricObservation"("sourceSystem", "observedAt" DESC);

-- CreateIndex
CREATE INDEX "MetricTarget_metricDefinitionId_targetType_effectiveFrom_idx" ON "MetricTarget"("metricDefinitionId", "targetType", "effectiveFrom" DESC);

-- CreateIndex
CREATE INDEX "SourceRun_status_receivedAt_idx" ON "SourceRun"("status", "receivedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "SourceRun_sourceSystem_externalRunId_key" ON "SourceRun"("sourceSystem", "externalRunId");

-- AddForeignKey
ALTER TABLE "MetricDefinition" ADD CONSTRAINT "MetricDefinition_dashboardGroupId_fkey" FOREIGN KEY ("dashboardGroupId") REFERENCES "DashboardGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricObservation" ADD CONSTRAINT "MetricObservation_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricObservation" ADD CONSTRAINT "MetricObservation_sourceRunId_fkey" FOREIGN KEY ("sourceRunId") REFERENCES "SourceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MetricTarget" ADD CONSTRAINT "MetricTarget_metricDefinitionId_fkey" FOREIGN KEY ("metricDefinitionId") REFERENCES "MetricDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
