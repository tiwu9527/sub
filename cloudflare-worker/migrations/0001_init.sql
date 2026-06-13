CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "platform" TEXT NOT NULL,
  "planType" TEXT NOT NULL,
  "price" REAL NOT NULL,
  "billingCycle" TEXT NOT NULL,
  "nextBillingDate" TEXT NOT NULL,
  "reminderEnabled" INTEGER NOT NULL DEFAULT 0 CHECK ("reminderEnabled" IN (0, 1)),
  "reminderDays" INTEGER NOT NULL DEFAULT 3,
  "lastReminderSentAt" TEXT,
  "lastReminderTargetDate" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS "SubscriptionUser" (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "subscriptionId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CONSTRAINT "SubscriptionUser_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId")
    REFERENCES "Subscription" ("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "SubscriptionUser_subscriptionId_idx"
  ON "SubscriptionUser" ("subscriptionId");

CREATE TABLE IF NOT EXISTS "AppSetting" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "createdAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  "updatedAt" TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO "AppSetting" ("key", "value")
VALUES ('brandName', 'Subscription Desk')
ON CONFLICT("key") DO NOTHING;
