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
                // 创建队伍ID到种子序号的映射
                const teamSeedMap = new Map();
                if (tournament.teams) {
                    tournament.teams.forEach((tournamentTeam) => {
                        if (tournamentTeam.team && tournamentTeam.seedNumber) {
                            teamSeedMap.set(tournamentTeam.team.id, tournamentTeam.seedNumber);
                        }
                    });
                }
                // 收集所有比赛
                if (tournament.rounds) {
                    tournament.rounds.forEach((round) => {
                        if (round.matches) {
                            round.matches.forEach((match) => {
                                // 为比赛中的队伍添加种子信息
                                const enhancedMatch = {
                                    ...match,
                                    matchType: tournament.matchType,
                                    round: round.roundNumber
                                };
                                // 为teamA添加种子信息
                                if (enhancedMatch.teamA) {
                                    enhancedMatch.teamA.seedNumber = teamSeedMap.get(enhancedMatch.teamA.id) || null;
                                }
                                // 为teamB添加种子信息
                                if (enhancedMatch.teamB) {
                                    enhancedMatch.teamB.seedNumber = teamSeedMap.get(enhancedMatch.teamB.id) || null;
                                }
                                allMatches.push(enhancedMatch);
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
                                seedNumber: tournamentTeam.seedNumber
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
        // 3. 使用正确的标准单淘汰赛算法 - 重新设计版本
        console.log(`🎯 开始生成标准单淘汰赛 (重新设计): ${allTeams.length}支队伍`);
        // 计算基础参数 (按标准算法)
        const P = allTeams.length; // 实际队伍数
        const M = 2 ** Math.ceil(Math.log2(P)); // 下一个2的幂次
        const B = M - P; // 轮空数量（实际上是null的数量）
        const totalRounds = Math.log2(M);
        console.log(`📋 标准锦标赛参数:`);
        console.log(`   - P (实际队伍): ${P}支`);
        console.log(`   - M (扩展到2的幂次): ${M}个位置`);
        console.log(`   - B (null补齐数量): ${B}个`);
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
                seedingMethod: 'standard'
            }
        });
        console.log(`✅ 创建锦标赛记录: ID=${tournament.id}`);
        // 5. 处理种子选手
        console.log(`🌱 处理种子选手...`);
        const seedTeamsSet = new Set(seedPlayers || []);
        const seedTeams = allTeams.filter(team => seedTeamsSet.has(team.id));
        const S = seedTeams.length; // 种子数量
        console.log(`   - 种子数量: ${S}`);
        console.log(`   - 种子选手: [${seedTeams.map(t => t.name).join(', ')}]`);
        // 6. 确定种子位置和轮空策略
        const seedPositions = getStandardSeedPositions(M, S); // 获取S个种子在M个位置中的分布
        console.log(`   - 种子位置: [${seedPositions.join(', ')}]`);
        console.log(seedPositions.length === S ? '   - 种子位置分布正确' : '   - ⚠️ 种子位置分布异常！数量不匹配！');
        // 轮空种子数量：min(S, B)
        const byeSeedCount = Math.min(S, B);
        console.log(`   - 轮空种子数量: ${byeSeedCount}`);
        // 7. 构建虚拟的M队伍数组（Teams）- 按照正确的两步法
        const Teams = new Array(M).fill(null); // 初始化为M个null
        console.log(`🏗️ 开始两步法构建虚拟队伍数组...`);
        // 第一步：将种子和对应的null放在正确的位置
        console.log(`📍 第一步：放置${S}个种子和${byeSeedCount}个对应null到固定位置`);
        const occupiedPositions = new Set(); // 记录已占用的位置
        // 放置种子到标准位置
        for (let i = 0; i < S; i++) {
            if (i < seedPositions.length) {
                const seedPosition = seedPositions[i];
                if (seedPosition && seedPosition <= M) {
                    const position = seedPosition - 1; // 转为0-based索引
                    Teams[position] = seedTeams[i];
                    occupiedPositions.add(position);
                    console.log(`   种子${i + 1}: ${seedTeams[i]?.name} → 位置${seedPosition}`);
                }
            }
        }
        // 为轮空的种子在对应位置放置null（轮空标记）
        for (let i = 0; i < byeSeedCount; i++) {
            if (i < seedPositions.length) {
                const seedPosition = seedPositions[i];
                if (seedPosition && seedPosition <= M) {
                    const seedPos = seedPosition - 1; // 种子位置
                    // 计算对应的对手位置（同一对的另一个位置）
                    let opponentPos;
                    if (seedPos % 2 === 0) {
                        opponentPos = seedPos + 1; // 右侧位置
                    }
                    else {
                        opponentPos = seedPos - 1; // 左侧位置
                    }
                    // 如果对手位置在有效范围内且未被占用，则放置null
                    if (opponentPos < M && !occupiedPositions.has(opponentPos)) {
                        Teams[opponentPos] = null;
                        occupiedPositions.add(opponentPos);
                        console.log(`   种子${i + 1}的对手位置${opponentPos + 1}设为轮空`);
                    }
                }
            }
        }
        console.log(`📊 第一步完成：已占用${occupiedPositions.size}个位置`);
        // 第二步：将剩余的普通选手和null打乱后填入剩余位置
        const remainingSlots = M - occupiedPositions.size; // 剩余位置数
        const nonSeedTeams = allTeams.filter(team => !seedTeamsSet.has(team.id)); // 普通选手
        const remainingNulls = B - byeSeedCount; // 剩余的null数量
        console.log(`📍 第二步：将${nonSeedTeams.length}个普通选手和${remainingNulls}个null打乱后填入${remainingSlots}个剩余位置`);
        // 创建要填入的混合数组：普通选手 + 剩余null
        const mixedArray = [...nonSeedTeams];
        for (let i = 0; i < remainingNulls; i++) {
            mixedArray.push(null);
        }
        // 打乱混合数组
        shuffleArray(mixedArray);
        console.log(`   打乱后的填充顺序：${mixedArray.map(item => item ? item.name : 'null').join(', ')}`);
        // 填入剩余位置
        let mixedIndex = 0;
        for (let i = 0; i < M && mixedIndex < mixedArray.length; i++) {
            if (!occupiedPositions.has(i)) {
                Teams[i] = mixedArray[mixedIndex];
                mixedIndex++;
            }
        }
        console.log(`📝 M队伍数组构建完成: ${Teams.filter(t => t !== null).length}支实际队伍 + ${Teams.filter(t => t === null).length}个null`);
        console.log(`🎯 Teams数组详情: [${Teams.map(t => t ? t.name : 'null').join(', ')}]`);
        // 添加shuffleArray辅助函数
        function shuffleArray(array) {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
        }
        // 8. 创建TournamentTeam记录
        for (let i = 0; i < Teams.length; i++) {
            const team = Teams[i];
            if (team) {
                const seedNumber = seedTeamsSet.has(team.id) ? (seedTeams.findIndex(st => st.id === team.id) + 1) : null;
                await prisma.tournamentTeam.create({
                    data: {
                        tournamentId: tournament.id,
                        teamId: team.id,
                        seedNumber,
                        initialPosition: i + 1
                    }
                });
            }
        }
        // 9. 创建轮次记录
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
        // 10. 首先确定整棵赛程树的形状
        console.log(`� 构建赛程树结构...`);
        // 计算每轮的比赛数
        const matchesPerRound = [];
        let currentTeamCount = M / 2; // 第一轮后的队伍数
        for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
            const matchesInRound = Math.floor(currentTeamCount);
            matchesPerRound[roundIndex] = matchesInRound;
            console.log(`   第${roundIndex + 1}轮: ${matchesInRound}场比赛`);
            currentTeamCount = matchesInRound; // 下一轮队伍数 = 当前轮比赛数
        }
        // 11. 创建所有轮次的比赛框架（空比赛）
        console.log(`🏗️ 创建比赛框架...`);
        const allMatches = [];
        const roundMatches = []; // 按轮次组织的比赛数组
        for (let roundIndex = 0; roundIndex < rounds.length; roundIndex++) {
            const round = rounds[roundIndex];
            if (!round)
                continue;
            const matchesInRound = matchesPerRound[roundIndex];
            const roundMatchArray = [];
            for (let matchIndex = 0; matchIndex < matchesInRound; matchIndex++) {
                const match = await prisma.match.create({
                    data: {
                        matchType: matchType,
                        tournamentId: tournament.id,
                        roundId: round.id,
                        round: round.roundNumber,
                        treePosition: matchIndex,
                        matchNumber: `R${round.roundNumber}-M${matchIndex + 1}`,
                        teamAId: null, // 初始时都是待定
                        teamBId: null, // 初始时都是待定
                        status: 'pending'
                    }
                });
                roundMatchArray.push(match);
                allMatches.push(match);
            }
            roundMatches[roundIndex] = roundMatchArray;
            console.log(`   第${roundIndex + 1}轮: 创建${roundMatchArray.length}场空比赛`);
        }
        // 12. 核心逻辑：遍历Teams数组填入第一轮和第二轮赛程
        console.log(`🎯 开始填入赛程：遍历Teams数组...`);
        const firstRoundMatchArray = roundMatches[0] || [];
        const secondRoundMatchArray = roundMatches[1] || [];
        for (let i = 0; i < Teams.length; i += 2) {
            const teamA = Teams[i];
            const teamB = Teams[i + 1];
            const pairIndex = Math.floor(i / 2); // 对的索引
            console.log(`\n处理第${pairIndex + 1}对: 位置${i + 1}(${teamA ? teamA.name : 'null'}) vs 位置${i + 2}(${teamB ? teamB.name : 'null'})`);
            if (teamA !== null && teamB !== null) {
                // 情况1：双方都不是null，创建第一轮比赛
                if (pairIndex < firstRoundMatchArray.length) {
                    const match = firstRoundMatchArray[pairIndex];
                    await prisma.match.update({
                        where: { id: match.id },
                        data: {
                            teamAId: teamA.id,
                            teamBId: teamB.id,
                            status: 'scheduled'
                        }
                    });
                    console.log(`   ✅ 第一轮比赛${pairIndex + 1}: ${teamA.name} vs ${teamB.name}`);
                }
            }
            else if (teamA !== null || teamB !== null) {
                // 情况2：有一个是null，表示另一个轮空
                const advancingTeam = teamA !== null ? teamA : teamB;
                if (pairIndex < firstRoundMatchArray.length) {
                    // 在第一轮创建轮空比赛
                    const match = firstRoundMatchArray[pairIndex];
                    await prisma.match.update({
                        where: { id: match.id },
                        data: {
                            teamAId: advancingTeam.id,
                            teamBId: null, // 对手为null表示轮空
                            status: 'bye', // 轮空状态
                            winnerId: advancingTeam.id // 直接设为获胜者
                        }
                    });
                    console.log(`   🎯 第一轮轮空: ${advancingTeam.name} (自动晋级)`);
                    // 将晋级队伍直接填入第二轮对应比赛
                    const secondRoundMatchIndex = Math.floor(pairIndex / 2);
                    if (secondRoundMatchIndex < secondRoundMatchArray.length) {
                        const secondRoundMatch = secondRoundMatchArray[secondRoundMatchIndex];
                        // 确定填入第二轮比赛的哪一方
                        const isTeamA = (pairIndex % 2) === 0;
                        const updateData = isTeamA
                            ? { teamAId: advancingTeam.id }
                            : { teamBId: advancingTeam.id };
                        await prisma.match.update({
                            where: { id: secondRoundMatch.id },
                            data: updateData
                        });
                        console.log(`   ⬆️ 晋级到第二轮比赛${secondRoundMatchIndex + 1}的${isTeamA ? 'A' : 'B'}方: ${advancingTeam.name}`);
                    }
                }
            }
            else {
                // 情况3：双方都是null，第一轮无比赛
                if (pairIndex < firstRoundMatchArray.length) {
                    const match = firstRoundMatchArray[pairIndex];
                    // 保持teamAId和teamBId为null，比赛状态为pending
                    console.log(`   ⭕ 第一轮比赛${pairIndex + 1}: 双方都是null，无比赛`);
                }
            }
        }
        const seed2Index = seed1Index + 1;
        if (seed1Index < byeSeeds.length && seed2Index < byeSeeds.length) {
            teamAId = byeSeeds[seed1Index]?.id;
            teamBId = byeSeeds[seed2Index]?.id;
            status = 'scheduled'; // 双方已确定
            console.log(`     比赛${matchIndex + 1}: ${byeSeeds[seed1Index]?.name} vs ${byeSeeds[seed2Index]?.name}`);
        }
    }
    finally { }
    {
        console.log(`     比赛${matchIndex + 1}: 待定 vs 待定`);
    }
    const match = await prisma.match.create({
        data: {
            matchType: matchType,
            tournamentId: tournament.id,
            roundId: round.id,
            round: round.roundNumber,
            treePosition: matchIndex,
            matchNumber: `R${round.roundNumber}-M${matchIndex + 1}`,
            teamAId,
            teamBId,
            status
        }
    });
    allMatches.push(match);
}, {
    matchIndex
}++);
{
    const match = await prisma.match.create({
        data: {
            matchType: matchType,
            tournamentId: tournament.id,
            roundId: round.id,
            round: round.roundNumber,
            treePosition: matchIndex,
            matchNumber: `R${round.roundNumber}-M${matchIndex + 1}`,
            teamAId: null,
            teamBId: null,
            status: 'pending'
        }
    });
    allMatches.push(match);
    console.log(`     比赛${matchIndex + 1}: 待定 vs 待定`);
}
currentRoundTeams = matchesInRound; // 下一轮队伍数 = 当前轮比赛数
// 12. 设置标准的 parentId 关系
console.log(`� 设置比赛的父子关系...`);
const matchesByRound = allMatches.reduce((acc, match) => {
    if (!acc[match.round])
        acc[match.round] = [];
    acc[match.round].push(match);
    return acc;
}, {});
for (let roundNum = 1; roundNum < totalRounds; roundNum++) {
    const currentRoundMatches = matchesByRound[roundNum] || [];
    const nextRoundMatches = matchesByRound[roundNum + 1] || [];
    for (let i = 0; i < currentRoundMatches.length; i++) {
        const currentMatch = currentRoundMatches[i];
        // 标准二叉树映射：每两场比赛对应一场父比赛
        const nextMatchIndex = Math.floor(i / 2);
        const nextMatch = nextRoundMatches[nextMatchIndex];
        if (nextMatch) {
            await prisma.match.update({
                where: { id: currentMatch.id },
                data: { parentId: nextMatch.id }
            });
            console.log(`🔗 第${roundNum}轮比赛${currentMatch.id} -> 第${roundNum + 1}轮比赛${nextMatch.id}`);
        }
    }
}
// 13. 更新轮次的实际比赛数量
for (const round of rounds) {
    const actualMatches = matchesByRound[round.roundNumber]?.length || 0;
    await prisma.tournamentRound.update({
        where: { id: round.id },
        data: { totalMatches: actualMatches }
    });
}
console.log(`🎉 标准锦标赛生成完成！总计${allMatches.length}场比赛`);
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
try { }
catch (error) {
    console.error('Error generating bracket:', error);
    res.status(500).json({ error: error.message || '生成赛程失败' });
}
;
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
        const { winnerId, matchType, round, id: matchId, parentId } = completedMatch;
        console.log(`处理晋级逻辑: 比赛 #${matchId}, 轮次 ${round}, 获胜者 ${winnerId}, 父比赛 ${parentId}`);
        // 如果没有父比赛（决赛），则无需处理晋级
        if (!parentId) {
            console.log(`比赛 #${matchId} 是决赛，无需处理晋级`);
            return;
        }
        // 获取获胜队伍信息
        const match = await prisma.match.findUnique({
            where: { id: matchId },
            include: {
                teamA: true,
                teamB: true
            }
        });
        if (!match || !match.winnerId) {
            console.log(`比赛 #${matchId} 信息不完整或没有获胜者`);
            return;
        }
        // 确定获胜队伍
        const winnerTeam = match.winnerId === match.teamAId ? match.teamA : match.teamB;
        if (!winnerTeam) {
            console.log(`无法确定比赛 #${matchId} 的获胜队伍`);
            return;
        }
        console.log(`获胜队伍: ${winnerTeam.name} (${winnerTeam.players})`);
        // 查找父比赛（下一轮比赛）
        const parentMatch = await prisma.match.findUnique({
            where: { id: parentId },
            include: {
                teamA: true,
                teamB: true
            }
        });
        if (!parentMatch) {
            console.log(`找不到父比赛 #${parentId}`);
            return;
        }
        console.log(`找到父比赛 #${parentId}: ${parentMatch.teamA?.name || '待定'} vs ${parentMatch.teamB?.name || '待定'}`);
        // 区别处理第一轮和后续轮次
        let updateField;
        let positionName;
        if (round === 1) {
            // 第一轮 → 第二轮：一对一映射，每场第一轮比赛对应一场第二轮比赛
            // 第一轮的获胜者直接填入第二轮比赛的 teamA 位置（约定规则）
            updateField = 'teamAId';
            positionName = 'teamA';
            console.log(`第一轮比赛 #${matchId} 的获胜者将填入第二轮比赛 #${parentId} 的 teamA 位置`);
        }
        else {
            // 第二轮及以后：二叉树结构，每两场比赛对应一场父比赛
            // 根据当前比赛在同轮次中的位置决定填入父比赛的哪个位置
            // 获取所有进入同一个父比赛的比赛
            const sameParentMatches = await prisma.match.findMany({
                where: {
                    matchType,
                    round,
                    parentId: parentId
                },
                orderBy: { id: 'asc' }
            });
            console.log(`进入父比赛 #${parentId} 的比赛:`, sameParentMatches.map(m => `#${m.id}`));
            // 找到当前比赛在列表中的位置
            const currentMatchIndex = sameParentMatches.findIndex(m => m.id === matchId);
            if (currentMatchIndex === -1) {
                console.log(`在同父比赛中找不到当前比赛 #${matchId}`);
                return;
            }
            // 确定更新字段：第一个比赛的获胜者填入 teamA，第二个比赛的获胜者填入 teamB
            updateField = currentMatchIndex === 0 ? 'teamAId' : 'teamBId';
            positionName = currentMatchIndex === 0 ? 'teamA' : 'teamB';
            console.log(`比赛 #${matchId} 是第 ${currentMatchIndex + 1} 场，获胜者将填入父比赛的 ${positionName} 位置`);
        }
        // 更新父比赛
        const updatedParentMatch = await prisma.match.update({
            where: { id: parentId },
            data: {
                [updateField]: winnerTeam.id,
                status: 'pending' // 确保状态为待开始
            },
            include: {
                teamA: true,
                teamB: true
            }
        });
        console.log(`已更新父比赛 #${parentId}: ${updatedParentMatch.teamA?.name || '待定'} vs ${updatedParentMatch.teamB?.name || '待定'}`);
        // 通知所有客户端有比赛更新
        io.emit('match-updated', {
            match: updatedParentMatch,
            round: round + 1,
            matchType,
            advancement: {
                fromMatch: matchId,
                winnerTeam: winnerTeam,
                toPosition: positionName
            }
        });
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
        let status = 'playing'; // 比赛状态（进行中）
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
        // 智能查找下一场待分配的比赛 - 只选择双方选手都已确定的比赛
        const allPendingMatches = await prisma.match.findMany({
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
        // 过滤出双方选手都已确定的比赛
        const eligibleMatches = allPendingMatches.filter(match => match.teamA && match.teamB &&
            match.teamA.name && match.teamB.name &&
            match.teamA.name !== '待定' && match.teamB.name !== '待定');
        const nextMatch = eligibleMatches[0]; // 取第一个符合条件的比赛
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
        const allPendingMatches = await prisma.match.findMany({
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
        // 过滤出双方选手都已确定的比赛
        const pendingMatches = allPendingMatches.filter(match => match.teamA && match.teamB &&
            match.teamA.name && match.teamB.name &&
            match.teamA.name !== '待定' && match.teamB.name !== '待定');
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
 * 手动分配指定比赛到指定场地
 *
 * 路由：POST /api/courts/:courtId/assign-match
 * 功能：手动分配指定的比赛到指定场地
 *
 * 应用场景：
 * - 管理员希望手动控制比赛分配，而非自动分配
 * - 可以将比赛分配到已有比赛的场地作为等待队列
 * - 支持更灵活的比赛调度
 *
 * 参数：
 * - courtId: 场地ID（路径参数）
 * - matchId: 要分配的比赛ID（请求体）
 */
app.post("/api/courts/:courtId/assign-match", async (req, res) => {
    try {
        const courtId = parseInt(req.params.courtId); // 解析场地ID
        const { matchId } = req.body; // 获取比赛ID
        if (!matchId) {
            return res.status(400).json({ error: "比赛ID不能为空" });
        }
        // 查找指定的比赛
        const match = await prisma.match.findUnique({
            where: { id: parseInt(matchId) },
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
            }
        });
        if (!match) {
            return res.status(404).json({ error: "找不到指定的比赛" });
        }
        // 检查比赛是否已经完成
        if (match.winnerId) {
            return res.status(400).json({ error: "该比赛已经完成，无法重新分配" });
        }
        // 检查比赛是否已经分配了场地
        if (match.courtId && match.courtId !== courtId) {
            return res.status(400).json({ error: "该比赛已经分配到其他场地" });
        }
        // 检查双方选手是否都已确定
        if (!match.teamA || !match.teamB ||
            !match.teamA.name || !match.teamB.name ||
            match.teamA.name === '待定' || match.teamB.name === '待定') {
            return res.status(400).json({
                error: "该比赛的选手尚未完全确定，无法分配场地",
                teamA: match.teamA?.name || '待定',
                teamB: match.teamB?.name || '待定'
            });
        }
        // 分配场地给比赛
        const updatedMatch = await prisma.match.update({
            where: { id: parseInt(matchId) },
            data: { courtId }, // 设置场地ID
            include: {
                teamA: true, // 包含A队信息
                teamB: true, // 包含B队信息
                court: true, // 包含场地信息
            }
        });
        // 通知所有客户端有比赛被手动分配
        io.emit('match-assigned', {
            matchId: updatedMatch.id, // 比赛ID
            courtId: courtId, // 场地ID
            match: updatedMatch, // 完整比赛信息
            type: 'manual' // 标记为手动分配
        });
        res.json({
            success: true,
            message: `比赛 ${match.teamA?.name || '队伍A'} vs ${match.teamB?.name || '队伍B'} 已成功分配到场地 ${courtId}`,
            match: updatedMatch
        });
    }
    catch (error) {
        console.error('手动分配比赛失败:', error);
        res.status(500).json({ error: "分配比赛时发生错误" });
    }
});
/**
 * 批量自动分配比赛到场地
 *
 * 路由：POST /api/matches/assign-to-courts
 * 功能：手动触发将待分配的比赛分配到可用场地
 * 参数：
 * - autoAssign: boolean (可选) - 是否使用自动分配算法，默认true
 * - assignments: Array (可选) - 手动指定分配列表 [{matchId, courtId}]
 *
 * 业务流程中的位置：
 * 1. 导入报名表
 * 2. 生成每个赛项的赛程树
 * 3. 形成比赛队列
 * 4. ★ 为场地分配比赛 ← 当前API
 * 5. 后续比赛管理
 */
app.post("/api/matches/assign-to-courts", async (req, res) => {
    try {
        const { autoAssign = true, assignments = [] } = req.body;
        if (autoAssign) {
            // 自动分配模式：使用现有的自动分配逻辑
            await autoAssignMatchesToCourts();
            // 获取刚刚分配的比赛信息
            const assignedMatches = await prisma.match.findMany({
                where: {
                    courtId: { not: null },
                    winnerId: null
                },
                include: {
                    teamA: true,
                    teamB: true,
                    court: true
                }
            });
            // 发送WebSocket通知
            io.emit('bulk-matches-assigned', {
                count: assignedMatches.length,
                matches: assignedMatches
            });
            res.json({
                success: true,
                message: `成功自动分配 ${assignedMatches.length} 场比赛到场地`,
                assignedMatches: assignedMatches.length
            });
        }
        else {
            // 手动分配模式：按指定的分配列表执行
            const assignmentPromises = assignments.map(async (assignment) => {
                const { matchId, courtId } = assignment;
                // 检查场地是否可用
                const courtStatus = await prisma.match.findFirst({
                    where: {
                        courtId: courtId,
                        winnerId: null
                    }
                });
                if (courtStatus) {
                    throw new Error(`场地 ${courtId} 已被占用`);
                }
                // 执行分配
                return await prisma.match.update({
                    where: { id: matchId },
                    data: { courtId },
                    include: {
                        teamA: true,
                        teamB: true,
                        court: true
                    }
                });
            });
            const assignedMatches = await Promise.all(assignmentPromises);
            // 发送WebSocket通知
            io.emit('bulk-matches-assigned', {
                count: assignedMatches.length,
                matches: assignedMatches
            });
            res.json({
                success: true,
                message: `成功手动分配 ${assignedMatches.length} 场比赛到场地`,
                assignedMatches: assignedMatches.length,
                matches: assignedMatches
            });
        }
    }
    catch (error) {
        console.error('批量分配比赛到场地失败:', error);
        res.status(500).json({
            success: false,
            error: error.message || '分配失败'
        });
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
    // 注意：自动场地分配已禁用，场地分配应该通过手动操作或专门的API触发
    // setInterval(autoAssignMatchesToCourts, 5000);  // 禁用自动分配
});
/**
 * 递归镜像分布算法 - 生成标准单淘汰赛种子位置序列
 *
 * 核心原理：
 * - 1号与2号种子分别在上下两端
 * - 3-4号种子分别位于两个半区的中部
 * - 5-8号种子位于四分区边界
 * - 依此类推，形成完美的镜像对称结构
 *
 * 标准序列示例：
 * - generateSeedPositions(4) → [1, 4, 3, 2]
 * - generateSeedPositions(8) → [1, 8, 5, 4, 3, 6, 7, 2]
 * - generateSeedPositions(16) → [1, 16, 9, 8, 5, 12, 13, 4, 3, 14, 11, 6, 7, 10, 15, 2]
 *
 * @param n 队伍数量（必须是2的幂次）
 * @returns 标准种子位置序列
 */
function generateSeedPositions(n) {
    if (n === 1)
        return [1];
    if (n === 2)
        return [1, 2];
    const half = n / 2;
    const prev = generateSeedPositions(half);
    // 构建标准镜像序列：前半部分保持原序，后半部分镜像翻转
    const result = [];
    for (let i = 0; i < prev.length; i++) {
        const pos = prev[i];
        if (pos !== undefined) {
            result.push(pos); // 上半区：原位置
            result.push(n + 1 - pos); // 下半区：镜像位置
        }
    }
    return result;
}
/**
 * 获取标准种子位置（改进版）
 *
 * 使用递归镜像分布算法生成标准单淘汰赛种子位置：
 * - 适配任何队伍数量（非2的幂次也能正确处理）
 * - 保证高种子选手不会过早相遇
 * - 形成完美的对称结构，便于树状图显示
 * - 符合国际网球、羽毛球、电竞等标准淘汰赛规则
 *
 * 示例：10支队伍，4个种子
 * → nextPowerOf2 = 16
 * → 标准16人序列 = [1, 16, 9, 8, 5, 12, 13, 4, ...]
 * → 取前4个位置 = [1, 16, 9, 8]
 * → 映射到10人范围 = [1, 10, 9, 8]
 *
 * @param totalTeams 总队伍数
 * @param seedCount 种子数量
 * @returns 种子位置数组（1-based）
 */
function getStandardSeedPositions(totalTeams, seedCount) {
    if (seedCount === 0)
        return [];
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(totalTeams)));
    // 生成标准位置序列（如 [1, 16, 9, 8, ...]）
    const fullSeedPositions = generateSeedPositions(nextPowerOf2);
    // 取前 seedCount 个位置
    const positions = fullSeedPositions.slice(0, seedCount);
    // 若总队伍数小于 nextPowerOf2，则将超出部分映射回合法区间
    return positions.map(pos => Math.min(pos, totalTeams));
}
/**
 * 获取种子位置的解释（基于递归镜像分布规则）
 *
 * @param seedNumber 种子序号
 * @param totalTeams 总队伍数
 * @returns 位置原因说明
 */
function getSeedPositionReason(seedNumber, totalTeams) {
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(totalTeams)));
    switch (seedNumber) {
        case 1:
            return "顶部位置 - 1号种子占据最上方，确保最佳晋级路径";
        case 2:
            return "底部位置 - 2号种子占据最下方，与1号种子对角分布";
        case 3:
            return "下半区中央 - 3号种子位于下半区，避免与1、2号过早相遇";
        case 4:
            return "上半区中央 - 4号种子位于上半区，与3号种子镜像分布";
        case 5:
        case 6:
        case 7:
        case 8:
            const quarterInfo = seedNumber <= 6 ? "上半区" : "下半区";
            return `${quarterInfo}四分之一区 - ${seedNumber}号种子按镜像原则分散分布`;
        default:
            return `第${seedNumber}号种子 - 按递归镜像算法分散到最佳位置`;
    }
}
//# sourceMappingURL=index_backup.js.map