-- CreateEnum
CREATE TYPE "WebsitePerformanceStrategy" AS ENUM ('MOBILE', 'DESKTOP');

-- CreateEnum
CREATE TYPE "WebsiteDataScope" AS ENUM ('PAGE', 'ORIGIN');

-- CreateEnum
CREATE TYPE "HealthCategory" AS ENUM ('GOOD', 'NEEDS_IMPROVEMENT', 'POOR');

-- CreateTable
CREATE TABLE "WebsitePage" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsitePage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteHealthSnapshot" (
    "id" TEXT NOT NULL,
    "websitePageId" TEXT NOT NULL,
    "strategy" "WebsitePerformanceStrategy" NOT NULL,
    "timegrain" "Timegrain" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,
    "pageDataScope" "WebsiteDataScope" NOT NULL,
    "lcpMs" DECIMAL(18,6),
    "inpMs" DECIMAL(18,6),
    "cls" DECIMAL(18,6),
    "lcpCategory" "HealthCategory",
    "inpCategory" "HealthCategory",
    "clsCategory" "HealthCategory",
    "requestedUrl" TEXT NOT NULL,
    "finalUrl" TEXT NOT NULL,
    "rawJson" JSONB NOT NULL,
    "sourceRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePage_key_key" ON "WebsitePage"("key");

-- CreateIndex
CREATE UNIQUE INDEX "WebsitePage_url_key" ON "WebsitePage"("url");

-- CreateIndex
CREATE UNIQUE INDEX "WebsiteHealthSnapshot_websitePageId_strategy_timegrain_periodS_key"
ON "WebsiteHealthSnapshot"("websitePageId", "strategy", "timegrain", "periodStart");

-- CreateIndex
CREATE INDEX "WebsiteHealthSnapshot_timegrain_periodStart_idx"
ON "WebsiteHealthSnapshot"("timegrain", "periodStart" DESC);

-- CreateIndex
CREATE INDEX "WebsiteHealthSnapshot_websitePageId_periodStart_idx"
ON "WebsiteHealthSnapshot"("websitePageId", "periodStart" DESC);

-- CreateIndex
CREATE INDEX "WebsiteHealthSnapshot_sourceRunId_idx"
ON "WebsiteHealthSnapshot"("sourceRunId");

-- AddForeignKey
ALTER TABLE "WebsiteHealthSnapshot"
ADD CONSTRAINT "WebsiteHealthSnapshot_websitePageId_fkey"
FOREIGN KEY ("websitePageId") REFERENCES "WebsitePage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebsiteHealthSnapshot"
ADD CONSTRAINT "WebsiteHealthSnapshot_sourceRunId_fkey"
FOREIGN KEY ("sourceRunId") REFERENCES "SourceRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
