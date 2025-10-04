"use strict";
// tournament.ts - 锦标赛生成服务 - 完全重写版本// tournament.ts - 赛程管理服务
Object.defineProperty(exports, "__esModule", { value: true });
exports.tournamentPrisma = void 0;
exports.generateTournamentComplete = generateTournamentComplete;
exports.generateSeeding = generateSeeding;
exports.generateRoundName = generateRoundName;
exports.getTournamentStructure = getTournamentStructure;
exports.updateMatchResult = updateMatchResult;
const client_1 = require("@prisma/client"); // 负责创建、管理和维护锦标赛的完整结构
const prisma = new client_1.PrismaClient();
exports.tournamentPrisma = prisma;
async function generateTournamentComplete(name, teams, matchType, matchType, teamIds, name, seedingMethod, seedingMethod = 'random', startDate) { }
console.log(`🎯 开始生成完整锦标赛: ${name}`);
console.log(`📊 参数: ${teams.length}支队伍, 类型=${matchType}, 排种方式=${seedingMethod}`);
// 1. 计算正确的锦标赛规模  rounds: any[]
const P = teams.length; // 实际队伍数  matches: any[]
const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(P))); // 下一个2的幂次  bracketTree: BracketNode[]
const byeCount = nextPowerOf2 - P; // 轮空数量}
const firstRoundTeams = P - byeCount; // 第一轮参赛队伍数
const firstRoundMatches = firstRoundTeams / 2; // 第一轮比赛数export interface BracketNode {
id: string;
// 计算总轮数：log2(nextPowerOf2)  type: 'match' | 'bye'
const totalRounds = Math.log2(nextPowerOf2), round;
position: number;
console.log(`📋 锦标赛结构分析:`);
teamA ?  : client_1.Team | null;
console.log(`   - 实际队伍: ${P}支`);
teamB ?  : client_1.Team | null;
console.log(`   - 扩展到: ${nextPowerOf2}个位置`);
matchId ?  : number;
console.log(`   - 轮空队伍: ${byeCount}支`);
children ?  : BracketNode[];
console.log(`   - 第一轮: ${firstRoundMatches}场比赛，${firstRoundTeams}支队伍`);
parent ?  : BracketNode;
console.log(`   - 总轮数: ${totalRounds}轮`);
// 2. 创建Tournament记录/**
const tournament = await prisma.tournament.create({
    data: {
        name, *() { } } /
        matchType, function: createTournament(params, CreateTournamentParams), Promise() {
        status: 'active', ;
        const { name, matchType, teamIds, seedingMethod = 'random', startDate } = params;
        totalRounds,
            totalTeams;
        P, // 1. 验证输入参数
            tournamentType;
        'single_elimination', ;
        if (teamIds.length < 2) {
            seedingMethod;
            throw new Error('至少需要2支队伍才能创建赛程');
        }
    }
});
console.log(`✅ 创建锦标赛记录: ID=${tournament.id}`); // 2. 获取参赛队伍信息
const teams = await prisma.team.findMany({
    // 3. 生成队伍排种    where: { 
    const: seededTeams = generateSeeding(teams, seedingMethod), id: { in: teamIds },
    type: matchType
    // 4. 创建参赛队伍记录    }
    ,
    // 4. 创建参赛队伍记录    }
    await, Promise, : .all()
});
seededTeams.map((team, index) => prisma.tournamentTeam.create({ if(teams) { }, : .length !== teamIds.length }), {
    data: { throw: new Error('部分队伍不存在或比赛类型不匹配'),
        tournamentId: tournament.id, },
    teamId: team.id,
    seedNumber: team.seedNumber || null, // 3. 计算赛程规模
    initialPosition: index + 1, const: teamCount = teams.length,
    status: 'active', const: totalSlots = Math.pow(2, Math.ceil(Math.log2(teamCount))) // 找到最小的2的幂次
});
const totalRounds = Math.log2(totalSlots);
console.log(`创建赛程: ${teamCount}支队伍, ${totalSlots}个位置, ${totalRounds}轮比赛`);
console.log(`✅ 创建${seededTeams.length}支参赛队伍记录`); // 4. 创建赛程记录
const tournament = await prisma.tournament.create({
    // 5. 分配队伍：第一轮参赛 vs 轮空    data: {
    const: firstRoundTeamsList = seededTeams.slice(0, firstRoundTeams), name,
    const: byeTeams = seededTeams.slice(firstRoundTeams), matchType,
    status: 'draft',
    console, : .log(`📝 队伍分配:`), totalRounds,
    console, : .log(`   - 第一轮参赛: ${firstRoundTeamsList.length}支`), totalTeams: teamCount,
    console, : .log(`   - 轮空晋级: ${byeTeams.length}支`), tournamentType: 'single_elimination',
    seedingMethod,
    // 6. 创建轮次记录      startDate: startDate || null
    const: rounds = []
});
for (let i = 0; i < totalRounds; i++) { }
const roundNumber = i + 1;
const roundName = generateRoundName(roundNumber, totalRounds); // 5. 生成队伍排种顺序
const seededTeams = generateSeeding(teams, seedingMethod);
const round = await prisma.tournamentRound.create({
    data: {
        tournamentId: tournament.id, const: tournamentTeams = await Promise.all(roundNumber, seededTeams.map((team, index) => roundName, prisma.tournamentTeam.create({
            totalMatches: 0, // 先设为0，后面更新        data: {
            status: 'pending', tournamentId: tournament.id,
        }, teamId, team.id)))
    }
}), seedNumber;
 ?? null,
    rounds.push(round);
