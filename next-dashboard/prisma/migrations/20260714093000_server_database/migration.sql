PRAGMA foreign_keys=OFF;
PRAGMA journal_mode=WAL;

CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "workspaceName" TEXT NOT NULL DEFAULT 'Personal workspace',
    "monthlyBudget" TEXT NOT NULL DEFAULT '40',
    "currency" TEXT NOT NULL DEFAULT '¥',
    "reminderDays" INTEGER NOT NULL DEFAULT 3,
    "copyrightText" TEXT NOT NULL DEFAULT '© 2026 续费管家. 保留所有权利。',
    "theme" TEXT NOT NULL DEFAULT 'forest',
    "frontendTemplate" TEXT NOT NULL DEFAULT 'cards',
    "frontendDisplayMode" TEXT NOT NULL DEFAULT 'system',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "initializedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "price" TEXT NOT NULL,
    "cycle" TEXT NOT NULL,
    "nextBilling" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "iconName" TEXT NOT NULL DEFAULT 'cloud',
    "tone" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "WorkspaceSettings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "SubscriptionMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SubscriptionMember_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ReminderDelivery" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "targetDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sending',
    "attemptCount" INTEGER NOT NULL DEFAULT 1,
    "claimedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" DATETIME,
    "lastError" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ReminderRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "checkedCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME
);

CREATE TABLE "SchedulerLease" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "owner" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE INDEX "Subscription_workspaceId_position_idx" ON "Subscription"("workspaceId", "position");
CREATE INDEX "Subscription_status_nextBilling_idx" ON "Subscription"("status", "nextBilling");
CREATE UNIQUE INDEX "SubscriptionMember_subscriptionId_email_key" ON "SubscriptionMember"("subscriptionId", "email");
CREATE INDEX "SubscriptionMember_subscriptionId_position_idx" ON "SubscriptionMember"("subscriptionId", "position");
CREATE UNIQUE INDEX "ReminderDelivery_subscriptionId_targetDate_recipientEmail_key" ON "ReminderDelivery"("subscriptionId", "targetDate", "recipientEmail");
CREATE INDEX "ReminderDelivery_status_claimedAt_idx" ON "ReminderDelivery"("status", "claimedAt");
CREATE INDEX "ReminderDelivery_subscriptionId_targetDate_idx" ON "ReminderDelivery"("subscriptionId", "targetDate");
CREATE INDEX "ReminderDelivery_createdAt_idx" ON "ReminderDelivery"("createdAt");
CREATE INDEX "ReminderRun_startedAt_idx" ON "ReminderRun"("startedAt");

PRAGMA foreign_keys=ON;
