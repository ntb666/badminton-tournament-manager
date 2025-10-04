-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchType" TEXT NOT NULL,
    "tournamentId" INTEGER,
    "roundId" INTEGER,
    "round" INTEGER NOT NULL,
    "treePosition" INTEGER,
    "matchNumber" TEXT,
    "isBronzeMatch" BOOLEAN NOT NULL DEFAULT false,
    "uiPositionTop" REAL,
    "uiIsLongCard" BOOLEAN,
    "uiPositionCalculated" BOOLEAN NOT NULL DEFAULT false,
    "teamAId" INTEGER,
    "teamBId" INTEGER,
    "courtId" INTEGER,
    "parentId" INTEGER,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "winnerId" INTEGER,
    "scoreHistory" TEXT,
    "gameSettings" TEXT,
    CONSTRAINT "Match_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "TournamentRound" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Match" ("courtId", "gameSettings", "id", "matchNumber", "matchType", "parentId", "round", "roundId", "scoreA", "scoreB", "scoreHistory", "status", "teamAId", "teamBId", "tournamentId", "treePosition", "uiIsLongCard", "uiPositionCalculated", "uiPositionTop", "winnerId") SELECT "courtId", "gameSettings", "id", "matchNumber", "matchType", "parentId", "round", "roundId", "scoreA", "scoreB", "scoreHistory", "status", "teamAId", "teamBId", "tournamentId", "treePosition", "uiIsLongCard", "uiPositionCalculated", "uiPositionTop", "winnerId" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
CREATE TABLE "new_Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalRounds" INTEGER NOT NULL,
    "totalTeams" INTEGER NOT NULL,
    "tournamentType" TEXT NOT NULL DEFAULT 'single_elimination',
    "seedingMethod" TEXT NOT NULL DEFAULT 'random',
    "hasBronzeMatch" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Tournament" ("createdAt", "endDate", "id", "matchType", "name", "seedingMethod", "startDate", "status", "totalRounds", "totalTeams", "tournamentType", "updatedAt") SELECT "createdAt", "endDate", "id", "matchType", "name", "seedingMethod", "startDate", "status", "totalRounds", "totalTeams", "tournamentType", "updatedAt" FROM "Tournament";
DROP TABLE "Tournament";
ALTER TABLE "new_Tournament" RENAME TO "Tournament";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