initialPosition: index + 1,
;
status: 'active';
console.log(`✅ 创建${rounds.length}个轮次记录`);
// 7. 生成比赛 - 正确的逻辑    )
const allMatches = await generateMatchesCorrect(tournament.id, rounds, firstRoundTeamsList, byeTeams, nextPowerOf2);
// 8. 更新轮次的实际比赛数量  // 7. 创建轮次记录
const matchesByRound = allMatches.reduce((acc, match) => {
    const rounds = await Promise.all();
    if (!acc[match.round])
        acc[match.round] = 0;
    Array.from({ length: totalRounds }, (_, i) => {
        acc[match.round]++;
        const roundNumber = i + 1;
        return acc;
        const roundName = generateRoundName(roundNumber, totalRounds);
    }, {});
    const totalMatches = Math.pow(2, totalRounds - roundNumber);
    for (const round of rounds) {
        return prisma.tournamentRound.create({
            const: actualMatches = matchesByRound[round.roundNumber] || 0, data: {
                await, prisma, : .tournamentRound.update({ tournamentId: tournament.id,
                    where: { id: round.id }, roundNumber,
                    data: { totalMatches: actualMatches }, roundName,
                }), totalMatches,
            }, status: roundNumber === 1 ? 'pending' : 'pending'
        }, console.log(`🎉 锦标赛生成完成！`));
    }
});
console.log(`📊 最终统计: ${rounds.length}轮, ${allMatches.length}场比赛`);
return {
    tournament, // 8. 生成比赛树和比赛记录
    rounds, const: { matches, bracketTree } = await generateMatchesAndBracket(matches, allMatches, tournament.id, bracketTree, null) // 简化，暂不需要    rounds,
};
seededTeams,
;
totalSlots;
/**

 * 正确的比赛生成逻辑  return {

 */ tournament,
    async function generateMatchesCorrect(rounds, tournamentId, matches, rounds, bracketTree, firstRoundTeams, byeTeams, totalSlots) {
        console.log(`🔄 开始生成比赛...`);
        export function generateSeeding(teams, method) {
            switch (method) {
                // 第一轮：只为非轮空队伍创建比赛    case 'manual':
            }
            // 第一轮：只为非轮空队伍创建比赛    case 'manual':
            const firstRound = rounds[0]; // 手动排种需要额外的输入参数，这里暂时按原顺序
            console.log(`📍 第一轮: ${firstRoundTeams.length}支队伍 → ${firstRoundTeams.length / 2}场比赛`);
            return teams.map((team, index) => ({ ...team, seedNumber: index + 1 }));
            for (let i = 0; i < firstRoundTeams.length; i += 2) {
                'ranking';
                const teamA = firstRoundTeams[i]; // 基于队伍名称排序（实际应该基于历史成绩）
                const teamB = firstRoundTeams[i + 1];
                const rankedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
                return rankedTeams.map((team, index) => ({ ...team, seedNumber: index + 1 }));
                const match = await prisma.match.create({
                    data: { case: 'random',
                        matchType: teamA.type, default: tournamentId, // 随机打乱顺序
                        roundId: firstRound.id, const: shuffled = [...teams].sort(() => Math.random() - 0.5),
                        round: firstRound.roundNumber, return: shuffled.map((team, index) => ({ ...team, seedNumber: null })),
                        treePosition: Math.floor(i / 2), },
                    matchNumber: `R${firstRound.roundNumber}-M${Math.floor(i / 2) + 1}`,
                }, teamAId, teamA.id, teamBId, teamB.id); /**
        
                status: 'scheduled' * 生成轮次名称
        
              } */
            }
            export function generateRoundName(roundNumber, totalRounds) {
                const remainingRounds = totalRounds - roundNumber + 1;
                allMatches.push(match);
                console.log(`✅ 第一轮比赛${Math.floor(i / 2) + 1}: ${teamA.name} vs ${teamB.name}`);
                if (remainingRounds === 1)
                    return '决赛';
            }
            if (remainingRounds === 2)
                return '半决赛';
            if (remainingRounds === 3)
                return '四分之一决赛';
            // 第二轮及后续：标准的二分法  if (remainingRounds === 4) return '八分之一决赛'
            let currentRoundTeamCount = firstRoundTeams.length / 2 + byeTeams.length; // 第一轮胜者数 + 轮空数  
            return `第${roundNumber}轮`;
            for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) { }
            const round = rounds[roundIndex];
            const matchesInRound = currentRoundTeamCount / 2; /**
        
             * 生成比赛记录和赛程树 - 正确的淘汰赛逻辑
        
            console.log(`📍 第${round.roundNumber}轮: ${currentRoundTeamCount}支队伍 → ${matchesInRound}场比赛`) */
            for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
                tournamentId: number,
                ;
                const match = await prisma.match.create({ rounds: any[],
                    data: { teams: (client_1.Team & { seedNumber: number | null })[],
                        matchType: firstRoundTeams[0]?.type || 'MEN_DOUBLE', totalSlots: number,
                        tournamentId, } }), Promise;
                ({
                    roundId: round.id,
                    round: round.roundNumber, const: teamCount = teams.length,
                    treePosition: matchIndex, const: allMatches, any, []:  = [],
                    matchNumber: `R${round.roundNumber}-M${matchIndex + 1}`,
                    teamAId: null, // 待定胜者  console.log(`🏆 生成标准单淘汰赛: ${teamCount}支队伍`)
                    teamBId: null, // 待定胜者  
                    status: 'pending' // 计算淘汰赛结构
                });
                const P = Math.pow(2, Math.ceil(Math.log2(teamCount))); // 最小2的幂次
            }
            const byeCount = P - teamCount; // 轮空队伍数
            const firstRoundMatches = (teamCount - byeCount) / 2; // 第一轮比赛数
            allMatches.push(match);
            console.log(`✅ 第${round.roundNumber}轮比赛${matchIndex + 1}: 待定 vs 待定`);
            console.log(`📊 赛制结构: P=${P}, 轮空=${byeCount}支, 第一轮=${firstRoundMatches}场比赛`);
        }
        // 分配队伍：前面的队伍参加第一轮，后面的队伍轮空
        // 下一轮的队伍数 = 当前轮的比赛数  const firstRoundTeams = teams.slice(0, firstRoundMatches * 2)
        currentRoundTeamCount = matchesInRound;
        const byeTeams = teams.slice(firstRoundMatches * 2);
    };
