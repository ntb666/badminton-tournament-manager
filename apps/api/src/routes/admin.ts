/**
 * 管理员功能路由模块
 * 
 * 功能：
 * - 系统数据重置
 * - 队伍信息管理（增删改查）
 * - 比赛数据导出
 * - 系统配置管理
 */

import express from "express";
import { PrismaClient, MatchType } from "@prisma/client";
import fs from "fs";
import path from "path";

const router = express.Router();
const prisma = new PrismaClient();

// 配置文件路径
const CONFIG_FILE = path.join(__dirname, '../config/system.json');

// 确保配置目录存在
const ensureConfigDir = () => {
  const configDir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
};

// 默认配置
const DEFAULT_CONFIG = {
  tournamentName: "羽毛球锦标赛",
  venue: "体育馆",
  organizer: "主办方",
  contactPhone: "",
  contactEmail: "",
  defaultGameSettings: "21分制，三局两胜",
  courtCount: 5,
  hasBronzeMatch: false,
  enabledMatchTypes: {
    MEN_SINGLE: false,
    WOMEN_SINGLE: false,
    MEN_DOUBLE: true,
    WOMEN_DOUBLE: true,
    MIX_DOUBLE: true
  }
};

// 读取配置
const readConfig = () => {
  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
    return DEFAULT_CONFIG;
  } catch (error) {
    console.error('读取配置文件失败:', error);
    return DEFAULT_CONFIG;
  }
};

// 写入配置
const writeConfig = (config: any) => {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('写入配置文件失败:', error);
    return false;
  }
};

/**
 * 一键重置系统数据
 * 
 * 路由：POST /api/admin/reset
 * 功能：清空所有比赛数据，将系统恢复到初始状态
 * 注意：此操作不可逆，会删除所有数据
 */
