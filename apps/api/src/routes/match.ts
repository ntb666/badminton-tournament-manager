import { Router } from "express";
import { prisma } from "../prismaClient";

const router = Router();

// 获取所有比赛
router.get("/", async (req, res) => {
  const matches = await prisma.match.findMany({
    include: { teamA: true, teamB: true, court: true, children: true },
  });
  res.json(matches);
});

// 生成比赛赛程 - 重定向到主赛程生成API
router.post("/generate", async (req, res) => {
  try {
    // 这个路由已废弃，请使用 POST /api/schedule/generate-bracket
    res.status(410).json({ 
      error: "此API已废弃，请使用 POST /api/schedule/generate-bracket 生成完整赛程",
      redirect: "/api/schedule/generate-bracket"
    });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

/**
 * 获取待分配的比赛列表
 * 路由：GET /api/matches/pending
 */
router.get("/pending", async (req, res) => {
  try {
    const pendingMatches = await prisma.match.findMany({
      where: {
        courtId: null,
        winnerId: null
      },
      include: {
        teamA: true,
        teamB: true
      },
      orderBy: {
        id: 'asc' // FIFO原则
      }
    });
    
    res.json({
      success: true,
      data: pendingMatches
    });
  } catch (error) {
    console.error("获取待分配比赛失败:", error);
    res.status(500).json({
      success: false,
      message: "获取待分配比赛失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

/**
 * 手动分配比赛到场地
 * 路由：POST /api/matches/assign
 */
router.post("/assign", async (req, res) => {
  try {
    const { matchId, courtId } = req.body;
    
    if (!matchId || !courtId) {
      return res.status(400).json({
        success: false,
        message: "缺少必要参数: matchId 和 courtId"
      });
    }
    
    // 检查比赛是否存在且未分配
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { teamA: true, teamB: true }
    });
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: "比赛不存在"
      });
    }
    
    if (match.courtId !== null) {
      return res.status(400).json({
        success: false,
        message: "比赛已被分配到场地"
      });
    }
    
    if (match.winnerId !== null) {
      return res.status(400).json({
        success: false,
        message: "比赛已结束"
      });
    }
    
    // 检查场地是否存在且可用
    const court = await prisma.court.findUnique({
      where: { id: courtId },
      include: {
        matches: {
          where: {
            winnerId: null // 正在进行的比赛
          }
        }
      }
    });
    
    if (!court) {
      return res.status(404).json({
        success: false,
        message: "场地不存在"
      });
    }
    
    if (court.matches.length > 0) {
      return res.status(400).json({
        success: false,
        message: "场地正在使用中"
      });
    }
    
    // 分配比赛到场地
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: { courtId: courtId },
      include: {
        teamA: true,
        teamB: true,
        court: true
      }
    });
    
    console.log(`手动分配比赛 ${matchId} 到场地 ${courtId} (${court.name})`);
    
    res.json({
      success: true,
      message: "比赛分配成功",
      data: updatedMatch
    });
    
  } catch (error) {
    console.error("分配比赛到场地失败:", error);
    res.status(500).json({
      success: false,
      message: "分配比赛失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

/**
 * 手动取消比赛分配
 * 路由：POST /api/matches/unassign
 */
router.post("/unassign", async (req, res) => {
  try {
    const { matchId } = req.body;
    
    if (!matchId) {
      return res.status(400).json({
        success: false,
        message: "缺少必要参数: matchId"
      });
    }
    
    // 检查比赛是否存在
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { teamA: true, teamB: true, court: true }
    });
    
    if (!match) {
      return res.status(404).json({
        success: false,
        message: "比赛不存在"
      });
    }
    
    if (match.winnerId !== null) {
      return res.status(400).json({
        success: false,
        message: "已结束的比赛无法取消分配"
      });
    }
    
    // 取消分配
    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: { courtId: null },
      include: {
        teamA: true,
        teamB: true
      }
    });
    
    console.log(`取消比赛 ${matchId} 的场地分配`);
    
    res.json({
      success: true,
      message: "取消分配成功",
      data: updatedMatch
    });
    
  } catch (error) {
    console.error("取消比赛分配失败:", error);
    res.status(500).json({
      success: false,
      message: "取消分配失败",
      error: error instanceof Error ? error.message : "未知错误"
    });
  }
});

export default router;