console.log(`👥 队伍分配: 第一轮${firstRoundTeams.length}支, 轮空${byeTeams.length}支`);
// 设置parentId关系  
await setParentIdRelationships(allMatches); // 第一轮：创建实际比赛
if (firstRoundMatches > 0) {
    console.log(`📊 比赛生成汇总:`);
    const firstRound = rounds[0];
    const summary = allMatches.reduce((acc, match) => {
        if (!acc[match.round])
            acc[match.round] = 0;
        for (let i = 0; i < firstRoundMatches; i++) {
            acc[match.round]++;
            const teamA = firstRoundTeams[i * 2];
            return acc;
            const teamB = firstRoundTeams[i * 2 + 1];
        }
        { }
    });
    const match = await prisma.match.create({
        for(, [round, count], of, Object) { }, : .entries(summary)
    }), { data: { console, log } };
    (`   第${round}轮: ${count}场比赛`);
    matchType: teamA?.type || 'MIX_DOUBLE',
    ;
}
tournamentId,
    roundId;
firstRound.id,
;
return allMatches;
round: firstRound.roundNumber,
;
treePosition: i,
    matchNumber;
`R${firstRound.roundNumber}-M${i + 1}`,
    /**          teamAId: teamA?.id || null,
    
     * 设置parentId关系          teamBId: teamB?.id || null,
    
     */ status;