router.post("/reset", async (req, res) => {
  try {
    console.log("🔄 开始重置系统数据...");
    
    // 由于外键约束，需要按照正确的顺序删除数据
    // 删除顺序：Match -> TournamentTeam -> TournamentRound -> Tournament -> Team
    
    // 1. 删除所有比赛记录（包含外键引用，需要最先删除）
    const deletedMatches = await prisma.match.deleteMany({});
    console.log(`📋 已删除 ${deletedMatches.count} 场比赛记录`);
    
    // 2. 删除所有赛程队伍关联记录
    const deletedTournamentTeams = await prisma.tournamentTeam.deleteMany({});
    console.log(`🔗 已删除 ${deletedTournamentTeams.count} 个赛程队伍关联记录`);
    
    // 3. 删除所有赛程轮次记录
    const deletedTournamentRounds = await prisma.tournamentRound.deleteMany({});
    console.log(`🔄 已删除 ${deletedTournamentRounds.count} 个赛程轮次记录`);
    
    // 4. 删除所有赛程记录
    const deletedTournaments = await prisma.tournament.deleteMany({});
    console.log(`🏆 已删除 ${deletedTournaments.count} 个赛程记录`);
    
    // 5. 删除所有队伍记录
    const deletedTeams = await prisma.team.deleteMany({});
    console.log(`👥 已删除 ${deletedTeams.count} 支队伍`);
    
    console.log("✅ 系统数据重置完成");
    
    res.json({
      success: true,
      message: "系统数据已成功重置",
      data: {
        deletedMatches: deletedMatches.count,
        deletedTournamentTeams: deletedTournamentTeams.count,
        deletedTournamentRounds: deletedTournamentRounds.count,
        deletedTournaments: deletedTournaments.count,
        deletedTeams: deletedTeams.count
      }
    });
    
  } catch (error) {
    console.error("❌ 重置系统数据失败:", error);
    res.status(500).json({
      success: false,
      message: "重置失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

/**
 * 导出完整比赛数据
 * 
 * 路由：GET /api/admin/export
 * 功能：导出所有比赛相关数据，包括队伍、比赛记录、比分历史等
 */
router.get("/export", async (req, res) => {
  try {
    console.log("📤 开始导出比赛数据...");
    
    // 获取所有队伍数据
    const teams = await prisma.team.findMany({
      orderBy: { id: 'asc' }
    });
    
    // 获取所有比赛数据
    const matches = await prisma.match.findMany({
      orderBy: { id: 'asc' },
      include: {
        teamA: true,
        teamB: true,
        court: true
      }
    });
    
    // 获取场地数据
    const courts = await prisma.court.findMany({
      orderBy: { id: 'asc' }
    });
    
    // 统计数据
    const statistics = {
      totalTeams: teams.length,
      totalMatches: matches.length,
      completedMatches: matches.filter(m => m.status === 'completed').length,
      playingMatches: matches.filter(m => m.status === 'playing').length,
      pendingMatches: matches.filter(m => m.status === 'pending').length,
      totalCourts: courts.length,
      exportTime: new Date().toISOString(),
      exportDate: new Date().toLocaleString('zh-CN')
    };
    
    // 按比赛类型统计
    const typeStats = {
      MEN_DOUBLE: teams.filter(t => t.type === MatchType.MEN_DOUBLE).length,
      WOMEN_DOUBLE: teams.filter(t => t.type === MatchType.WOMEN_DOUBLE).length,
      MIX_DOUBLE: teams.filter(t => t.type === MatchType.MIX_DOUBLE).length
    };
    
    const exportData = {
      metadata: {
        exportTime: statistics.exportTime,
        exportDate: statistics.exportDate,
        systemVersion: "1.0.0",
        description: "羽毛球赛事管理系统 - 完整数据导出"
      },
      statistics: {
        ...statistics,
        byType: typeStats
      },
      teams: teams.map(team => {
        // 计算该队伍的比赛记录
        const teamMatches = matches.filter(m => 
          m.teamAId === team.id || m.teamBId === team.id
        );
        const wins = matches.filter(m => m.winnerId === team.id).length;
        const losses = teamMatches.filter(m => 
          m.winnerId && m.winnerId !== team.id
        ).length;
        
        return {
          id: team.id,
          name: team.name,
          players: team.players,
          type: team.type,
          matches: {
            total: teamMatches.length,
            wins,
            losses
          }
        };
      }),
      matches: matches.map(match => ({
        id: match.id,
        teamA: match.teamA ? {
          id: match.teamA.id,
          name: match.teamA.name,
          players: match.teamA.players
        } : null,
        teamB: match.teamB ? {
          id: match.teamB.id,
          name: match.teamB.name,
          players: match.teamB.players
        } : null,
        status: match.status,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        scoreHistory: match.scoreHistory,
        gameSettings: match.gameSettings,
        matchType: match.matchType,
        round: match.round,
        winnerId: match.winnerId,
        court: match.court ? {
          id: match.court.id,
          name: match.court.name
        } : null
      })),
      courts
    };
    
    console.log("✅ 比赛数据导出完成");
    
    res.json(exportData);
    
  } catch (error) {
    console.error("❌ 导出比赛数据失败:", error);
    res.status(500).json({
      success: false,
      message: "导出失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

/**
 * 获取系统配置
 * 
 * 路由：GET /api/admin/config
 * 功能：获取当前系统配置信息
 */
router.get("/config", async (req, res) => {
  try {
    const config = readConfig();
    
    res.json({
      success: true,
      data: {
        ...config,
        lastUpdated: new Date().toISOString()
      }
    });
    
  } catch (error) {
    console.error("❌ 获取系统配置失败:", error);
    res.status(500).json({
      success: false,
      message: "获取配置失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

/**
 * 确保场地数据已初始化
 * 如果数据库中没有场地，根据配置自动创建
 */
async function ensureCourtsInitialized(courtCount: number) {
  try {
    const existingCourts = await prisma.court.findMany();
    
    if (existingCourts.length === 0) {
      console.log(`🏟️ 初始化 ${courtCount} 个场地...`);
      
      const courtsData = [];
      for (let i = 1; i <= courtCount; i++) {
        courtsData.push({
          name: `${i}号场地`
        });
      }
      
      await prisma.court.createMany({
        data: courtsData
      });
      
      console.log(`✅ 已初始化 ${courtCount} 个场地`);
    } else if (existingCourts.length !== courtCount) {
      // 如果场地数量不匹配，需要同步
      console.log(`🏟️ 检测到场地数量不匹配，当前${existingCourts.length}个，期望${courtCount}个`);
      await updateCourtsInDatabase(courtCount);
    } else {
      console.log(`🏟️ 场地已初始化，当前共有 ${existingCourts.length} 个场地`);
    }
  } catch (error) {
    console.error("❌ 初始化场地失败:", error);
  }
}

/**
 * 更新系统配置
 * 
 * 路由：PUT /api/admin/config
 * 功能：更新系统配置信息，并同步场地数据
 */
router.put("/config", async (req, res) => {
  try {
    const currentConfig = readConfig();
    const updatedConfig = {
      ...currentConfig,
      ...req.body,
      lastUpdated: new Date().toISOString()
    };
    
    // 如果场地数量发生变化，需要同步数据库
    if (updatedConfig.courtCount !== currentConfig.courtCount) {
      await updateCourtsInDatabase(updatedConfig.courtCount);
    }
    
    const success = writeConfig(updatedConfig);
    
    if (success) {
      console.log("⚙️ 系统配置已更新:", updatedConfig);
      
      res.json({
        success: true,
        message: "配置更新成功",
        data: updatedConfig
      });
    } else {
      res.status(500).json({
        success: false,
        message: "配置保存失败"
      });
    }
    
  } catch (error) {
    console.error("❌ 更新系统配置失败:", error);
    res.status(500).json({
      success: false,
      message: "配置更新失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

/**
 * 同步场地数据到数据库
 * 根据配置的场地数量更新数据库中的场地记录，确保场地编号连续
 */
async function updateCourtsInDatabase(targetCourtCount: number) {
  try {
    console.log(`🏟️ 正在同步场地数量到 ${targetCourtCount} 个...`);
    
    // 获取当前数据库中的所有场地，按ID排序
    const currentCourts = await prisma.court.findMany({
      orderBy: { id: 'asc' }
    });
    
    const currentCount = currentCourts.length;
    
    if (targetCourtCount > currentCount) {
      // 需要增加场地
      const addCount = targetCourtCount - currentCount;
      const newCourts = [];
      
      for (let i = currentCount + 1; i <= targetCourtCount; i++) {
        newCourts.push({
          name: `${i}号场地`
        });
      }
      
      await prisma.court.createMany({
        data: newCourts
      });
      
      console.log(`✅ 已新增 ${addCount} 个场地`);
      
    } else if (targetCourtCount < currentCount) {
      // 需要删除场地（从后往前删，保护前面有比赛的场地）
      const courtsToDelete = currentCourts.slice(targetCourtCount);
      
      // 检查要删除的场地是否有正在进行的比赛
      const activeMatches = await prisma.match.findMany({
        where: {
          courtId: {
            in: courtsToDelete.map(c => c.id)
          },
          status: {
            in: ['PENDING', 'ACTIVE', 'IN_PROGRESS', 'playing', 'assigned']
          }
        }
      });
      
      if (activeMatches.length > 0) {
        throw new Error(`无法删除场地：有 ${activeMatches.length} 场比赛正在进行或等待分配`);
      }
      
      // 删除多余的场地
      await prisma.court.deleteMany({
        where: {
          id: {
            in: courtsToDelete.map(c => c.id)
          }
        }
      });
      
      console.log(`✅ 已删除 ${courtsToDelete.length} 个场地`);
    }
    
    // 只有在场地数量发生变化时才重新整理编号
    if (targetCourtCount !== currentCount) {
      await reorderCourtNames(targetCourtCount);
      console.log(`🏟️ 场地数量同步完成，当前共有 ${targetCourtCount} 个场地`);
    } else {
      console.log(`🏟️ 场地数量无变化，当前共有 ${targetCourtCount} 个场地，跳过重新整理`);
    }
    
  } catch (error) {
    console.error("❌ 同步场地数据失败:", error);
    throw error;
  }
}

/**
 * 重新整理场地名称，确保编号连续
 */
async function reorderCourtNames(targetCount: number) {
  try {
    console.log(`🔄 重新整理场地编号...`);
    
    // 获取所有场地，按ID排序
    const courts = await prisma.court.findMany({
      orderBy: { id: 'asc' }
    });
    
    // 更新每个场地的名称为连续编号
    for (let i = 0; i < Math.min(courts.length, targetCount); i++) {
      const court = courts[i];
      if (!court) continue; // 安全检查
      
      const newName = `${i + 1}号场地`;
      
      if (court.name !== newName) {
        await prisma.court.update({
          where: { id: court.id },
          data: { name: newName }
        });
        console.log(`📝 更新 ${court.name} -> ${newName}`);
      }
    }
    
    console.log(`✅ 场地编号整理完成`);
    
  } catch (error) {
    console.error("❌ 重新整理场地编号失败:", error);
  }
}

/**
 * 获取系统统计信息
 * 
 * 路由：GET /api/admin/stats
 * 功能：获取详细的系统统计数据，用于管理员面板展示
 */
router.get("/stats", async (req, res) => {
  try {
    // 获取队伍统计
    const teams = await prisma.team.findMany();
    const teamsByType = {
      MEN_DOUBLE: teams.filter(t => t.type === 'MEN_DOUBLE').length,
      WOMEN_DOUBLE: teams.filter(t => t.type === 'WOMEN_DOUBLE').length,
      MIX_DOUBLE: teams.filter(t => t.type === 'MIX_DOUBLE').length
    };
    
    // 获取比赛统计
    const matches = await prisma.match.findMany();
    const matchesByStatus = {
      pending: matches.filter(m => m.status === 'pending').length,
      playing: matches.filter(m => m.status === 'playing').length,
      completed: matches.filter(m => m.status === 'completed').length
    };
    
    // 获取场地使用情况
    const courts = await prisma.court.findMany();
    const playingMatches = matches.filter(m => m.status === 'playing');
    const occupiedCourts = playingMatches.filter(m => m.courtId !== null).length;
    const availableCourts = courts.length - occupiedCourts;
    
    const stats = {
      teams: {
        total: teams.length,
        byType: teamsByType
      },
      matches: {
        total: matches.length,
        byStatus: matchesByStatus
      },
      courts: {
        total: courts.length,
        occupied: occupiedCourts,
        available: availableCourts
      },
      lastUpdated: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    console.error("❌ 获取系统统计失败:", error);
    res.status(500).json({
      success: false,
      message: "获取统计失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

/**
 * 获取数据库原始内容
 * 
 * 路由：GET /api/admin/database
 * 功能：获取数据库所有表的原始数据，用于管理员调试和查看
 */
router.get("/database", async (req, res) => {
  try {
    console.log("📊 开始获取数据库原始内容...");
    
    // 获取所有表的数据
    const [teams, courts, matches, tournaments, tournamentRounds, tournamentTeams] = await Promise.all([
      prisma.team.findMany({
        orderBy: { id: 'asc' }
      }),
      prisma.court.findMany({
        orderBy: { id: 'asc' }
      }),
      prisma.match.findMany({
        orderBy: { id: 'asc' },
        include: {
          teamA: true,
          teamB: true,
          court: true,
          winner: true,
          parent: {
            select: { id: true, round: true }
          },
          children: {
            select: { id: true, round: true }
          }
        }
      }),
      prisma.tournament.findMany({
        orderBy: { id: 'asc' },
        include: {
          rounds: {
            orderBy: { roundNumber: 'asc' },
            select: { id: true, roundNumber: true, roundName: true, status: true }
          },
          teams: {
            orderBy: { initialPosition: 'asc' },
            include: {
              team: { select: { id: true, name: true, type: true } }
            }
          },
          matches: {
            select: { id: true, status: true, round: true }
          }
        }
      }),
      prisma.tournamentRound.findMany({
        orderBy: [{ tournamentId: 'asc' }, { roundNumber: 'asc' }],
        include: {
          tournament: { select: { id: true, name: true, matchType: true } },
          matches: { select: { id: true, status: true } }
        }
      }),
      prisma.tournamentTeam.findMany({
        orderBy: [{ tournamentId: 'asc' }, { initialPosition: 'asc' }],
        include: {
          tournament: { select: { id: true, name: true, matchType: true } },
          team: { select: { id: true, name: true, players: true } }
        }
      })
    ]);

    // 统计信息
    const statistics = {
      teams: {
        total: teams.length,
        byType: {
          MEN_DOUBLE: teams.filter((t: any) => t.type === 'MEN_DOUBLE').length,
          WOMEN_DOUBLE: teams.filter((t: any) => t.type === 'WOMEN_DOUBLE').length,
          MIX_DOUBLE: teams.filter((t: any) => t.type === 'MIX_DOUBLE').length
        }
      },
      courts: {
        total: courts.length,
        withMatches: matches.filter((m: any) => m.courtId !== null && m.status !== 'completed').length
      },
      matches: {
        total: matches.length,
        byStatus: {
          pending: matches.filter((m: any) => m.status === 'pending').length,
          assigned: matches.filter((m: any) => m.status === 'assigned').length,
          playing: matches.filter((m: any) => m.status === 'playing').length,
          completed: matches.filter((m: any) => m.status === 'completed').length
        },
        byRound: matches.reduce((acc: any, match: any) => {
          acc[`round_${match.round}`] = (acc[`round_${match.round}`] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      },
      tournaments: {
        total: tournaments.length,
        byStatus: {
          draft: tournaments.filter((t: any) => t.status === 'draft').length,
          active: tournaments.filter((t: any) => t.status === 'active').length,
          completed: tournaments.filter((t: any) => t.status === 'completed').length,
          cancelled: tournaments.filter((t: any) => t.status === 'cancelled').length
        },
        byType: {
          MEN_DOUBLE: tournaments.filter((t: any) => t.matchType === 'MEN_DOUBLE').length,
          WOMEN_DOUBLE: tournaments.filter((t: any) => t.matchType === 'WOMEN_DOUBLE').length,
          MIX_DOUBLE: tournaments.filter((t: any) => t.matchType === 'MIX_DOUBLE').length
        }
      },
      tournamentRounds: {
        total: tournamentRounds.length,
        byStatus: {
          pending: tournamentRounds.filter((r: any) => r.status === 'pending').length,
          active: tournamentRounds.filter((r: any) => r.status === 'active').length,
          completed: tournamentRounds.filter((r: any) => r.status === 'completed').length
        }
      },
      tournamentTeams: {
        total: tournamentTeams.length,
        byStatus: {
          active: tournamentTeams.filter((t: any) => t.status === 'active').length,
          eliminated: tournamentTeams.filter((t: any) => t.status === 'eliminated').length,
          withdrawn: tournamentTeams.filter((t: any) => t.status === 'withdrawn').length
        }
      }
    };

    const databaseContent = {
      metadata: {
        timestamp: new Date().toISOString(),
        totalRecords: teams.length + courts.length + matches.length + tournaments.length + tournamentRounds.length + tournamentTeams.length,
        lastUpdated: new Date().toLocaleString('zh-CN'),
        tablesInfo: {
          teams: `${teams.length} 条记录`,
          courts: `${courts.length} 条记录`,
          matches: `${matches.length} 条记录`,
          tournaments: `${tournaments.length} 条记录`,
          tournamentRounds: `${tournamentRounds.length} 条记录`,
          tournamentTeams: `${tournamentTeams.length} 条记录`
        }
      },
      statistics,
      tables: {
        teams: {
          count: teams.length,
          description: "参赛队伍信息表",
          data: teams
        },
        courts: {
          count: courts.length,
          description: "比赛场地信息表",
          data: courts
        },
        matches: {
          count: matches.length,
          description: "比赛记录表",
          data: matches
        },
        tournaments: {
          count: tournaments.length,
          description: "赛程信息表",
          data: tournaments
        },
        tournamentRounds: {
          count: tournamentRounds.length,
          description: "赛程轮次表",
          data: tournamentRounds
        },
        tournamentTeams: {
          count: tournamentTeams.length,
          description: "赛程队伍关联表",
          data: tournamentTeams
        }
      }
    };

    console.log(`✅ 数据库内容获取完成，共 ${databaseContent.metadata.totalRecords} 条记录`);
    
    res.json({
      success: true,
      data: databaseContent
    });
    
  } catch (error) {
    console.error("❌ 获取数据库内容失败:", error);
    res.status(500).json({
      success: false,
      message: "获取数据库内容失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

/**
 * 初始化场地数据（仅在服务器启动时使用）
 * 
 * 路由：POST /api/admin/init-courts
 * 功能：确保场地数据已正确初始化
 */
router.post("/init-courts", async (req, res) => {
  try {
    const config = readConfig();
    await ensureCourtsInitialized(config.courtCount);
    
    res.json({
      success: true,
      message: "场地初始化检查完成"
    });
    
  } catch (error) {
    console.error("❌ 初始化场地失败:", error);
    res.status(500).json({
      success: false,
      message: "场地初始化失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

export default router;