-- CreateTable
CREATE TABLE "Tournament" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "totalRounds" INTEGER NOT NULL,
    "totalTeams" INTEGER NOT NULL,
    "tournamentType" TEXT NOT NULL DEFAULT 'single_elimination',
    "seedingMethod" TEXT NOT NULL DEFAULT 'random',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TournamentRound" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "roundName" TEXT NOT NULL,
    "totalMatches" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "scheduledDate" DATETIME,
    "startTime" DATETIME,
    "endTime" DATETIME,
    CONSTRAINT "TournamentRound_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TournamentTeam" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tournamentId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "seedNumber" INTEGER,
    "initialPosition" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "eliminatedInRound" INTEGER,
    "finalRanking" INTEGER,
    CONSTRAINT "TournamentTeam_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TournamentTeam_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

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
INSERT INTO "new_Match" ("courtId", "gameSettings", "id", "matchType", "parentId", "round", "scoreA", "scoreB", "scoreHistory", "status", "teamAId", "teamBId", "winnerId") SELECT "courtId", "gameSettings", "id", "matchType", "parentId", "round", "scoreA", "scoreB", "scoreHistory", "status", "teamAId", "teamBId", "winnerId" FROM "Match";
DROP TABLE "Match";
ALTER TABLE "new_Match" RENAME TO "Match";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TournamentRound_tournamentId_roundNumber_key" ON "TournamentRound"("tournamentId", "roundNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_teamId_key" ON "TournamentTeam"("tournamentId", "teamId");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_seedNumber_key" ON "TournamentTeam"("tournamentId", "seedNumber");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentTeam_tournamentId_initialPosition_key" ON "TournamentTeam"("tournamentId", "initialPosition");