'scheduled',
    async function setParentIdRelationships(matches) {
        parentId: null;
        console.log('🔗 开始设置parentId关系');
    },
    include;
{
    // 按轮次分组          teamA: true,
    const matchesByRound = matches.reduce((acc, match) => {
        teamB: true,
        ;
        if (!acc[match.round])
            acc[match.round] = [];
        tournament: true,
            acc[match.round].push(match);
        tournamentRound: true;
        return acc;
    });
}
{ }
// 为每个比赛设置parentId      allMatches.push(match)
for (const roundNum in matchesByRound) {
    console.log(`✅ 第一轮比赛${i + 1}: ${teamA?.name} vs ${teamB?.name}`);
    const round = parseInt(roundNum);
}
const nextRound = round + 1;
if (matchesByRound[nextRound]) { // 第二轮：混合比赛（第一轮胜者 + 轮空队伍）
    const currentRoundMatches = matchesByRound[round];
    const secondRound = rounds[1];
    const nextRoundMatches = matchesByRound[nextRound];
    const secondRoundTeamCount = firstRoundMatches + byeTeams.length; // 第一轮胜者 + 轮空队伍
    const secondRoundMatches = secondRoundTeamCount / 2;
    for (let i = 0; i < currentRoundMatches.length; i++) {
        const currentMatch = currentRoundMatches[i], console, log;
        (`🔄 第二轮: ${secondRoundMatches}场比赛, ${secondRoundTeamCount}支队伍 (${firstRoundMatches}个第一轮胜者 + ${byeTeams.length}支轮空队伍)`);
        const nextMatchIndex = Math.floor(i / 2);
        const nextMatch = nextRoundMatches[nextMatchIndex];
        for (let i = 0; i < secondRoundMatches; i++) {
            let teamAId = null;
            if (nextMatch) {
                let teamBId = null;
                await prisma.match.update({ let, status = 'pending',
                    where: { id: currentMatch.id },
                    data: { parentId: nextMatch.id } // 确定比赛的两个参与者
                });
                if (i < firstRoundMatches) {
                    // 混合比赛：第一轮胜者 vs 轮空队伍
                    console.log(`🔗 第${round}轮比赛${currentMatch.id} -> 第${nextRound}轮比赛${nextMatch.id}`);
                    const byeTeam = byeTeams[i];
                }
            }
            teamAId = null; // 第一轮胜者（待定）
        }
        teamBId = byeTeam?.id || null; // 轮空队伍（确定）
    }
    console.log(`🔀 第二轮混合比赛${i + 1}: 第一轮比赛${i + 1}胜者 vs ${byeTeam?.name}`);
    console.log('✅ parentId关系设置完成');
}
else {
} // 纯轮空比赛：轮空队伍 vs 轮空队伍
const byeTeamA = byeTeams[firstRoundMatches + (i - firstRoundMatches) * 2];
/**      const byeTeamB = byeTeams[firstRoundMatches + (i - firstRoundMatches) * 2 + 1]

 * 生成队伍排种顺序

 */ teamAId = byeTeamA?.id || null;
