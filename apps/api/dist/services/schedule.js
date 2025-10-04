"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearTournament = clearTournament;
exports.buildMatchQueue = buildMatchQueue;
const prismaClient_1 = require("../prismaClient");
/**
 * 清空指定类型的赛程
 * @param matchType 比赛类型
 */
async function clearTournament(matchType) {
    await prismaClient_1.prisma.match.deleteMany({
        where: { matchType }
    });
    return { success: true, message: `${matchType} 赛程已清空` };
}
/**
 * 构建总比赛队列（顺序调度到各场地）
 */
function buildMatchQueue(matches, courts) {
    const queue = [];
    let court = 1;
    for (const match of matches) {
        queue.push({ matchId: match.id, courtId: court });
        court = (court % courts) + 1; // 循环分配场地
    }
    return queue;
}
//# sourceMappingURL=schedule.js.map