// 手动创建种子选手测试
console.log('🌱 开始设置种子选手测试...');

async function createSeedPlayers() {
  try {
    // 1. 获取现有的混双队伍
    console.log('📋 获取现有队伍...');
    const teamsResponse = await fetch('http://localhost:4001/api/teams?type=MIX_DOUBLE');
    const teamsData = await teamsResponse.json();
    
    if (!teamsResponse.ok || !teamsData.teams) {
      throw new Error('获取队伍失败');
    }
    
    const teams = teamsData.teams;
    console.log(`📊 找到 ${teams.length} 支混双队伍`);
    
    if (teams.length < 2) {
      console.log('❌ 队伍数量不足，需要至少2支队伍来设置种子选手');
      return;
    }
    
    // 2. 选择前两支队伍作为种子选手
    const seedTeams = teams.slice(0, 2);
    console.log('🎯 选择种子选手:');
    seedTeams.forEach((team, index) => {
      console.log(`  ${index + 1}号种子: ${team.name} (${team.players})`);
    });
    
    // 3. 生成赛程并设置种子选手
    const seedPlayerIds = seedTeams.map(t => t.id);
    
    console.log('\n🏗️ 生成赛程并设置种子选手...');
    const generateResponse = await fetch('http://localhost:4001/api/schedule/generate-bracket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        matchType: 'MIX_DOUBLE',
        seedPlayers: seedPlayerIds
      })
    });
    
    const generateData = await generateResponse.json();
    
    if (!generateResponse.ok) {
      throw new Error(generateData.error || '生成赛程失败');
    }
    
    console.log('✅ 赛程生成成功！');
    
    // 4. 验证种子选手设置
    console.log('\n🔍 验证种子选手设置...');
    const treeResponse = await fetch('http://localhost:4001/api/schedule/tree?matchType=MIX_DOUBLE');
    const treeData = await treeResponse.json();
    
    if (treeResponse.ok && treeData.teams) {
      const teamsWithSeeds = treeData.teams.filter(t => t.seedNumber);
      console.log(`🌟 成功设置 ${teamsWithSeeds.length} 个种子选手:`);
      
      teamsWithSeeds.forEach(team => {
        console.log(`  [${team.seedNumber}] ${team.name} - ${team.players}`);
      });
      
      if (teamsWithSeeds.length > 0) {
        console.log('\n🎉 种子选手功能测试成功！现在前端应该能显示种子标识了。');
      } else {
        console.log('\n❌ 没有找到种子选手，可能设置失败');
      }
    } else {
      console.log('❌ 验证失败，无法获取赛程数据');
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

// 模拟 fetch API（如果在 Node.js 环境中）
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

createSeedPlayers();