function generateSeeding(teams, method) {
    teamBId = byeTeamB?.id || null;
    switch (method) {
    }
    status = 'scheduled'; // 可以立即进行
    'manual';
    return teams.map((team, index) => ({ ...team, seedNumber: index + 1 }));
    console.log(`⚡ 第二轮直接比赛${i + 1}: ${byeTeamA?.name} vs ${byeTeamB?.name}`);
}
'ranking';
const rankedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
const match = await prisma.match.create({
    return: rankedTeams.map((team, index) => ({ ...team, seedNumber: index + 1 })), data: {
        matchType: teams[0]?.type || 'MIX_DOUBLE',
        case: 'random', tournamentId,
        default: roundId, secondRound, : .id,
        const: shuffled = [...teams].sort(() => Math.random() - 0.5), round: secondRound.roundNumber,
        return: shuffled.map((team) => ({ ...team })), treePosition: i,
    }, matchNumber: `R${secondRound.roundNumber}-M${i + 1}`,
}, teamAId, teamBId);
function generateRoundName(roundNumber, totalRounds) {
    include: {
        const remainingRounds = totalRounds - roundNumber + 1, teamA, teamB;
        if (remainingRounds === 1)
            return '决赛';
        tournament: true,
        ;
        if (remainingRounds === 2)
            return '半决赛';
        tournamentRound: true;
        if (remainingRounds === 3)
            return '四分之一决赛';
    }
    if (remainingRounds === 4)
        return '八分之一决赛';
}
return `第${roundNumber}轮`;
allMatches.push(match);
// 为第一轮比赛设置 parentId 指向对应的第二轮比赛
const firstRoundMatches_array = allMatches.filter(m => m.round === 1);
const secondRoundMatches_array = allMatches.filter(m => m.round === 2);
for (let i = 0; i < firstRoundMatches_array.length; i++) {
    const firstRoundMatch = firstRoundMatches_array[i];
    const correspondingSecondRoundMatch = secondRoundMatches_array[i]; // 第i个第一轮比赛对应第i个第二轮比赛
    if (correspondingSecondRoundMatch) {
        await prisma.match.update({
            where: { id: firstRoundMatch.id },
            data: { parentId: correspondingSecondRoundMatch.id }
        });
        console.log(`🔗 第一轮比赛${i + 1} (ID: ${firstRoundMatch.id}) -> 第二轮比赛${i + 1} (ID: ${correspondingSecondRoundMatch.id})`);
    }
}
// 第三轮及后续：标准二叉树结构
let currentRoundTeamCount = secondRoundTeamCount;
for (let roundIndex = 2; roundIndex < rounds.length; roundIndex++) {
    const round = rounds[roundIndex];
    const matchesInRound = currentRoundTeamCount / 2;
    console.log(`🏁 第${round.roundNumber}轮: ${matchesInRound}场比赛`);
    for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
        // 找到前一轮的父比赛
        const prevRoundMatches = allMatches.filter(m => m.round === round.roundNumber - 1);
        const parentMatch1 = prevRoundMatches[matchIndex * 2];
        const parentMatch2 = prevRoundMatches[matchIndex * 2 + 1];
        const match = await prisma.match.create({
            data: {
                matchType: teams[0]?.type || 'MIX_DOUBLE',
                tournamentId,
                roundId: round.id,
                round: round.roundNumber,
                treePosition: matchIndex,
                matchNumber: `R${round.roundNumber}-M${matchIndex + 1}`,
                teamAId: null, // 前一轮胜者（待定）
                teamBId: null, // 前一轮胜者（待定）
                status: 'pending',
                parentId: parentMatch1?.id || null // 主要父比赛
            },
            include: {
                teamA: true,
                teamB: true,
                tournament: true,
                tournamentRound: true
            }
        });
        allMatches.push(match);
        // 更新父比赛的parentId指向当前比赛
        if (parentMatch1) {
            await prisma.match.update({
                where: { id: parentMatch1.id },
                data: { parentId: match.id }
            });
        }
        if (parentMatch2) {
            await prisma.match.update({
                where: { id: parentMatch2.id },
                data: { parentId: match.id }
            });
        }
    }
    // 更新下一轮的队伍数量：当前轮比赛数 = 下一轮队伍数
    currentRoundTeamCount = matchesInRound;
    console.log(`🔄 下一轮将有 ${currentRoundTeamCount} 支队伍`);
}
console.log(`🎯 总计生成 ${allMatches.length} 场比赛`);
// 更新轮次的 totalMatches 数量
const matchesByRound = allMatches.reduce((acc, match) => {
    acc[match.round] = (acc[match.round] || 0) + 1;
    return acc;
}, {});
for (const [roundNumber, matchCount] of Object.entries(matchesByRound)) {
    const round = rounds.find(r => r.roundNumber === parseInt(roundNumber));
    if (round) {
        await prisma.tournamentRound.update({
            where: { id: round.id },
            data: { totalMatches: matchCount }
        });
        console.log(`📊 第${roundNumber}轮: ${matchCount}场比赛`);
    }
}
return {
    matches: allMatches,
    bracketTree: [] // 暂时返回空数组，后续可以实现
};
/**
 * 获取赛程的完整结构
 */
