import { prisma } from "../prismaClient";
import { MatchType } from "@prisma/client";

/**
 * 清空指定类型的赛程
 * @param matchType 比赛类型
 */
export async function clearTournament(matchType: MatchType) {
  await prisma.match.deleteMany({
    where: { matchType }
  });
  return { success: true, message: `${matchType} 赛程已清空` };
}

/**
 * 构建总比赛队列（顺序调度到各场地）
 */
export function buildMatchQueue(matches: any[], courts: number) {
  const queue: Array<{ matchId: number; courtId?: number }> = [];
  let court = 1;

  for (const match of matches) {
    queue.push({ matchId: match.id, courtId: court });
    court = (court % courts) + 1; // 循环分配场地
  }

  return queue;
}
