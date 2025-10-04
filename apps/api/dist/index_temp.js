"use strict";
/**
 * 羽毛球赛事管理系统 - API服务器主文件
 *
 * 功能：
 * - 提供RESTful API接口
 * - 支持WebSocket实时通信
 * - 管理比赛、队伍、场地数据
 * - 处理比分更新和晋级逻辑
 *
 * 技术栈：
 * - Express.js: Web框架
 * - Socket.IO: 实时通信
 * - Prisma: 数据库ORM
 * - SQLite: 数据库
 *
 * 系统排序策略说明：
 * ==================
 * 本系统采用统一的排序原则，确保数据展示的一致性和可预测性：
 *
 * 1. 等待队列排序：FIFO原则（先进先出）
 *    - 所有等待分配的比赛按ID升序排列
 *    - 最早创建的比赛优先获得场地分配
 *    - 确保比赛顺序的公平性
 *
 * 2. 赛程树排序：多级排序策略
 *    - 主排序：比赛类型（MEN_DOUBLE → WOMEN_DOUBLE → MIX_DOUBLE）
 *    - 次排序：轮次（第1轮 → 第2轮 → 决赛）
 *    - 末排序：ID（相同条件下按创建时间）
 *
 * 3. 晋级逻辑排序：稳定配对原则
 *    - 已完成比赛按ID升序排列
 *    - 确保下轮比赛配对的稳定性和可预测性
 *
 * 4. 所有列表展示：统一采用ID升序
 *    - 保持界面显示的稳定性
 *    - 便于调试和问题追踪
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ===== 导入依赖包 =====
const express_1 = __importDefault(require("express")); // Express.js Web框架
const cors_1 = __importDefault(require("cors")); // 跨域资源共享中间件
const dotenv_1 = __importDefault(require("dotenv")); // 环境变量管理
const http_1 = require("http"); // Node.js HTTP服务器
const socket_io_1 = require("socket.io"); // Socket.IO实时通信库
const client_1 = require("@prisma/client"); // Prisma数据库ORM客户端
const match_1 = __importDefault(require("./routes/match")); // 比赛管理路由模块
const team_1 = __importDefault(require("./routes/team")); // 队伍管理路由模块
const import_1 = __importDefault(require("./routes/import")); // 报名表导入路由模块
const admin_1 = __importDefault(require("./routes/admin")); // 管理员功能路由模块
const tournament_1 = __importDefault(require("./routes/tournament")); // 赛程管理路由模块
// ===== 系统初始化 =====
dotenv_1.default.config(); // 加载环境变量
const app = (0, express_1.default)(); // 创建Express应用实例
const server = (0, http_1.createServer)(app); // 创建HTTP服务器
const io = new socket_io_1.Server(server, {
    cors: {
        origin: ["http://localhost:3000", "http://localhost:3001"], // 允许主控和场地管理器
        methods: ["GET", "POST", "PUT", "DELETE"] // 允许的HTTP方法
    }
});
const prisma = new client_1.PrismaClient(); // 创建Prisma数据库客户端
// ===== 中间件配置 =====
app.use((0, cors_1.default)()); // 启用跨域资源共享
app.use(express_1.default.json()); // 解析JSON请求体
const PORT = process.env.PORT || 4001; // 服务器端口，默认4001
// ===== 路由注册 =====
// 注册各个功能模块的路由到Express应用
app.use("/api/teams", team_1.default); // 队伍管理相关API路由
app.use("/api/matches", match_1.default); // 比赛管理相关API路由
app.use("/api/tournaments", tournament_1.default); // 赛程管理相关API路由
app.use("/api/import", import_1.default); // 报名表导入相关API路由
app.use("/api/admin", admin_1.default); // 管理员功能相关API路由
// ===== API路由端点 =====
/**
 * 获取实时场地状态
 *
 * 路由：GET /api/courts/status
 * 功能：返回所有场地的当前状态，包括正在进行的比赛信息
 *
 * 响应格式：
 * {
 *   id: number,           // 场地ID
 *   name: string,         // 场地名称
 *   match: {              // 当前比赛信息（如果有）
 *     id: number,         // 比赛ID
 *     teamA: {            // A队信息
 *       name: string,     // 队伍名称
 *       players: string[] // 队员列表
 *     },
 *     teamB: {            // B队信息
 *       name: string,     // 队伍名称
 *       players: string[] // 队员列表
 *     },
 *     scoreA: number,     // A队得分
 *     scoreB: number      // B队得分
 *   } | null              // 无比赛时为null
 * }[]
 */
