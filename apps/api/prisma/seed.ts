import { PrismaClient, MatchType } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("正在清理现有数据...");
  
  // 清理现有数据
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.court.deleteMany();

  console.log("正在创建种子数据...");

  // 1️⃣ 创建 5 个场地
  const courts = [];
  for (let i = 1; i <= 5; i++) {
    const court = await prisma.court.create({
      data: { name: `Court ${i}号场地` },
    });
    courts.push(court);
  }

  // 2️⃣ 创建队伍（数量适中，便于调试）
  const teams: any[] = [];

  // 男双 16 组（便于淘汰赛）
  for (let i = 1; i <= 16; i++) {
    const team = await prisma.team.create({
      data: {
        name: `MenDouble Team ${i}`,
        players: `张${i}，李${i}`,
        type: MatchType.MEN_DOUBLE,
      },
    });
    teams.push(team);
  }

  // 女双 8 组
  for (let i = 1; i <= 8; i++) {
    const team = await prisma.team.create({
      data: {
        name: `WomenDouble Team ${i}`,
        players: `王${i}，赵${i}`,
        type: MatchType.WOMEN_DOUBLE,
      },
    });
    teams.push(team);
  }

  // 混双 8 组
  for (let i = 1; i <= 8; i++) {
    const team = await prisma.team.create({
      data: {
        name: `MixDouble Team ${i}`,
        players: `陈${i}，刘${i}`,
        type: MatchType.MIX_DOUBLE,
      },
    });
    teams.push(team);
  }

  // 3️⃣ 创建比赛并设置不同状态
  const matches: any[] = [];

  // 创建男双第一轮比赛（16队->8场比赛）
  const menDoubleTeams = teams.filter(t => t.type === MatchType.MEN_DOUBLE);
  for (let i = 0; i < menDoubleTeams.length; i += 2) {
    const match = await prisma.match.create({
      data: {
        matchType: MatchType.MEN_DOUBLE,
        round: 1,
        teamAId: menDoubleTeams[i].id,
        teamBId: menDoubleTeams[i + 1].id,
      },
    });
    matches.push(match);
  }

  // 创建女双第一轮比赛（8队->4场比赛）
  const womenDoubleTeams = teams.filter(t => t.type === MatchType.WOMEN_DOUBLE);
  for (let i = 0; i < womenDoubleTeams.length; i += 2) {
    const match = await prisma.match.create({
      data: {
        matchType: MatchType.WOMEN_DOUBLE,
        round: 1,
        teamAId: womenDoubleTeams[i].id,
        teamBId: womenDoubleTeams[i + 1].id,
      },
    });
    matches.push(match);
  }

  // 创建混双第一轮比赛（8队->4场比赛）
  const mixDoubleTeams = teams.filter(t => t.type === MatchType.MIX_DOUBLE);
  for (let i = 0; i < mixDoubleTeams.length; i += 2) {
    const match = await prisma.match.create({
      data: {
        matchType: MatchType.MIX_DOUBLE,
        round: 1,
        teamAId: mixDoubleTeams[i].id,
        teamBId: mixDoubleTeams[i + 1].id,
      },
    });
    matches.push(match);
  }

  // 4️⃣ 设置不同状态的比赛进行调试

  // 场地1: 正在进行的男双比赛 (有比分)
  if (courts[0] && matches[0]) {
    await prisma.match.update({
      where: { id: matches[0].id },
      data: {
        courtId: courts[0].id,
        scoreA: 15,
        scoreB: 12,
        scoreHistory: JSON.stringify([
          {
            setNumber: 1,
            scoreA: 15,
            scoreB: 12,
            pointHistory: [
              { scorer: 'A', scoreA: 1, scoreB: 0 },
              { scorer: 'B', scoreA: 1, scoreB: 1 },
              { scorer: 'A', scoreA: 2, scoreB: 1 },
              // ... 更多得分历史可根据需要添加
            ]
          }
        ]),
        gameSettings: JSON.stringify({
          maxSets: 3,
          pointsPerSet: 21,
          deuceDiff: 2
        }),
      },
    });
  }

  // 场地2: 准备开始的女双比赛 (已分配但无比分)
  if (courts[1] && matches[8]) {
    await prisma.match.update({
      where: { id: matches[8].id }, // 第一个女双比赛
      data: {
        courtId: courts[1].id,
      },
    });
  }

  // 场地3: 正在进行的混双比赛 (有比分，接近结束)
  if (courts[2] && matches[12]) {
    await prisma.match.update({
      where: { id: matches[12].id }, // 第一个混双比赛
      data: {
        courtId: courts[2].id,
        scoreA: 20,
        scoreB: 18,
        scoreHistory: JSON.stringify([
          {
            setNumber: 1,
            scoreA: 20,
            scoreB: 18,
            pointHistory: []
          }
        ]),
        gameSettings: JSON.stringify({
          maxSets: 1,
          pointsPerSet: 21,
          deuceDiff: 2
        }),
      },
    });
  }

  // 场地4: 已完成的比赛
  if (courts[3] && matches[1] && menDoubleTeams[0]) {
    await prisma.match.update({
      where: { id: matches[1].id },
      data: {
        courtId: courts[3].id,
        scoreA: 21,
        scoreB: 15,
        winnerId: menDoubleTeams[0].id, // 第一队获胜
        scoreHistory: JSON.stringify([
          {
            setNumber: 1,
            scoreA: 21,
            scoreB: 15,
            pointHistory: []
          }
        ]),
        gameSettings: JSON.stringify({
          maxSets: 1,
          pointsPerSet: 21,
          deuceDiff: 2
        }),
      },
    });
  }

  // 场地5: 空闲状态

  // 5️⃣ 创建一些待分配的比赛（等待队列）
  // 这些比赛没有分配到场地，会出现在等待队列中
  
  console.log(`✅ 种子数据创建完成!`);
  console.log(`📊 创建统计:`);
  console.log(`   - 场地: ${courts.length} 个`);
  console.log(`   - 队伍: ${teams.length} 支`);
  console.log(`   - 比赛: ${matches.length} 场`);
  console.log(`   - 状态分布:`);
  console.log(`     * 场地1: 进行中比赛 (15:12)`);
  console.log(`     * 场地2: 准备开始 (已分配)`);
  console.log(`     * 场地3: 激烈比赛 (20:18)`);
  console.log(`     * 场地4: 已完成比赛 (21:15)`);
  console.log(`     * 场地5: 空闲状态`);
  console.log(`     * 等待队列: ${matches.length - 4} 场比赛`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
