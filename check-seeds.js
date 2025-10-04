const { PrismaClient } = require('./apps/api/node_modules/@prisma/client');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./apps/api/prisma/dev.db'
    }
  }
});

async function checkSeeds() {
  try {
    console.log('🔍 检查种子选手数据...');
    
    // 查询 TournamentTeam 表
    const tournamentTeams = await prisma.tournamentTeam.findMany();
    console.log(`📊 TournamentTeam 记录总数: ${tournamentTeams.length}`);
    
    // 查看前几条记录
    console.log('\n📋 前5条 TournamentTeam 记录:');
    tournamentTeams.slice(0, 5).forEach((tt, index) => {
      console.log(`${index + 1}. Team ID: ${tt.teamId}, Seed: ${tt.seedNumber}, Position: ${tt.initialPosition}`);
    });
    
    // 统计有种子号的队伍
    const seededTeams = tournamentTeams.filter(tt => tt.seedNumber !== null);
    console.log(`\n🎯 有种子号的队伍: ${seededTeams.length}`);
    
    if (seededTeams.length > 0) {
      console.log('种子队伍详情:');
      seededTeams.forEach(tt => {
        console.log(`  - Team ID: ${tt.teamId}, Seed: ${tt.seedNumber}`);
      });
    }
    
    // 查询比赛数据中的队伍信息
    console.log('\n🏆 检查最新比赛中的队伍数据...');
    const matches = await prisma.match.findMany({
      include: {
        teamA: true,
        teamB: true
      },
      take: 3,
      orderBy: { id: 'desc' }
    });
    
    matches.forEach((match, index) => {
      console.log(`\n比赛 ${index + 1} (ID: ${match.id}):`);
      if (match.teamA) {
        console.log(`  Team A: ${match.teamA.name} (ID: ${match.teamA.id})`);
      }
      if (match.teamB) {
        console.log(`  Team B: ${match.teamB.name} (ID: ${match.teamB.id})`);
      }
    });
    
  } catch (error) {
    console.error('❌ 查询失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSeeds();