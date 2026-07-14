CREATE TABLE "AdminCredential" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'default',
    "passwordHash" TEXT NOT NULL,
    "sessionGeneration" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