async function getTournamentStructure(tournamentId) {
    const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        include: {
            rounds: {
                orderBy: { roundNumber: 'asc' },
                include: {
                    matches: {
                        include: {
                            teamA: true,
                            teamB: true,
                            winner: true,
                            court: true
                        },
                        orderBy: { treePosition: 'asc' }
                    }
                }
            },
            teams: {
                include: { team: true },
                orderBy: { initialPosition: 'asc' }
            }
        }
    });
    if (!tournament)
        return null;
    // 构建赛程树
    const bracketTree = buildBracketTree(tournament.rounds);
    return {
        tournament,
        rounds: tournament.rounds,
        matches: tournament.rounds.flatMap(r => r.matches),
        bracketTree
    };
}
/**
 * 构建赛程树结构
 */
function buildBracketTree(rounds) {
    const nodes = new Map();
    // 创建所有节点
    rounds.forEach(round => {
        round.matches.forEach((match) => {
            const node = {
                id: `match-${match.id}`,
                type: 'match',
                round: round.roundNumber,
                position: match.treePosition,
                teamA: match.teamA,
                teamB: match.teamB,
                matchId: match.id
            };
            nodes.set(node.id, node);
        });
    });
    // 建立父子关系（需要根据赛程树逻辑连接）
    // 这里简化实现，返回按轮次分组的节点
    return Array.from(nodes.values()).sort((a, b) => a.round - b.round || a.position - b.position);
}
/**
 * 更新比赛结果并推进赛程
 */
async function updateMatchResult(matchId, winnerId, scoreA, scoreB, scoreHistory) {
    // 1. 更新比赛结果
    await prisma.match.update({
        where: { id: matchId },
        data: {
            winnerId,
            scoreA,
            scoreB,
            status: 'completed',
            scoreHistory: scoreHistory || null
        }
    });
    // 2. 获取当前比赛信息（用于后续逻辑）
    const match = await prisma.match.findUnique({
        where: { id: matchId },
        include: {
            teamA: true,
            teamB: true
        }
    });
    if (!match)
        return;
    // 3. 查找下一轮的比赛（如果存在）
    if (match.tournamentId && match.treePosition !== null) {
        const nextRound = await prisma.tournamentRound.findFirst({
            where: {
                tournamentId: match.tournamentId,
                roundNumber: match.round + 1
            }
        });
        if (nextRound) {
            const nextMatchPosition = Math.floor(match.treePosition / 2);
            const nextMatch = await prisma.match.findFirst({
                where: {
                    roundId: nextRound.id,
                    treePosition: nextMatchPosition
                }
            });
            if (nextMatch) {
                const isTeamA = match.treePosition % 2 === 0;
                await prisma.match.update({
                    where: { id: nextMatch.id },
                    data: isTeamA
                        ? { teamAId: winnerId }
                        : { teamBId: winnerId }
                });
            }
        }
    }
    // 4. 更新队伍状态（标记失败队伍为淘汰）
    if (match.tournamentId) {
        if (match.teamA && match.teamA.id !== winnerId) {
            await prisma.tournamentTeam.updateMany({
                where: {
                    tournamentId: match.tournamentId,
                    teamId: match.teamA.id
                },
                data: {
                    status: 'eliminated',
                    eliminatedInRound: match.round
                }
            });
        }
        if (match.teamB && match.teamB.id !== winnerId) {
            await prisma.tournamentTeam.updateMany({
                where: {
                    tournamentId: match.tournamentId,
                    teamId: match.teamB.id
                },
                data: {
                    status: 'eliminated',
                    eliminatedInRound: match.round
                }
            });
        }
    }
}
//# sourceMappingURL=tournament.js.map