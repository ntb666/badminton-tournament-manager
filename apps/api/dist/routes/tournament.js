"use strict";
// tournament.ts - 赛程管理API路由 - 简化版本，使用services/tournament.ts中的统一逻辑// tournament.ts - 赛程管理API路由
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const tournament_1 = require("../services/tournament");
const router = (0, express_1.Router)();
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const prisma = new client_1.PrismaClient();
// 创建新赛程// 创建新赛程
router.post('/create', async (req, res) => {
    router.post('/create', async (req, res) => {
        try {
            try {
                const { name, matchType, teamIds, seedingMethod = 'random' } = req.body;
                const { name, matchType, teamIds, seedingMethod = 'random' } = req.body;
                // 验证输入    // 验证输入
                if (!name || !matchType || !teamIds || teamIds.length < 2) {
                    if (!name || !matchType || !teamIds || teamIds.length < 2) {
                        return res.status(400).json({ return: res.status(400).json({
                                error: '缺少必要参数或队伍数量不足', error: '缺少必要参数或队伍数量不足'
                            }) });
                    }
                }
                // 获取参赛队伍    // 获取参赛队伍
                const teams = await prisma.team.findMany({ const: teams = await prisma.team.findMany({
                        where: { where: {
                                id: { in: teamIds }, id: { in: teamIds },
                                type: matchType, type: matchType
                            } }
                    }) });
                if (teams.length !== teamIds.length) {
                    if (teams.length !== teamIds.length) {
                        return res.status(400).json({ return: res.status(400).json({
                                error: '部分队伍不存在或比赛类型不匹配', error: '部分队伍不存在或比赛类型不匹配'
                            }) });
                    }
                }
                console.log(`🏁 开始创建锦标赛: ${name}, ${teams.length}支队伍`);
                console.log(`🏁 开始创建锦标赛: ${name}, ${teams.length}支队伍`);
                // 使用统一的锦标赛生成服务    // 使用统一的锦标赛生成服务
                const result = await (0, tournament_1.generateTournamentComplete)(teams, matchType, name, seedingMethod);
                const result = await (0, tournament_1.generateTournamentComplete)(teams, matchType, name, seedingMethod);
                res.json({ res, : .json({
                        success: true, success: true,
                        tournament: result.tournament, tournament: result.tournament,
                        rounds: result.rounds, rounds: result.rounds,
                        matchCount: result.matches.length, matchCount: result.matches.length,
                        message: `成功创建赛程，共${result.rounds.length}轮${result.matches.length}场比赛`, message: `成功创建赛程，共${result.rounds.length}轮${result.matches.length}场比赛`
                    }) });
            }
            catch (error) { }
            try { }
            catch (error) {
                console.error('❌ 创建赛程失败:', error);
                console.error('❌ 创建赛程失败:', error);
                res.status(500).json({ res, : .status(500).json({
                        error: '创建赛程失败', error: '创建赛程失败',
                        details: error instanceof Error ? error.message : String(error), details: error instanceof Error ? error.message : String(error)
                    }) });
            }
        }
        finally {
        }
    });
});
exports.default = routerexport;
router;
// 获取赛程详细信息
router.get('/:id', async (req, res) => {
    try {
        const tournamentId = parseInt(req.params.id);
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
        if (!tournament) {
            return res.status(404).json({ error: '赛程不存在' });
        }
        res.json(tournament);
    }
    catch (error) {
        console.error('获取赛程失败:', error);
        res.status(500).json({
            error: '获取赛程失败',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
// 获取所有赛程列表
router.get('/', async (req, res) => {
    try {
        const tournaments = await prisma.tournament.findMany({
            include: {
                _count: {
                    select: {
                        rounds: true,
                        matches: true,
                        teams: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(tournaments);
    }
    catch (error) {
        console.error('获取赛程列表失败:', error);
        res.status(500).json({
            error: '获取赛程列表失败',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
// 更新比赛结果
router.post('/match/:matchId/result', async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId);
        const { winnerId, scoreA, scoreB, scoreHistory } = req.body;
        // 更新比赛结果
        const match = await prisma.match.update({
            where: { id: matchId },
            data: {
                winnerId,
                scoreA,
                scoreB,
                status: 'completed',
                scoreHistory: scoreHistory || null
            },
            include: {
                tournament: true,
                tournamentRound: true
            }
        });
        if (match.tournament) {
            // 查找并更新下一轮比赛
            await updateNextRoundMatch(match);
            // 更新被淘汰队伍的状态
            await updateEliminatedTeams(match, winnerId);
        }
        res.json({
            success: true,
            message: '比赛结果更新成功',
            match
        });
    }
    catch (error) {
        console.error('更新比赛结果失败:', error);
        res.status(500).json({
            error: '更新比赛结果失败',
            details: error instanceof Error ? error.message : String(error)
        });
    }
});
// 辅助函数：生成队伍排种顺序
function generateSeeding(teams, method) {
    switch (method) {
        case 'manual':
            return teams.map((team, index) => ({ ...team, seedNumber: index + 1 }));
        case 'ranking':
            const rankedTeams = [...teams].sort((a, b) => a.name.localeCompare(b.name));
            return rankedTeams.map((team, index) => ({ ...team, seedNumber: index + 1 }));
        case 'random':
        default:
            const shuffled = [...teams].sort(() => Math.random() - 0.5);
            return shuffled.map((team) => ({ ...team }));
    }
}
// 辅助函数：生成轮次名称
function generateRoundName(roundNumber, totalRounds) {
    const remainingRounds = totalRounds - roundNumber + 1;
    if (remainingRounds === 1)
        return '决赛';
    if (remainingRounds === 2)
        return '半决赛';
    if (remainingRounds === 3)
        return '四分之一决赛';
    if (remainingRounds === 4)
        return '八分之一决赛';
    return `第${roundNumber}轮`;
}
// 辅助函数：生成比赛记录
async function generateMatches(tournamentId, rounds, teams, totalSlots) {
    // 创建叶子节点数组
    const leaves = new Array(totalSlots).fill(null);
    teams.forEach((team, index) => {
        leaves[index] = team;
    });
    console.log(`🎯 开始生成比赛: ${teams.length}支队伍, ${totalSlots}个位置`);
    const allMatches = [];
    let currentTeams = leaves;
    for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
        const round = rounds[roundIndex];
        const thisRoundMatches = [];
        console.log(`🔄 第${round.roundNumber}轮: 输入${currentTeams.length}支队伍`);
        for (let i = 0; i < currentTeams.length; i += 2) {
            const teamA = currentTeams[i];
            const teamB = currentTeams[i + 1];
            if (teamA || teamB) {
                const matchNumber = `R${round.roundNumber}-M${Math.floor(i / 2) + 1}`;
                const match = await prisma.match.create({
                    data: {
                        matchType: teamA?.type || teamB?.type || 'MEN_DOUBLE',
                        tournamentId,
                        roundId: round.id,
                        round: round.roundNumber,
                        treePosition: Math.floor(i / 2),
                        matchNumber,
                        teamAId: teamA?.id || null,
                        teamBId: teamB?.id || null,
                        status: teamA && teamB ? 'pending' : 'pending'
                    }
                });
                allMatches.push(match);
                thisRoundMatches.push(match);
                console.log(`✅ 创建比赛: ${matchNumber} - ${teamA?.name || '待定'} vs ${teamB?.name || '待定'}`);
            }
        }
        console.log(`📊 第${round.roundNumber}轮: 生成${thisRoundMatches.length}场比赛`);
        // ❗修复关键逻辑：下一轮应当包含与本轮比赛数量相同的"胜者占位"
        currentTeams = Array.from({ length: thisRoundMatches.length }, () => null);
        console.log(`➡️  下一轮将有${currentTeams.length}支队伍`);
    }
    console.log(`🎉 总计生成${allMatches.length}场比赛`);
    // 设置 parentId 关系
    await setParentIdRelationships(allMatches);
    return allMatches;
}
// 辅助函数：设置parentId关系
async function setParentIdRelationships(matches) {
    console.log('🔗 开始设置parentId关系');
    // 按轮次分组
    const matchesByRound = matches.reduce((acc, match) => {
        if (!acc[match.round])
            acc[match.round] = [];
        acc[match.round].push(match);
        return acc;
    }, {});
    // 为每个比赛设置parentId
    for (const roundNum in matchesByRound) {
        const round = parseInt(roundNum);
        const nextRound = round + 1;
        if (matchesByRound[nextRound]) {
            const currentRoundMatches = matchesByRound[round];
            const nextRoundMatches = matchesByRound[nextRound];
            for (let i = 0; i < currentRoundMatches.length; i++) {
                const currentMatch = currentRoundMatches[i];
                const nextMatchIndex = Math.floor(i / 2);
                const nextMatch = nextRoundMatches[nextMatchIndex];
                if (nextMatch) {
                    await prisma.match.update({
                        where: { id: currentMatch.id },
                        data: { parentId: nextMatch.id }
                    });
                    console.log(`🔗 第${round}轮比赛${currentMatch.id} -> 第${nextRound}轮比赛${nextMatch.id}`);
                }
            }
        }
    }
    console.log('✅ parentId关系设置完成');
} // 辅助函数：更新下一轮比赛
async function updateNextRoundMatch(match) {
    if (!match.tournamentId)
        return;
    const nextRound = await prisma.tournamentRound.findFirst({
        where: {
            tournamentId: match.tournamentId,
            roundNumber: match.round + 1
        }
    });
    if (nextRound && match.treePosition !== null) {
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
                data: isTeamA ?
                    { teamAId: match.winnerId } :
                    { teamBId: match.winnerId }
            });
        }
    }
}
// 辅助函数：更新被淘汰队伍状态
async function updateEliminatedTeams(match, winnerId) {
    if (!match.tournamentId)
        return;
    const loserIds = [match.teamAId, match.teamBId].filter(id => id && id !== winnerId);
    for (const loserId of loserIds) {
        await prisma.tournamentTeam.updateMany({
            where: {
                tournamentId: match.tournamentId,
                teamId: loserId
            },
            data: {
                status: 'eliminated',
                eliminatedInRound: match.round
            }
        });
    }
}
exports.default = router;
//# sourceMappingURL=tournament.js.map