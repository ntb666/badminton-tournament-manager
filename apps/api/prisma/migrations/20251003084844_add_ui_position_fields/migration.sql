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
INSERT INTO "new_Match" ("courtId", "gameSettings", "id", "matchNumber", "matchType", "parentId", "round", "roundId", "scoreA", "scoreB", "scoreHistory", "status", "teamAId", "teamBId", "tournamentId", "treePosition", "winnerId") SELECT "courtId", "gameSettings", "id", "matchNumber", "matchType", "parentId", "round", "roundId", "scoreA", "scoreB", "scoreHistory", "status", "teamAId", "teamBId", "tournamentId", "treePosition", "winnerId" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
