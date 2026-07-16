CREATE TABLE "EmailSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "host" TEXT NOT NULL DEFAULT '',
    "port" INTEGER NOT NULL DEFAULT 587 CHECK ("port" BETWEEN 1 AND 65535),
    "secure" BOOLEAN NOT NULL DEFAULT false,
    "requireTls" BOOLEAN NOT NULL DEFAULT true,
    "username" TEXT NOT NULL DEFAULT '',
    "passwordEncrypted" TEXT,
    "mailFrom" TEXT NOT NULL DEFAULT '',
    "mailReplyTo" TEXT NOT NULL DEFAULT '',
    "testTo" TEXT NOT NULL DEFAULT '',
    "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" >= 1),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "ReminderSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60 CHECK ("intervalMinutes" BETWEEN 1 AND 1440),
    "runOnStart" BOOLEAN NOT NULL DEFAULT true,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3 CHECK ("maxAttempts" BETWEEN 1 AND 10),
    "nextScheduledAt" DATETIME,
    "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" >= 1),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