app.get("/api/courts/status", async (req, res) => {
    try {
        // 查询所有场地，包含未完成的比赛信息
        const courts = await prisma.court.findMany({
            include: {
                matches: {
                    where: {
                        winnerId: null, // 筛选未完成的比赛
                    },
                    include: {
                        teamA: true, // 包含A队详细信息
                        teamB: true, // 包含B队详细信息
                    },
                    take: 1, // 每个场地只取一场比赛
                }
            }
        });
        // 格式化场地状态数据
        const courtStatus = courts.map(court => ({
            id: court.id,
            name: court.name,
            match: court.matches[0] ? {
                id: court.matches[0].id,
                teamA: court.matches[0].teamA ? {
                    name: court.matches[0].teamA.name,
                    players: court.matches[0].teamA.players
                } : null,
                teamB: court.matches[0].teamB ? {
                    name: court.matches[0].teamB.name,
                    players: court.matches[0].teamB.players
                } : null,
                scoreA: court.matches[0].scoreA || 0, // A队得分，默认0
                scoreB: court.matches[0].scoreB || 0, // B队得分，默认0
                status: court.matches[0].scoreA !== null && court.matches[0].scoreB !== null ? 'playing' : 'assigned', // 比赛状态
                matchType: court.matches[0].matchType, // 比赛类型
                round: court.matches[0].round, // 比赛轮次
                scoreHistory: court.matches[0].scoreHistory, // 比分历史记录
                gameSettings: court.matches[0].gameSettings // 比赛设置
            } : null // 无比赛时返回null
        }));
        res.json(courtStatus); // 返回场地状态数据
    }
    catch (error) {
        res.status(500).json({ error: error }); // 返回错误信息
    }
});
/**
 * 获取赛程树结构
 *
 * 路由：GET /api/schedule/tree
 * 功能：返回按比赛类型和轮次组织的赛程树数据
 *
 * 数据组织和排序策略：
 * 1. 主排序：按比赛类型升序（MEN_DOUBLE → WOMEN_DOUBLE → MIX_DOUBLE）
 * 2. 次排序：按轮次升序（第1轮 → 第2轮 → 决赛）
 * 3. 末排序：按ID升序（相同轮次内按创建时间排序）
 *
 * 这种多级排序确保：
 * - 比赛类型分组清晰
 * - 轮次progression逻辑正确
 * - 同轮次内比赛顺序稳定
 *
 * 响应格式：
 * {
 *   [matchType]: {      // 比赛类型
 *     [round]: {         // 轮次（如1、2、3）
 *       matches: []      // 该轮次的比赛列表
 *     }
 *   }
 * }
 */
