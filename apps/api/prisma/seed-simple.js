const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('正在清理现有数据...');
  
  await prisma.match.deleteMany();
  await prisma.team.deleteMany();
  await prisma.court.deleteMany();

  console.log('正在创建基础数据...');
  
  // 创建5个场地
  const courts = [];
  for (let i = 1; i <= 5; i++) {
    const court = await prisma.court.create({
      data: { name: `Court ${i}号场地` },
    });
    courts.push(court);
  }

  // 创建男双队伍
  const menTeams = [];
  for (let i = 1; i <= 16; i++) {
    const team = await prisma.team.create({
      data: {
        name: `MenDouble Team ${i}`,
        players: `张${i}，李${i}`,
        type: 'MEN_DOUBLE',
      },
    });
    menTeams.push(team);
  }

  // 创建女双队伍
  const womenTeams = [];
  for (let i = 1; i <= 8; i++) {
    const team = await prisma.team.create({
      data: {
        name: `WomenDouble Team ${i}`,
        players: `王${i}，赵${i}`,
        type: 'WOMEN_DOUBLE',
      },
    });
    womenTeams.push(team);
  }

  // 创建混双队伍
  const mixTeams = [];
  for (let i = 1; i <= 8; i++) {
    const team = await prisma.team.create({
      data: {
        name: `MixDouble Team ${i}`,
        players: `陈${i}，刘${i}`,
        type: 'MIX_DOUBLE',
      },
    });
    mixTeams.push(team);
  }

  // 创建男双比赛
  const menMatches = [];
  for (let i = 0; i < menTeams.length; i += 2) {
    const match = await prisma.match.create({
      data: {
        matchType: 'MEN_DOUBLE',
        round: 1,
        teamAId: menTeams[i].id,
        teamBId: menTeams[i + 1].id,
      },
    });
    menMatches.push(match);
  }

  // 创建女双比赛
  const womenMatches = [];
  for (let i = 0; i < womenTeams.length; i += 2) {
    const match = await prisma.match.create({
      data: {
        matchType: 'WOMEN_DOUBLE',
        round: 1,
        teamAId: womenTeams[i].id,
        teamBId: womenTeams[i + 1].id,
      },
    });
    womenMatches.push(match);
  }

  // 创建混双比赛
  const mixMatches = [];
  for (let i = 0; i < mixTeams.length; i += 2) {
    const match = await prisma.match.create({
      data: {
        matchType: 'MIX_DOUBLE',
        round: 1,
        teamAId: mixTeams[i].id,
        teamBId: mixTeams[i + 1].id,
      },
    });
    mixMatches.push(match);
  }

  // 设置场地状态进行调试
  
  // 场地1: 正在进行的比赛 (有比分)
  if (menMatches[0]) {
    await prisma.match.update({
      where: { id: menMatches[0].id },
      data: {
        courtId: courts[0].id,
        scoreA: 15,
        scoreB: 12,
        scoreHistory: JSON.stringify([{
          setNumber: 1,
          scoreA: 15,
          scoreB: 12,
          pointHistory: []
        }]),
        gameSettings: JSON.stringify({
          maxSets: 3,
          pointsPerSet: 21,
          deuceDiff: 2
        }),
      },
    });
  }

  // 场地2: 准备开始的比赛 (已分配但无比分)
  if (womenMatches[0]) {
    await prisma.match.update({
      where: { id: womenMatches[0].id },
      data: {
        courtId: courts[1].id,
      },
    });
  }

  // 场地3: 接近结束的比赛
  if (mixMatches[0]) {
    await prisma.match.update({
      where: { id: mixMatches[0].id },
      data: {
        courtId: courts[2].id,
        scoreA: 20,
        scoreB: 18,
        scoreHistory: JSON.stringify([{
          setNumber: 1,
          scoreA: 20,
          scoreB: 18,
          pointHistory: []
        }]),
        gameSettings: JSON.stringify({
          maxSets: 1,
          pointsPerSet: 21,
          deuceDiff: 2
        }),
      },
    });
  }

  // 场地4: 已完成的比赛
  if (menMatches[1]) {
    await prisma.match.update({
      where: { id: menMatches[1].id },
      data: {
        courtId: courts[3].id,
        scoreA: 21,
        scoreB: 15,
        winnerId: menTeams[2].id, // 获胜者
        scoreHistory: JSON.stringify([{
          setNumber: 1,
          scoreA: 21,
          scoreB: 15,
          pointHistory: []
        }]),
        gameSettings: JSON.stringify({
          maxSets: 1,
          pointsPerSet: 21,
          deuceDiff: 2
        }),
      },
    });
  }

  // 场地5: 空闲状态 (无比赛分配)

  const totalMatches = menMatches.length + womenMatches.length + mixMatches.length;
  const assignedMatches = 4; // 分配到场地的比赛数量
  const pendingMatches = totalMatches - assignedMatches;

  console.log('✅ 种子数据创建完成!');
  console.log(`📊 创建统计:`);
  console.log(`   - 场地: ${courts.length} 个`);
  console.log(`   - 队伍: ${menTeams.length + womenTeams.length + mixTeams.length} 支`);
  console.log(`     * 男双: ${menTeams.length} 支`);
  console.log(`     * 女双: ${womenTeams.length} 支`);
  console.log(`     * 混双: ${mixTeams.length} 支`);
  console.log(`   - 比赛: ${totalMatches} 场`);
  console.log(`   - 状态分布:`);
  console.log(`     * 场地1: 进行中 (男双 15:12)`);
  console.log(`     * 场地2: 准备开始 (女双)`);
  console.log(`     * 场地3: 激烈比赛 (混双 20:18)`);
  console.log(`     * 场地4: 已完成 (男双 21:15)`);
  console.log(`     * 场地5: 空闲状态`);
  console.log(`     * 等待队列: ${pendingMatches} 场比赛`);
  console.log('');
  console.log('🚀 您现在可以启动服务器进行调试了！');
}

main()
  .catch(e => {
    console.error('❌ 种子数据创建失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });