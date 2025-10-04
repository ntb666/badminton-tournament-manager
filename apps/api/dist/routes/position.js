"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
// 获取队员名字组合显示
const getTeamDisplayName = (team) => {
    if (!team)
        return '待定';
    let displayName = '';
    // 优先显示队员名字组合
    if (team.players) {
        const players = team.players.split(/[,，、]/).map((p) => p.trim()).filter((p) => p);
        if (players.length >= 2) {
            displayName = `${players[0]}/${players[1]}`;
        }
        else if (players.length === 1) {
            displayName = players[0];
        }
    }
    // 如果没有队员信息，fallback到队伍名称
    if (!displayName) {
        displayName = team.name || '待定';
    }
    // 如果是种子选手，添加种子序号
    if (team.seedNumber) {
        displayName += `[${team.seedNumber}]`;
    }
    return displayName;
};
// 计算比赛位置的函数
const calculateAndStorePositions = async (matchType) => {
    try {
        // 构建查询条件
        const whereCondition = {};
        if (matchType) {
            whereCondition.matchType = matchType;
        }
        // 获取所有比赛，按轮次和ID排序
        const matches = await prisma.match.findMany({
            where: whereCondition,
            include: {
                teamA: true,
                teamB: true,
                court: true,
            },
            orderBy: [
                { round: 'asc' },
                { id: 'asc' }
            ]
        });
        if (matches.length === 0) {
            return { success: true, message: '没有找到比赛数据' };
        }
        // 根据matchType过滤比赛并排序
        const filteredMatches = matches.filter(match => {
            if (!matchType)
                return true;
            return match.matchType === matchType;
        });
        // 按轮次分组比赛
        const groupedMatches = filteredMatches.reduce((acc, match) => {
            const roundIndex = match.round - 1;
            if (!acc[roundIndex]) {
                acc[roundIndex] = [];
            }
            acc[roundIndex].push(match);
            return acc;
        }, []);
        // 确保每轮内的比赛也按ID排序
        groupedMatches.forEach(round => {
            round.sort((a, b) => a.id - b.id);
        });
        const positions = {}; // key: matchId, value: [topPosition, isLong]
        const cardHeight = 140;
        const uniformSpacing = 50;
        console.log('=== 开始计算对齐位置 ===');
        console.log('分组比赛数据:', groupedMatches.map((round, index) => ({
            roundIndex: index,
            matchCount: round.length,
            matches: round.map((m) => ({ id: m.id, parentId: m.parentId }))
        })));
        // 先找出第二轮中待定的比赛
        const secondRoundOnePendingMatches = [];
        const secondRoundBothPendingMatches = [];
        if (groupedMatches[1]) {
            groupedMatches[1].forEach((match) => {
                const teamADisplayName = getTeamDisplayName(match.teamA);
                const teamBDisplayName = getTeamDisplayName(match.teamB);
                if (teamADisplayName === '待定' && teamBDisplayName === '待定') {
                    secondRoundBothPendingMatches.push(match);
                }
                else if (teamADisplayName === '待定' || teamBDisplayName === '待定') {
                    secondRoundOnePendingMatches.push(match);
                }
            });
        }
        console.log('🔍 第二轮中有待定队伍的比赛:', secondRoundOnePendingMatches.map((m) => ({
            id: m.id,
            teamA: getTeamDisplayName(m.teamA),
            teamB: getTeamDisplayName(m.teamB)
        })));
        // 获取第一轮中将要显示的比赛
        const firstRoundVisibleMatches = [];
        if (groupedMatches[0]) {
            groupedMatches[0].forEach((match) => {
                const teamADisplayName = getTeamDisplayName(match.teamA);
                const teamBDisplayName = getTeamDisplayName(match.teamB);
                if (teamADisplayName !== '待定' && teamBDisplayName !== '待定') {
                    firstRoundVisibleMatches.push(match);
                }
            });
        }
        console.log('🔍 第一轮中将要显示的比赛:', firstRoundVisibleMatches.map((m) => ({
            id: m.id,
            teamA: getTeamDisplayName(m.teamA),
            teamB: getTeamDisplayName(m.teamB)
        })));
        let isFirstShortFlag = true; // 用于第一轮短比赛的交替位置计算
        // 为每一轮计算位置
        for (let roundIndex = 0; roundIndex < groupedMatches.length; roundIndex++) {
            const round = groupedMatches[roundIndex];
            if (!round)
                continue;
            for (let matchIndex = 0; matchIndex < round.length; matchIndex++) {
                const match = round[matchIndex];
                if (roundIndex === 0) {
                    // 第一轮：特殊处理，与第二轮中有待定队伍的比赛对齐
                    const teamADisplayName = getTeamDisplayName(match.teamA);
                    const teamBDisplayName = getTeamDisplayName(match.teamB);
                    // 只为可见的比赛（双方都不是待定）计算位置
                    if (teamADisplayName !== '待定' && teamBDisplayName !== '待定') {
                        const visibleIndex = firstRoundVisibleMatches.findIndex((m) => m.id === match.id);
                        if (visibleIndex >= 0) {
                            const parentMatch = groupedMatches[1]?.find((m) => m.id === match.parentId);
                            if (parentMatch && groupedMatches[1]) {
                                if (secondRoundOnePendingMatches.some((m) => m.id === parentMatch.id)) {
                                    // 父比赛在 secondRoundOnePendingMatches 中 - 长卡片
                                    const parentIndex = groupedMatches[1].findIndex((m) => m.id === parentMatch.id);
                                    const parentPosition = parentIndex * (cardHeight + uniformSpacing);
                                    positions[match.id] = [parentPosition, true];
                                    console.log(`✓ 第一轮比赛 ${match.id} 与第二轮一方待定比赛 ${parentMatch.id} 对齐: ${parentPosition}px`);
                                }
                                else if (secondRoundBothPendingMatches.some((m) => m.id === parentMatch.id)) {
                                    // 父比赛在 secondRoundBothPendingMatches 中 - 短卡片
                                    const parentIndex = groupedMatches[1].findIndex((m) => m.id === parentMatch.id);
                                    let offset = 0;
                                    if (isFirstShortFlag) {
                                        isFirstShortFlag = false;
                                    }
                                    else {
                                        offset = (cardHeight + uniformSpacing) / 2;
                                        isFirstShortFlag = true;
                                    }
                                    const parentPosition = parentIndex * (cardHeight + uniformSpacing) + offset;
                                    positions[match.id] = [parentPosition, false];
                                    console.log(`✓ 第一轮比赛 ${match.id} 与第二轮双方待定比赛 ${parentMatch.id} 对齐: ${parentPosition}px`);
                                }
                                else {
                                    // 默认逻辑
                                    positions[match.id] = [visibleIndex * (cardHeight + uniformSpacing), true];
                                    console.log(`✓ 第一轮比赛 ${match.id} 使用常规间距: ${visibleIndex} -> ${positions[match.id]}px`);
                                }
                            }
                            else {
                                // 没有父比赛，使用常规间距
                                positions[match.id] = [visibleIndex * (cardHeight + uniformSpacing), true];
                                console.log(`✓ 第一轮比赛 ${match.id} 无父比赛，使用常规间距: ${visibleIndex} -> ${positions[match.id]}px`);
                            }
                        }
                    }
                }
                else if (roundIndex === 1) {
                    // 第二轮：使用统一间距
                    positions[match.id] = [matchIndex * (cardHeight + uniformSpacing), true];
                    console.log(`✓ 第二轮比赛 ${match.id} 统一间距: ${matchIndex * (cardHeight + uniformSpacing)}px`);
                }
                else {
                    // 第三轮及以后：基于前一轮相邻两场比赛对齐到中间位置
                    const prevRound = groupedMatches[roundIndex - 1];
                    if (!prevRound)
                        continue;
                    const firstParentIndex = matchIndex * 2;
                    const secondParentIndex = matchIndex * 2 + 1;
                    if (firstParentIndex < prevRound.length && secondParentIndex < prevRound.length) {
                        const firstParentMatch = prevRound[firstParentIndex];
                        const secondParentMatch = prevRound[secondParentIndex];
                        const firstParentPosition = positions[firstParentMatch.id];
                        const secondParentPosition = positions[secondParentMatch.id];
                        if (firstParentPosition && secondParentPosition) {
                            const centerPosition = (firstParentPosition[0] + secondParentPosition[0] + cardHeight) / 2 - cardHeight / 2;
                            positions[match.id] = [centerPosition, true];
                            console.log(`✓ 第${roundIndex + 1}轮比赛 ${match.id} 中间对齐: ${centerPosition}px`);
                        }
                        else {
                            positions[match.id] = [matchIndex * (cardHeight + uniformSpacing * 2), true];
                            console.log(`⚠ 第${roundIndex + 1}轮比赛 ${match.id} fallback位置: ${matchIndex * (cardHeight + uniformSpacing * 2)}px`);
                        }
                    }
                    else {
                        positions[match.id] = [matchIndex * (cardHeight + uniformSpacing * 2), true];
                        console.log(`⚠ 第${roundIndex + 1}轮比赛 ${match.id} 默认位置: ${matchIndex * (cardHeight + uniformSpacing * 2)}px`);
                    }
                }
            }
        }
        // 将计算的位置存储到数据库
        const updatePromises = Object.entries(positions).map(([matchId, [position, isLong]]) => {
            return prisma.match.update({
                where: { id: parseInt(matchId) },
                data: {
                    uiPositionTop: position,
                    uiIsLongCard: isLong,
                    uiPositionCalculated: true
                }
            });
        });
        await Promise.all(updatePromises);
        console.log('=== 位置已存储到数据库 ===', positions);
        return {
            success: true,
            message: `已计算并存储 ${Object.keys(positions).length} 个比赛的位置信息`,
            positions
        };
    }
    catch (error) {
        console.error('计算位置时出错:', error);
        throw error;
    }
};
// 计算并存储位置的API端点
router.post('/calculate', async (req, res) => {
    try {
        const { matchType } = req.body;
        const result = await calculateAndStorePositions(matchType);
        res.json(result);
    }
    catch (error) {
        console.error('计算位置API错误:', error);
        res.status(500).json({
            success: false,
            message: '计算位置时发生错误',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 重置位置信息的API端点
router.post('/reset', async (req, res) => {
    try {
        const { matchType } = req.body;
        // 重置所有比赛的位置信息
        await prisma.match.updateMany({
            where: matchType ? { matchType } : {},
            data: {
                uiPositionTop: null,
                uiIsLongCard: null,
                uiPositionCalculated: false
            }
        });
        res.json({
            success: true,
            message: '位置信息已重置'
        });
    }
    catch (error) {
        console.error('重置位置API错误:', error);
        res.status(500).json({
            success: false,
            message: '重置位置时发生错误',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
// 获取位置信息的API端点
router.get('/list', async (req, res) => {
    try {
        const { matchType } = req.query;
        // 构建查询条件
        const whereCondition = {
            uiPositionCalculated: true
        };
        if (matchType) {
            whereCondition.matchType = matchType;
        }
        const matches = await prisma.match.findMany({
            where: whereCondition,
            select: {
                id: true,
                round: true,
                uiPositionTop: true,
                uiIsLongCard: true,
                uiPositionCalculated: true
            },
            orderBy: [
                { round: 'asc' },
                { id: 'asc' }
            ]
        });
        res.json({
            success: true,
            positions: matches.reduce((acc, match) => {
                acc[match.id] = [match.uiPositionTop, match.uiIsLongCard];
                return acc;
            }, {})
        });
    }
    catch (error) {
        console.error('获取位置API错误:', error);
        res.status(500).json({
            success: false,
            message: '获取位置时发生错误',
            error: error instanceof Error ? error.message : '未知错误'
        });
    }
});
exports.default = router;
//# sourceMappingURL=position.js.map