app.get("/api/schedule/tree", async (req, res) => {
    try {
        const { matchType } = req.query;
        // 构建查询条件
        const whereCondition = matchType ? { matchType: matchType } : {};
        // 优先从Tournament表获取最新的赛程数据
        const tournaments = await prisma.tournament.findMany({
            where: whereCondition,
            include: {
                rounds: {
                    include: {
                        matches: {
                            include: {
                                teamA: true,
                                teamB: true,
                                court: true
                            }
                        }
                    },
                    orderBy: { roundNumber: 'asc' }
                },
                teams: {
                    include: {
                        team: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        if (tournaments.length > 0) {
            // 使用Tournament数据
            const allMatches = [];
            const allTeams = [];
            tournaments.forEach((tournament) => {
                // 收集所有比赛
                if (tournament.rounds) {
                    tournament.rounds.forEach((round) => {
                        if (round.matches) {
                            round.matches.forEach((match) => {
                                allMatches.push({
                                    ...match,
                                    matchType: tournament.matchType,
                                    round: round.roundNumber
                                });
                            });
                        }
                    });
                }
                // 收集所有队伍
                if (tournament.teams) {
                    tournament.teams.forEach((tournamentTeam) => {
                        if (tournamentTeam.team) {
                            allTeams.push({
                                ...tournamentTeam.team,
                                seedPosition: tournamentTeam.seedPosition
                            });
                        }
                    });
                }
            });
            return res.json({
                matches: allMatches,
                teams: allTeams
            });
        }
        // 回退到原有的Match表数据（兼容性）
        const matches = await prisma.match.findMany({
            where: whereCondition,
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
                court: true // 包含场地信息
            },
            orderBy: [
                { matchType: 'asc' }, // 1级：按比赛类型升序（类型分组）
                { round: 'asc' }, // 2级：按轮次升序（时间顺序）
                { id: 'asc' } // 3级：按ID升序（创建顺序）
            ]
        });
        // 获取相关队伍
        const teamWhereCondition = matchType ? { type: matchType } : {};
        const teams = await prisma.team.findMany({
            where: teamWhereCondition
        });
        res.json({
            matches,
            teams
        });
    }
    catch (error) {
        console.error('Error fetching schedule tree:', error);
        res.status(500).json({ error: 'Failed to fetch schedule tree' });
    }
});
/**
 * 生成赛程树
 * 路由：POST /api/schedule/generate-bracket
 * 参数：matchType, seedPlayers
 */
app.post("/api/schedule/generate-bracket", async (req, res) => {
    try {
        const { matchType, seedPlayers } = req.body;
        if (!matchType) {
            return res.status(400).json({ error: '请指定比赛类型' });
        }
        // 1. 获取该比赛类型的所有队伍
        const allTeams = await prisma.team.findMany({
            where: { type: matchType },
            orderBy: { id: 'asc' }
        });
        if (allTeams.length < 2) {
            return res.status(400).json({
                error: `${getMatchTypeName(matchType)}队伍数量不足，至少需要2支队伍`
            });
        }
        // 2. 检查是否已有该类型的赛程，如果有则先清空
        const existingTournament = await prisma.tournament.findFirst({
            where: { matchType }
        });
        if (existingTournament) {
            // 删除相关的所有数据
            await prisma.match.deleteMany({
                where: { matchType }
            });
            await prisma.tournamentTeam.deleteMany({
                where: { tournamentId: existingTournament.id }
            });
            await prisma.tournamentRound.deleteMany({
                where: { tournamentId: existingTournament.id }
            });
            await prisma.tournament.delete({
                where: { id: existingTournament.id }
            });
        }
        // 3. 使用正确的锦标赛生成算法
        console.log(`🎯 开始生成正确的锦标赛: ${allTeams.length}支队伍`);
        // 计算正确的锦标赛规模
        const P = allTeams.length; // 实际队伍数
        const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(P))); // 下一个2的幂次
        const byeCount = nextPowerOf2 - P; // 轮空数量
        const firstRoundTeams = P - byeCount; // 第一轮参赛队伍数
        const firstRoundMatches = firstRoundTeams / 2; // 第一轮比赛数
        const totalRounds = Math.log2(nextPowerOf2);
        console.log(`📋 锦标赛结构分析:`);
        console.log(`   - 实际队伍: ${P}支`);
        console.log(`   - 扩展到: ${nextPowerOf2}个位置`);
        console.log(`   - 轮空队伍: ${byeCount}支`);
        console.log(`   - 第一轮: ${firstRoundMatches}场比赛，${firstRoundTeams}支队伍`);
        console.log(`   - 总轮数: ${totalRounds}轮`);
        // 4. 创建Tournament记录
        const tournament = await prisma.tournament.create({
            data: {
                name: `${getMatchTypeName(matchType)}淘汰赛`,
                matchType: matchType,
                status: 'active',
                totalRounds,
                totalTeams: P,
                tournamentType: 'single_elimination',
                seedingMethod: 'random'
            }
        });
        console.log(`✅ 创建锦标赛记录: ID=${tournament.id}`);
        // 5. 随机打乱队伍
        const shuffledTeams = [...allTeams].sort(() => Math.random() - 0.5);
        // 分配队伍：第一轮参赛 vs 轮空
        const firstRoundTeamsList = shuffledTeams.slice(0, firstRoundTeams);
        const byeTeams = shuffledTeams.slice(firstRoundTeams);
        console.log(`📝 队伍分配:`);
        console.log(`   - 第一轮参赛: ${firstRoundTeamsList.length}支`);
        console.log(`   - 轮空晋级: ${byeTeams.length}支`);
        // 6. 创建轮次记录
        const rounds = [];
        for (let i = 0; i < totalRounds; i++) {
            const roundNumber = i + 1;
            let roundName = `第${roundNumber}轮`;
            if (roundNumber === totalRounds)
                roundName = '决赛';
            else if (roundNumber === totalRounds - 1)
                roundName = '半决赛';
            else if (roundNumber === totalRounds - 2)
                roundName = '四分之一决赛';
            else if (roundNumber === totalRounds - 3)
                roundName = '八分之一决赛';
            const round = await prisma.tournamentRound.create({
                data: {
                    tournamentId: tournament.id,
                    roundNumber,
                    roundName,
                    totalMatches: 0, // 先设为0，后面更新
                    status: 'pending'
                }
            });
            rounds.push(round);
        }
        console.log(`✅ 创建${rounds.length}个轮次记录`);
        // 7. 生成比赛 - 正确的逻辑
        const allMatches = [];
        // 第一轮：只为非轮空队伍创建比赛
        const firstRound = rounds[0];
        if (firstRound) {
            console.log(`📍 第一轮: ${firstRoundTeamsList.length}支队伍 → ${firstRoundTeams / 2}场比赛`);
            for (let i = 0; i < firstRoundTeamsList.length; i += 2) {
                const teamA = firstRoundTeamsList[i];
                const teamB = firstRoundTeamsList[i + 1];
                const match = await prisma.match.create({
                    data: {
                        matchType: teamA.type,
                        tournamentId: tournament.id,
                        roundId: firstRound.id,
                        round: firstRound.roundNumber,
                        treePosition: Math.floor(i / 2),
                        matchNumber: `R${firstRound.roundNumber}-M${Math.floor(i / 2) + 1}`,
                        teamAId: teamA.id,
                        teamBId: teamB.id,
                        status: 'scheduled'
                    }
                });
                allMatches.push(match);
                console.log(`✅ 第一轮比赛${Math.floor(i / 2) + 1}: ${teamA.name} vs ${teamB.name}`);
            }
        }
        // 第二轮及后续：标准的二分法
        let currentRoundTeamCount = firstRoundTeams / 2 + byeTeams.length; // 第一轮胜者数 + 轮空数
        for (let roundIndex = 1; roundIndex < rounds.length; roundIndex++) {
            const round = rounds[roundIndex];
            if (round) {
                const matchesInRound = currentRoundTeamCount / 2;
                console.log(`📍 第${round.roundNumber}轮: ${currentRoundTeamCount}支队伍 → ${matchesInRound}场比赛`);
                for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
                    const match = await prisma.match.create({
                        data: {
                            matchType: matchType,
                            tournamentId: tournament.id,
                            roundId: round.id,
                            round: round.roundNumber,
                            treePosition: matchIndex,
                            matchNumber: `R${round.roundNumber}-M${matchIndex + 1}`,
                            teamAId: null, // 待定胜者
                            teamBId: null, // 待定胜者
                            status: 'pending'
                        }
                    });
                    allMatches.push(match);
                    console.log(`✅ 第${round.roundNumber}轮比赛${matchIndex + 1}: 待定 vs 待定`);
                }
                // 下一轮的队伍数 = 当前轮的比赛数
                currentRoundTeamCount = matchesInRound;
            }
        }
        // 8. 设置parentId关系
        const matchesByRound = allMatches.reduce((acc, match) => {
            if (!acc[match.round])
                acc[match.round] = [];
            acc[match.round].push(match);
            return acc;
        }, {});
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
        // 9. 更新轮次的实际比赛数量
        for (const round of rounds) {
            const actualMatches = matchesByRound[round.roundNumber]?.length || 0;
            await prisma.tournamentRound.update({
                where: { id: round.id },
                data: { totalMatches: actualMatches }
            });
        }
        console.log(`📊 比赛生成汇总:`);
        for (const [round, matches] of Object.entries(matchesByRound)) {
            console.log(`   第${round}轮: ${matches.length}场比赛`);
        }
        console.log(`🎉 锦标赛生成完成！总计${allMatches.length}场比赛`);
        // 发送WebSocket通知更新
        io.emit('scheduleUpdate', {
            action: 'generate',
            matchType,
            matches: allMatches.length,
            tournamentId: tournament.id
        });
        // 发送场地状态更新通知
        io.emit('court-status-update');
        io.emit('pending-matches-update');
        res.json({
            success: true,
            message: `成功生成${getMatchTypeName(matchType)}赛程`,
            tournament,
            rounds: rounds.length,
            matches: allMatches.length,
            matchCount: allMatches.length
        });
    }
    catch (error) {
        console.error('Error generating bracket:', error);
        res.status(500).json({ error: error.message || '生成赛程失败' });
    }
});
/**
 * 自动分配比赛到可用场地
 */
async function autoAssignMatchesToCourts() {
    try {
        // 获取所有可用场地
        const availableCourts = await prisma.court.findMany({
            where: {
                matches: {
                    none: {
                        winnerId: null // 没有进行中的比赛
                    }
                }
            }
        });
        // 获取等待分配的比赛（按优先级排序）
        const pendingMatches = await prisma.match.findMany({
            where: {
                courtId: null,
                winnerId: null
            },
            orderBy: {
                id: 'asc' // FIFO原则
            }
        });
        console.log(`找到${availableCourts.length}个可用场地，${pendingMatches.length}场待分配比赛`);
        // 分配比赛到场地
        const assignmentPromises = [];
        for (let i = 0; i < Math.min(availableCourts.length, pendingMatches.length); i++) {
            const court = availableCourts[i];
            const match = pendingMatches[i];
            if (court && match) {
                console.log(`分配比赛 ${match.id} 到场地 ${court.id} (${court.name})`);
                assignmentPromises.push(prisma.match.update({
                    where: { id: match.id },
                    data: { courtId: court.id }
                }));
            }
        }
        // 批量执行分配
        if (assignmentPromises.length > 0) {
            await Promise.all(assignmentPromises);
            console.log(`成功分配${assignmentPromises.length}场比赛到场地`);
        }
    }
    catch (error) {
        console.error('自动分配比赛到场地失败:', error);
    }
}
/**
 * 清空赛程
 * 路由：POST /api/schedule/clear-bracket
 * 参数：matchType
 */
app.post("/api/schedule/clear-bracket", async (req, res) => {
    try {
        const { matchType } = req.body;
        if (!matchType) {
            return res.status(400).json({ error: '请指定比赛类型' });
        }
        const { clearTournament } = require('./services/schedule');
        const result = await clearTournament(matchType);
        // 发送WebSocket通知更新
        io.emit('scheduleUpdate', {
            action: 'clear',
            matchType
        });
        // 发送场地状态更新通知
        io.emit('court-status-update');
        io.emit('pending-matches-update');
        res.json(result);
    }
    catch (error) {
        console.error('Error clearing bracket:', error);
        res.status(500).json({ error: error.message || '清空赛程失败' });
    }
});
/**
 * 获取比赛类型中文名称
 *
 * @param matchType 比赛类型英文标识
 * @returns 比赛类型中文名称
 */
function getMatchTypeName(matchType) {
    switch (matchType) {
        case 'MEN_DOUBLE': return '男子双打';
        case 'WOMEN_DOUBLE': return '女子双打';
        case 'MIX_DOUBLE': return '混合双打';
        default: return matchType;
    }
}
/**
 * 生成淘汰赛bracket结构
 *
 * 功能：将比赛数据按轮次组织成对阵表结构
 *
 * @param matches 比赛列表
 * @returns 按轮次组织的对阵表数据
 */
function generateTournamentBracket(matches) {
    if (matches.length === 0)
        return []; // 空数据直接返回
    // 按轮次分组比赛数据
    const roundsMap = matches.reduce((acc, match) => {
        const round = match.round;
        if (!acc[round]) {
            acc[round] = []; // 初始化轮次数组
        }
        acc[round].push({
            id: match.id, // 比赛ID
            teamA: match.teamA ? match.teamA.name : null, // A队名称
            teamB: match.teamB ? match.teamB.name : null, // B队名称
            scoreA: match.scoreA, // A队得分
            scoreB: match.scoreB, // B队得分
            winnerId: match.winnerId, // 获胜队伍ID
            status: match.winnerId ? 'completed' : (match.scoreA !== null ? 'playing' : 'pending'), // 比赛状态
            scoreHistory: match.scoreHistory, // 比分历史
            gameSettings: match.gameSettings // 比赛设置
        });
        return acc;
    }, {});
    // 计算需要的轮次数（基于参赛队伍数）
    const teamCount = matches.filter(m => m.round === 1).length * 2; // 第一轮比赛数*2 = 队伍数
    const maxRounds = Math.ceil(Math.log2(teamCount)); // 淘汰赛需要的轮次数
    // 补充缺失的轮次（用于显示完整的bracket结构）
    for (let round = 1; round <= maxRounds; round++) {
        if (!roundsMap[round]) {
            roundsMap[round] = []; // 初始化轮次数组
        }
        // 如果是第一轮之后的轮次，需要计算应有的比赛数量
        if (round > 1) {
            const prevRoundMatches = roundsMap[round - 1].length; // 上一轮比赛数
            const expectedMatches = Math.ceil(prevRoundMatches / 2); // 本轮应有比赛数
            // 补充缺失的比赛占位符
            while (roundsMap[round].length < expectedMatches) {
                roundsMap[round].push({
                    id: `placeholder-${round}-${roundsMap[round].length}`, // 占位符ID
                    teamA: null, // 待定A队
                    teamB: null, // 待定B队
                    scoreA: null, // 待定得分
                    scoreB: null, // 待定得分
                    winnerId: null, // 待定获胜者
                    status: 'pending' // 等待状态
                });
            }
        }
    }
    // 转换为bracket格式并排序
    const rounds = Object.entries(roundsMap)
        .sort(([a], [b]) => parseInt(a) - parseInt(b)) // bracket排序：按轮次编号升序（确保时间顺序正确）
        .map(([roundNum, roundMatches]) => ({
        round: parseInt(roundNum), // 轮次编号
        roundName: getRoundName(parseInt(roundNum), maxRounds), // 轮次名称
        matches: roundMatches // 该轮次的比赛列表
    }));
    return rounds; // 返回完整的对阵表结构
}
/**
 * 获取轮次名称
 *
 * @param roundNum 当前轮次编号
 * @param totalRounds 总轮次数
 * @returns 轮次的中文名称
 */
function getRoundName(roundNum, totalRounds) {
    const remaining = totalRounds - roundNum + 1; // 剩余轮次数
    if (remaining === 1)
        return '决赛';
    if (remaining === 2)
        return '半决赛';
    if (remaining === 3)
        return '四分之一决赛';
    if (remaining === 4)
        return '八分之一决赛';
    return `第${roundNum}轮`;
}
/**
 * 处理晋级逻辑
 *
 * 功能：当比赛完成时，自动安排获胜队伍进入下一轮比赛
 *
 * @param completedMatch 已完成的比赛信息
 */
async function handleAdvancement(completedMatch) {
    try {
        const { winnerId, matchType, round, id: matchId } = completedMatch;
        // 查找同一轮次、同一比赛类型的所有已完成比赛
        const sameRoundMatches = await prisma.match.findMany({
            where: {
                matchType, // 相同比赛类型
                round, // 相同轮次
                winnerId: { not: null } // 已完成的比赛
            },
            include: {
                teamA: true, // 包含队伍信息
                teamB: true
            },
            orderBy: {
                id: 'asc' // 晋级排序：按ID升序（确保配对顺序稳定和可预测）
            }
        });
        // 检查是否有足够的比赛完成来创建下一轮
        // 淘汰赛中，每2场比赛产生1场下一轮比赛
        const completedPairs = Math.floor(sameRoundMatches.length / 2);
        // 查找下一轮已存在的比赛数量
        const nextRoundMatches = await prisma.match.findMany({
            where: {
                matchType,
                round: round + 1
            }
        });
        // 计算需要创建多少场下一轮比赛
        const needToCreate = completedPairs - nextRoundMatches.length;
        if (needToCreate > 0) {
            // 按顺序配对获胜者
            for (let i = 0; i < needToCreate; i++) {
                const pairStartIndex = (nextRoundMatches.length + i) * 2;
                if (pairStartIndex + 1 < sameRoundMatches.length) {
                    const match1 = sameRoundMatches[pairStartIndex];
                    const match2 = sameRoundMatches[pairStartIndex + 1];
                    if (match1 && match2 && match1.winnerId && match2.winnerId) {
                        // 获取获胜队伍
                        const teamA = match1.winnerId === match1.teamAId ? match1.teamA : match1.teamB;
                        const teamB = match2.winnerId === match2.teamAId ? match2.teamA : match2.teamB;
                        if (teamA && teamB) {
                            // 创建下一轮比赛
                            const nextMatch = await prisma.match.create({
                                data: {
                                    matchType,
                                    round: round + 1,
                                    teamAId: teamA.id,
                                    teamBId: teamB.id,
                                    // parentId 可以用来追踪比赛来源，暂时不设置
                                },
                                include: {
                                    teamA: true,
                                    teamB: true
                                }
                            });
                            console.log(`Created next round match: ${teamA.name} vs ${teamB.name} (Round ${round + 1})`);
                            // 通知所有客户端有新比赛创建
                            io.emit('match-created', {
                                match: nextMatch,
                                round: round + 1,
                                matchType
                            });
                        }
                    }
                }
            }
        }
    }
    catch (error) {
        console.error('Error handling advancement:', error);
    }
}
/**
 * 获取比赛队列
 *
 * 路由：GET /api/matches/queue
 * 功能：返回所有已分配场地但尚未开始的比赛
 *
 * 队列排序规则：按比赛ID升序排列（创建时间先后顺序）
 * - 优先显示最早创建的比赛
 * - 保证比赛按照原定计划顺序进行
 * - 为每个比赛分配队列位置编号（#1, #2, #3...）
 *
 * 响应格式：
 * {
 *   id: number,              // 比赛ID
 *   queuePosition: number,   // 队列位置数字：1, 2, 3...
 *   queueLabel: string,      // 队列标签："#1", "#2", "#3"... (前端直接显示)
 *   teamA: string,           // A队名称
 *   teamB: string,           // B队名称
 *   courtId: number,         // 场地ID
 *   matchType: string,       // 比赛类型
 *   round: number,           // 比赛轮次
 *   scheduledAt: string      // 排期时间
 * }[]
 */
app.get("/api/matches/queue", async (req, res) => {
    try {
        // 查询已分配场地但尚未开始的比赛
        const queueMatches = await prisma.match.findMany({
            where: {
                scoreA: null, // A队得分为空（未开始）
                scoreB: null, // B队得分为空（未开始）
                courtId: {
                    not: null // 已分配场地
                }
            },
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
            },
            orderBy: {
                id: 'asc' // 队列排序：按ID升序排列（优先显示最早创建的比赛）
            }
        });
        // 格式化队列数据，添加队列位置标识
        const queue = queueMatches.map((match, index) => ({
            id: match.id, // 比赛ID
            queuePosition: index + 1, // 队列位置：#1, #2, #3... (前端显示用)
            queueLabel: `#${index + 1}`, // 队列标签：便于前端直接显示
            teamA: match.teamA?.name || 'TBD', // A队名称，如果为空则显示TBD
            teamB: match.teamB?.name || 'TBD', // B队名称，如果为空则显示TBD
            courtId: match.courtId, // 场地ID
            matchType: match.matchType, // 比赛类型
            round: match.round, // 比赛轮次
            scheduledAt: new Date().toLocaleTimeString() // 排期时间（临时）
        }));
        res.json(queue); // 返回队列数据
    }
    catch (error) {
        res.status(500).json({ error: error });
    }
});
/**
 * 获取特定场地的当前比赛
 *
 * 路由：GET /api/courts/:courtId/current-match
 * 功能：返回指定场地正在进行的比赛信息
 *
 * 参数：
 * - courtId: 场地ID（路径参数）
 *
 * 响应格式：比赛对象或null
 */
