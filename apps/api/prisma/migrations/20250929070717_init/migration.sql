-- CreateTable
CREATE TABLE "Team" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "players" TEXT NOT NULL,
    "type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Court" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchType" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "teamAId" INTEGER NOT NULL,
    "teamBId" INTEGER NOT NULL,
    "courtId" INTEGER,
    "parentId" INTEGER,
    "scoreA" INTEGER,
    "scoreB" INTEGER,
    "winnerId" INTEGER,
    CONSTRAINT "Match_teamAId_fkey" FOREIGN KEY ("teamAId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_teamBId_fkey" FOREIGN KEY ("teamBId") REFERENCES "Team" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Match_courtId_fkey" FOREIGN KEY ("courtId") REFERENCES "Court" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Match_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Match" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