app.get("/api/courts/:courtId/current-match", async (req, res) => {
    try {
        const courtId = parseInt(req.params.courtId); // 解析场地ID
        // 查找该场地的当前比赛
        const match = await prisma.match.findFirst({
            where: {
                courtId: courtId, // 指定场地
                winnerId: null, // 未完成的比赛
            },
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
                court: true, // 包含场地信息
            },
            orderBy: {
                id: 'asc' // 按ID升序排列
            }
        });
        res.json(match); // 返回比赛数据
    }
    catch (error) {
        res.status(500).json({ error: error });
    }
});
/**
 * 更新比赛比分和历史
 *
 * 路由：PUT /api/matches/:matchId/score
 * 功能：更新比赛得分，计算获胜者，处理比赛完成逻辑
 *
 * 参数：
 * - matchId: 比赛ID（路径参数）
 *
 * 请求体：
 * - scoreA: A队总得分
 * - scoreB: B队总得分
 * - scoreHistory: 比分历史记录
 * - gameSettings: 比赛设置（局数等）
 */
app.put("/api/matches/:matchId/score", async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId); // 解析比赛ID
        const { scoreA, scoreB, scoreHistory, gameSettings } = req.body;
        // 计算比赛是否结束和获胜者
        const neededSets = Math.ceil(gameSettings.maxSets / 2); // 需要获胜的局数
        let setsWonA = 0, setsWonB = 0; // 各队获胜局数
        // 统计各队获胜局数
        scoreHistory.forEach((set) => {
            const pointsPerSet = gameSettings.pointsPerSet || 21; // 每局得分，默认21分
            const deuceDiff = gameSettings.deuceDiff || 2; // 平分后需要的分差，默认2分
            // 判断A队是否赢得这一局
            if (set.scoreA >= pointsPerSet && set.scoreA - set.scoreB >= deuceDiff) {
                setsWonA++;
            }
            // 判断B队是否赢得这一局
            else if (set.scoreB >= pointsPerSet && set.scoreB - set.scoreA >= deuceDiff) {
                setsWonB++;
            }
        });
        // 判断比赛是否结束
        const isMatchFinished = setsWonA >= neededSets || setsWonB >= neededSets;
        let winnerId = null; // 获胜者ID
        let status = 'in-progress'; // 比赛状态
        if (isMatchFinished) {
            status = 'completed'; // 比赛完成
            // 获取当前比赛的队伍信息来确定winnerId
            const match = await prisma.match.findUnique({
                where: { id: matchId },
                include: { teamA: true, teamB: true }
            });
            if (match && match.teamA && match.teamB) {
                // 根据获胜局数确定获胜者
                winnerId = setsWonA >= neededSets ? match.teamA.id : match.teamB.id;
            }
        }
        // 更新数据库中的比赛信息
        const updatedMatch = await prisma.match.update({
            where: { id: matchId },
            data: {
                scoreA, // A队得分
                scoreB, // B队得分
                scoreHistory: JSON.stringify(scoreHistory), // 比分历史（JSON格式）
                gameSettings: JSON.stringify(gameSettings), // 比赛设置（JSON格式）
                status, // 比赛状态
                winnerId, // 获胜者ID
            },
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
                court: true, // 包含场地信息
                winner: true, // 包含获胜队伍信息
            }
        });
        // 如果比赛结束，处理晋级逻辑
        if (isMatchFinished && winnerId) {
            await handleAdvancement(updatedMatch); // 处理下一轮比赛安排
        }
        // 发送WebSocket事件通知所有客户端
        io.emit('score-updated', {
            matchId, // 比赛ID
            courtId: updatedMatch.courtId, // 场地ID
            match: updatedMatch, // 更新后的比赛信息
            scoreHistory, // 比分历史
            gameSettings, // 比赛设置
            isMatchFinished, // 是否比赛结束
            winnerId // 获胜者ID
        });
        res.json(updatedMatch); // 返回更新后的比赛数据
    }
    catch (error) {
        console.error('Error updating match score:', error);
        res.status(500).json({ error: error });
    }
});
/**
 * 为场地分配下一场比赛
 *
 * 路由：POST /api/courts/:courtId/assign-next-match
 * 功能：为指定场地自动分配下一场等待比赛的队伍
 *
 * 分配策略：智能排序分配
 * - 优先级1：未分配场地的比赛（courtId为null）
 * - 优先级2：未完成的比赛（winnerId为null）
 * - 排序规则：按ID升序排列（FIFO原则，最早创建的比赛优先）
 * - 这确保了比赛按照预定顺序进行，维护赛程的公平性
 *
 * 参数：
 * - courtId: 场地ID（路径参数）
 */
app.post("/api/courts/:courtId/assign-next-match", async (req, res) => {
    try {
        const courtId = parseInt(req.params.courtId); // 解析场地ID
        // 智能查找下一场待分配的比赛
        const nextMatch = await prisma.match.findFirst({
            where: {
                courtId: null, // 未分配场地
                winnerId: null, // 未完成的比赛
            },
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
            },
            orderBy: {
                id: 'asc' // 分配优先级：按ID升序排列（最早创建的比赛优先分配）
            }
        });
        if (!nextMatch) {
            return res.json({ message: "No more matches to assign" }); // 没有更多比赛可分配
        }
        // 分配场地给比赛
        const updatedMatch = await prisma.match.update({
            where: { id: nextMatch.id },
            data: { courtId }, // 设置场地ID
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
                court: true, // 包含场地信息
            }
        });
        // 通知所有客户端有比赛被分配
        io.emit('match-assigned', {
            matchId: updatedMatch.id, // 比赛ID
            courtId: courtId, // 场地ID
            match: updatedMatch // 完整比赛信息
        });
        res.json(updatedMatch); // 返回更新后的比赛数据
    }
    catch (error) {
        res.status(500).json({ error: error });
    }
});
/**
 * 获取等待分配的比赛
 *
 * 路由：GET /api/matches/pending
 * 功能：返回所有未分配场地且未完成的比赛列表
 *
 * 等待队列排序规则：按比赛ID升序排列
 * - 基于FIFO（先进先出）原则
 * - 最早创建的比赛优先分配场地
 * - 确保比赛顺序的公平性和可预测性
 * - 为每个等待比赛分配队列位置编号（#1, #2, #3...）
 *
 * 响应格式：
 * {
 *   id: number,              // 比赛ID
 *   queuePosition: number,   // 等待队列位置数字：1, 2, 3...
 *   queueLabel: string,      // 等待队列标签："#1", "#2", "#3"... (前端直接显示)
 *   teamA: string,           // A队名称
 *   teamB: string,           // B队名称
 *   matchType: string,       // 比赛类型
 *   round: number            // 比赛轮次
 * }[]
 */
app.get("/api/matches/pending", async (req, res) => {
    try {
        // 查询等待分配的比赛
        const pendingMatches = await prisma.match.findMany({
            where: {
                courtId: null, // 未分配场地
                winnerId: null, // 未完成的比赛
            },
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
            },
            orderBy: {
                id: 'asc' // 等待队列排序：按ID升序排列（FIFO - 先创建先分配）
            }
        });
        // 格式化返回数据，添加等待队列位置标识
        const formatted = pendingMatches.map((match, index) => ({
            id: match.id, // 比赛ID
            queuePosition: index + 1, // 等待队列位置：#1, #2, #3... (前端显示用)
            queueLabel: `#${index + 1}`, // 等待队列标签：便于前端直接显示
            teamA: match.teamA?.name || 'TBD', // A队名称，如果为空则显示TBD
            teamB: match.teamB?.name || 'TBD', // B队名称，如果为空则显示TBD
            matchType: match.matchType, // 比赛类型
            round: match.round // 比赛轮次
        }));
        res.json(formatted); // 返回格式化数据
    }
    catch (error) {
        res.status(500).json({ error: error });
    }
});
/**
 * 分配特定比赛到特定场地
 *
 * 路由：POST /api/matches/:matchId/assign-court
 * 功能：将指定的比赛分配到指定的场地
 *
 * 参数：
 * - matchId: 比赛ID（路径参数）
 *
 * 请求体：
 * - courtId: 要分配的场地ID
 */
app.post("/api/matches/:matchId/assign-court", async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId); // 解析比赛ID
        const { courtId } = req.body;
        // 检查场地是否可用（没有进行中的比赛）
        const courtStatus = await prisma.match.findFirst({
            where: {
                courtId: courtId, // 指定场地
                winnerId: null, // 进行中的比赛
            }
        });
        if (courtStatus) {
            return res.status(400).json({ error: "Court is already occupied" }); // 场地已被占用
        }
        // 分配比赛到场地
        const updatedMatch = await prisma.match.update({
            where: { id: matchId },
            data: { courtId }, // 设置场地ID
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
                court: true, // 包含场地信息
            }
        });
        // 通知所有客户端比赛分配事件
        io.emit('match-assigned', {
            matchId: updatedMatch.id, // 比赛ID
            courtId: courtId, // 场地ID
            match: updatedMatch // 完整比赛信息
        });
        res.json(updatedMatch); // 返回更新后的比赛数据
    }
    catch (error) {
        res.status(500).json({ error: error });
    }
});
/**
 * 获取统计数据
 *
 * 路由：GET /api/statistics
 * 功能：返回赛事的统计信息
 *
 * 响应格式：
 * {
 *   total: number,      // 总比赛数
 *   completed: number,  // 已完成比赛数
 *   active: number,     // 进行中比赛数
 *   waiting: number     // 等待比赛数
 * }
 */
app.get("/api/statistics", async (req, res) => {
    try {
        // 统计总比赛数
        const totalMatches = await prisma.match.count();
        // 统计已完成比赛数（有获胜者）
        const completedMatches = await prisma.match.count({
            where: {
                winnerId: { not: null } // 有获胜者
            }
        });
        // 统计进行中比赛数（已分配场地但未完成）
        const activeMatches = await prisma.match.count({
            where: {
                courtId: { not: null }, // 已分配场地
                winnerId: null // 未完成
            }
        });
        // 统计等待比赛数（未分配场地且未完成）
        const waitingMatches = await prisma.match.count({
            where: {
                courtId: null, // 未分配场地
                winnerId: null // 未完成
            }
        });
        // 返回统计数据
        res.json({
            total: totalMatches, // 总比赛数
            completed: completedMatches, // 已完成比赛数
            active: activeMatches, // 进行中比赛数
            waiting: waitingMatches // 等待比赛数
        });
    }
    catch (error) {
        res.status(500).json({ error: error });
    }
});
/**
 * 手动测试晋级逻辑的API
 *
 * 路由：POST /api/test/advancement/:matchId
 * 功能：测试指定比赛的晋级逻辑（开发调试用）
 *
 * 参数：
 * - matchId: 比赛ID（路径参数）
 */
app.post("/api/test/advancement/:matchId", async (req, res) => {
    try {
        const matchId = parseInt(req.params.matchId); // 解析比赛ID
        // 获取测试比赛数据来触发晋级逻辑
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: {
                teamA: true, // 包含A队信息
                teamB: true // 包含B队信息
            }
        });
        if (match) {
            await handleAdvancement(match); // 调用晋级处理函数
            res.json({ message: "Advancement logic triggered", match });
        }
        else {
            res.status(404).json({ error: "Match not found" });
        }
    }
    catch (error) {
        console.error('Error testing advancement:', error);
        res.status(500).json({ error: error });
    }
});
// ===== 简单API端点（用于测试和兼容性） =====
/**
 * 获取所有队伍（简化版API）
 *
 * 路由：GET /teams
 * 功能：返回所有队伍的基本信息
 */
app.get("/teams", async (req, res) => {
    const teams = await prisma.team.findMany(); // 查询所有队伍
    res.json(teams); // 返回队伍列表
});
/**
 * 获取所有场地（简化版API）
 *
 * 路由：GET /courts
 * 功能：返回所有场地的基本信息
 */
app.get("/courts", async (req, res) => {
    const courts = await prisma.court.findMany(); // 查询所有场地
    res.json(courts); // 返回场地列表
});
/**
 * 获取所有比赛（简化版API）
 *
 * 路由：GET /matches
 * 功能：返回所有比赛的详细信息
 */
app.get("/matches", async (req, res) => {
    const matches = await prisma.match.findMany({
        include: { teamA: true, teamB: true, court: true }, // 包含关联数据
    });
    res.json(matches); // 返回比赛列表
});
// ===== WebSocket 连接处理 =====
/**
 * Socket.IO 连接处理
 *
 * 功能：处理客户端连接和实时事件
 * - 支持房间管理（区分主控和场地管理器）
 * - 处理比分更新事件
 * - 处理比赛完成事件
 * - 广播状态变化到所有客户端
 */
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    // 加入房间 - 区分主控和场地管理器
    socket.on('join-room', (room) => {
        socket.join(room); // 加入指定房间
        console.log(`Socket ${socket.id} joined room: ${room}`);
    });
    // 场地管理器更新比分
    socket.on('update-score', async (data) => {
        const { matchId, scoreA, scoreB, winnerId } = data;
        try {
            // 更新数据库中的比分
            const updatedMatch = await prisma.match.update({
                where: { id: matchId },
                data: { scoreA, scoreB, winnerId }, // 更新比分和获胜者
                include: { teamA: true, teamB: true, court: true } // 包含关联数据
            });
            // 向所有连接的客户端广播更新
            io.emit('score-updated', {
                matchId, // 比赛ID
                match: updatedMatch, // 更新后的比赛数据
                courtId: updatedMatch.courtId // 场地ID
            });
            console.log(`Score updated for match ${matchId}: ${scoreA}-${scoreB}`);
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to update score', error });
        }
    });
    // 完成比赛
    socket.on('complete-match', async (data) => {
        const { matchId, winnerId } = data;
        try {
            // 更新比赛状态为完成
            const completedMatch = await prisma.match.update({
                where: { id: matchId },
                data: { winnerId }, // 设置获胜者
                include: { teamA: true, teamB: true, court: true } // 包含关联数据
            });
            // 广播比赛完成事件
            io.emit('match-completed', {
                matchId, // 比赛ID
                match: completedMatch, // 完成的比赛数据
                winnerId // 获胜者ID
            });
            console.log(`Match ${matchId} completed, winner: ${winnerId}`);
        }
        catch (error) {
            socket.emit('error', { message: 'Failed to complete match', error });
        }
    });
    // 客户端断开连接事件
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`); // 记录客户端断开连接日志
    });
});
// ===== 启动服务器 =====
/**
 * 启动HTTP服务器
 *
 * 功能：
 * - 启动Express应用服务器
 * - 监听指定端口的连接请求
 * - 同时启用HTTP和WebSocket服务
 * - 输出服务器状态信息
 */
server.listen(PORT, async () => {
    console.log(`羽毛球赛事管理系统API服务器正在运行 - 端口: ${PORT}`);
    console.log(`HTTP API: http://localhost:${PORT}`);
    console.log(`WebSocket: ws://localhost:${PORT}`);
    console.log('系统功能：');
    console.log('- RESTful API接口服务');
    console.log('- Socket.IO实时通信');
    console.log('- 比赛管理和场地分配');
    console.log('- 自动晋级和对阵表生成');
    console.log('服务器启动完成，等待客户端连接...');
    // 启动时自动分配比赛到空闲场地
    setInterval(autoAssignMatchesToCourts, 5000); // 每5秒检查一次自动分配
});
//# sourceMappingURL=index_temp.js.map